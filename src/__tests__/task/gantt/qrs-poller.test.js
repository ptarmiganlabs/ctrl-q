import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';

import { createQrsPoller } from '../../../lib/task-gantt/live/qrs-poller.js';
import { createLivePublisher } from '../../../lib/cmd/qseow/taskgantt.js';
import { STATUS } from '../../../lib/task-gantt/model/status.js';

const T0 = Date.UTC(2026, 9, 6, 12, 0, 0);
const SEC = 1000;
const MIN = 60 * SEC;
const INTERVAL = 10 * SEC;

// Let every pending promise callback run (setImmediate is left real below, so this is a true event-loop turn)
const flush = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const rec = (resultId, status = STATUS.FINISHED_SUCCESS, modifiedAt = T0) => ({ resultId, status, modifiedAt });

const httpError = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { status });

/**
 * A fake task-gantt app with the surface the poller uses. By default QRS returns nothing new and the cursor stays put.
 */
function makeApp() {
    return {
        cursor: T0 - MIN,
        qrs: {
            changesSince: jest.fn(async (cursor) => ({ records: [], cursor })),
            runningResultIds: jest.fn(async () => new Set(['res-running'])),
        },
        hasRunning: jest.fn(() => false),
        setRunningResultIds: jest.fn(),
        refreshMetadata: jest.fn(async () => false),
        metadataWanted: jest.fn(() => false),
        applyQrsChanges: jest.fn(() => 0),
        markLive: jest.fn(),
        breakLiveCoverage: jest.fn(),
        setStatus: jest.fn(),
        setIssue: jest.fn(),
    };
}

