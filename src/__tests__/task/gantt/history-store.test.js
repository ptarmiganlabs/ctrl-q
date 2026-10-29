import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createHistoryStore, hostSlug, utcDay, recordToLine, lineToRecord } from '../../../lib/task-gantt/store/history-store.js';
import { SOURCE, SOURCE_BIT } from '../../../lib/task-gantt/defaults.js';

const silent = { error() {}, warn() {}, info() {}, verbose() {}, debug() {} };
const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const DAY = 86400000;

const rec = (over = {}) => ({
    key: `r:${over.resultId || 'res-1'}`,
    resultId: 'res-1',
    executionId: 'exe-1',
    taskId: 'task-1',
    taskType: 0,
    appId: 'app-1',
    nodeName: 'node1',
    status: 7,
    triggeredAt: NOW - 3600000,
    queuedAt: null,
    startedAt: NOW - 3599000,
    stoppedAt: NOW - 3500000,
    finishedAt: NOW - 3500100,
    failureReason: null,
    src: SOURCE_BIT[SOURCE.QRS],
    confidence: 'exact',
    modifiedAt: NOW - 3500000,
    ...over,
});

let dir;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrlq-history-'));
});
afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
});

const make = (over = {}) =>
    createHistoryStore({
        dir,
        host: 'Sense.Example.com',
        clusterId: 'cluster-1',
        retentionDays: 90,
        logger: silent,
        now: () => NOW,
        hostname: 'this-computer',
        ...over,
    });

const MIN = 60000;
const lockFile = (base = dir) => path.join(base, 'sense.example.com', '.lock');
const readLock = (base = dir) => JSON.parse(fs.readFileSync(lockFile(base), 'utf8'));

// Write a lock as another instance would, last refreshed some time before NOW
const writeLock = (holder, { refreshedAgo = 0, base = dir } = {}) => {
    fs.mkdirSync(path.dirname(lockFile(base)), { recursive: true });
    fs.writeFileSync(lockFile(base), JSON.stringify({ token: 'their-token', since: new Date(NOW - DAY).toISOString(), ...holder }));
    const t = new Date(NOW - refreshedAgo);
    fs.utimesSync(lockFile(base), t, t);
};

describe('helpers', () => {
    test('hostSlug and utcDay', () => {
        expect(hostSlug('Sense.Example.com')).toBe('sense.example.com');
        expect(hostSlug('a/b\\c:d')).toBe('a_b_c_d');
        expect(hostSlug('..')).toBe('_');
        expect(hostSlug('')).toBe('unknown');
        expect(utcDay(NOW)).toBe('2026-10-06');
    });

    test('records survive the round trip through a history line', () => {
        const back = lineToRecord(JSON.parse(JSON.stringify(recordToLine(rec()))));

        expect(back).toMatchObject({ ...rec(), src: SOURCE_BIT[SOURCE.HISTORY], modifiedAt: null });
        expect(lineToRecord({ t: 'r', task: 't' })).toBeNull();
    });
});

