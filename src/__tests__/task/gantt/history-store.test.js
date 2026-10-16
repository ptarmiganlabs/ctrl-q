import { test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
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
        ...over,
    });

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
        const reader = make({ pidAlive: () => true });
        fs.writeFileSync(path.join(dir, 'sense.example.com', '.lock'), '999999');

        expect((await reader.open()).mode).toBe('readonly');
        reader.appendRecords([rec()]);
        expect(await reader.flush()).toBe(0);
        await reader.close();
        await writer.close();
    });

    test('a stale lock from a dead process is taken over', async () => {
        fs.mkdirSync(path.join(dir, 'sense.example.com'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'sense.example.com', '.lock'), '999999');
        const store = make({ pidAlive: () => false });

        expect((await store.open()).mode).toBe('readwrite');
        expect(fs.readFileSync(path.join(dir, 'sense.example.com', '.lock'), 'utf8')).toBe(String(process.pid));
        await store.close();
        expect(fs.existsSync(path.join(dir, 'sense.example.com', '.lock'))).toBe(false);
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
        fs.writeFileSync(path.join(hostDir, '.lock'), '999999');
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
            fs.writeFileSync(path.join(hostDir, 'sense.example.com', '.lock'), '999999');
            const alive = (pid) => pid === 1001 || pid === 1002;
            const a = make({ dir: hostDir, pid: 1001, pidAlive: alive });
            const b = make({ dir: hostDir, pid: 1002, pidAlive: alive });

            const [ma, mb] = (await Promise.all([a.open(), b.open()])).map((r) => r.mode);
            expect([ma, mb].sort()).toEqual(['readonly', 'readwrite']);
            // The lock names the instance that writes
            const lock = fs.readFileSync(path.join(hostDir, 'sense.example.com', '.lock'), 'utf8');
            expect(lock).toBe(ma === 'readwrite' ? '1001' : '1002');
            await a.close();
            await b.close();
        }
    });

    test('an unusable directory gives mode error, and load returns nothing', async () => {
        const file = path.join(dir, 'not-a-dir');
        fs.writeFileSync(file, 'x');
        const store = createHistoryStore({ dir: file, host: 'h', clusterId: null, retentionDays: 1, logger: silent });

        expect((await store.open()).mode).toBe('error');
        expect((await store.load(0, NOW)).records).toEqual([]);
    });
});