describe('createQrsPoller', () => {
    let clock;
    let randomValue;
    let pollers;
    let setTimeoutSpy;

    const makeLogger = () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), verbose: jest.fn(), debug: jest.fn() });

    const makePoller = (app, opts = {}) => {
        const onUpdate = jest.fn();
        const logger = makeLogger();
        const poller = createQrsPoller({
            app,
            intervalMs: INTERVAL,
            logger,
            onUpdate,
            now: () => clock,
            random: () => randomValue,
            ...opts,
        });
        pollers.push(poller);
        return { poller, onUpdate, logger };
    };

    // Delays of every timer the poller has scheduled so far
    const delays = () => setTimeoutSpy.mock.calls.map((call) => call[1]);

    beforeEach(() => {
        clock = T0;
        randomValue = 0.5; // jitter factor 0.8 + 0.5 * 0.4 = 1.0
        pollers = [];
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
        setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    });

    afterEach(async () => {
        for (const p of pollers) await p.stop();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('cursor and records', () => {
        test('asks QRS for changes since the app cursor and advances the cursor', async () => {
            const app = makeApp();
            app.cursor = 1000;
            app.qrs.changesSince.mockResolvedValueOnce({ records: [], cursor: 2000 }).mockResolvedValueOnce({ records: [], cursor: 3000 });
            const { poller } = makePoller(app);

            await poller.tickNow();
            expect(app.qrs.changesSince).toHaveBeenLastCalledWith(1000);
            expect(app.cursor).toBe(2000);

            await poller.tickNow();
            expect(app.qrs.changesSince).toHaveBeenLastCalledWith(2000);
            expect(app.cursor).toBe(3000);
        });

        test('hands the fetched records to the app and marks it live at the tick time', async () => {
            const app = makeApp();
            const records = [rec('a'), rec('b', STATUS.FINISHED_FAIL)];
            app.qrs.changesSince.mockResolvedValueOnce({ records, cursor: T0 });
            const { poller } = makePoller(app);

            clock = T0 + 5 * SEC;
            await poller.tickNow();

            expect(app.applyQrsChanges).toHaveBeenCalledWith(records);
            expect(app.markLive).toHaveBeenCalledWith(T0 + 5 * SEC);
            // The state was already ok. The app records the time of the good poll itself, on the Sense clock (markLive).
            expect(app.setStatus).not.toHaveBeenCalled();
        });

        test('a successful tick schedules the next one after the normal interval', async () => {
            const { poller } = makePoller(makeApp());

            await poller.tickNow();

            expect(delays()).toEqual([INTERVAL]);
            expect(jest.getTimerCount()).toBe(1);
        });
    });

    describe('running sessions', () => {
        test('are refreshed on every 10th tick when nothing runs', async () => {
            const app = makeApp();
            const { poller } = makePoller(app);
            const refreshedOnTick = [];

            for (let i = 1; i <= 25; i++) {
                const before = app.qrs.runningResultIds.mock.calls.length;
                await poller.tickNow();
                if (app.qrs.runningResultIds.mock.calls.length > before) refreshedOnTick.push(i);
            }

            expect(refreshedOnTick).toEqual([10, 20]);
            expect(app.setRunningResultIds).toHaveBeenCalledTimes(2);
            expect(app.setRunningResultIds).toHaveBeenLastCalledWith(new Set(['res-running']));
        });

        test.each([
            ['Triggered', STATUS.TRIGGERED],
            ['Started', STATUS.STARTED],
            ['Queued', STATUS.QUEUED],
        ])('are refreshed at once when a fetched record is %s', async (_name, status) => {
            const app = makeApp();
            app.qrs.changesSince.mockResolvedValueOnce({ records: [rec('done'), rec('busy', status)], cursor: T0 });
            const { poller } = makePoller(app);

            await poller.tickNow();

            expect(app.qrs.runningResultIds).toHaveBeenCalledTimes(1);
            expect(app.setRunningResultIds).toHaveBeenCalledWith(new Set(['res-running']));
        });

        test.each([
            ['Aborted', STATUS.ABORTED],
            ['FinishedSuccess', STATUS.FINISHED_SUCCESS],
            ['FinishedFail', STATUS.FINISHED_FAIL],
            ['Skipped', STATUS.SKIPPED],
            ['Error', STATUS.ERROR],
        ])('are not refreshed early for a finished (%s) record', async (_name, status) => {
            const app = makeApp();
            app.qrs.changesSince.mockResolvedValueOnce({ records: [rec('x', status)], cursor: T0 });
            const { poller } = makePoller(app);

            await poller.tickNow();

            expect(app.qrs.runningResultIds).not.toHaveBeenCalled();
            expect(app.setRunningResultIds).not.toHaveBeenCalled();
        });

        test('are refreshed on every tick while the app still has a running execution', async () => {
            const app = makeApp();
            app.hasRunning.mockReturnValue(true);
            const { poller } = makePoller(app);

            await poller.tickNow();
            await poller.tickNow();
            await poller.tickNow();
            expect(app.qrs.runningResultIds).toHaveBeenCalledTimes(3);

            // Once nothing runs any more the refresh drops back to every 10th tick
            app.hasRunning.mockReturnValue(false);
            await poller.tickNow();
            expect(app.qrs.runningResultIds).toHaveBeenCalledTimes(3);
        });

        test('are refreshed before the records are applied, so the app sees fresh sessions', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockResolvedValueOnce({ records: [rec('busy', STATUS.STARTED)], cursor: T0 });
            const { poller } = makePoller(app);

            await poller.tickNow();

            expect(app.setRunningResultIds.mock.invocationCallOrder[0]).toBeLessThan(app.applyQrsChanges.mock.invocationCallOrder[0]);
        });
    });

    describe('task metadata', () => {
        test('is refreshed 10 minutes after the poller started, then every 10 minutes', async () => {
            const app = makeApp();
            const { poller } = makePoller(app);

            clock = T0 + 10 * MIN - 1;
            await poller.tickNow();
            expect(app.refreshMetadata).not.toHaveBeenCalled();

            clock = T0 + 10 * MIN;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);

            clock = T0 + 15 * MIN;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);

            clock = T0 + 20 * MIN;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(2);
        });

        test('a metadata change is reported as a change even when no execution changed', async () => {
            const app = makeApp();
            app.refreshMetadata.mockResolvedValue(true);
            const { poller, onUpdate } = makePoller(app);

            clock = T0 + 10 * MIN;
            await poller.tickNow();

            expect(onUpdate).toHaveBeenLastCalledWith({ changed: true, statusChanged: false });
        });

        test('unchanged metadata and no execution changes are reported as no change', async () => {
            const app = makeApp();
            const { poller, onUpdate } = makePoller(app);

            clock = T0 + 10 * MIN;
            await poller.tickNow();

            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);
            expect(onUpdate).toHaveBeenLastCalledWith({ changed: false, statusChanged: false });
        });

        test('a failing refresh does not hold up the execution updates; it shows on the QRS badge and has its own backoff', async () => {
            const app = makeApp();
            const timeout = Object.assign(new Error('QRS GET /qrs/task/full on h:4242 failed: ECONNABORTED: timeout. Check it'), {
                reason: 'ECONNABORTED: timeout',
                hint: 'Check it',
            });
            app.refreshMetadata.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout).mockResolvedValue(false);
            const records = [rec('a')];
            app.qrs.changesSince.mockResolvedValue({ records, cursor: T0 });
            const { poller, onUpdate, logger } = makePoller(app);
            const refreshes = () => app.refreshMetadata.mock.calls.length;

            clock = T0 + 10 * MIN;
            await poller.tickNow();

            // The poll itself went through as usual
            expect(app.applyQrsChanges).toHaveBeenCalledWith(records);
            expect(app.markLive).toHaveBeenCalledWith(T0 + 10 * MIN);
            expect(delays()).toEqual([INTERVAL]);
            expect(app.setStatus).not.toHaveBeenCalled();
            // A message only: the QRS state is the state of live updates, which still work
            expect(app.setIssue).toHaveBeenCalledWith('qrs', 'metadata', {
                message: 'Task names, tags and capacity could not be refreshed (ECONNABORTED: timeout), retrying in 60 s',
                hint: 'Check it',
            });
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Task metadata refresh failed'));
            expect(onUpdate).toHaveBeenLastCalledWith({ changed: false, statusChanged: true });

            // Retried after a minute, then after two
            clock = T0 + 10 * MIN + 30 * SEC;
            await poller.tickNow();
            expect(refreshes()).toBe(1);
            clock = T0 + 11 * MIN;
            await poller.tickNow();
            expect(refreshes()).toBe(2);
            expect(app.setIssue).toHaveBeenLastCalledWith(
                'qrs',
                'metadata',
                expect.objectContaining({ message: expect.stringContaining('retrying in 120 s') })
            );
            clock = T0 + 12 * MIN;
            await poller.tickNow();
            expect(refreshes()).toBe(2);
            clock = T0 + 13 * MIN;
            await poller.tickNow();
            expect(refreshes()).toBe(3);
            expect(app.setIssue).toHaveBeenLastCalledWith('qrs', 'metadata', null);
            expect(onUpdate).toHaveBeenLastCalledWith({ changed: false, statusChanged: true });

            // Then every 10 minutes again
            clock = T0 + 22 * MIN;
            await poller.tickNow();
            expect(refreshes()).toBe(3);
            clock = T0 + 23 * MIN;
            await poller.tickNow();
            expect(refreshes()).toBe(4);
            // Every one of the 7 polls applied its records
            expect(app.applyQrsChanges).toHaveBeenCalledTimes(7);
        });

        test('a refresh and a poll that reject with nothing at all are reported, and polling carries on', async () => {
            // Reading .message, .reason, .hint or .status off undefined would throw inside the error handling
            const app = makeApp();
            app.refreshMetadata.mockRejectedValueOnce(undefined);
            app.qrs.changesSince.mockRejectedValueOnce(undefined);
            const { poller, logger } = makePoller(app);

            // The poll fails
            clock = T0 + 10 * MIN;
            await expect(poller.tickNow()).resolves.toBeUndefined();
            expect(app.setStatus).toHaveBeenCalledWith(
                'qrs',
                expect.objectContaining({ state: 'degraded', message: expect.stringContaining('(undefined)') })
            );
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Live update failed: undefined'));

            // The next poll goes through, and the metadata refresh it starts fails
            clock = T0 + 10 * MIN + 30 * SEC;
            await poller.tickNow();
            await flush();
            expect(app.markLive).toHaveBeenCalledWith(T0 + 10 * MIN + 30 * SEC);
            expect(app.setIssue).toHaveBeenCalledWith(
                'qrs',
                'metadata',
                expect.objectContaining({ message: expect.stringContaining('(undefined)') })
            );
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Task metadata refresh failed: undefined'));
        });

        test('a slow refresh runs alongside the polls, which carry on at their interval', async () => {
            const app = makeApp();
            const slow = deferred();
            app.refreshMetadata.mockReturnValueOnce(slow.promise);
            const { poller, onUpdate } = makePoller(app);

            clock = T0 + 10 * MIN;
            poller.start();
            jest.advanceTimersByTime(INTERVAL);
            await flush();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(INTERVAL);
            await flush();
            jest.advanceTimersByTime(INTERVAL);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(3);
            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);

            slow.resolve(true);
            await flush();
            expect(onUpdate).toHaveBeenLastCalledWith({ changed: true, statusChanged: false });
        });

        test('executions of tasks the metadata does not know bring the refresh forward, but not closer than a minute', async () => {
            const app = makeApp();
            app.metadataWanted.mockReturnValue(true);
            const { poller } = makePoller(app);

            clock = T0 + 10 * SEC;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);

            clock = T0 + 40 * SEC;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(1);
            clock = T0 + 70 * SEC;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(2);

            // Known again: back to every 10 minutes
            app.metadataWanted.mockReturnValue(false);
            clock = T0 + 5 * MIN;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(2);
            clock = T0 + 70 * SEC + 10 * MIN;
            await poller.tickNow();
            expect(app.refreshMetadata).toHaveBeenCalledTimes(3);
        });
    });

    describe('onUpdate', () => {
        test('reports changed when the app applied at least one change', async () => {
            const app = makeApp();
            app.applyQrsChanges.mockReturnValueOnce(2).mockReturnValueOnce(0);
            const { poller, onUpdate } = makePoller(app);

            await poller.tickNow();
            await poller.tickNow();

            expect(onUpdate.mock.calls.map((c) => c[0])).toEqual([
                { changed: true, statusChanged: false },
                { changed: false, statusChanged: false },
            ]);
        });

        test('reports a status change on failure and on the first good tick after it, not later', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValueOnce(new Error('socket hang up'));
            app.applyQrsChanges.mockReturnValue(0);
            const { poller, onUpdate } = makePoller(app);

            await poller.tickNow(); // fails
            await poller.tickNow(); // recovers
            await poller.tickNow(); // steady

            expect(onUpdate.mock.calls.map((c) => c[0])).toEqual([
                { changed: false, statusChanged: true },
                { changed: false, statusChanged: true },
                { changed: false, statusChanged: false },
            ]);
        });

        // BUG: after a transient failure the QRS source status stays 'degraded' ("retrying in N s") for good, because
        // nothing sets it back to ok when polling recovers. The page badge keeps showing the outage.
        test('sets the QRS status back to ok when polling recovers', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValueOnce(new Error('socket hang up'));
            const { poller } = makePoller(app);

            await poller.tickNow();
            expect(app.setStatus).toHaveBeenLastCalledWith('qrs', expect.objectContaining({ state: 'degraded' }));

            clock = T0 + 30 * SEC;
            await poller.tickNow();
            expect(app.setStatus).toHaveBeenLastCalledWith('qrs', expect.objectContaining({ state: 'ok', hint: '' }));
            expect(app.markLive).toHaveBeenLastCalledWith(T0 + 30 * SEC);
        });
    });

    describe('errors and backoff', () => {
        test('a failed tick marks QRS degraded, logs a warning and leaves the app untouched', async () => {
            const app = makeApp();
            const cursorBefore = app.cursor;
            app.qrs.changesSince.mockRejectedValueOnce(new Error('ECONNRESET'));
            const { poller, onUpdate, logger } = makePoller(app);

            await poller.tickNow();

            expect(app.setStatus).toHaveBeenCalledTimes(1);
            expect(app.setStatus).toHaveBeenCalledWith('qrs', {
                state: 'degraded',
                message: 'Live update failed (ECONNRESET), retrying in 20 s',
                hint: '',
            });
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
            expect(logger.error).not.toHaveBeenCalled();
            expect(onUpdate).toHaveBeenCalledWith({ changed: false, statusChanged: true });
            expect(app.cursor).toBe(cursorBefore);
            expect(app.applyQrsChanges).not.toHaveBeenCalled();
            expect(app.markLive).not.toHaveBeenCalled();
        });

        test.each([500, 502, 503, 404])('HTTP %i is retried, not treated as fatal', async (status) => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValueOnce(httpError(status));
            const { poller } = makePoller(app);

            await poller.tickNow();

            expect(app.setStatus).toHaveBeenCalledWith('qrs', expect.objectContaining({ state: 'degraded' }));
            expect(jest.getTimerCount()).toBe(1);
        });

        test('the retry delay doubles with every failure and is capped at 5 minutes', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValue(new Error('down'));
            const { poller } = makePoller(app);

            for (let i = 0; i < 8; i++) await poller.tickNow();

            expect(delays()).toEqual([20 * SEC, 40 * SEC, 80 * SEC, 160 * SEC, 5 * MIN, 5 * MIN, 5 * MIN, 5 * MIN]);
            expect(app.setStatus).toHaveBeenLastCalledWith(
                'qrs',
                expect.objectContaining({ message: expect.stringContaining('retrying in 300 s') })
            );
            // Only ever one pending timer: retries never pile up
            expect(jest.getTimerCount()).toBe(1);
        });

        test('with a long poll interval the cap applies from the first failure', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValue(new Error('down'));
            const { poller } = makePoller(app, { intervalMs: 4 * MIN });

            await poller.tickNow();

            expect(delays()).toEqual([5 * MIN]);
        });

        test.each([
            [0, 16 * SEC], // 0.8x
            [0.25, 18 * SEC], // 0.9x
            [0.5, 20 * SEC], // 1.0x
            [0.75, 22 * SEC], // 1.1x
            [0.999999, 24 * SEC], // just under 1.2x, rounded
        ])('jitter: random() = %d gives a first retry after %i ms', async (r, expected) => {
            randomValue = r;
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValue(new Error('down'));
            const { poller } = makePoller(app);

            await poller.tickNow();

            expect(delays()).toEqual([expected]);
        });

        test('jitter stays within 0.8x-1.2x of the capped delay', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValue(new Error('down'));
            const { poller } = makePoller(app);

            for (let i = 0; i < 5; i++) await poller.tickNow(); // reach the cap
            randomValue = 0;
            await poller.tickNow();
            randomValue = 0.999999;
            await poller.tickNow();

            const [low, high] = delays().slice(-2);
            expect(low).toBe(0.8 * 5 * MIN);
            expect(high).toBeLessThanOrEqual(1.2 * 5 * MIN);
            expect(high).toBeGreaterThan(1.19 * 5 * MIN);
        });

        test('a successful tick resets the backoff', async () => {
            const app = makeApp();
            app.qrs.changesSince
                .mockRejectedValueOnce(new Error('down'))
                .mockRejectedValueOnce(new Error('down'))
                .mockResolvedValueOnce({ records: [], cursor: T0 })
                .mockRejectedValueOnce(new Error('down again'));
            const { poller } = makePoller(app);

            for (let i = 0; i < 4; i++) await poller.tickNow();

            expect(delays()).toEqual([20 * SEC, 40 * SEC, INTERVAL, 20 * SEC]);
        });

        test('a failure in the session refresh is handled like any other failure', async () => {
            const app = makeApp();
            app.hasRunning.mockReturnValue(true);
            app.qrs.runningResultIds.mockRejectedValueOnce(new Error('sessions unavailable'));
            const { poller, onUpdate } = makePoller(app);

            await poller.tickNow();

            expect(app.setStatus).toHaveBeenCalledWith('qrs', expect.objectContaining({ state: 'degraded' }));
            expect(onUpdate).toHaveBeenCalledWith({ changed: false, statusChanged: true });
            expect(delays()).toEqual([20 * SEC]);
        });

        test('driven by its own timer, the retry fires after the backoff delay and not before', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValue(new Error('down'));
            const { poller } = makePoller(app);

            poller.start();
            jest.advanceTimersByTime(INTERVAL);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(20 * SEC - 1);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(1);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(2);

            jest.advanceTimersByTime(40 * SEC);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(3);
        });
    });

    describe('authentication errors', () => {
        test.each([401, 403])('HTTP %i sets an error status and stops polling for good', async (status) => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValue(httpError(status));
            const { poller, onUpdate, logger } = makePoller(app);

            poller.start();
            jest.advanceTimersByTime(INTERVAL);
            await flush();

            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);
            expect(app.setStatus).toHaveBeenCalledWith('qrs', {
                state: 'error',
                message: `Sense refused the request (HTTP ${status}). Live updates stopped.`,
                hint: 'Check the certificate or JWT, then restart Ctrl-Q.',
            });
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`status code ${status}`));
            expect(logger.warn).not.toHaveBeenCalled();
            expect(onUpdate).toHaveBeenCalledWith({ changed: false, statusChanged: true });

            // No retry is scheduled, and neither start() nor tickNow() bring polling back
            expect(jest.getTimerCount()).toBe(0);
            poller.start();
            expect(jest.getTimerCount()).toBe(0);
            await poller.tickNow();
            jest.advanceTimersByTime(60 * MIN);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);
            expect(app.setStatus).toHaveBeenCalledTimes(1);
        });

        test('an auth error after earlier transient failures still stops polling', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValueOnce(new Error('timeout')).mockRejectedValueOnce(httpError(401));
            const { poller } = makePoller(app);

            await poller.tickNow();
            expect(jest.getTimerCount()).toBe(1);
            await poller.tickNow();

            expect(app.setStatus).toHaveBeenLastCalledWith('qrs', expect.objectContaining({ state: 'error' }));
            expect(jest.getTimerCount()).toBe(0);
        });
    });

    describe('outages', () => {
        test('an outage longer than 15 minutes splits live coverage at the last good tick', async () => {
            const app = makeApp();
            app.qrs.changesSince
                .mockResolvedValueOnce({ records: [], cursor: T0 })
                .mockRejectedValueOnce(new Error('down'))
                .mockRejectedValueOnce(new Error('down'))
                .mockResolvedValue({ records: [], cursor: T0 });
            const { poller } = makePoller(app);

            clock = T0 + 2 * MIN;
            await poller.tickNow(); // last good tick
            clock = T0 + 3 * MIN;
            await poller.tickNow();
            clock = T0 + 10 * MIN;
            await poller.tickNow();
            clock = T0 + 17 * MIN + 1;
            await poller.tickNow(); // recovers 15 min + 1 ms after the last good tick

            expect(app.breakLiveCoverage).toHaveBeenCalledTimes(1);
            expect(app.breakLiveCoverage).toHaveBeenCalledWith(T0 + 17 * MIN + 1);
            // The new live range must start after the split, so the split comes first
            expect(app.markLive).toHaveBeenLastCalledWith(T0 + 17 * MIN + 1);
            expect(app.breakLiveCoverage.mock.invocationCallOrder[0]).toBeLessThan(app.markLive.mock.invocationCallOrder.at(-1));

            // Later good ticks do not split again
            clock = T0 + 18 * MIN;
            await poller.tickNow();
            expect(app.breakLiveCoverage).toHaveBeenCalledTimes(1);
        });

        test('an outage of exactly 15 minutes keeps live coverage whole', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockResolvedValueOnce({ records: [], cursor: T0 }).mockRejectedValueOnce(new Error('down'));
            const { poller } = makePoller(app);

            await poller.tickNow();
            clock = T0 + 1 * MIN;
            await poller.tickNow();
            clock = T0 + 15 * MIN;
            await poller.tickNow();

            expect(app.breakLiveCoverage).not.toHaveBeenCalled();
            expect(app.markLive).toHaveBeenLastCalledWith(T0 + 15 * MIN);
        });

        test('when the very first tick fails, the outage counts from when the poller was created', async () => {
            const app = makeApp();
            app.qrs.changesSince.mockRejectedValueOnce(new Error('down'));
            const { poller } = makePoller(app); // created at T0

            clock = T0 + 1 * MIN;
            await poller.tickNow();
            clock = T0 + 16 * MIN;
            await poller.tickNow();

            expect(app.breakLiveCoverage).toHaveBeenCalledWith(T0 + 16 * MIN);
        });

        test('a QRS error shows its short reason in the status, and its hint as the hint', async () => {
            const app = makeApp();
            const err = Object.assign(new Error('QRS GET /qrs/executionresult/full on h:4242 failed: HTTP 503. Check it'), {
                status: 503,
                reason: 'HTTP 503',
                hint: 'Check it',
            });
            app.qrs.changesSince.mockRejectedValueOnce(err);
            const { poller } = makePoller(app);

            await poller.tickNow();

            expect(app.setStatus).toHaveBeenCalledWith('qrs', {
                state: 'degraded',
                message: 'Live update failed (HTTP 503), retrying in 20 s',
                hint: 'Check it',
            });
        });

        test('a gap between good ticks of more than the interval plus 15 minutes (the computer slept) splits coverage', async () => {
            const app = makeApp();
            const { poller } = makePoller(app);

            await poller.tickNow();
            clock = T0 + 30 * MIN;
            await poller.tickNow();

            expect(app.breakLiveCoverage).toHaveBeenCalledWith(T0 + 30 * MIN);
        });

        test('without failures, a gap up to the poll interval plus 15 minutes keeps coverage whole (long poll intervals)', async () => {
            const app = makeApp();
            const { poller } = makePoller(app, { intervalMs: 30 * MIN });

            await poller.tickNow();
            clock = T0 + 45 * MIN;
            await poller.tickNow();
            expect(app.breakLiveCoverage).not.toHaveBeenCalled();

            clock = T0 + 90 * MIN + 1;
            await poller.tickNow();
            expect(app.breakLiveCoverage).toHaveBeenCalledWith(T0 + 90 * MIN + 1);
        });
    });

    describe('start and stop', () => {
        test('start() runs the first tick one interval later, then keeps polling at the interval', async () => {
            const app = makeApp();
            const { poller } = makePoller(app);

            poller.start();
            jest.advanceTimersByTime(INTERVAL - 1);
            await flush();
            expect(app.qrs.changesSince).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(INTERVAL);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(2);
            expect(jest.getTimerCount()).toBe(1);
        });

        test('stop() before the first tick means QRS is never polled', async () => {
            const app = makeApp();
            const { poller } = makePoller(app);

            poller.start();
            await poller.stop();
            jest.advanceTimersByTime(60 * MIN);
            await flush();

            expect(app.qrs.changesSince).not.toHaveBeenCalled();
            expect(jest.getTimerCount()).toBe(0);
        });

        test('stop() waits for an in-flight tick to finish and schedules nothing after it', async () => {
            const app = makeApp();
            const pending = deferred();
            app.qrs.changesSince.mockReturnValueOnce(pending.promise);
            const { poller, onUpdate } = makePoller(app);

            poller.start();
            jest.advanceTimersByTime(INTERVAL);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);

            let stopped = false;
            const stopping = poller.stop().then(() => {
                stopped = true;
            });
            await flush();
            expect(stopped).toBe(false);

            pending.resolve({ records: [rec('a')], cursor: T0 });
            await stopping;

            expect(stopped).toBe(true);
            expect(app.applyQrsChanges).toHaveBeenCalledWith([rec('a')]);
            expect(onUpdate).toHaveBeenCalledTimes(1);
            expect(jest.getTimerCount()).toBe(0);

            jest.advanceTimersByTime(60 * MIN);
            await flush();
            expect(app.qrs.changesSince).toHaveBeenCalledTimes(1);
        });

        test('stop() waits for an in-flight tick that fails, and no retry is scheduled', async () => {
            const app = makeApp();
            const pending = deferred();
            app.qrs.changesSince.mockReturnValueOnce(pending.promise);
            const { poller } = makePoller(app);

            poller.start();
            jest.advanceTimersByTime(INTERVAL);
            await flush();

            const stopping = poller.stop();
            pending.reject(new Error('down'));
            await expect(stopping).resolves.toBeUndefined();

            expect(jest.getTimerCount()).toBe(0);
        });

        test('stop() resolves at once when no tick is running', async () => {
            const { poller } = makePoller(makeApp());

            poller.start();
            await expect(poller.stop()).resolves.toBeUndefined();
            expect(jest.getTimerCount()).toBe(0);
        });
    });

    describe('changes are not lost when a later step of the tick fails', () => {
        // A fake QRS that behaves like qrs-source.changesSince: results modified after (cursor - 5 s overlap), and the
        // new cursor is the newest modifiedAt seen.
        const fakeQrsChanges = (serverRecords) => async (cursor) => {
            const records = serverRecords.filter((r) => r.modifiedAt > cursor - 5 * SEC);
            const next = records.reduce((m, r) => Math.max(m, r.modifiedAt), cursor);
            return { records, cursor: next };
        };

        // BUG: the cursor is advanced before the session/metadata refresh. If that refresh throws, the tick's records
        // are never applied, and the next tick only re-reads the last 5 s before the advanced cursor. An execution
        // that finished earlier in that batch is lost (it stays "running" on the page until it goes stale).
        test.each(['runningResultIds', 'refreshMetadata'])('a failing %s does not drop the fetched records', async (step) => {
            const app = makeApp();
            app.cursor = T0 - 60 * SEC;
            app.qrs.changesSince.mockImplementation(
                fakeQrsChanges([rec('finished-earlier', STATUS.FINISHED_SUCCESS, T0 - 30 * SEC), rec('just-started', STATUS.STARTED, T0)])
            );
            const { poller } = makePoller(app);
            if (step === 'runningResultIds') {
                app.qrs.runningResultIds.mockRejectedValueOnce(new Error('sessions unavailable'));
            } else {
                app.refreshMetadata.mockRejectedValueOnce(new Error('metadata unavailable'));
                clock = T0 + 10 * MIN; // metadata is due
            }

            await poller.tickNow(); // fails part-way
            await poller.tickNow(); // recovers

            const applied = new Set(app.applyQrsChanges.mock.calls.flatMap(([records]) => records.map((r) => r.resultId)));
            expect(applied).toEqual(new Set(['finished-earlier', 'just-started']));
        });
    });
});

