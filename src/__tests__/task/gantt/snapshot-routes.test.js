import { jest, test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';

import {
    isStale,
    encodeLanes,
    encodeRecords,
    buildAnalytics,
    createNodeTable,
    buildSnapshot,
    FLAG_STALE,
    FLAG_DERIVED,
} from '../../../lib/task-gantt/api/snapshot.js';
import { createApiRoutes } from '../../../lib/task-gantt/api/routes.js';
import { fromExecutionResult } from '../../../lib/task-gantt/normalize/qrs.js';
import { createLaneRegistry } from '../../../lib/task-gantt/model/lanes.js';
import { createCoverage } from '../../../lib/task-gantt/store/coverage.js';
import { STALE_RUNNING_MS, SOURCE, SOURCE_BIT } from '../../../lib/task-gantt/defaults.js';
import { startWebServer } from '../../../lib/util/web/server.js';
import { rawRequest, silentLogger } from '../../util/web/web-test-helpers.mjs';

// The lab run: 6 reload tasks triggered at 06:29:45 with maxConcurrentEngines = 4; Content Monitor and Operations
// Monitor queued for ~46-49 s. Plus two old runs (September) of an external program task.
const ROWS = JSON.parse(fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8'));

const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
const OPS_MONITOR = '0419086f-a935-4358-a356-da2f79069e78';
const HIDDEN_A = 'a87ae597-be31-4453-be04-5b4f67489d8d';
const HIDDEN_B = '8d2c5d0c-12e2-4dc8-9832-de1ae367a373';
const HIDDEN_C = '60f56836-b6e4-4690-8896-a2262c4ebb8c';
// Has executions in the window, but is not in the lane registry at all
const UNREGISTERED = '5fee7b84-76f8-4cc1-ba4f-466d8eefa8be';
// External program task with only old executions (outside the window)
const EXT_TASK = '0359bda0-22dc-4c46-983c-8724266eb4ef';

const RELOAD_TASKS = [CONTENT_MONITOR, HIDDEN_A, OPS_MONITOR, HIDDEN_B, HIDDEN_C, UNREGISTERED];
const TASK_TYPES = new Map([...RELOAD_TASKS.map((id) => [id, 0]), [EXT_TASK, 1]]);
const RECORDS = ROWS.map((r) => fromExecutionResult(r, TASK_TYPES)).filter(Boolean);

const NODE = 'sense-node1.example.com';
const FROM = Date.parse('2026-10-06T06:00:00.000Z');
const TO = Date.parse('2026-10-06T07:00:00.000Z');
const NOW = TO;
const MINUTE = 60 * 1000;
const SCHEDULERS = [{ nodeName: NODE, maxConcurrentEngines: 4 }];

const keyOf = (taskId) => RECORDS.find((r) => r.taskId === taskId).key;

/**
 * Lane registry where only Content Monitor (idx 0), Operations Monitor (idx 2) and the external program task (idx 5)
 * are visible. Three more reload tasks have hidden lanes, and one reload task is not registered at all.
 *
 * @returns {object} Lane registry.
 */
const makeLanes = () => {
    const lanes = createLaneRegistry({ taskIds: [CONTENT_MONITOR, OPS_MONITOR, EXT_TASK] });
    lanes.upsert({ id: CONTENT_MONITOR, name: 'Content Monitor', taskType: 0, enabled: true, appId: 'app-cm', tags: ['monitor'] });
    lanes.upsert({ id: HIDDEN_A, name: 'Hidden A', taskType: 0, enabled: true });
    lanes.upsert({ id: OPS_MONITOR, name: 'Operations Monitor', taskType: 0, enabled: true, stream: 'Monitoring apps' });
    lanes.upsert({ id: HIDDEN_B, name: 'Hidden B', taskType: 0, enabled: true });
    lanes.upsert({ id: HIDDEN_C, name: 'Hidden C', taskType: 0, enabled: false });
    lanes.upsert({ id: EXT_TASK, name: 'Nightly export', taskType: 1, enabled: true });
    return lanes;
};

/**
 * A synthetic running execution record.
 *
 * @param {object} overrides - Fields to change.
 * @returns {object} Execution record.
 */
const makeRec = (overrides = {}) => {
    const rec = {
        resultId: null,
        executionId: null,
        taskId: CONTENT_MONITOR,
        taskType: 0,
        appId: 'c7178a65-a153-4f63-bbd7-10990fcffb69',
        nodeName: NODE,
        status: 2,
        triggeredAt: FROM + 10 * MINUTE,
        queuedAt: null,
        startedAt: FROM + 10 * MINUTE,
        stoppedAt: null,
        finishedAt: null,
        failureReason: null,
        src: SOURCE_BIT[SOURCE.QRS],
        confidence: 'exact',
        modifiedAt: null,
        ...overrides,
    };
    if (!rec.key) rec.key = rec.resultId ? `r:${rec.resultId}` : `f:${rec.taskId}:${rec.triggeredAt}`;
    return rec;
};

/**
 * Parameters for buildSnapshot()/buildAnalytics() over the lab fixture.
 *
 * @param {object} overrides - Parameters to change.
 * @returns {object} Parameters.
 */
const snapshotParam = (overrides = {}) => ({
    records: RECORDS,
    lanes: makeLanes(),
    coverage: createCoverage(),
    sources: [{ id: SOURCE.QRS, state: 'ok' }],
    schedulers: SCHEDULERS,
    runningResultIds: new Set(),
    window: { from: FROM, to: TO },
    now: NOW,
    live: true,
    rev: 42,
    ...overrides,
});

const maxOf = (series, col) => Math.max(...series.map((b) => b[col]));

describe('isStale', () => {
    const QRS = SOURCE_BIT[SOURCE.QRS];

    test('a finished execution is never stale, however old', () => {
        expect(isStale({ triggeredAt: 0, startedAt: 0, stoppedAt: 1 }, new Set(), NOW)).toBe(false);
        // stoppedAt 0 is a time, not "missing"
        expect(isStale({ triggeredAt: 0, startedAt: 0, stoppedAt: 0 }, new Set(), NOW)).toBe(false);
    });

    test('a "running" execution triggered more than STALE_RUNNING_MS ago is stale', () => {
        expect(isStale({ src: QRS, triggeredAt: NOW - STALE_RUNNING_MS - 1, stoppedAt: null }, new Set(), NOW)).toBe(true);
        expect(isStale({ src: QRS, triggeredAt: NOW - 7 * STALE_RUNNING_MS }, new Set(), NOW)).toBe(true);
    });

    test('the threshold itself is not stale yet', () => {
        expect(isStale({ src: QRS, triggeredAt: NOW - STALE_RUNNING_MS, stoppedAt: null }, new Set(), NOW)).toBe(false);
        expect(isStale({ src: QRS, triggeredAt: NOW - 1000, stoppedAt: null }, new Set(), NOW)).toBe(false);
    });

    test('an old execution with a live QRS execution session is really running', () => {
        const rec = { src: QRS, resultId: 'res-1', triggeredAt: NOW - 3 * STALE_RUNNING_MS, stoppedAt: null };

        expect(isStale(rec, new Set(['res-1']), NOW)).toBe(false);
        expect(isStale(rec, new Set(['res-2']), NOW)).toBe(true);
        expect(isStale({ ...rec, resultId: null }, new Set([null]), NOW)).toBe(true);
    });

    test('falls back to the start time, and is never stale without any begin time', () => {
        expect(isStale({ src: QRS, triggeredAt: null, startedAt: NOW - STALE_RUNNING_MS - 1, stoppedAt: null }, new Set(), NOW)).toBe(true);
        expect(isStale({ src: QRS, triggeredAt: NOW, startedAt: NOW - STALE_RUNNING_MS - 1, stoppedAt: null }, new Set(), NOW)).toBe(false);
        expect(isStale({ src: QRS, triggeredAt: null, startedAt: null, stoppedAt: null }, new Set(), NOW)).toBe(false);
    });

    test('a run that only the history file (or another source, not QRS) has as running has an unknown outcome', () => {
        const rec = { resultId: 'res-1', triggeredAt: NOW - 1000, stoppedAt: null };

        expect(isStale({ ...rec, src: SOURCE_BIT[SOURCE.HISTORY] }, new Set(['res-1']), NOW)).toBe(true);
        expect(isStale({ ...rec, src: SOURCE_BIT[SOURCE.OPS_MONITOR] }, new Set(), NOW)).toBe(true);
        expect(isStale({ ...rec, src: SOURCE_BIT[SOURCE.HISTORY] | QRS }, new Set(), NOW)).toBe(false);
        expect(isStale({ ...rec, src: SOURCE_BIT[SOURCE.HISTORY], stoppedAt: NOW }, new Set(), NOW)).toBe(false);
    });
});

describe('createNodeTable', () => {
    test('assigns stable indexes in order of first use', () => {
        const nodes = createNodeTable();

        expect(nodes.idx('node-b')).toBe(0);
        expect(nodes.idx('node-a')).toBe(1);
        expect(nodes.idx('node-b')).toBe(0);
        expect(nodes.idx('')).toBe(2);
        expect(nodes.names).toEqual(['node-b', 'node-a', '']);
    });

    test('starts from known names without aliasing the given array', () => {
        const initial = ['n1', 'n2'];
        const nodes = createNodeTable(initial);

        expect(nodes.idx('n2')).toBe(1);
        expect(nodes.idx('n3')).toBe(2);
        expect(nodes.names).toEqual(['n1', 'n2', 'n3']);
        expect(initial).toEqual(['n1', 'n2']);
    });
});

describe('encodeLanes', () => {
    test('encodes the lane fields and clips coverage to the window', () => {
        const lanes = makeLanes();
        const coverage = createCoverage();
        // Starts before the window: clipped at its start
        coverage.addGlobal(FROM - 60 * MINUTE, FROM + 10 * MINUTE);
        // Ends after the window: clipped at its end
        coverage.addTask(CONTENT_MONITOR, TO - MINUTE, TO + 60 * MINUTE);
        // Only touching the window edges: dropped
        coverage.addTask(OPS_MONITOR, FROM - 2 * MINUTE, FROM);
        coverage.addTask(OPS_MONITOR, TO, TO + MINUTE);
        // Entirely outside: dropped
        coverage.addTask(EXT_TASK, TO + MINUTE, TO + 2 * MINUTE);

        const encoded = encodeLanes(lanes.visible(), coverage, FROM, TO);

        expect(encoded).toEqual([
            {
                idx: 0,
                id: CONTENT_MONITOR,
                name: 'Content Monitor',
                taskType: 0,
                enabled: true,
                appId: 'app-cm',
                appName: null,
                stream: null,
                tags: ['monitor'],
                deleted: false,
                coverage: [
                    [FROM, FROM + 10 * MINUTE],
                    [TO - MINUTE, TO],
                ],
            },
            {
                idx: 2,
                id: OPS_MONITOR,
                name: 'Operations Monitor',
                taskType: 0,
                enabled: true,
                appId: null,
                appName: null,
                stream: 'Monitoring apps',
                tags: [],
                deleted: false,
                coverage: [[FROM, FROM + 10 * MINUTE]],
            },
            {
                idx: 5,
                id: EXT_TASK,
                name: 'Nightly export',
                taskType: 1,
                enabled: true,
                appId: null,
                appName: null,
                stream: null,
                tags: [],
                deleted: false,
                coverage: [[FROM, FROM + 10 * MINUTE]],
            },
        ]);
        // Internal registry state is not sent to the page
        expect(encoded[0]).not.toHaveProperty('visible');
    });

    test('a lane without coverage gets an empty list, and clipping does not change the tracker', () => {
        const coverage = createCoverage();
        coverage.addTask(CONTENT_MONITOR, FROM - MINUTE, TO + MINUTE);

        const [cm, ops] = encodeLanes(makeLanes().visible(), coverage, FROM, TO);

        expect(cm.coverage).toEqual([[FROM, TO]]);
        expect(ops.coverage).toEqual([]);
        expect(coverage.forTask(CONTENT_MONITOR)).toEqual([[FROM - MINUTE, TO + MINUTE]]);
    });
});

describe('encodeRecords', () => {
    const encode = (records, overrides = {}) => {
        const nodes = createNodeTable();
        const cols = encodeRecords(records, {
            laneByTask: new Map([
                [CONTENT_MONITOR, 0],
                [OPS_MONITOR, 2],
            ]),
            nodeIdx: nodes.idx,
            runningResultIds: new Set(),
            from: FROM,
            to: TO,
            now: NOW,
            ...overrides,
        });
        return { cols, nodes };
    };

    test('encodes fixture records of visible lanes column-wise', () => {
        const { cols, nodes } = encode(RECORDS);
        const cm = RECORDS.find((r) => r.taskId === CONTENT_MONITOR);
        const ops = RECORDS.find((r) => r.taskId === OPS_MONITOR);

        expect(Object.keys(cols)).toEqual([
            'key',
            'lane',
            'status',
            'triggeredAt',
            'queuedAt',
            'startedAt',
            'stoppedAt',
            'node',
            'src',
            'flags',
        ]);
        expect(cols).toEqual({
            key: [cm.key, ops.key],
            lane: [0, 2],
            status: [8, 7],
            triggeredAt: [cm.triggeredAt, ops.triggeredAt],
            queuedAt: [cm.queuedAt, ops.queuedAt],
            startedAt: [cm.startedAt, ops.startedAt],
            stoppedAt: [cm.stoppedAt, ops.stoppedAt],
            node: [0, 0],
            src: [SOURCE_BIT[SOURCE.QRS], SOURCE_BIT[SOURCE.QRS]],
            flags: [0, 0],
        });
        // Queued executions keep their queue time, so the page can draw the wait
        expect(cols.queuedAt.every((t) => typeof t === 'number')).toBe(true);
        expect(nodes.names).toEqual([NODE]);
    });

    test('keeps records that have not ended before the window start, including ones touching its edges or after its end', () => {
        const T = (id) => makeRec({ taskId: CONTENT_MONITOR, resultId: id, ...KEEP[id] });
        const KEEP = {
            'ends-at-from': { triggeredAt: FROM - 10 * MINUTE, startedAt: FROM - 10 * MINUTE, stoppedAt: FROM, status: 7 },
            'begins-at-to': { triggeredAt: TO, startedAt: TO, stoppedAt: TO + MINUTE, status: 7 },
            'running-across': { triggeredAt: FROM - 60 * MINUTE, startedAt: FROM - 60 * MINUTE, stoppedAt: null },
            'start-time-only': { triggeredAt: null, startedAt: FROM + MINUTE, stoppedAt: FROM + 2 * MINUTE, status: 7 },
            // The window ends at Ctrl-Q's estimate of the Sense clock, which can be a little behind the times QRS gives. A
            // live delta that left such a record out would lose it for good.
            'began-after': { triggeredAt: TO + 1, startedAt: TO + 1, stoppedAt: TO + MINUTE, status: 7 },
        };
        const DROP = [
            makeRec({
                resultId: 'ended-before',
                triggeredAt: FROM - 2 * MINUTE,
                startedAt: FROM - 2 * MINUTE,
                stoppedAt: FROM - 1,
                status: 7,
            }),
            makeRec({ resultId: 'no-begin', triggeredAt: null, startedAt: null, queuedAt: FROM + MINUTE, stoppedAt: null, status: 3 }),
            makeRec({ resultId: 'hidden-lane', taskId: HIDDEN_A }),
            makeRec({ resultId: 'unknown-task', taskId: UNREGISTERED }),
        ];

        const { cols } = encode([DROP[0], ...Object.keys(KEEP).map(T), ...DROP.slice(1)]);

        expect(cols.key).toEqual(['r:ends-at-from', 'r:begins-at-to', 'r:running-across', 'r:start-time-only', 'r:began-after']);
        for (const values of Object.values(cols)) {
            expect(values).toHaveLength(5);
        }
        // Running executions are sent with a null stop time; the page extends them to "now"
        expect(cols.stoppedAt[2]).toBeNull();
        expect(cols.triggeredAt[3]).toBeNull();
    });

    test('nodes are sent as indexes into the node table, unknown node as ""', () => {
        const nodes = createNodeTable(['known']);
        const cols = encodeRecords(
            [
                makeRec({ resultId: '1', nodeName: 'node-b' }),
                makeRec({ resultId: '2', nodeName: '' }),
                makeRec({ resultId: '3', nodeName: 'known' }),
                makeRec({ resultId: '4', nodeName: 'node-b' }),
                makeRec({ resultId: '5', nodeName: undefined }),
            ],
            { laneByTask: new Map([[CONTENT_MONITOR, 0]]), nodeIdx: nodes.idx, runningResultIds: new Set(), from: FROM, to: TO, now: NOW }
        );

        expect(cols.node).toEqual([1, 2, 0, 1, 2]);
        expect(nodes.names).toEqual(['known', 'node-b', '']);
    });

    test('flags stale and derived records', () => {
        const old = NOW - STALE_RUNNING_MS - MINUTE;
        const opsBit = SOURCE_BIT[SOURCE.OPS_MONITOR];
        const done = { status: 7, stoppedAt: FROM + 20 * MINUTE };
        const records = [
            makeRec({ resultId: 'fresh-qrs' }),
            makeRec({ resultId: 'ops-derived', src: opsBit, confidence: 'derived', ...done }),
            makeRec({ resultId: 'ops-approx', src: opsBit, confidence: 'approx', ...done }),
            makeRec({ resultId: 'ops-exact', src: opsBit, confidence: 'exact', ...done }),
            makeRec({ resultId: 'qrs-and-ops', src: SOURCE_BIT[SOURCE.QRS] | opsBit, confidence: 'derived' }),
            makeRec({ resultId: 'history-exact', src: SOURCE_BIT[SOURCE.HISTORY], confidence: 'exact', ...done }),
            makeRec({ resultId: 'history-running', src: SOURCE_BIT[SOURCE.HISTORY], confidence: 'exact' }),
            makeRec({ resultId: 'stale', triggeredAt: old, startedAt: old }),
            makeRec({ resultId: 'stale-derived', triggeredAt: old, startedAt: old, src: opsBit, confidence: 'derived' }),
            makeRec({ resultId: 'old-but-running', triggeredAt: old, startedAt: old }),
            makeRec({ resultId: 'old-but-finished', triggeredAt: old, startedAt: old, stoppedAt: FROM + MINUTE, status: 7 }),
        ];

        const { cols } = encode(records, { runningResultIds: new Set(['old-but-running']) });

        expect(Object.fromEntries(cols.key.map((k, i) => [k.slice(2), cols.flags[i]]))).toEqual({
            'fresh-qrs': 0,
            'ops-derived': FLAG_DERIVED,
            'ops-approx': FLAG_DERIVED,
            'ops-exact': 0,
            'qrs-and-ops': 0,
            'history-exact': 0,
            'history-running': FLAG_STALE,
            stale: FLAG_STALE,
            'stale-derived': FLAG_STALE | FLAG_DERIVED,
            'old-but-running': 0,
            'old-but-finished': 0,
        });
    });

    test('no records gives empty columns', () => {
        const { cols } = encode([]);

        expect(Object.values(cols).every((c) => Array.isArray(c) && c.length === 0)).toBe(true);
        expect(Object.keys(cols)).toHaveLength(10);
    });
});

describe('buildAnalytics', () => {
    test('concurrency counts all reloads in the window, also tasks without a visible lane', () => {
        const a = buildAnalytics(snapshotParam());

        // Only 2 of the 6 reloads have a visible lane, yet the scheduler ran 4 and queued 2
        expect(a.bucketMs).toBe(MINUTE);
        expect(a.concurrency.total).toHaveLength(60);
        expect(maxOf(a.concurrency.total, 1)).toBe(4);
        expect(maxOf(a.concurrency.total, 2)).toBe(2);
        expect(a.concurrency.nodes.map((n) => n.name)).toEqual([NODE]);
        expect(maxOf(a.concurrency.nodes[0].steps, 1)).toBe(4);
        expect(a.concurrency).not.toHaveProperty('points');
    });

    test('episodes list every task involved, with lane and name where known', () => {
        const [ep, ...rest] = buildAnalytics(snapshotParam()).episodes;

        expect(rest).toEqual([]);
        expect(ep).toMatchObject({ node: NODE, capacity: 4, peakRunning: 4, peakQueued: 2 });
        const byTask = new Map(ep.tasks.map((t) => [t.taskId, t]));
        expect([...byTask.keys()].sort()).toEqual([...RELOAD_TASKS].sort());
        expect(byTask.get(CONTENT_MONITOR)).toMatchObject({ lane: 0, name: 'Content Monitor', runs: 1 });
        expect(byTask.get(OPS_MONITOR)).toMatchObject({ lane: 2, name: 'Operations Monitor', runs: 1 });
        // Hidden lanes: no lane number, but the name is still useful in the episode list
        expect(byTask.get(HIDDEN_A)).toMatchObject({ lane: null, name: 'Hidden A' });
        expect(byTask.get(HIDDEN_C)).toMatchObject({ lane: null, name: 'Hidden C' });
        expect(byTask.get(UNREGISTERED)).toMatchObject({ lane: null, name: null });
        // The two queued tasks waited longest
        expect(
            ep.tasks
                .slice(0, 2)
                .map((t) => t.taskId)
                .sort()
        ).toEqual([OPS_MONITOR, CONTENT_MONITOR].sort());
        expect(byTask.get(CONTENT_MONITOR).waitMs).toBeGreaterThan(40000);
    });

    test('time before completeFrom (executions evicted from memory) is left out of the analytics', () => {
        const all = buildAnalytics(snapshotParam());
        const before = buildAnalytics(snapshotParam({ completeFrom: FROM - 60 * MINUTE }));
        expect(before).toEqual(all);

        // The congestion was at 06:29; with data complete only from 06:45 it is not counted
        const clipped = buildAnalytics(snapshotParam({ completeFrom: FROM + 45 * MINUTE }));
        expect(clipped.episodes).toEqual([]);
        expect(clipped.concurrency.total.length).toBeGreaterThan(0);
        expect(Math.min(...clipped.concurrency.total.map((b) => b[0]))).toBeGreaterThanOrEqual(FROM + 45 * MINUTE);

        const nothing = buildAnalytics(snapshotParam({ completeFrom: TO + MINUTE }));
        expect(nothing.episodes).toEqual([]);
        expect(maxOf([[0, 0, 0], ...nothing.concurrency.total], 1)).toBe(0);
    });

    test('without scheduler info, episodes come from queueing alone and have no capacity', () => {
        const { episodes } = buildAnalytics(snapshotParam({ schedulers: undefined }));

        expect(episodes).toHaveLength(1);
        expect(episodes[0]).toMatchObject({ capacity: null, peakQueued: 2 });
    });

    test('task stats only for visible lanes with executions in the window, in lane order', () => {
        const { taskStats } = buildAnalytics(snapshotParam());

        // The external program task is visible but only ran in September
        expect(taskStats.map((s) => s.lane)).toEqual([0, 2]);
        expect(taskStats[0]).toMatchObject({ lane: 0, runs: 1, fails: 1, lastStatus: 8 });
        expect(taskStats[0].totalWaitMs).toBeGreaterThan(40000);
        expect(taskStats[1]).toMatchObject({ lane: 2, runs: 1, fails: 0, lastStatus: 7 });
        expect(taskStats[0]).not.toHaveProperty('taskId');
    });

    test('stale "running" records are left out, unless QRS lists a running session for them', () => {
        const old = NOW - STALE_RUNNING_MS - MINUTE;
        const ghost = makeRec({ resultId: 'ghost-0000', taskId: CONTENT_MONITOR, triggeredAt: old, startedAt: old });
        const records = [...RECORDS, ghost];

        const without = buildAnalytics(snapshotParam({ records }));
        expect(without.concurrency.total[0]).toEqual([FROM, 0, 0]);
        expect(maxOf(without.concurrency.total, 1)).toBe(4);
        expect(without.taskStats[0]).toMatchObject({ lane: 0, runs: 1 });

        const withSession = buildAnalytics(snapshotParam({ records, runningResultIds: new Set(['ghost-0000']) }));
        expect(withSession.concurrency.total[0]).toEqual([FROM, 1, 0]);
        expect(maxOf(withSession.concurrency.total, 1)).toBe(5);
        expect(withSession.taskStats[0]).toMatchObject({ lane: 0, runs: 2 });
    });

    test('a window without executions gives zero series and no episodes', () => {
        const from = TO + 60 * MINUTE;
        const to = from + 30 * MINUTE;
        const a = buildAnalytics(snapshotParam({ window: { from, to }, now: to }));

        expect(a.concurrency.total).toHaveLength(30);
        expect(a.concurrency.total.every(([, run, queue]) => run === 0 && queue === 0)).toBe(true);
        expect(a.episodes).toEqual([]);
        expect(a.taskStats).toEqual([]);
    });
});

describe('buildSnapshot', () => {
    test('has the documented shape', () => {
        const param = snapshotParam();
        param.coverage.addGlobal(FROM, TO);
        const snap = buildSnapshot(param);

        expect(Object.keys(snap).sort()).toEqual([
            'analytics',
            'capacity',
            'cols',
            'generatedAt',
            'lanes',
            'live',
            'nodes',
            'rev',
            'sources',
            'window',
        ]);
        expect(snap).toMatchObject({ rev: 42, generatedAt: NOW, live: true, window: { from: FROM, to: TO }, nodes: [NODE] });
        expect(snap.sources).toBe(param.sources);
        expect(snap.capacity).toEqual({ nodes: [{ name: NODE, maxConcurrentEngines: 4 }] });
        expect(snap.lanes.map((l) => [l.idx, l.name, l.coverage])).toEqual([
            [0, 'Content Monitor', [[FROM, TO]]],
            [2, 'Operations Monitor', [[FROM, TO]]],
            [5, 'Nightly export', [[FROM, TO]]],
        ]);
        const lengths = Object.values(snap.cols).map((c) => c.length);
        expect(new Set(lengths)).toEqual(new Set([2]));
        // Every record refers to a lane and a node that are in the snapshot
        expect(snap.cols.lane.every((l) => snap.lanes.some((lane) => lane.idx === l))).toBe(true);
        expect(snap.cols.node.every((n) => n >= 0 && n < snap.nodes.length)).toBe(true);
        expect(snap.analytics).toEqual(buildAnalytics(snapshotParam()));
    });

    test('is plain JSON and leaves its inputs alone', () => {
        const param = snapshotParam();
        const before = JSON.parse(JSON.stringify(param.records));
        const snap = buildSnapshot(param);

        expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
        expect(param.records).toEqual(before);
    });

    test('stale records are drawn (flagged) but not counted as running', () => {
        const old = NOW - STALE_RUNNING_MS - MINUTE;
        const ghost = makeRec({ resultId: 'ghost-1111', taskId: OPS_MONITOR, triggeredAt: old, startedAt: old });
        const snap = buildSnapshot(snapshotParam({ records: [...RECORDS, ghost] }));

        const i = snap.cols.key.indexOf('r:ghost-1111');
        expect(i).toBeGreaterThanOrEqual(0);
        expect(snap.cols.flags[i] & FLAG_STALE).toBe(FLAG_STALE);
        expect(snap.cols.lane[i]).toBe(2);
        expect(snap.analytics.concurrency.total[0]).toEqual([FROM, 0, 0]);
    });

    test('shares the node table with live deltas, and returns a copy of its names', () => {
        const nodes = createNodeTable(['other-node']);
        const snap = buildSnapshot(snapshotParam({ nodes }));

        expect(snap.nodes).toEqual(['other-node', NODE]);
        expect(snap.cols.node).toEqual([1, 1]);
        expect(nodes.idx('third-node')).toBe(2);
        expect(snap.nodes).toEqual(['other-node', NODE]);
    });

    test('without schedulers or records', () => {
        const snap = buildSnapshot(snapshotParam({ records: [], schedulers: undefined, live: false, rev: 0 }));

        expect(snap).toMatchObject({ rev: 0, live: false, nodes: [], capacity: { nodes: [] } });
        expect(Object.values(snap.cols).every((c) => c.length === 0)).toBe(true);
        expect(snap.lanes).toHaveLength(3);
        expect(snap.analytics.episodes).toEqual([]);
        expect(snap.analytics.taskStats).toEqual([]);
    });
});

// ---------------------------------------------------------------------------------------------------------------------
// API routes

const RID = '570f641f-6e79-455b-bc1a-533a99bbb5a7';
const XID = '81e91df1-baf0-46f5-9f41-bb36a8720c49';
const TID = CONTENT_MONITOR;

const INVALID_KEYS = [
    ['missing', null],
    ['empty', ''],
    ['bare GUID', RID],
    ['unknown prefix', `q:${RID}`],
    ['prefix without colon', `r${RID}`],
    ['SQL injection', `r:${RID}' OR '1'='1`],
    ['SQL comment', `r:${RID}'--`],
    ['stacked SQL statement', `r:${RID}; DROP TABLE "ExecutionResults"`],
    ['QRS filter injection', `r:${RID} or id ne ${RID}`],
    ['QRS filter injection in an f: key', `f:${TID}:1 or taskID ne ${TID}`],
    ['URL query smuggling', `r:${RID}&filter=id ne null`],
    ['trailing newline', `r:${RID}\n`],
    ['leading newline', `\nr:${RID}`],
    ['trailing NUL', `r:${RID}\u0000`],
    ['surrounding spaces', ` r:${RID} `],
    ['path traversal', 'r:../../qrs/about'],
    ['regex metacharacters', 'r:.*'],
    ['GUID in braces', `r:{${RID}}`],
    ['GUID without dashes', `r:${RID.replace(/-/g, '')}`],
    ['non-hex character', `x:${RID.replace('a', 'g')}`],
    ['GUID one char short', `r:${RID.slice(0, -1)}`],
    ['GUID one char long', `r:${RID}0`],
    ['two keys', `r:${RID},x:${XID}`],
    ['r: key with a time', `r:${RID}:1759732185239`],
    ['f: key without time', `f:${TID}`],
    ['f: key with empty time', `f:${TID}:`],
    ['f: key with negative time', `f:${TID}:-1`],
    ['f: key with decimal time', `f:${TID}:1759732185239.5`],
    ['f: key with exponent', `f:${TID}:1e12`],
    ['f: key with 17 digit time', `f:${TID}:${'9'.repeat(17)}`],
    ['f: key with non-ASCII digits', `f:${TID}:١٢٣`],
    ['f: key with non-GUID task', 'f:task-1:1759732185239'],
];

const VALID_KEYS = [
    ['r: key', `r:${RID}`],
    ['x: key', `x:${XID}`],
    ['upper-case GUID', `r:${RID.toUpperCase()}`],
    ['mixed-case GUID', `x:${XID.slice(0, 8).toUpperCase()}${XID.slice(8)}`],
    ['f: key', `f:${TID}:1759732185239`],
    ['f: key with upper-case task id', `f:${TID.toUpperCase()}:1759732185239`],
    ['f: key at epoch 0', `f:${TID}:0`],
    ['f: key with 16 digit time', `f:${TID}:${'9'.repeat(16)}`],
];

const routeOf = (routes, path) => routes.find((r) => r.path === path);

/**
 * Fake task-gantt app over the fixture records.
 *
 * @returns {object} App with jest mocks.
 */
const makeApp = () => {
    const store = new Map(RECORDS.map((r) => [r.key, r]));
    const lanes = makeLanes();
    return {
        snapshot: jest.fn(() => buildSnapshot(snapshotParam({ lanes }))),
        executionDetails: jest.fn(async (key) => {
            const record = store.get(key);
            if (!record) return null;
            const lane = lanes.get(record.taskId);
            return { record, task: lane ? { id: lane.id, name: lane.name } : null, qrs: null };
        }),
    };
};

/**
 * Call the /api/execution handler directly.
 *
 * @param {Array<object>} routes - Routes from createApiRoutes().
 * @param {string|null|Array<string>} key - Value(s) of the key parameter; null for none.
 * @returns {Promise<{sendJson: Function, result: any}>} The sendJson mock and the handler's return value.
 */
const callExecution = async (routes, key) => {
    const query = new URLSearchParams();
    for (const k of key === null ? [] : [].concat(key)) query.append('key', k);
    const sendJson = jest.fn(async () => {});
    const result = await routeOf(routes, '/api/execution').handler({ query, sendJson });
    return { sendJson, result };
};

describe('createApiRoutes', () => {
    const pageConfig = { version: '9.9.9', host: 'qs.example.com', window: { from: FROM, to: TO } };

    test('declares GET routes; /api/events only with an SSE hub', () => {
        const routes = createApiRoutes({ app: makeApp(), pageConfig });

        expect(routes.map((r) => r.path)).toEqual(['/api/config', '/api/snapshot', '/api/execution']);
        expect(routes.every((r) => (r.method ?? 'GET') === 'GET' && typeof r.handler === 'function')).toBe(true);

        const withSse = createApiRoutes({ app: makeApp(), pageConfig, sse: { handle: jest.fn() } });
        expect(withSse.map((r) => r.path)).toEqual(['/api/config', '/api/snapshot', '/api/events', '/api/execution']);
    });

    test('/api/config returns the page configuration', () => {
        const app = makeApp();
        const routes = createApiRoutes({ app, pageConfig });

        expect(routeOf(routes, '/api/config').handler({})).toBe(pageConfig);
        expect(app.snapshot).not.toHaveBeenCalled();
    });

    test('/api/snapshot builds a fresh snapshot per request', () => {
        const app = makeApp();
        const routes = createApiRoutes({ app, pageConfig });
        const handler = routeOf(routes, '/api/snapshot').handler;

        const first = handler({});
        handler({});

        expect(app.snapshot).toHaveBeenCalledTimes(2);
        expect(first).toMatchObject({ rev: 42, nodes: [NODE] });
        expect(first.cols.key).toEqual([keyOf(CONTENT_MONITOR), keyOf(OPS_MONITOR)]);
    });

    test('/api/events hands the request to the SSE hub with the base headers', () => {
        const sse = { handle: jest.fn(() => 'handled') };
        const routes = createApiRoutes({ app: makeApp(), pageConfig, sse });
        const ctx = { req: { id: 'req' }, res: { id: 'res' }, baseHeaders: { 'X-Frame-Options': 'DENY' }, query: new URLSearchParams() };

        expect(routeOf(routes, '/api/events').handler(ctx)).toBe('handled');
        expect(sse.handle).toHaveBeenCalledTimes(1);
        expect(sse.handle).toHaveBeenCalledWith(ctx.req, ctx.res, ctx.baseHeaders);
    });

    describe('/api/execution', () => {
        test.each(INVALID_KEYS)('rejects an invalid key (%s) with 400 without a lookup', async (_name, key) => {
            const app = makeApp();
            const { sendJson, result } = await callExecution(createApiRoutes({ app, pageConfig }), key);

            expect(sendJson).toHaveBeenCalledTimes(1);
            expect(sendJson).toHaveBeenCalledWith(400, { error: 'invalid key' });
            expect(app.executionDetails).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        test.each(VALID_KEYS)('looks up a well-formed key (%s) as given, 404 when unknown', async (_name, key) => {
            const app = makeApp();
            app.executionDetails.mockResolvedValueOnce(null);
            const { sendJson } = await callExecution(createApiRoutes({ app, pageConfig }), key);

            expect(app.executionDetails).toHaveBeenCalledTimes(1);
            expect(app.executionDetails).toHaveBeenCalledWith(key);
            expect(sendJson).toHaveBeenCalledTimes(1);
            expect(sendJson).toHaveBeenCalledWith(404, { error: 'unknown execution' });
        });

        test('returns the details of a known execution', async () => {
            const app = makeApp();
            const key = keyOf(CONTENT_MONITOR);
            const { sendJson } = await callExecution(createApiRoutes({ app, pageConfig }), key);

            expect(sendJson).toHaveBeenCalledTimes(1);
            const [status, body] = sendJson.mock.calls[0];
            expect(status).toBe(200);
            expect(body).toEqual({
                record: RECORDS.find((r) => r.key === key),
                task: { id: CONTENT_MONITOR, name: 'Content Monitor' },
                qrs: null,
            });
        });

        test('keys are not case-normalised: an upper-case variant of a known key is unknown', async () => {
            const app = makeApp();
            const { sendJson } = await callExecution(
                createApiRoutes({ app, pageConfig }),
                keyOf(CONTENT_MONITOR).toUpperCase().replace(/^R/, 'r')
            );

            expect(sendJson).toHaveBeenCalledWith(404, { error: 'unknown execution' });
        });

        test('only the first key parameter counts', async () => {
            const app = makeApp();
            const routes = createApiRoutes({ app, pageConfig });

            const bad = await callExecution(routes, ["r:' OR 1=1", keyOf(CONTENT_MONITOR)]);
            expect(bad.sendJson).toHaveBeenCalledWith(400, { error: 'invalid key' });
            expect(app.executionDetails).not.toHaveBeenCalled();

            const good = await callExecution(routes, [keyOf(OPS_MONITOR), "' OR 1=1"]);
            expect(app.executionDetails).toHaveBeenCalledWith(keyOf(OPS_MONITOR));
            expect(good.sendJson.mock.calls[0][0]).toBe(200);
        });

        test('a failing lookup rejects without sending a response, so the server answers 500', async () => {
            const app = makeApp();
            app.executionDetails.mockRejectedValueOnce(new Error('QRS unreachable'));

            const query = new URLSearchParams({ key: keyOf(CONTENT_MONITOR) });
            const sendJson = jest.fn(async () => {});
            await expect(routeOf(createApiRoutes({ app, pageConfig }), '/api/execution').handler({ query, sendJson })).rejects.toThrow(
                'QRS unreachable'
            );
            expect(sendJson).not.toHaveBeenCalled();
        });
    });
});

describe('API routes behind the real web server', () => {
    const pageConfig = { version: '9.9.9', window: { from: FROM, to: TO } };
    let app;
    let sse;
    let server;
    let serverNoSse;

    beforeAll(async () => {
        app = makeApp();
        sse = {
            handle: jest.fn((req, res, headers) => {
                res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream' });
                res.end('event: hello\ndata: {}\n\n');
            }),
        };
        server = await startWebServer({
            host: '127.0.0.1',
            port: 0,
            apiRoutes: createApiRoutes({ app, pageConfig, sse }),
            logger: silentLogger,
        });
        serverNoSse = await startWebServer({
            host: '127.0.0.1',
            port: 0,
            apiRoutes: createApiRoutes({ app, pageConfig }),
            logger: silentLogger,
        });
    });

    afterAll(async () => {
        await server?.close();
        await serverNoSse?.close();
    });

    const get = (path, srv = server) => rawRequest({ port: srv.port, path });

    test('/api/config and /api/snapshot are served as JSON', async () => {
        const config = await get('/api/config');
        expect(config.status).toBe(200);
        expect(config.headers['content-type']).toMatch(/^application\/json/);
        expect(JSON.parse(config.body)).toEqual(pageConfig);

        const snap = await get('/api/snapshot');
        expect(snap.status).toBe(200);
        expect(JSON.parse(snap.body)).toEqual(buildSnapshot(snapshotParam()));
    });

    test('/api/execution over HTTP: 400 for injection attempts, 404 unknown, 200 known', async () => {
        const injected = encodeURIComponent(`r:${RID}' OR '1'='1`);
        const bad = await get(`/api/execution?key=${injected}`);
        expect(bad.status).toBe(400);
        expect(JSON.parse(bad.body)).toEqual({ error: 'invalid key' });

        const newline = await get(`/api/execution?key=r:${RID}%0A`);
        expect(newline.status).toBe(400);

        const filter = await get(`/api/execution?key=${encodeURIComponent(`r:${RID} or id ne ${RID}`)}`);
        expect(filter.status).toBe(400);

        const unknown = await get(`/api/execution?key=x:${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`);
        expect(unknown.status).toBe(404);
        expect(JSON.parse(unknown.body)).toEqual({ error: 'unknown execution' });

        const key = keyOf(OPS_MONITOR);
        const known = await get(`/api/execution?key=${encodeURIComponent(key)}`);
        expect(known.status).toBe(200);
        const body = JSON.parse(known.body);
        expect(body.record).toMatchObject({ key, taskId: OPS_MONITOR, status: 7, nodeName: NODE });
        expect(body.task).toEqual({ id: OPS_MONITOR, name: 'Operations Monitor' });
    });

    test('/api/execution answers 500 when the lookup fails', async () => {
        app.executionDetails.mockRejectedValueOnce(new Error('boom'));

        const res = await get(`/api/execution?key=${encodeURIComponent(keyOf(CONTENT_MONITOR))}`);

        expect(res.status).toBe(500);
        expect(res.body).not.toMatch(/boom/);
    });

    test('/api/events goes to the SSE hub with the security headers; absent without a hub', async () => {
        const events = await get('/api/events');
        expect(events.status).toBe(200);
        expect(events.headers['content-type']).toBe('text/event-stream');
        expect(events.headers['x-frame-options']).toBe('DENY');
        expect(events.headers['content-security-policy']).toBeDefined();
        expect(events.body).toContain('event: hello');
        expect(sse.handle).toHaveBeenCalledTimes(1);

        const none = await get('/api/events', serverNoSse);
        expect(none.status).toBe(404);
    });
});
