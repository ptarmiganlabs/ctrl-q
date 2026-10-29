import { logger as defaultLogger } from '../../../globals.js';

/**
 * Create a shutdown manager for long-running commands, e.g. those running a web server.
 *
 * Cleanup functions ("closers") are registered as resources are created, and run once, in reverse order, when
 * Ctrl-C (SIGINT), SIGTERM, Ctrl-Break (SIGBREAK, Windows only) or, when output goes to a terminal, SIGHUP arrives.
 * SIGHUP is what closing the terminal window sends. A second Ctrl-C, Ctrl-Break or SIGTERM while cleanup runs forces
 * an immediate exit.
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
    let shuttingDown = false;
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
                // Not every rejection is an Error. Reading .message off undefined would throw here, and that rejection
                // would end the process before the remaining closers had run.
                .catch((err) => logger.warn(`Shutdown: "${closer.name}" failed: ${err?.message ?? err}`))
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
            shuttingDown = true;
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

        // Once the terminal window has been closed, writing to it fails, and the first use of process.stderr (or
        // stdout) blocks for good: Node then opens the terminal device, which on macOS waits for a terminal that is
        // gone. Either would keep the closers from running. So both streams are set up now, while the terminal is
        // there, and their write errors are ignored once shutdown has begun. Before that they end the process as usual.
        for (const stream of [processRef.stdout, processRef.stderr]) {
            stream?.on('error', (err) => {
                if (!shuttingDown) {
                    throw err;
                }
            });
        }

        const signals = ['SIGINT', 'SIGTERM'];
        if (processRef.platform === 'win32') {
            signals.push('SIGBREAK');
        }
        // Only with a terminal to close. Under nohup, or with output redirected, SIGHUP keeps its usual meaning.
        if (processRef.stdout?.isTTY || processRef.stderr?.isTTY) {
            signals.push('SIGHUP');
        }

        for (const signal of signals) {
            processRef.on(signal, () => {
                if (shutdownPromise) {
                    // Closing a terminal can deliver SIGHUP more than once; only a repeated Ctrl-C or kill forces the exit
                    if (signal === 'SIGHUP') {
                        return;
                    }
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
