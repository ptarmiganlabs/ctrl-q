import { test, expect, describe } from '@jest/globals';

import { createExecutionStore, mergeRecords } from '../../../lib/task-gantt/store/execution-store.js';
import { createCoverage } from '../../../lib/task-gantt/store/coverage.js';
import { SOURCE, SOURCE_BIT } from '../../../lib/task-gantt/defaults.js';
import { recordKey } from '../../../lib/task-gantt/model/execution-record.js';

const T = 1_800_000_000_000;

const qrsRec = (over = {}) => {
    const rec = {
        resultId: 'res-1',
        executionId: 'exe-1',
        taskId: 'task-1',
        taskType: 0,
        appId: 'app-1',
        nodeName: 'node1',
        status: 2,
        triggeredAt: T,
        queuedAt: null,
        startedAt: T + 500,
        stoppedAt: null,
        failureReason: null,
        src: SOURCE_BIT[SOURCE.QRS],
        confidence: 'exact',
        modifiedAt: T + 600,
        ...over,
    };
    rec.key = recordKey(rec);
    return rec;
};

const opsRec = (over = {}) => {
    const rec = {
        resultId: null,
        executionId: null,
        taskId: 'task-1',
        taskType: null,
        appId: 'app-1',
        nodeName: 'node1',
        status: 7,
        triggeredAt: T + 400,
        queuedAt: null,
        startedAt: T + 1000,
        stoppedAt: T + 60000,
        failureReason: null,
        src: SOURCE_BIT[SOURCE.OPS_MONITOR],
        confidence: 'derived',
        modifiedAt: null,
        ...over,
    };
    rec.key = recordKey(rec);
    return rec;
};

