import { logger as defaultLogger } from '../../../globals.js';

/**
 * Create a shutdown manager for long-running commands, e.g. those running a web server.
 *
 * Cleanup functions ("closers") are registered as resources are created, and run once, in reverse order, when
 * Ctrl-C (SIGINT), SIGTERM or, on Windows, Ctrl-Break (SIGBREAK) arrives. A second signal while cleanup runs forces an
 * immediate exit.
 *
 * @param {object} [param] - Parameters.
 * @param {object} [param.processRef] - The process object. Injectable for tests.
 * @param {object} [param.logger] - Winston-style logger.
 * @param {number} [param.closerTimeoutMs] - Max time to wait for each closer.
 * @returns {{register: Function, install: Function, shutdown: Function}} The shutdown manager.
 */
export function createShutdownManager({ processRef = process, logger = defaultLogger, closerTimeoutMs = 5000 } = {}) {
    const closers = [];
    let shutdownPromise = null;
    let installed = false;

    /**
     * Register a cleanup function.
     *
     * @param {string} name - Name, used in log messages.
     * @param {Function} fn - Cleanup function. May return a promise.
     */
    const register = (name, fn) => {
        closers.push({ name, fn });
    };

    const runWithTimeout = (closer) =>
        new Promise((resolve) => {
            // Not unref'd: the bounded wait must keep the process alive, or later closers would never run
            const timer = setTimeout(() => {
                logger.warn(`Shutdown: "${closer.name}" did not finish within ${closerTimeoutMs} ms, continuing`);
                resolve();
            }, closerTimeoutMs);

            Promise.resolve()
                .then(() => closer.fn())
                .catch((err) => logger.warn(`Shutdown: "${closer.name}" failed: ${err.message}`))
                .finally(() => {
                    clearTimeout(timer);
                    resolve();
                });
        });

    /**
     * Run all closers, once, in reverse registration order.
     *
     * @param {string} [reason] - Why we are shutting down, for the log.
     * @returns {Promise<void>} Resolves when all closers have finished.
     */
    const shutdown = (reason = 'shutdown requested') => {
        if (!shutdownPromise) {
            logger.info(`Shutting down (${reason})...`);
            shutdownPromise = (async () => {
                for (const closer of [...closers].reverse()) {
                    await runWithTimeout(closer);
                }
            })();
        }
        return shutdownPromise;
    };

    /**
     * Install signal handlers. A first signal runs the closers and exits with code 0. A second signal exits at once.
     */
    const install = () => {
        if (installed) {
            return;
        }
        installed = true;

        const signals = ['SIGINT', 'SIGTERM'];
        if (processRef.platform === 'win32') {
            signals.push('SIGBREAK');
        }

        for (const signal of signals) {
            processRef.on(signal, () => {
                if (shutdownPromise) {
                    logger.warn(`Received ${signal} again, exiting immediately`);
                    processRef.exit(1);
                    return;
                }
                shutdown(signal).then(() => processRef.exit(0));
            });
        }
    };

    return { register, install, shutdown };
}
