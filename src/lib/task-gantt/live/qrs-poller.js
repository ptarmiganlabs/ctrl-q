import { isTerminalStatus } from '../model/status.js';

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const METADATA_REFRESH_MS = 10 * 60 * 1000;
// A failed metadata refresh is tried again after this, doubled with every further failure up to METADATA_REFRESH_MS.
// Executions of unknown tasks bring the refresh forward, but to no less than this after the previous one.
const METADATA_RETRY_MS = 60 * 1000;
const SESSIONS_EVERY_N_TICKS = 10;
// After an outage longer than this, live coverage is split: QRS may have dropped executions in between. Without failed
// polls, a gap this much longer than the poll interval (the computer slept, the process was paused) counts as one too.
const COVERAGE_BREAK_MS = 15 * 60 * 1000;

/**
 * Poll QRS for changed execution results and feed them into the app, one tick at a time (ticks never overlap).
 *
 * Each tick asks for results modified since the cursor (the newest modifiedDate seen). Every 10th tick, and whenever
 * something is still running, the running execution sessions are refreshed. On errors the interval backs off (x2 per
 * failure, max 5 min). HTTP 401/403 stops polling: credentials will not fix themselves.
 *
 * Task metadata is refreshed every 10 minutes, and sooner when executions of unknown tasks arrive. The refresh runs
 * alongside the polls: on a large site it can take minutes, and a failing one must not hold up the execution updates.
 * It has its own backoff, and its message shows on the QRS badge while it fails.
 *
 * @param {object} param - Parameters.
 * @param {object} param.app - The task-gantt app.
 * @param {number} param.intervalMs - Poll interval.
 * @param {object} param.logger - Winston-style logger.
 * @param {Function} param.onUpdate - Called after every tick with { changed, statusChanged }.
 * @param {Function} [param.now] - Clock.
 * @param {Function} [param.random] - Random source for backoff jitter.
 * @returns {{start: Function, stop: Function, tickNow: Function}} The poller.
 */
export function createQrsPoller({ app, intervalMs, logger, onUpdate, now = () => Date.now(), random = Math.random }) {
    let timer = null;
    let stopped = false;
    let failures = 0;
    let ticks = 0;
    let lastOkAt = now();
    let inFlight = null;
    // When the next metadata refresh is due, and the earliest an early one may run
    let nextMetaAt = now() + METADATA_REFRESH_MS;
    let earliestMetaAt = now();
    let metaFailures = 0;
    let metaInFlight = null;

    const refreshMetadata = async () => {
        try {
            const changed = await app.refreshMetadata();
            const recovered = metaFailures > 0;
            metaFailures = 0;
            nextMetaAt = now() + METADATA_REFRESH_MS;
            earliestMetaAt = now() + METADATA_RETRY_MS;
            if (recovered) app.setIssue('qrs', 'metadata', null);
            if (changed || recovered) onUpdate({ changed, statusChanged: recovered });
        } catch (err) {
            metaFailures += 1;
            const retryMs = Math.min(METADATA_REFRESH_MS, METADATA_RETRY_MS * 2 ** (metaFailures - 1));
            nextMetaAt = now() + retryMs;
            earliestMetaAt = nextMetaAt;
            // Only a message, without a state: the page reads the QRS state as the state of live updates, which still work
            app.setIssue('qrs', 'metadata', {
                message: `Task names, tags and capacity could not be refreshed (${err.reason ?? err.message}), retrying in ${Math.round(retryMs / 1000)} s`,
                hint: err.hint ?? '',
            });
            logger.warn(`Task metadata refresh failed: ${err.message}. Retrying in ${Math.round(retryMs / 1000)} s`);
            onUpdate({ changed: false, statusChanged: true });
        }
    };

    const schedule = (ms) => {
        if (stopped) return;
        timer = setTimeout(() => {
            inFlight = tick().finally(() => {
                inFlight = null;
            });
        }, ms);
        timer.unref?.();
    };

    const tick = async () => {
        if (stopped) return;
        // When this poll asks QRS: its answer holds everything that happened before. On this computer's clock, like all
        // times here; the app converts what it records to the Sense clock.
        const t = now();
        try {
            const { records, cursor } = await app.qrs.changesSince(app.cursor);
            ticks += 1;

            const anyRunning = records.some((r) => !isTerminalStatus(r.status)) || app.hasRunning();
            if (ticks % SESSIONS_EVERY_N_TICKS === 0 || anyRunning) {
                app.setRunningResultIds(await app.qrs.runningResultIds());
            }

            const changes = app.applyQrsChanges(records);
            // Only now that the records are applied: a failed tick re-reads them next time
            app.cursor = cursor;
            if (t - lastOkAt > (failures > 0 ? COVERAGE_BREAK_MS : intervalMs + COVERAGE_BREAK_MS)) {
                app.breakLiveCoverage(t);
            }
            const recovered = failures > 0;
            if (recovered) {
                app.setStatus('qrs', {
                    state: 'ok',
                    message: 'QRS keeps only the last few executions of each task',
                    hint: '',
                });
            }
            failures = 0;
            lastOkAt = t;
            // The app also keeps this as the QRS status's lastOkAt
            app.markLive(t);
            onUpdate({ changed: changes > 0, statusChanged: recovered });
            const due = now() >= nextMetaAt || (app.metadataWanted() && now() >= earliestMetaAt);
            if (due && !metaInFlight) {
                metaInFlight = refreshMetadata().finally(() => {
                    metaInFlight = null;
                });
            }
            schedule(intervalMs);
        } catch (err) {
            failures += 1;
            if (err.status === 401 || err.status === 403) {
                app.setStatus('qrs', {
                    state: 'error',
                    message: `Sense refused the request (HTTP ${err.status}). Live updates stopped.`,
                    hint: 'Check the certificate or JWT, then restart Ctrl-Q.',
                });
                logger.error(`Live updates stopped: ${err.message}`);
                onUpdate({ changed: false, statusChanged: true });
                stopped = true;
                return;
            }
            const backoff = Math.round(Math.min(MAX_BACKOFF_MS, intervalMs * 2 ** Math.min(failures, 5)) * (0.8 + random() * 0.4));
            app.setStatus('qrs', {
                state: 'degraded',
                message: `Live update failed (${err.reason ?? err.message}), retrying in ${Math.round(backoff / 1000)} s`,
                hint: err.hint ?? '',
            });
            logger.warn(`Live update failed: ${err.message}. Retrying in ${Math.round(backoff / 1000)} s`);
            onUpdate({ changed: false, statusChanged: true });
            schedule(backoff);
        }
    };

    return {
        start: () => schedule(intervalMs),
        stop: async () => {
            stopped = true;
            clearTimeout(timer);
            if (inFlight) await inFlight;
            if (metaInFlight) await metaInFlight;
        },
        // For tests: run one tick now and wait for it, and for a metadata refresh it started
        tickNow: async () => {
            clearTimeout(timer);
            await tick();
            if (metaInFlight) await metaInFlight;
        },
    };
}