describe('createExecutionStore', () => {
    test('adds records and bumps the revision', () => {
        const store = createExecutionStore();

        expect(store.upsertMany([qrsRec()], SOURCE.QRS)).toBe(1);
        expect(store.size()).toBe(1);
        expect(store.rev()).toBe(1);
        expect(store.get('r:res-1').status).toBe(2);
    });

    test('a newer QRS version of a result replaces the older one; an older one is ignored', () => {
        const store = createExecutionStore();
        store.upsertMany([qrsRec()], SOURCE.QRS);
        store.upsertMany([qrsRec({ status: 7, stoppedAt: T + 90000, modifiedAt: T + 90100 })], SOURCE.QRS);
        const rev = store.rev();

        expect(store.get('r:res-1')).toMatchObject({ status: 7, stoppedAt: T + 90000 });
        expect(store.upsertMany([qrsRec({ status: 2, modifiedAt: T + 700 })], SOURCE.QRS)).toBe(0);
        expect(store.get('r:res-1').status).toBe(7);
        expect(store.rev()).toBe(rev);
    });

    test('an unchanged record is not counted as a change', () => {
        const store = createExecutionStore();
        store.upsertMany([qrsRec()], SOURCE.QRS);

        expect(store.upsertMany([qrsRec()], SOURCE.QRS)).toBe(0);
    });

    test('a record without ids matches by task and trigger time within the tolerance', () => {
        const store = createExecutionStore({ matchToleranceMs: 10000 });
        store.upsertMany([qrsRec({ status: 7, stoppedAt: T + 61000 })], SOURCE.QRS);
        store.upsertMany([opsRec()], SOURCE.OPS_MONITOR);

        expect(store.size()).toBe(1);
        const rec = store.get('r:res-1');
        expect(rec.src).toBe(SOURCE_BIT[SOURCE.QRS] | SOURCE_BIT[SOURCE.OPS_MONITOR]);
        // QRS wins where both have values
        expect(rec.triggeredAt).toBe(T);
        expect(rec.stoppedAt).toBe(T + 61000);
        expect(rec.confidence).toBe('exact');
    });

    test('a better source arriving later re-keys the record', () => {
        const store = createExecutionStore();
        store.upsertMany([opsRec()], SOURCE.OPS_MONITOR);
        store.drainChanges();
        store.upsertMany([qrsRec({ status: 7, stoppedAt: T + 61000 })], SOURCE.QRS);

        expect(store.size()).toBe(1);
        expect(store.get(`f:task-1:${T + 400}`)).toBeUndefined();
        expect(store.get('r:res-1').taskType).toBe(0);
        expect(store.drainChanges()).toEqual({ rev: 2, changed: ['r:res-1'], removed: [`f:task-1:${T + 400}`] });
    });

    test('records too far apart are separate executions', () => {
        const store = createExecutionStore({ matchToleranceMs: 10000 });
        store.upsertMany([qrsRec()], SOURCE.QRS);
        store.upsertMany([opsRec({ triggeredAt: T + 3600000 })], SOURCE.OPS_MONITOR);

        expect(store.size()).toBe(2);
    });

    test('fuzzy matching finds a record just across a time bucket boundary, and never one beyond the tolerance', () => {
        const store = createExecutionStore({ matchToleranceMs: 10000 });
        // Bucket boundaries are at multiples of the tolerance
        const edge = Math.ceil(T / 10000) * 10000;
        store.upsertMany([qrsRec({ triggeredAt: edge - 1, status: 7, stoppedAt: edge + 60000 })], SOURCE.QRS);
        store.upsertMany([opsRec({ triggeredAt: edge + 9998 })], SOURCE.OPS_MONITOR);
        expect(store.size()).toBe(1);

        store.upsertMany([opsRec({ triggeredAt: edge + 10000 })], SOURCE.OPS_MONITOR);
        expect(store.size()).toBe(2);
    });

    test('loading tens of thousands of executions of one task stays fast (no scan per record)', () => {
        const store = createExecutionStore();
        const start = Date.now();
        const withIds = Array.from({ length: 20000 }, (_, i) =>
            qrsRec({
                resultId: `res-${i}`,
                executionId: `exe-${i}`,
                status: 7,
                triggeredAt: T + i * 300000,
                stoppedAt: T + i * 300000 + 1000,
            })
        );
        store.upsertMany(withIds, SOURCE.HISTORY);
        // The same executions again from a source without ids: each must find its partner by time
        const withoutIds = withIds.map((r) => opsRec({ triggeredAt: r.triggeredAt + 200, stoppedAt: r.stoppedAt }));
        store.upsertMany(withoutIds, SOURCE.OPS_MONITOR);

        expect(store.size()).toBe(20000);
        // Quadratic matching took about 5 s for 20k records; this takes well under a second
        expect(Date.now() - start).toBeLessThan(3000);
    });

    test('running() lists the executions that have not stopped, and follows them as they finish or go', () => {
        const store = createExecutionStore();
        store.upsertMany(
            [qrsRec({ resultId: 'a', executionId: 'a' }), qrsRec({ resultId: 'b', executionId: 'b', status: 7, stoppedAt: T + 5000 })],
            SOURCE.QRS
        );
        expect(store.running().map((r) => r.key)).toEqual(['r:a']);

        store.upsertMany([qrsRec({ resultId: 'a', executionId: 'a', status: 7, stoppedAt: T + 9000, modifiedAt: T + 9000 })], SOURCE.QRS);
        expect(store.running()).toEqual([]);

        store.upsertMany([qrsRec({ resultId: 'c', executionId: 'c', triggeredAt: T + 100000 })], SOURCE.QRS);
        store.pruneBefore(T + 50000);
        expect(store.running().map((r) => r.key)).toEqual(['r:c']);
    });

    test('two QRS results never fuzzy-match each other', () => {
        const store = createExecutionStore();
        store.upsertMany([qrsRec(), qrsRec({ resultId: 'res-2', executionId: 'exe-2', triggeredAt: T + 100 })], SOURCE.QRS);

        expect(store.size()).toBe(2);
    });

    test('a lower-ranked source may finish an execution but not override values', () => {
        const store = createExecutionStore();
        store.upsertMany([qrsRec()], SOURCE.QRS);
        store.upsertMany(
            [{ ...qrsRec({ status: 8, stoppedAt: T + 5000, nodeName: 'other' }), src: SOURCE_BIT[SOURCE.HISTORY] }],
            SOURCE.HISTORY
        );

        const rec = store.get('r:res-1');
        expect(rec.status).toBe(8);
        expect(rec.stoppedAt).toBe(T + 5000);
        expect(rec.nodeName).toBe('node1');
    });

    test('counts conflicts between sources', () => {
        const store = createExecutionStore({ matchToleranceMs: 10000 });
        store.upsertMany([qrsRec({ status: 7, stoppedAt: T + 61000 })], SOURCE.QRS);
        store.upsertMany([opsRec({ stoppedAt: T + 120000 })], SOURCE.OPS_MONITOR);

        expect(store.conflicts(SOURCE.OPS_MONITOR)).toBe(1);
        expect(store.conflicts(SOURCE.QRS)).toBe(0);
    });

    test('evicts the oldest finished records beyond maxRecords', () => {
        const store = createExecutionStore({ maxRecords: 2 });
        store.upsertMany(
            [
                qrsRec({ resultId: 'a', executionId: 'a', status: 7, stoppedAt: T + 1 }),
                qrsRec({ resultId: 'b', executionId: 'b', status: 7, stoppedAt: T + 2 }),
                qrsRec({ resultId: 'c', executionId: 'c', status: 2, stoppedAt: null }),
            ],
            SOURCE.QRS
        );

        expect(store.size()).toBe(2);
        expect(store.get('r:a')).toBeUndefined();
        expect(store.get('r:c')).toBeDefined();
        // Everything that ended before this may be gone
        expect(store.evictedUntil()).toBe(T + 1);
    });

    test('evicts down to 95 % of maxRecords at once, and evictedUntil is null until something is evicted', () => {
        const store = createExecutionStore({ maxRecords: 100 });
        const rec = (i) =>
            qrsRec({ resultId: `r${i}`, executionId: `x${i}`, status: 7, triggeredAt: T + i * 1000, stoppedAt: T + i * 1000 + 1 });
        store.upsertMany(
            Array.from({ length: 100 }, (_, i) => rec(i)),
            SOURCE.QRS
        );
        expect(store.size()).toBe(100);
        expect(store.evictedUntil()).toBeNull();

        store.upsertMany([rec(100)], SOURCE.QRS);
        expect(store.size()).toBe(95);
        expect(store.get('r:r5')).toBeUndefined();
        expect(store.get('r:r6')).toBeDefined();
        expect(store.evictedUntil()).toBe(T + 5 * 1000 + 1);
    });

    test('pruneBefore drops records that ended before a time', () => {
        const store = createExecutionStore();
        store.upsertMany(
            [qrsRec({ resultId: 'a', executionId: 'a', status: 7, stoppedAt: T + 1 }), qrsRec({ resultId: 'b', executionId: 'b' })],
            SOURCE.QRS
        );

        expect(store.pruneBefore(T + 10)).toBe(1);
        expect(store.all().map((r) => r.resultId)).toEqual(['b']);
    });

    test('ignores records without a task id', () => {
        const store = createExecutionStore();

        expect(store.upsertMany([null, { resultId: 'x' }], SOURCE.QRS)).toBe(0);
    });
});