describe('createLivePublisher', () => {
    const START = Date.UTC(2026, 9, 6, 12, 0, 0);

    const emptyDelta = (rev) => ({ rev, prevRev: rev, cols: { key: [] }, removed: [], lanes: [] });

    function makePublisherApp() {
        let rev = 1;
        let next = null;
        let payloads = 0;
        return {
            // The delta the next drainDelta() returns; afterwards the app has nothing new until the next queue()
            queue(delta) {
                next = delta;
            },
            drainDelta: jest.fn(() => {
                const d = next ?? emptyDelta(rev);
                next = null;
                rev = d.rev;
                return d;
            }),
            analyticsPayload: jest.fn(() => {
                payloads += 1;
                return { rev, payload: payloads };
            }),
            liveStatus: jest.fn(() => ({ rev, coveredTo: Date.now() })),
        };
    }

    const makeSse = (clients = 1) => {
        const sent = [];
        return {
            sent,
            clients,
            clientCount() {
                return this.clients;
            },
            broadcast: jest.fn((event, data, id) => sent.push({ event, data, id, at: Date.now() })),
        };
    };

    const events = (sse, name) => sse.sent.filter((s) => s.event === name);

    beforeEach(() => {
        jest.useFakeTimers({ now: START });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('deltas', () => {
        test.each([
            ['changed records', { rev: 7, prevRev: 6, cols: { key: ['r:1', 'r:2'] }, removed: [], lanes: [] }],
            ['removed records', { rev: 8, prevRev: 7, cols: { key: [] }, removed: ['r:3'], lanes: [] }],
            ['changed lanes', { rev: 9, prevRev: 8, cols: { key: [] }, removed: [], lanes: [{ id: 'task-1' }] }],
        ])('a delta with %s is broadcast at once, with its revision as the event id', (_name, delta) => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            app.queue(delta);
            publish({ changed: true, statusChanged: false });

            expect(events(sse, 'delta')).toEqual([{ event: 'delta', data: delta, id: delta.rev, at: START }]);
        });

        test('an empty delta is drained but not broadcast', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            publish({ changed: false, statusChanged: false });
            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(60 * SEC);

            expect(app.drainDelta).toHaveBeenCalledTimes(2);
            expect(events(sse, 'delta')).toEqual([]);
        });

        test('a delta that only moves the revision (changes of hidden tasks) is broadcast, so pages stay in step', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);
            const delta = { rev: 2, prevRev: 1, cols: { key: [] }, removed: [], lanes: [] };

            app.queue(delta);
            publish({ changed: true, statusChanged: false });

            expect(events(sse, 'delta')).toEqual([{ event: 'delta', data: delta, id: 2, at: START }]);
        });

        test('a delta that only adds node names is broadcast', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);
            const delta = { rev: 1, prevRev: 1, cols: { key: [] }, removed: [], lanes: [], nodes: ['node1', 'node2'] };

            app.queue(delta);
            publish({ changed: true, statusChanged: false });

            expect(events(sse, 'delta').map((e) => e.data)).toEqual([delta]);
        });

        test('deltas are never throttled', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            for (let rev = 2; rev <= 6; rev++) {
                app.queue({ rev, prevRev: rev - 1, cols: { key: [`r:${rev}`] }, removed: [], lanes: [] });
                publish({ changed: true, statusChanged: false });
                jest.advanceTimersByTime(100);
            }

            expect(events(sse, 'delta').map((e) => e.id)).toEqual([2, 3, 4, 5, 6]);
        });
    });

    describe('live status', () => {
        test('every update ends with a live event (no event id), after the delta of that update', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            app.queue({ rev: 2, prevRev: 1, cols: { key: ['r:1'] }, removed: [], lanes: [] });
            publish({ changed: true, statusChanged: false });
            publish({ changed: false, statusChanged: false });
            publish({ changed: false, statusChanged: true });

            expect(sse.sent.filter((s) => s.event !== 'analytics').map((s) => s.event)).toEqual(['delta', 'live', 'live', 'live']);
            expect(events(sse, 'live')[0]).toEqual({ event: 'live', data: { rev: 2, coveredTo: START }, id: undefined, at: START });
        });

        test('with no page connected, neither live events nor analytics are computed', () => {
            const app = makePublisherApp();
            const sse = makeSse(0);
            const publish = createLivePublisher(app, sse);

            publish({ changed: true, statusChanged: true });
            jest.advanceTimersByTime(60 * SEC);

            expect(app.liveStatus).not.toHaveBeenCalled();
            expect(app.analyticsPayload).not.toHaveBeenCalled();
            expect(sse.sent.filter((s) => s.event !== 'delta')).toEqual([]);

            // A page connects: the next change is published again
            sse.clients = 1;
            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(0);
            expect(events(sse, 'analytics')).toHaveLength(1);
            expect(events(sse, 'live')).toHaveLength(1);
        });
    });

    describe('analytics', () => {
        test('are not published when nothing changed', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            publish({ changed: false, statusChanged: false });
            jest.advanceTimersByTime(60 * SEC);

            expect(events(sse, 'analytics')).toEqual([]);
            expect(app.analyticsPayload).not.toHaveBeenCalled();
        });

        test.each([
            ['an execution change', { changed: true, statusChanged: false }],
            ['a status change', { changed: false, statusChanged: true }],
        ])('the first update after start-up publishes analytics without waiting, for %s', (_name, flags) => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            publish(flags);
            jest.advanceTimersByTime(0);

            expect(events(sse, 'analytics')).toEqual([{ event: 'analytics', data: { rev: 1, payload: 1 }, id: undefined, at: START }]);
        });

        test('a change within 5 s of the last publish waits for the rest of the 5 s, and a burst is coalesced', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(0);
            expect(events(sse, 'analytics')).toHaveLength(1);

            jest.advanceTimersByTime(1000);
            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(1000);
            publish({ changed: false, statusChanged: true });
            jest.advanceTimersByTime(1000);
            publish({ changed: true, statusChanged: false });

            jest.advanceTimersByTime(1999); // 4999 ms after the first publish
            expect(events(sse, 'analytics')).toHaveLength(1);

            jest.advanceTimersByTime(1); // 5000 ms
            const sent = events(sse, 'analytics');
            expect(sent).toHaveLength(2);
            expect(sent[1].at).toBe(START + 5000);
            // The payload is built when it is sent, so it reflects the whole burst
            expect(app.analyticsPayload).toHaveBeenCalledTimes(2);
            expect(sent[1].data.payload).toBe(2);

            jest.advanceTimersByTime(60 * SEC);
            expect(events(sse, 'analytics')).toHaveLength(2);
        });

        test('after a quiet spell of 5 s or more, the next change is published at once', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(0);
            jest.advanceTimersByTime(7000);
            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(0);

            expect(events(sse, 'analytics').map((e) => e.at)).toEqual([START, START + 7000]);
        });

        test('a steady stream of changes publishes at most every 5 s, and the last change is not left behind', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);
            let lastChangeAt = 0;

            for (let i = 0; i < 30; i++) {
                publish({ changed: true, statusChanged: false });
                lastChangeAt = Date.now();
                jest.advanceTimersByTime(1000);
            }
            jest.advanceTimersByTime(5000);

            const times = events(sse, 'analytics').map((e) => e.at);
            for (let i = 1; i < times.length; i++) {
                expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(5000);
            }
            expect(times.length).toBeGreaterThanOrEqual(6);
            expect(times.length).toBeLessThanOrEqual(7);
            expect(times.at(-1)).toBeGreaterThanOrEqual(lastChangeAt);
        });

        test('analytics are broadcast without an event id', () => {
            const app = makePublisherApp();
            const sse = makeSse();
            const publish = createLivePublisher(app, sse);

            publish({ changed: true, statusChanged: false });
            jest.advanceTimersByTime(0);

            expect(sse.broadcast).toHaveBeenCalledWith('analytics', { rev: 1, payload: 1 });
        });
    });
});