describe('createHistoryStore', () => {
    test('writes daily files with a header and reads them back', async () => {
        const store = make();
        expect((await store.open()).mode).toBe('readwrite');
        store.appendRecords([
            rec(),
            rec({ resultId: 'res-2', triggeredAt: NOW - 2 * DAY, startedAt: NOW - 2 * DAY, stoppedAt: NOW - 2 * DAY + 1000 }),
        ]);
        store.appendTasks([{ id: 'task-1', name: 'Reload <Sales>', taskType: 0, appId: 'app-1', appName: 'Sales' }]);
        store.appendCoverage(new Map([['task-1', NOW - 5 * 3600000]]), NOW);
        store.appendObservation(NOW - 600000, NOW);
        expect(await store.flush()).toBe(5);
        await store.close();

        const files = fs.readdirSync(path.join(dir, 'sense.example.com')).sort();
        expect(files).toEqual(['2026-10-04.ndjson', '2026-10-06.ndjson']);
        const firstLine = fs.readFileSync(path.join(dir, 'sense.example.com', '2026-10-06.ndjson'), 'utf8').split('\n')[0];
        expect(JSON.parse(firstLine)).toEqual({ v: 1, host: 'Sense.Example.com', clusterId: 'cluster-1' });

        const reader = make();
        await reader.open();
        const loaded = await reader.load(NOW - 7 * DAY, NOW);
        expect(loaded.records.map((r) => r.resultId).sort()).toEqual(['res-1', 'res-2']);
        expect(loaded.tasks.get('task-1').name).toBe('Reload <Sales>');
        expect(loaded.coverage.tasks.get('task-1')).toEqual([[NOW - 5 * 3600000, NOW]]);
        expect(loaded.coverage.global).toEqual([[NOW - 600000, NOW]]);
        await reader.close();
    });

    test('the last line for an execution wins', async () => {
        const store = make();
        await store.open();
        store.appendRecords([rec({ status: 8 })]);
        await store.flush();
        store.appendRecords([rec({ status: 7 })]);
        await store.flush();

        const loaded = await store.load(NOW - DAY, NOW);
        expect(loaded.records).toHaveLength(1);
        expect(loaded.records[0].status).toBe(7);
        await store.close();
    });

    test('a second instance opens read-only and writes nothing', async () => {
        const writer = make();
        await writer.open();
        const reader = make({ pid: 999999, pidAlive: () => true });

        expect((await reader.open()).mode).toBe('readonly');
        reader.appendRecords([rec()]);
        expect(await reader.flush()).toBe(0);
        await reader.close();
        await writer.close();
    });

    test('a lock left by a process of this computer that no longer runs is taken over at once', async () => {
        writeLock({ pid: 999999, host: 'this-computer' });
        const store = make({ pidAlive: () => false });

        expect((await store.open()).mode).toBe('readwrite');
        expect(readLock()).toEqual({
            pid: process.pid,
            host: 'this-computer',
            token: expect.stringMatching(/^[0-9a-f]{16}$/),
            since: new Date(NOW).toISOString(),
        });
        await store.close();
        expect(fs.existsSync(lockFile())).toBe(false);
    });

    test('the lock is refreshed while the store writes: its modification time is the heartbeat', async () => {
        let now = NOW;
        const store = make({ now: () => now });
        await store.open();
        expect(fs.statSync(lockFile()).mtimeMs).toBe(NOW);

        now = NOW + MIN;
        await store.heartbeat();
        expect(fs.statSync(lockFile()).mtimeMs).toBe(NOW + MIN);
        await store.close();
    });

    test('a lock of another computer is respected while it is refreshed, whatever its process id, and taken over once it is not', async () => {
        // Its process id means nothing here (here it does not even exist): two writers would share --history-dir
        writeLock({ pid: 4242, host: 'other-computer' }, { refreshedAgo: 4 * MIN });
        const reader = make({ pidAlive: () => false });

        const opened = await reader.open();
        expect(opened.mode).toBe('readonly');
        // Which instance, which file, and when it is safe to delete it
        expect(opened.message).toBe(
            `another Ctrl-Q instance is writing this history (process 4242 on other-computer); opened read-only. Delete ${lockFile()} if that instance is no longer running; Ctrl-Q also takes over a lock that has not been refreshed for 5 minutes.`
        );
        await reader.close();
        expect(readLock()).toMatchObject({ pid: 4242, host: 'other-computer' });

        // Not refreshed for more than 5 minutes: that instance is gone
        writeLock({ pid: 4242, host: 'other-computer' }, { refreshedAgo: 6 * MIN });
        const next = make({ pidAlive: () => false });
        expect((await next.open()).mode).toBe('readwrite');
        expect(readLock()).toMatchObject({ pid: process.pid, host: 'this-computer' });
        await next.close();
    });

    test('a lock whose process id now belongs to another process is taken over once it has not been refreshed for 5 minutes', async () => {
        // Left by a crash; after a restart (or on Windows, soon) another process got the same id
        writeLock({ pid: 999999, host: 'this-computer' }, { refreshedAgo: 4 * MIN });
        const early = make({ pidAlive: () => true });
        expect((await early.open()).mode).toBe('readonly');
        await early.close();

        writeLock({ pid: 999999, host: 'this-computer' }, { refreshedAgo: 6 * MIN });
        const later = make({ pidAlive: () => true });
        expect((await later.open()).mode).toBe('readwrite');
        await later.close();
    });

    test("two containers with the same process id and computer name do not take over each other's lock", async () => {
        // Both run Ctrl-Q as process 1. A process id equal to its own no longer passes for a crashed earlier run.
        writeLock({ pid: 1, host: 'this-computer' });
        const second = make({ pid: 1, pidAlive: () => true });

        expect((await second.open()).mode).toBe('readonly');
        await second.close();
        expect(readLock()).toMatchObject({ pid: 1, token: 'their-token' });
    });

    test('close() leaves a lock alone that another instance has taken over meanwhile', async () => {
        const store = make();
        await store.open();
        // Another instance took the lock for stale, e.g. while this computer slept
        writeLock({ pid: 4242, host: 'other-computer' });

        await store.close();

        expect(readLock()).toMatchObject({ pid: 4242, token: 'their-token' });
    });

    test('the heartbeat notices that another instance took the lock over, and the store stops writing', async () => {
        const warn = jest.fn();
        const store = make({ logger: { ...silent, warn } });
        await store.open();
        store.appendRecords([rec()]);
        writeLock({ pid: 4242, host: 'other-computer' });

        await store.heartbeat();

        expect(store.mode()).toBe('readonly');
        expect(store.message()).toBe(
            `another Ctrl-Q instance took over writing this history while this one was not responding (see ${lockFile()}); read-only from now on`
        );
        expect(warn).toHaveBeenCalledWith(`History file: ${store.message()}`);
        store.appendRecords([rec({ resultId: 'res-2' })]);
        expect(await store.flush()).toBe(0);
        expect(fs.readdirSync(path.join(dir, 'sense.example.com'))).toEqual(['.lock']);
        await store.close();
        expect(readLock()).toMatchObject({ pid: 4242 });
    });

    test('a lock deleted by hand while the store writes is taken again at the next heartbeat', async () => {
        const store = make();
        await store.open();
        fs.rmSync(lockFile());

        await store.heartbeat();

        expect(store.mode()).toBe('readwrite');
        expect(readLock()).toMatchObject({ pid: process.pid, host: 'this-computer' });
        await store.close();
        expect(fs.existsSync(lockFile())).toBe(false);
    });

    test('torn lines are skipped and counted', async () => {
        const store = make();
        await store.open();
        store.appendRecords([rec()]);
        await store.flush();
        fs.appendFileSync(path.join(dir, 'sense.example.com', '2026-10-06.ndjson'), '{"t":"r","task":"x","s":7,"tr":17');

        const loaded = await store.load(NOW - DAY, NOW);
        expect(loaded.records).toHaveLength(1);
        expect(loaded.skippedLines).toBe(1);
        await store.close();
    });

    test('files from another cluster are ignored', async () => {
        const hostDir = path.join(dir, 'sense.example.com');
        fs.mkdirSync(hostDir, { recursive: true });
        fs.writeFileSync(
            path.join(hostDir, '2026-10-06.ndjson'),
            `${JSON.stringify({ v: 1, host: 'x', clusterId: 'other' })}\n${JSON.stringify(recordToLine(rec()))}\n`
        );
        const store = make();
        await store.open();

        const loaded = await store.load(NOW - DAY, NOW);
        expect(loaded.records).toHaveLength(0);
        expect(loaded.ignoredFiles).toBe(1);
        await store.close();
    });

    test('deletes daily files older than the retention period', async () => {
        const hostDir = path.join(dir, 'sense.example.com');
        fs.mkdirSync(hostDir, { recursive: true });
        fs.writeFileSync(path.join(hostDir, '2026-06-01.ndjson'), '');
        fs.writeFileSync(path.join(hostDir, '2026-10-01.ndjson'), '');
        fs.writeFileSync(path.join(hostDir, 'notes.txt'), '');
        const store = make({ retentionDays: 30 });

        expect((await store.open()).message).toContain('deleted 1');
        expect(fs.readdirSync(hostDir).sort()).toEqual(['.lock', '2026-10-01.ndjson', 'notes.txt']);
        await store.close();
    });

    test('only loads records overlapping the requested range', async () => {
        const store = make();
        await store.open();
        store.appendRecords([
            rec(),
            rec({ resultId: 'old', triggeredAt: NOW - 20 * DAY, startedAt: NOW - 20 * DAY, stoppedAt: NOW - 20 * DAY + 1000 }),
        ]);
        await store.flush();

        expect((await store.load(NOW - DAY, NOW)).records.map((r) => r.resultId)).toEqual(['res-1']);
        await store.close();
    });

    test('coverage of many tasks is one line per start, and loads merged however many starts there were', async () => {
        const store = make();
        await store.open();
        // 200 starts, each with the same 30 tasks and ranges that end at the start time
        for (let i = 0; i < 200; i += 1) {
            const t = NOW - (200 - i) * 60000;
            store.appendCoverage(new Map(Array.from({ length: 30 }, (_, k) => [`task-${k}`, t - 4 * 3600000])), t);
        }
        // An older, separate range for one task, and two tasks whose range is empty or negative (not written)
        store.appendCoverage(
            new Map([
                ['task-0', NOW - 2 * DAY],
                ['task-x', NOW],
            ]),
            NOW - 2 * DAY + 3600000
        );
        expect(await store.flush()).toBe(201);
        const text = fs.readFileSync(path.join(dir, 'sense.example.com', '2026-10-06.ndjson'), 'utf8');
        expect(text.split('\n').filter((l) => l.includes('"covs"'))).toHaveLength(200);

        const loaded = await store.load(NOW - 7 * DAY, NOW);
        expect(loaded.coverage.tasks.size).toBe(30);
        expect(loaded.coverage.tasks.get('task-5')).toEqual([[NOW - 200 * 60000 - 4 * 3600000, NOW - 60000]]);
        expect(loaded.coverage.tasks.get('task-0')).toEqual([
            [NOW - 2 * DAY, NOW - 2 * DAY + 3600000],
            [NOW - 200 * 60000 - 4 * 3600000, NOW - 60000],
        ]);
        expect(loaded.coverage.tasks.has('task-x')).toBe(false);
        await store.close();
    });

    test('nested observation ranges merge into one, and older per-task "cov" lines are still read', async () => {
        const hostDir = path.join(dir, 'sense.example.com');
        fs.mkdirSync(hostDir, { recursive: true });
        const lines = [{ v: 1, host: 'Sense.Example.com', clusterId: 'cluster-1' }];
        // A live session writes [liveFrom, t] every 5 minutes
        for (let t = NOW - 3600000; t <= NOW; t += 300000) lines.push({ t: 'obs', from: NOW - 3600000, to: t });
        lines.push({ t: 'cov', task: 'task-1', from: NOW - 6 * 3600000, to: NOW - 5 * 3600000 });
        fs.writeFileSync(path.join(hostDir, '2026-10-06.ndjson'), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
        const store = make();
        await store.open();

        const loaded = await store.load(NOW - DAY, NOW);
        expect(loaded.coverage.global).toEqual([[NOW - 3600000, NOW]]);
        expect(loaded.coverage.tasks.get('task-1')).toEqual([[NOW - 6 * 3600000, NOW - 5 * 3600000]]);
        await store.close();
    });

    test('coverage never reaches back before the retention period or the read window', async () => {
        const store = make({ retentionDays: 2 });
        await store.open();
        // Ctrl-Q watched for 10 days, but the files only keep 2 (plus today)
        store.appendObservation(NOW - 10 * DAY, NOW);
        store.appendCoverage(new Map([['task-1', NOW - 30 * DAY]]), NOW);
        await store.flush();

        const cutoff = Date.UTC(2026, 9, 4);
        const loaded = await store.load(NOW - 7 * DAY, NOW);
        expect(loaded.coverage.global).toEqual([[cutoff, NOW]]);
        expect(loaded.coverage.tasks.get('task-1')).toEqual([[cutoff, NOW]]);

        const shortWindow = await store.load(NOW - 3600000, NOW);
        expect(shortWindow.coverage.global[0][0]).toBeGreaterThanOrEqual(cutoff);
        await store.close();
    });

    test('records older than the retention period are not written, so expired files are not created again', async () => {
        const store = make({ retentionDays: 2 });
        await store.open();
        store.appendRecords([
            rec({ resultId: 'old', triggeredAt: NOW - 10 * DAY, startedAt: NOW - 10 * DAY, stoppedAt: NOW - 10 * DAY + 1000 }),
            rec(),
        ]);
        expect(await store.flush()).toBe(1);
        expect(fs.readdirSync(path.join(dir, 'sense.example.com')).filter((n) => n.endsWith('.ndjson'))).toEqual(['2026-10-06.ndjson']);
        await store.close();
    });

    test('readSignatures returns the stored state of the records in the files of some days only', async () => {
        const store = make();
        await store.open();
        store.appendRecords([
            rec({ resultId: 'a', status: 2, stoppedAt: null }),
            rec({ resultId: 'b', triggeredAt: NOW - 3 * DAY, startedAt: NOW - 3 * DAY, stoppedAt: NOW - 3 * DAY + 5000 }),
        ]);
        await store.flush();
        store.appendRecords([rec({ resultId: 'a', status: 7, stoppedAt: NOW - 1000 })]);
        await store.flush();

        const today = await store.readSignatures(['2026-10-06']);
        expect([...today]).toEqual([['r:a', `7:${NOW - 1000}`]]);
        const older = await store.readSignatures(new Set(['2026-10-03', '2026-09-01']));
        expect([...older]).toEqual([['r:b', `7:${NOW - 3 * DAY + 5000}`]]);
        await store.close();
    });

    test('pruneExpired deletes files once the retention cutoff moves on to a new day', async () => {
        let now = NOW;
        const hostDir = path.join(dir, 'sense.example.com');
        fs.mkdirSync(hostDir, { recursive: true });
        fs.writeFileSync(path.join(hostDir, '2026-09-06.ndjson'), '');
        fs.writeFileSync(path.join(hostDir, '2026-09-07.ndjson'), '');
        const store = make({ retentionDays: 30, now: () => now });
        await store.open();
        expect(fs.existsSync(path.join(hostDir, '2026-09-06.ndjson'))).toBe(true);

        // Same day: nothing to do
        now = NOW + 3600000;
        expect(await store.pruneExpired()).toBe(0);
        // The next day the cutoff passes 2026-09-06
        now = NOW + DAY;
        expect(await store.pruneExpired()).toBe(1);
        expect(fs.existsSync(path.join(hostDir, '2026-09-06.ndjson'))).toBe(false);
        expect(fs.existsSync(path.join(hostDir, '2026-09-07.ndjson'))).toBe(true);
        await store.close();

        const reader = make({ retentionDays: 1, now: () => NOW + 2 * DAY, pidAlive: () => true });
        writeLock({ pid: 999999, host: 'this-computer' }, { refreshedAgo: -2 * DAY });
        await reader.open();
        expect(await reader.pruneExpired()).toBe(0);
        expect(fs.existsSync(path.join(hostDir, '2026-09-07.ndjson'))).toBe(true);
    });

    test('a failed flush keeps its lines queued, and the next flush writes them in order', async () => {
        const hostDir = path.join(dir, 'sense.example.com');
        const store = make();
        await store.open();
        // A directory where the daily file should be makes the write fail
        fs.mkdirSync(path.join(hostDir, '2026-10-06.ndjson'));
        store.appendRecords([rec({ status: 2, stoppedAt: null })]);
        await expect(store.flush()).rejects.toThrow();
        expect(store.pending()).toBe(1);

        fs.rmdirSync(path.join(hostDir, '2026-10-06.ndjson'));
        store.appendRecords([rec({ status: 7 })]);
        expect(await store.flush()).toBe(2);
        const loaded = await store.load(NOW - DAY, NOW);
        expect(loaded.records.map((r) => r.status)).toEqual([7]);
        await store.close();
    });

    test('after a torn last line, the next line written is not glued onto it', async () => {
        const store = make();
        await store.open();
        store.appendRecords([rec({ resultId: 'first' })]);
        await store.flush();
        await store.close();
        fs.appendFileSync(path.join(dir, 'sense.example.com', '2026-10-06.ndjson'), '{"t":"r","task":"x","s":7,"tr":17');

        const next = make();
        await next.open();
        next.appendRecords([rec({ resultId: 'second' }), rec({ resultId: 'third' })]);
        await next.flush();
        const loaded = await next.load(NOW - DAY, NOW);
        expect(loaded.records.map((r) => r.resultId).sort()).toEqual(['first', 'second', 'third']);
        expect(loaded.skippedLines).toBe(1);
        await next.close();
    });

    test("a same-day file of another cluster is left alone; this cluster's lines go to a file of their own", async () => {
        const hostDir = path.join(dir, 'sense.example.com');
        fs.mkdirSync(hostDir, { recursive: true });
        const foreign = `${JSON.stringify({ v: 1, host: 'x', clusterId: 'old-cluster' })}\n${JSON.stringify(recordToLine(rec()))}\n`;
        fs.writeFileSync(path.join(hostDir, '2026-10-06.ndjson'), foreign);
        const store = make({ clusterId: 'New-Cluster-1234' });
        await store.open();
        expect((await store.load(NOW - DAY, NOW)).ignoredFiles).toBe(1);

        store.appendRecords([rec({ resultId: 'mine' })]);
        store.appendObservation(NOW - 60000, NOW);
        await store.flush();
        expect(fs.readFileSync(path.join(hostDir, '2026-10-06.ndjson'), 'utf8')).toBe(foreign);
        expect(fs.readdirSync(hostDir).sort()).toEqual(['.lock', '2026-10-06.ndjson', '2026-10-06.new-clus.ndjson']);

        const loaded = await store.load(NOW - DAY, NOW);
        expect(loaded.records.map((r) => r.resultId)).toEqual(['mine']);
        expect(loaded.coverage.global).toEqual([[NOW - 60000, NOW]]);
        await store.close();
    });

    test('of two instances opening at the same time, only one writes', async () => {
        const alive = (pid) => pid === 1001 || pid === 1002;
        const a = make({ pid: 1001, pidAlive: alive });
        const b = make({ pid: 1002, pidAlive: alive });

        const modes = (await Promise.all([a.open(), b.open()])).map((r) => r.mode).sort();
        expect(modes).toEqual(['readonly', 'readwrite']);
        await a.close();
        await b.close();
    });

    test('of two instances taking over the same stale lock at the same time, only one writes', async () => {
        for (let i = 0; i < 20; i += 1) {
            const hostDir = path.join(dir, `run-${i}`);
            fs.mkdirSync(path.join(hostDir, 'sense.example.com'), { recursive: true });
            writeLock({ pid: 999999, host: 'this-computer' }, { base: hostDir });
            const alive = (pid) => pid === 1001 || pid === 1002;
            const a = make({ dir: hostDir, pid: 1001, pidAlive: alive });
            const b = make({ dir: hostDir, pid: 1002, pidAlive: alive });

            const [ma, mb] = (await Promise.all([a.open(), b.open()])).map((r) => r.mode);
            expect([ma, mb].sort()).toEqual(['readonly', 'readwrite']);
            // The lock names the instance that writes
            expect(readLock(hostDir).pid).toBe(ma === 'readwrite' ? 1001 : 1002);
            await a.close();
            await b.close();
        }
    });

    test('close() during an open() still under way waits for it, and releases the lock it took', async () => {
        const store = make();

        const opening = store.open();
        await store.close();

        expect((await opening).mode).toBe('readwrite');
        expect(store.mode()).toBe('closed');
        expect(fs.existsSync(path.join(dir, 'sense.example.com', '.lock'))).toBe(false);
    });

    test('past the limit of lines waiting to be written, the store stops writing for the session and says why', async () => {
        const warn = jest.fn();
        const store = make({ maxPendingLines: 3, logger: { ...silent, warn } });
        await store.open();
        const append = jest
            .spyOn(fsp, 'appendFile')
            .mockRejectedValue(Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }));

        store.appendRecords([rec({ resultId: 'a' }), rec({ resultId: 'b' })]);
        await expect(store.flush()).rejects.toThrow('ENOSPC');
        expect(store.pending()).toBe(2);
        store.appendRecords([rec({ resultId: 'c' })]);
        expect(store.mode()).toBe('readwrite');

        // A fourth line would pass the limit. Dropping only some lines would leave coverage lines written later
        // claiming the time of the dropped executions, so nothing more is written at all.
        store.appendRecords([rec({ resultId: 'd' })]);
        expect(store.mode()).toBe('error');
        expect(store.pending()).toBe(0);
        expect(store.message()).toBe(
            `stopped writing to ${path.join(dir, 'sense.example.com')} until Ctrl-Q is restarted: 3 lines could not be written (ENOSPC: no space left on device, write)`
        );
        expect(warn).toHaveBeenCalledWith(`History file: ${store.message()}`);

        append.mockRestore();
        store.appendRecords([rec({ resultId: 'e' })]);
        expect(await store.flush()).toBe(0);
        await store.close();
        expect(fs.readdirSync(path.join(dir, 'sense.example.com'))).toEqual([]);
    });

    test('an unusable directory gives mode error, and load returns nothing', async () => {
        const file = path.join(dir, 'not-a-dir');
        fs.writeFileSync(file, 'x');
        const store = createHistoryStore({ dir: file, host: 'h', clusterId: null, retentionDays: 1, logger: silent });

        expect((await store.open()).mode).toBe('error');
        expect((await store.load(0, NOW)).records).toEqual([]);
    });
});