describe('mergeRecords', () => {
    test('a finished execution stays finished when a better source still sees it running', () => {
        const finished = { ...opsRec(), src: SOURCE_BIT[SOURCE.HISTORY] };
        const { merged } = mergeRecords(finished, qrsRec({ status: 2, stoppedAt: null }), SOURCE.QRS);

        expect(merged.status).toBe(7);
        expect(merged.stoppedAt).toBe(T + 60000);
    });
});

describe('createCoverage', () => {
    test('merges global and per-task coverage', () => {
        const cov = createCoverage();
        cov.addGlobal(100, 200);
        cov.addTask('t1', 50, 120);
        cov.addTask('t1', 300, 400);
        cov.addTask('t2', 10, 5);

        expect(cov.forTask('t1')).toEqual([
            [50, 200],
            [300, 400],
        ]);
        expect(cov.forTask('t2')).toEqual([[100, 200]]);
        expect(cov.globalRanges()).toEqual([[100, 200]]);
    });

    test('the live range is replaced, not added, and can be cleared', () => {
        const cov = createCoverage();
        cov.setLive(100, 150);
        cov.setLive(100, 180);
        expect(cov.globalRanges()).toEqual([[100, 180]]);
        expect(cov.live()).toEqual([100, 180]);

        cov.setLive(null);
        expect(cov.globalRanges()).toEqual([]);
        expect(cov.live()).toBeNull();
    });

    test('nothing before completeFrom counts as covered', () => {
        const cov = createCoverage();
        cov.addGlobal(100, 200);
        cov.addTask('t1', 50, 300);
        cov.setCompleteFrom(150);

        expect(cov.forTask('t1')).toEqual([[150, 300]]);
        expect(cov.globalRanges()).toEqual([[150, 200]]);
        expect(cov.completeFrom()).toBe(150);

        cov.setCompleteFrom(250);
        expect(cov.globalRanges()).toEqual([]);
    });

    test('thousands of nested ranges stay merged', () => {
        const cov = createCoverage();
        for (let t = 1000; t <= 26000; t += 1) cov.addGlobal(1000, t);
        expect(cov.globalRanges()).toEqual([[1000, 26000]]);
    });
});
