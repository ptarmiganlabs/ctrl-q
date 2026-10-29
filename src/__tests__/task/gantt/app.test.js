import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createGanttApp, newSourceStatus } from '../../../lib/task-gantt/app.js';
import { validateTaskGanttOptions } from '../../../lib/task-gantt/options.js';
import { mergeIntervals } from '../../../lib/task-gantt/shared/sweep.js';
import { FLAG_STALE } from '../../../lib/task-gantt/api/snapshot.js';
import { createQrsPoller } from '../../../lib/task-gantt/live/qrs-poller.js';
import { createLivePublisher, taskGantt } from '../../../lib/cmd/qseow/taskgantt.js';
import { logger as globalLogger } from '../../../globals.js';
import { silentLogger } from '../../util/web/web-test-helpers.mjs';

// Real QRS rows (anonymised) from a lab run: 6 reload tasks triggered at 06:29:45 on one node with
// maxConcurrentEngines 4, so Content Monitor and Operations Monitor queued ~46/49 s. Plus two older runs of a
// task without an app (here: a user sync task), from 2026-09-30 and 2026-09-09.
const ROWS = JSON.parse(fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8'));

const HOST = 'sense.example.com';
const NODE1 = 'sense-node1.example.com';
const NODE2 = 'sense-node2.example.com';
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.parse('2026-10-06T07:00:00.000Z');

const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
const OPS_MONITOR = '0419086f-a935-4358-a356-da2f79069e78';
const CAL_PERF_1 = 'a87ae597-be31-4453-be04-5b4f67489d8d';
const CAL_PERF_2 = '60f56836-b6e4-4690-8896-a2262c4ebb8c';
const CAL_PERF_3 = '8d2c5d0c-12e2-4dc8-9832-de1ae367a373';
const CAL_PERF_4 = '5fee7b84-76f8-4cc1-ba4f-466d8eefa8be';
const USER_SYNC = '0359bda0-22dc-4c46-983c-8724266eb4ef';
const RELOAD_TASKS = [CONTENT_MONITOR, CAL_PERF_1, OPS_MONITOR, CAL_PERF_3, CAL_PERF_2, CAL_PERF_4];

const CM_RESULT = '570f641f-6e79-455b-bc1a-533a99bbb5a7';
const CM_KEY = `r:${CM_RESULT}`;
const OM_KEY = 'r:db55cd5a-870f-417e-8b2d-b3b39c3f450f';
const OLD_SYNC_KEY = 'r:02f7bc8e-a4d6-48cd-85b2-90ae5c61ba40';
const CM_TRIGGERED = Date.parse('2026-10-06T06:29:45.239Z');
const OLDEST_TRIGGERED = Date.parse('2026-09-09T05:20:30.143Z');
const NEWEST_MODIFIED = Date.parse('2026-10-06T06:31:21.216Z');

// A task created after Ctrl-Q started, running on a node QRS has not reported yet
const NEW_TASK = '11111111-2222-4333-8444-555555555555';
const NEW_APP = '22222222-3333-4444-8555-666666666666';
const NEW_RESULT = '33333333-4444-4555-8666-777777777777';
const NEW_KEY = `r:${NEW_RESULT}`;

const appOf = (taskId) => ROWS.find((r) => r.taskID === taskId).appID;
const iso = (ms) => new Date(ms).toISOString();
const detail = (ms, message) => ({ detailsType: 2, message, detailCreatedDate: iso(ms) });

// GET /qrs/task/full rows
const qrsTask = (id, name, { taskType = 0, appName = null, stream = null, tags = [] } = {}) => ({
    id,
    name,
    taskType,
    enabled: true,
    app: taskType === 0 ? { id: appOf(id), name: appName, stream: stream ? { name: stream } : null } : null,
    tags: tags.map((t) => ({ name: t })),
});

const baseTasks = () => [
    qrsTask(CONTENT_MONITOR, 'Reload Content Monitor', { appName: 'Content Monitor', stream: 'Monitoring apps', tags: ['monitoring'] }),
    qrsTask(CAL_PERF_1, 'Reload Calendar perf 1', { appName: 'Calendar perf 1', stream: 'Perf' }),
    qrsTask(OPS_MONITOR, 'Reload Operations Monitor', { appName: 'Operations Monitor', stream: 'Monitoring apps', tags: ['monitoring'] }),
    qrsTask(USER_SYNC, 'User sync AD', { taskType: 2 }),
    qrsTask(CAL_PERF_3, 'Reload Calendar perf 3', { appName: 'Calendar perf 3', stream: 'Perf' }),
    qrsTask(CAL_PERF_2, 'Reload Calendar perf 2', { appName: 'Calendar perf 2', stream: 'Perf' }),
    qrsTask(CAL_PERF_4, 'Reload Calendar perf 4', { appName: 'Calendar perf 4', stream: 'Perf' }),
];
// Lane numbers follow the order QRS lists the tasks in
const LANE = { [CONTENT_MONITOR]: 0, [CAL_PERF_1]: 1, [OPS_MONITOR]: 2, [USER_SYNC]: 3, [CAL_PERF_3]: 4, [CAL_PERF_2]: 5, [CAL_PERF_4]: 6 };

// GET /qrs/schedulerservice/full rows. Type 0 (Master) does not run reloads.
const scheduler = (hostName, type, maxConcurrentEngines) => ({
    settings: { schedulerServiceType: type, maxConcurrentEngines },
    serverNodeConfiguration: { hostName },
});
const baseSchedulers = () => [scheduler('Central.example.com', 0, 4), scheduler('Sense-Node1.example.com', 1, 4)];

// An execution of NEW_TASK, triggered one minute after NOW
const newTaskRow = ({ status, stoppedAt = null, modifiedAt }) => ({
    id: NEW_RESULT,
    taskID: NEW_TASK,
    executionID: '44444444-5555-4666-8777-888888888888',
    appID: NEW_APP,
    executingNodeName: 'Sense-Node2.example.com',
    status,
    startTime: iso(NOW + MIN),
    stopTime: stoppedAt === null ? '1753-01-01T00:00:00.000Z' : iso(stoppedAt),
    modifiedDate: iso(modifiedAt),
    scriptLogAvailable: false,
    details: [
        detail(NOW + MIN, 'Changing task state to Triggered'),
        detail(NOW + MIN + 500, 'Changing task state from Triggered to Started'),
        ...(stoppedAt === null ? [] : [detail(stoppedAt - 100, 'Changing task state from Started to FinishedSuccess')]),
    ],
});

// NEW_TASK as GET /qrs/task/full lists it, once it is known
const newTask = () => ({
    id: NEW_TASK,
    name: 'Reload New Sales',
    taskType: 0,
    enabled: true,
    app: { id: NEW_APP, name: 'New Sales' },
    tags: [],
});

/**
 * A fake QRS. The request function has the same signature as qrsRequestJson(options, { method, path, query }) and
 * answers from mutable state, so a test can change tasks, capacity and execution results between calls.
 *
 * @param {Function} clock - Clock used for the response's server date.
 * @returns {object} Stub state, with .request and .calls. Set .skewMs for a Sense clock that is ahead (or behind).
 */
function createQrsStub(clock) {
    const stub = {
        tasks: baseTasks(),
        schedulers: baseSchedulers(),
        clusterId: 'cluster-1',
        rows: structuredClone(ROWS),
        sessions: [],
        apps: [],
        failures: new Map(),
        calls: [],
        skewMs: 0,
    };
    stub.request = async (options, { method = 'get', path: p, query = {} }) => {
        stub.calls.push({ options, method, path: p, query: { ...query } });
        if (stub.failures.has(p)) throw stub.failures.get(p);
        const reply = (data) => ({ status: 200, data: structuredClone(data), serverDate: clock() + stub.skewMs });
        switch (p) {
            case '/qrs/task/full':
                return reply(stub.tasks);
            case '/qrs/schedulerservice/full':
                return reply(stub.schedulers);
            case '/qrs/servicecluster/full':
                return reply([{ id: stub.clusterId, name: 'ServiceCluster' }]);
            case '/qrs/executionsession/full':
                return reply(stub.sessions);
            case '/qrs/app':
                return reply(stub.apps);
            case '/qrs/executionresult/full': {
                const filter = query.filter || '';
                if (filter === 'status ne NeverStarted') return reply(stub.rows.filter((r) => r.status !== 0));
                const byId = /^id eq (\S+)$/.exec(filter);
                if (byId) return reply(stub.rows.filter((r) => r.id === byId[1]));
                const since = /^modifiedDate gt '(.+)'$/.exec(filter);
                if (since) return reply(stub.rows.filter((r) => Date.parse(r.modifiedDate) > Date.parse(since[1])));
                throw new Error(`stub: unexpected executionresult filter ${filter}`);
            }
            default:
                throw new Error(`stub: unexpected QRS ${method} ${p}`);
        }
    };
    return stub;
}

const callsTo = (stub, p) => stub.calls.filter((c) => c.path === p);

let dir;
let clock;
const now = () => clock;
let apps = [];

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrlq-gantt-app-'));
    clock = NOW;
    apps = [];
});

afterEach(async () => {
    jest.restoreAllMocks();
    for (const app of apps) await app.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
});

// Command configuration exactly as the CLI builds it
const makeConfig = (over = {}) => {
    const { ok, errors, config } = validateTaskGanttOptions({
        host: HOST,
        port: '4242',
        secure: true,
        authType: 'cert',
        lookback: '30d',
        sources: 'qrs,history-file',
        pollInterval: '10',
        historyDir: dir,
        historyRetentionDays: '90',
        visHost: 'localhost',
        visPort: '0',
        taskType: ['reload', 'ext-program'],
        ...over,
    });
    if (!ok) throw new Error(errors.join('\n'));
    return config;
};

const makeApp = (stub, config = makeConfig(), logger = silentLogger, extra = {}) => {
    const app = createGanttApp({ config, logger, now, request: stub.request, ...extra });
    apps.push(app);
    return app;
};

const hostDir = () => path.join(dir, HOST);
const historyLines = (day) => {
    const file = path.join(hostDir(), `${day}.ndjson`);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
};
const ofType = (lines, t) => lines.filter((l) => l.t === t);
const headers = (lines) => lines.filter((l) => l.v !== undefined);

// Write a daily history file by hand, as an earlier Ctrl-Q run would have
const writeHistory = (day, lines, header = { v: 1, host: HOST, clusterId: 'cluster-1' }) => {
    fs.mkdirSync(hostDir(), { recursive: true });
    const text = [header, ...lines].map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');
    fs.writeFileSync(path.join(hostDir(), `${day}.ndjson`), `${text}\n`);
};

// History line of a Content Monitor run two days ago that QRS no longer holds
const OLD_CM_RESULT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const oldCmLine = () => ({
    t: 'r',
    r: OLD_CM_RESULT,
    x: null,
    task: CONTENT_MONITOR,
    tt: 0,
    app: appOf(CONTENT_MONITOR),
    n: NODE1,
    s: 7,
    tr: NOW - 2 * DAY,
    q: null,
    st: NOW - 2 * DAY + 1000,
    sp: NOW - 2 * DAY + 60000,
    fi: NOW - 2 * DAY + 59000,
    fr: null,
});

const waitFor = async (fn, timeoutMs = 2000) => {
    const start = Date.now();
    for (;;) {
        const value = fn();
        if (value) return value;
        if (Date.now() - start > timeoutMs) throw new Error('waitFor: timed out');
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};

describe('createGanttApp init and snapshot', () => {
    test('source statuses start pending, or disabled when not selected', () => {
        const stub = createQrsStub(now);

        expect(makeApp(stub).statuses()).toEqual([newSourceStatus('qrs', 'pending'), newSourceStatus('history-file', 'pending')]);
        expect(makeApp(stub, makeConfig({ sources: 'qrs' })).statuses()[1]).toMatchObject({ id: 'history-file', state: 'disabled' });
        expect(stub.calls).toEqual([]);
    });

    test('init loads metadata, the empty history and the QRS snapshot, and sets the source statuses', async () => {
        const stub = createQrsStub(now);
        const config = makeConfig();
        const app = makeApp(stub, config);

        await app.init();

        expect(stub.calls.map((c) => c.path).sort()).toEqual(
            [
                '/qrs/executionresult/full',
                '/qrs/executionsession/full',
                '/qrs/schedulerservice/full',
                '/qrs/servicecluster/full',
                '/qrs/task/full',
            ].sort()
        );
        expect(stub.calls.every((c) => c.options === config.qseow && c.method === 'get')).toBe(true);
        expect(callsTo(stub, '/qrs/executionresult/full')[0].query).toEqual({ filter: 'status ne NeverStarted' });

        const [qrs, history] = app.statuses();
        expect(qrs).toEqual({
            id: 'qrs',
            state: 'ok',
            message: 'QRS keeps only the last few executions of each task',
            hint: '',
            lastOkAt: NOW,
            records: 8,
            coverage: { fromMs: OLDEST_TRIGGERED, toMs: NOW },
        });
        expect(history).toEqual({ id: 'history-file', state: 'ok', message: '', hint: '', lastOkAt: NOW, records: 0, coverage: null });

        expect(app.store.size()).toBe(8);
        expect(app.cursor).toBe(NEWEST_MODIFIED);
        expect(app.lanes().all()).toHaveLength(7);
        expect(app.lanes().get(USER_SYNC)).toMatchObject({ idx: 3, visible: false, deleted: false });
        expect(app.history().mode()).toBe('readwrite');
        expect(app.hasRunning()).toBe(false);
    });

    test('snapshot holds visible lanes, their executions, coverage, capacity and the congestion episode', async () => {
        const app = makeApp(createQrsStub(now));
        await app.init();

        const snap = app.snapshot();

        expect(snap).toMatchObject({
            rev: 1,
            generatedAt: NOW,
            live: { rev: 1, now: NOW, from: NOW, coveredTo: NOW, pollIntervalMs: 10000, qrs: { state: 'ok' }, staleKeys: [] },
            window: { from: NOW - 30 * DAY, to: NOW },
            nodes: [NODE1],
        });
        expect(snap.capacity).toEqual({ nodes: [{ name: NODE1, maxConcurrentEngines: 4 }] });
        expect(snap.sources.map((s) => [s.id, s.state])).toEqual([
            ['qrs', 'ok'],
            ['history-file', 'ok'],
        ]);

        // The user sync task is filtered out by --task-type, but keeps its lane number
        expect(snap.lanes.map((l) => l.id)).toEqual(RELOAD_TASKS);
        expect(snap.lanes.map((l) => l.idx)).toEqual([0, 1, 2, 4, 5, 6]);
        expect(snap.lanes[0]).toEqual({
            idx: 0,
            id: CONTENT_MONITOR,
            name: 'Reload Content Monitor',
            taskType: 0,
            enabled: true,
            appId: appOf(CONTENT_MONITOR),
            appName: 'Content Monitor',
            stream: 'Monitoring apps',
            tags: ['monitoring'],
            deleted: false,
            coverage: [[CM_TRIGGERED, NOW]],
        });

        // One column entry per execution of a visible lane; the user sync runs are left out
        expect(Object.keys(snap.cols)).toEqual([
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
        expect(snap.cols.key).toHaveLength(6);
        expect(snap.cols.key).not.toContain(OLD_SYNC_KEY);
        const cm = snap.cols.key.indexOf(CM_KEY);
        expect(snap.cols.lane[cm]).toBe(LANE[CONTENT_MONITOR]);
        expect(snap.cols.status[cm]).toBe(8);
        expect(snap.cols.triggeredAt[cm]).toBe(CM_TRIGGERED);
        expect(snap.cols.startedAt[cm] - snap.cols.queuedAt[cm]).toBeGreaterThan(45000);
        expect(new Set(snap.cols.node)).toEqual(new Set([0]));
        expect(new Set(snap.cols.src)).toEqual(new Set([1]));
        expect(new Set(snap.cols.flags)).toEqual(new Set([0]));

        // Congestion: 4 running + 2 queued on the node, the two queued tasks listed first, with lane and name
        expect(snap.analytics.episodes).toHaveLength(1);
        const [ep] = snap.analytics.episodes;
        expect(ep).toMatchObject({ node: NODE1, capacity: 4, peakRunning: 4, peakQueued: 2 });
        expect(ep.waitMs).toBeGreaterThan(90000);
        expect(ep.waitMs).toBeLessThan(100000);
        expect(ep.tasks).toHaveLength(6);
        expect(ep.tasks.slice(0, 2).sort((a, b) => a.lane - b.lane)).toEqual([
            expect.objectContaining({ taskId: CONTENT_MONITOR, lane: 0, name: 'Reload Content Monitor', runs: 1 }),
            expect.objectContaining({ taskId: OPS_MONITOR, lane: 2, name: 'Reload Operations Monitor', runs: 1 }),
        ]);

        // Task stats for visible lanes only
        expect(snap.analytics.taskStats.map((s) => s.lane)).toEqual([0, 1, 2, 4, 5, 6]);
        expect(snap.analytics.taskStats[0]).toMatchObject({ lane: 0, runs: 1, fails: 1, lastStatus: 8 });
    });

    test('analyticsPayload matches the snapshot analytics and carries statuses and capacity', async () => {
        const app = makeApp(createQrsStub(now), makeConfig({ sources: 'qrs' }));
        await app.init();
        clock = NOW + 5 * MIN;

        const payload = app.analyticsPayload();

        expect(payload.rev).toBe(1);
        expect(payload.window).toEqual({ from: NOW + 5 * MIN - 30 * DAY, to: NOW + 5 * MIN });
        expect(payload.analytics).toEqual(app.snapshot().analytics);
        expect(payload.analytics.episodes).toHaveLength(1);
        expect(payload.sources.map((s) => [s.id, s.state])).toEqual([
            ['qrs', 'ok'],
            ['history-file', 'disabled'],
        ]);
        expect(payload.capacity).toEqual({ nodes: [{ name: NODE1, maxConcurrentEngines: 4 }] });
    });

    test('a "running" record without a running session for over 24 h is stale, unless QRS lists a session', async () => {
        const STALE_RESULT = '55555555-6666-4777-8888-999999999999';
        const stub = createQrsStub(now);
        stub.rows.push({
            id: STALE_RESULT,
            taskID: OPS_MONITOR,
            appID: appOf(OPS_MONITOR),
            executingNodeName: NODE1,
            status: 2,
            startTime: iso(NOW - 30 * 60 * MIN),
            stopTime: '1753-01-01T00:00:00.000Z',
            modifiedDate: iso(NOW - 30 * 60 * MIN + 1000),
            details: [],
        });
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        const flagsOf = (snap) => snap.cols.flags[snap.cols.key.indexOf(`r:${STALE_RESULT}`)];
        const runningBeforeTheLabRun = (snap) =>
            Math.max(...snap.analytics.concurrency.total.filter((b) => b[0] < Date.parse('2026-10-06T06:00:00.000Z')).map((b) => b[1]));

        expect(app.hasRunning()).toBe(false);
        expect(flagsOf(app.snapshot())).toBe(FLAG_STALE);
        expect(runningBeforeTheLabRun(app.snapshot())).toBe(0);

        app.setRunningResultIds(new Set([STALE_RESULT]));

        expect(app.hasRunning()).toBe(true);
        expect(flagsOf(app.snapshot())).toBe(0);
        expect(runningBeforeTheLabRun(app.snapshot())).toBe(1);

        // Same when the session is already listed at start-up
        stub.sessions = [{ id: 'session-1', executionResult: { id: STALE_RESULT } }];
        const app2 = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app2.init();
        expect(app2.hasRunning()).toBe(true);
    });

    test('without live updates the snapshot is not live and coverage is not extended', async () => {
        const app = makeApp(createQrsStub(now), makeConfig({ pollInterval: '0' }));
        await app.init();

        app.markLive(NOW + MIN);
        app.breakLiveCoverage(NOW + 20 * MIN);
        clock = NOW + 30 * MIN;
        await app.close();

        expect(app.snapshot().live).toBeNull();
        expect(app.coverage.globalRanges()).toEqual([]);
        expect(ofType(historyLines('2026-10-06'), 'obs')).toEqual([]);
    });
});

describe('lane filters', () => {
    test('--app-tag is resolved to app ids via /qrs/app; it chooses lanes, analytics still count all reloads', async () => {
        const stub = createQrsStub(now);
        stub.apps = [{ id: appOf(CONTENT_MONITOR) }, { id: appOf(OPS_MONITOR) }];
        const app = makeApp(stub, makeConfig({ sources: 'qrs', appTag: ['Monitoring', "O'Brien"] }));

        await app.init();

        const appCalls = callsTo(stub, '/qrs/app');
        expect(appCalls).toHaveLength(1);
        expect(appCalls[0].query).toEqual({ filter: "tags.name eq 'Monitoring' or tags.name eq 'O''Brien'" });

        const snap = app.snapshot();
        expect(snap.lanes.map((l) => l.id)).toEqual([CONTENT_MONITOR, OPS_MONITOR]);
        expect([...snap.cols.key].sort()).toEqual([CM_KEY, OM_KEY].sort());
        const [ep] = snap.analytics.episodes;
        expect(ep.tasks).toHaveLength(6);
        const hidden = ep.tasks.filter((t) => t.lane === null);
        expect(hidden.map((t) => t.taskId).sort()).toEqual([CAL_PERF_1, CAL_PERF_2, CAL_PERF_3, CAL_PERF_4].sort());
        expect(hidden.every((t) => t.name.startsWith('Reload Calendar perf'))).toBe(true);
        expect(snap.analytics.taskStats.map((s) => s.lane)).toEqual([0, 2]);
    });

    test('/qrs/app is not called without --app-tag; --task-tag filters on task tags', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs', taskTag: 'monitoring' }));
        await app.init();

        expect(callsTo(stub, '/qrs/app')).toEqual([]);
        expect(app.snapshot().lanes.map((l) => l.id)).toEqual([CONTENT_MONITOR, OPS_MONITOR]);

        const none = makeApp(stub, makeConfig({ sources: 'qrs', taskTag: 'no-such-tag' }));
        await none.init();
        expect(none.snapshot().lanes).toEqual([]);
    });

    test.each([
        ['--task-id', { taskId: [CONTENT_MONITOR.toUpperCase()] }],
        ['--app-id', { appId: [appOf(CONTENT_MONITOR).toUpperCase()] }],
    ])('%s given in upper case shows its lane', async (_name, over) => {
        const app = makeApp(createQrsStub(now), makeConfig({ sources: 'qrs', ...over }));
        await app.init();

        expect(app.snapshot().lanes.map((l) => l.id)).toEqual([CONTENT_MONITOR]);
    });

    // BUG: lanes.js isTaskVisible() only looks at the resolved app ids. When no app carries the tag the set is empty,
    // so no filter is considered active and every task gets a lane, while --task-tag no-such-tag shows none.
    test('--app-tag that matches no app shows no lanes, like --task-tag does', async () => {
        const stub = createQrsStub(now);
        stub.apps = [];
        const app = makeApp(stub, makeConfig({ sources: 'qrs', appTag: 'no-such-tag' }));
        await app.init();

        expect(callsTo(stub, '/qrs/app')).toHaveLength(1);
        expect(app.snapshot().lanes).toEqual([]);
    });
});

describe('history file', () => {
    test('init writes finished QRS executions, task names and QRS coverage to daily files', async () => {
        const app = makeApp(createQrsStub(now));
        await app.init();

        expect(JSON.parse(fs.readFileSync(path.join(hostDir(), '.lock'), 'utf8'))).toMatchObject({ pid: process.pid, host: os.hostname() });
        await app.close();
        expect(fs.readdirSync(hostDir()).sort()).toEqual(['2026-09-09.ndjson', '2026-09-30.ndjson', '2026-10-06.ndjson']);

        const today = historyLines('2026-10-06');
        expect(today[0]).toEqual({ v: 1, host: HOST, clusterId: 'cluster-1' });
        expect(headers(today)).toHaveLength(1);
        expect(ofType(today, 'task')).toHaveLength(7);
        expect(ofType(today, 'r')).toHaveLength(6);
        // One coverage line per start, whatever the number of tasks
        expect(ofType(today, 'covs')).toHaveLength(1);
        expect(today).toHaveLength(15);

        expect(ofType(today, 'task').find((l) => l.id === CONTENT_MONITOR)).toEqual({
            t: 'task',
            id: CONTENT_MONITOR,
            name: 'Reload Content Monitor',
            tt: 0,
            app: appOf(CONTENT_MONITOR),
            appName: 'Content Monitor',
        });
        expect(ofType(today, 'task').find((l) => l.id === USER_SYNC)).toMatchObject({ tt: 2, app: null, appName: null });
        const cmLine = ofType(today, 'r').find((l) => l.r === CM_RESULT);
        expect(cmLine).toMatchObject({
            task: CONTENT_MONITOR,
            tt: 0,
            n: NODE1,
            s: 8,
            tr: CM_TRIGGERED,
            sp: Date.parse('2026-10-06T06:31:10.481Z'),
        });
        expect(cmLine.fr).toMatch(/^Message from ReloadProvider/);
        const [covs] = ofType(today, 'covs');
        expect(covs.to).toBe(NOW);
        expect(Object.keys(covs.tasks)).toHaveLength(7);
        expect(covs.tasks[CONTENT_MONITOR]).toBe(CM_TRIGGERED);

        // Records go to the file of their trigger day
        expect(ofType(historyLines('2026-09-30'), 'r').map((l) => l.task)).toEqual([USER_SYNC]);
        expect(ofType(historyLines('2026-09-09'), 'r').map((l) => `r:${l.r}`)).toEqual([OLD_SYNC_KEY]);
        // The lock is released
        expect(fs.existsSync(path.join(hostDir(), '.lock'))).toBe(false);
    });

    test('a second instance loads the history back and does not append unchanged records or tasks again', async () => {
        const first = makeApp(createQrsStub(now));
        await first.init();
        await first.close();

        clock = NOW + 10 * MIN;
        const stub = createQrsStub(now);
        const second = makeApp(stub);
        await second.init();

        expect(second.statuses()[1]).toEqual({
            id: 'history-file',
            state: 'ok',
            message: '',
            hint: '',
            lastOkAt: NOW + 10 * MIN,
            records: 8,
            coverage: { fromMs: OLDEST_TRIGGERED, toMs: NOW },
        });
        // History and QRS versions of the same executions are merged, not duplicated
        expect(second.store.size()).toBe(8);
        const snap = second.snapshot();
        expect(snap.rev).toBe(2);
        expect(snap.cols.key).toHaveLength(6);
        expect(new Set(snap.cols.src)).toEqual(new Set([3]));
        expect(snap.analytics.episodes).toHaveLength(1);
        await second.close();

        const today = historyLines('2026-10-06');
        expect(headers(today)).toHaveLength(1);
        expect(ofType(today, 'task')).toHaveLength(7);
        expect(ofType(today, 'r')).toHaveLength(6);
        // Coverage is recorded on every start, up to the new server time
        expect(ofType(today, 'covs').map((l) => l.to)).toEqual([NOW, NOW + 10 * MIN]);
        expect(historyLines('2026-09-30')).toHaveLength(2);
        expect(historyLines('2026-09-09')).toHaveLength(2);
    });

    // BUG: app.js only remembers what the history holds for the files it loads (lookback + 2 days). QRS keeps the last
    // few results of every task however old, so with the default --lookback 7d every start appends those again.
    test('a restart with the default 7d lookback does not re-append QRS results older than the read window', async () => {
        const config = makeConfig({ lookback: '7d' });
        const first = makeApp(createQrsStub(now), config);
        await first.init();
        await first.close();
        expect(historyLines('2026-09-09')).toHaveLength(2);

        const second = makeApp(createQrsStub(now), config);
        await second.init();
        await second.close();

        expect(historyLines('2026-09-09')).toHaveLength(2);
    });

    test('a QRS result from the two days read before the window is not appended again on every start', async () => {
        // --lookback 7d: the window starts 2026-09-29T07:00, and the files from 2026-09-27 on are read
        const run = structuredClone(ROWS.find((r) => r.taskID === CAL_PERF_3));
        Object.assign(run, {
            id: '99999999-aaaa-4bbb-8ccc-eeeeeeeeeeee',
            executionID: '99999999-aaaa-4bbb-8ccc-ffffffffffff',
            status: 7,
            startTime: '2026-09-28T10:00:00.000Z',
            stopTime: '2026-09-28T10:01:00.000Z',
            modifiedDate: '2026-09-28T10:01:00.100Z',
            details: [],
        });
        for (let start = 1; start <= 3; start += 1) {
            clock = NOW + start * 10 * MIN;
            const stub = createQrsStub(now);
            stub.rows.push(structuredClone(run));
            const app = makeApp(stub, makeConfig({ lookback: '7d' }));
            await app.init();
            await app.close();
        }

        expect(ofType(historyLines('2026-09-28'), 'r')).toHaveLength(1);
    });

    // BUG: open() deletes daily files older than --history-retention-days, then persist() writes QRS results older than
    // that to new daily files, so expired files are re-created on every start.
    test('QRS results older than --history-retention-days do not re-create expired daily files', async () => {
        const stub = createQrsStub(now);
        const ancient = structuredClone(ROWS.find((r) => `r:${r.id}` === OLD_SYNC_KEY));
        Object.assign(ancient, {
            id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
            startTime: '2026-06-01T05:20:30.000Z',
            stopTime: '2026-06-01T05:20:40.000Z',
            modifiedDate: '2026-06-01T05:20:41.000Z',
            details: [],
        });
        stub.rows.push(ancient);
        const app = makeApp(stub, makeConfig({ lookback: '7d', historyRetentionDays: '90' }));
        await app.init();
        await app.close();

        const cutoff = '2026-07-08'; // NOW - 90 days
        expect(fs.readdirSync(hostDir()).filter((n) => n.endsWith('.ndjson') && n < cutoff)).toEqual([]);
    });

    test('a task only known from the history becomes a deleted lane with its stored name', async () => {
        const first = makeApp(createQrsStub(now));
        await first.init();
        await first.close();

        // Content Monitor was deleted: QRS no longer lists the task, nor its execution results
        clock = NOW + 10 * MIN;
        const stub = createQrsStub(now);
        stub.tasks = stub.tasks.filter((t) => t.id !== CONTENT_MONITOR);
        stub.rows = stub.rows.filter((r) => r.taskID !== CONTENT_MONITOR);
        const app = makeApp(stub);
        await app.init();

        const lane = app.lanes().get(CONTENT_MONITOR);
        expect(lane).toMatchObject({
            idx: 6,
            name: 'Reload Content Monitor',
            appName: 'Content Monitor',
            appId: appOf(CONTENT_MONITOR),
            taskType: 0,
            deleted: true,
            visible: true,
        });

        const snap = app.snapshot();
        const encoded = snap.lanes.find((l) => l.id === CONTENT_MONITOR);
        expect(encoded).toMatchObject({ idx: 6, deleted: true, name: 'Reload Content Monitor', coverage: [[CM_TRIGGERED, NOW]] });
        const i = snap.cols.key.indexOf(CM_KEY);
        expect(snap.cols.lane[i]).toBe(6);
        expect(snap.cols.src[i]).toBe(2);
        // Its history run still counts in the congestion episode
        expect(snap.analytics.episodes[0].tasks.find((t) => t.taskId === CONTENT_MONITOR)).toMatchObject({
            lane: 6,
            name: 'Reload Content Monitor',
        });

        // Details of a history-only execution come from the record alone; QRS is not asked
        const before = stub.calls.length;
        const details = await app.executionDetails(CM_KEY);
        expect(stub.calls.length).toBe(before);
        expect(details).toMatchObject({
            record: { key: CM_KEY, status: 8 },
            task: { id: CONTENT_MONITOR, name: 'Reload Content Monitor', appName: 'Content Monitor', stream: null },
            qrs: null,
        });

        await app.close();
        expect(ofType(historyLines('2026-10-06'), 'task')).toHaveLength(7);
        expect(ofType(historyLines('2026-10-06'), 'r')).toHaveLength(6);
    });

    test('history from another Sense cluster is ignored and unreadable lines are reported', async () => {
        writeHistory('2026-10-04', [oldCmLine(), 'not json {', { t: 'r', task: CONTENT_MONITOR }]);
        writeHistory('2026-10-05', [{ ...oldCmLine(), r: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff' }], {
            v: 1,
            host: HOST,
            clusterId: 'other-cluster',
        });
        const logger = { ...silentLogger, warn: jest.fn() };
        const app = makeApp(createQrsStub(now), makeConfig(), logger);

        await app.init();

        expect(app.statuses()[1]).toMatchObject({ state: 'ok', records: 1, message: '2 unreadable line(s) skipped' });
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('another Sense cluster (other-cluster)'));
        expect(app.store.get(`r:${OLD_CM_RESULT}`)).toMatchObject({ taskId: CONTENT_MONITOR, status: 7, src: 2 });
        expect(app.store.size()).toBe(9);
    });

    test('opens read-only while another live Ctrl-Q holds the lock: reads, but writes nothing', async () => {
        writeHistory('2026-10-04', [oldCmLine()]);
        const lockFile = path.join(hostDir(), '.lock');
        // The parent process stands in for the other instance
        const lock = JSON.stringify({ pid: process.ppid, host: os.hostname(), token: 'other', since: iso(NOW - DAY) });
        fs.writeFileSync(lockFile, lock);
        const app = makeApp(createQrsStub(now));

        await app.init();

        expect(app.history().mode()).toBe('readonly');
        expect(app.statuses()[1]).toMatchObject({
            state: 'degraded',
            records: 1,
            message: expect.stringContaining(
                `another Ctrl-Q instance is writing this history (process ${process.ppid} on ${os.hostname()}); opened read-only. Delete ${lockFile} if`
            ),
        });
        const snap = app.snapshot();
        expect(snap.cols.key).toContain(`r:${OLD_CM_RESULT}`);
        expect(snap.cols.key).toHaveLength(7);

        clock = NOW + MIN;
        app.markLive(clock);
        clock = NOW + 2 * MIN;
        await app.close();
        expect(fs.readdirSync(hostDir()).sort()).toEqual(['.lock', '2026-10-04.ndjson']);
        expect(historyLines('2026-10-04')).toHaveLength(2);
        expect(fs.readFileSync(lockFile, 'utf8')).toBe(lock);
    });

    test('init copes with history files holding more coverage lines than fit in one function call', async () => {
        // Older Ctrl-Q versions wrote one coverage line per task on every start
        const lines = [];
        for (let i = 0; i < 135000; i += 1) {
            lines.push({ t: 'cov', task: RELOAD_TASKS[i % 6], from: NOW - DAY - (i % 1000) * MIN, to: NOW - DAY + 1000 });
        }
        writeHistory('2026-10-05', lines);
        const app = makeApp(createQrsStub(now));
        await app.init();

        expect(app.statuses()[1]).toMatchObject({ state: 'ok', coverage: { fromMs: NOW - DAY - 999 * MIN, toMs: NOW - DAY + 1000 } });
        // Content Monitor got every 6th line, whose ranges start at even minutes only
        expect(app.snapshot().lanes.find((l) => l.id === CONTENT_MONITOR).coverage[0]).toEqual([NOW - DAY - 998 * MIN, NOW - DAY + 1000]);
    });

    test('executions evicted over the memory cap make the time before them unknown, and the history status says so', async () => {
        writeHistory(
            '2026-10-05',
            Array.from({ length: 20 }, (_, i) => ({
                ...oldCmLine(),
                r: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`,
                tr: NOW - DAY + i * 10 * MIN,
                st: NOW - DAY + i * 10 * MIN + 1000,
                sp: NOW - DAY + i * 10 * MIN + 60000,
                fi: null,
            }))
        );
        const warn = jest.fn();
        const app = makeApp(createQrsStub(now), makeConfig(), { ...silentLogger, warn }, { maxRecords: 20 });
        await app.init();

        // 20 from the history plus 8 from QRS: evicted down to 19, the oldest first
        expect(app.store.size()).toBe(19);
        const completeFrom = app.coverage.completeFrom();
        expect(completeFrom).toBe(app.store.evictedUntil());
        expect(completeFrom).toBe(NOW - DAY + 6 * 10 * MIN + 60000);
        expect(app.statuses()[1]).toMatchObject({ state: 'degraded', message: expect.stringMatching(/^Too many executions/) });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Use a shorter --lookback'));

        const snap = app.snapshot();
        for (const lane of snap.lanes) expect(lane.coverage.every(([a]) => a >= completeFrom)).toBe(true);
        expect(snap.analytics.concurrency.total.every((b) => b[0] >= completeFrom - snap.analytics.bucketMs)).toBe(true);
    });

    test('refreshMetadata also deletes expired history files once the retention cutoff has moved on a day', async () => {
        writeHistory('2026-07-08', []);
        const app = makeApp(createQrsStub(now));
        await app.init();
        expect(fs.existsSync(path.join(hostDir(), '2026-07-08.ndjson'))).toBe(true);

        clock = NOW + DAY;
        await app.refreshMetadata();
        expect(fs.existsSync(path.join(hostDir(), '2026-07-08.ndjson'))).toBe(false);
    });

    test('history disabled via --sources: no history store, nothing written', async () => {
        const app = makeApp(createQrsStub(now), makeConfig({ sources: 'qrs' }));
        await app.init();

        expect(app.history()).toBeNull();
        expect(app.statuses()[1]).toEqual(newSourceStatus('history-file', 'disabled'));
        expect(app.snapshot().cols.key).toHaveLength(6);

        app.markLive(NOW + MIN);
        app.breakLiveCoverage(NOW + 20 * MIN);
        await app.close();
        expect(fs.readdirSync(dir)).toEqual([]);
    });

    test('an unusable history directory sets the status to error, but init still succeeds', async () => {
        const blocker = path.join(dir, 'not-a-directory');
        fs.writeFileSync(blocker, 'x');
        const logger = { ...silentLogger, warn: jest.fn() };
        const app = makeApp(createQrsStub(now), makeConfig({ historyDir: blocker }), logger);

        await app.init();

        const [qrs, history] = app.statuses();
        expect(qrs.state).toBe('ok');
        expect(history).toMatchObject({ state: 'error', hint: 'Check --history-dir.', records: 0 });
        expect(history.message).toContain(`cannot use history directory ${path.join(blocker, HOST)}`);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('History file: cannot use history directory'));
        expect(app.snapshot().cols.key).toHaveLength(6);

        clock = NOW + MIN;
        app.markLive(clock);
        expect(app.applyQrsChanges(app.store.all())).toBe(0);
        await expect(app.close()).resolves.toBeUndefined();
        expect(fs.readdirSync(dir)).toEqual(['not-a-directory']);
    });
});

describe('live updates', () => {
    // One poller tick: changed results since the cursor, applied to the app
    const pollChanges = async (app) => {
        const { records, cursor } = await app.qrs.changesSince(app.cursor);
        app.cursor = cursor;
        return app.applyQrsChanges(records);
    };

    test('applyQrsChanges + drainDelta: chained revisions, changed keys, lanes for new tasks, nodes only when new', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub);
        await app.init();

        // Nothing changed since the snapshot
        expect(app.drainDelta()).toEqual({
            rev: 1,
            prevRev: 1,
            cols: {
                key: [],
                lane: [],
                status: [],
                triggeredAt: [],
                queuedAt: [],
                startedAt: [],
                stoppedAt: [],
                node: [],
                src: [],
                flags: [],
            },
            removed: [],
            lanes: [],
            nodes: undefined,
        });
        expect(app.applyQrsChanges([])).toBe(0);

        // A new task starts on a new node. The poll overlap also returns Operations Monitor again, unchanged.
        stub.rows.push(newTaskRow({ status: 2, modifiedAt: NOW + MIN + 600 }));
        clock = NOW + 90 * 1000;
        expect(await pollChanges(app)).toBe(1);
        expect(app.cursor).toBe(NOW + MIN + 600);
        expect(app.hasRunning()).toBe(true);
        // The metadata does not know the task, so its lane waits for a refresh. QRS does not know it either: a lane as
        // for a deleted task, with the execution.
        expect(app.lanes().get(NEW_TASK)).toBeUndefined();
        expect(app.metadataWanted()).toBe(true);
        await app.refreshMetadata();
        expect(app.metadataWanted()).toBe(false);

        const d1 = app.drainDelta();
        expect(d1).toEqual({
            rev: 2,
            prevRev: 1,
            cols: {
                key: [NEW_KEY],
                lane: [7],
                status: [2],
                triggeredAt: [NOW + MIN],
                queuedAt: [null],
                startedAt: [NOW + MIN + 500],
                stoppedAt: [null],
                node: [1],
                src: [1],
                flags: [0],
            },
            removed: [],
            lanes: [expect.objectContaining({ idx: 7, id: NEW_TASK, appId: NEW_APP, coverage: [] })],
            nodes: [NODE1, NODE2],
        });

        // Nothing new: an empty delta chained to the previous one
        const d2 = app.drainDelta();
        expect(d2).toMatchObject({ rev: 2, prevRev: 2, removed: [], lanes: [], nodes: undefined });
        expect(d2.cols.key).toEqual([]);

        // The execution finishes
        stub.rows = stub.rows.map((r) =>
            r.id === NEW_RESULT ? newTaskRow({ status: 7, stoppedAt: NOW + 2 * MIN, modifiedAt: NOW + 2 * MIN + 100 }) : r
        );
        clock = NOW + 150 * 1000;
        expect(await pollChanges(app)).toBe(1);
        expect(app.hasRunning()).toBe(false);

        const d3 = app.drainDelta();
        expect(d3).toMatchObject({ rev: 3, prevRev: 2, removed: [], lanes: [], nodes: undefined });
        expect(d3.cols).toMatchObject({ key: [NEW_KEY], lane: [7], status: [7], stoppedAt: [NOW + 2 * MIN], node: [1] });

        // The same result again (poll overlap) changes nothing; an older version is ignored
        expect(await pollChanges(app)).toBe(0);
        const older = newTaskRow({ status: 2, modifiedAt: NOW + MIN + 600 });
        stub.rows = [...stub.rows.filter((r) => r.id !== NEW_RESULT), older];
        expect(app.applyQrsChanges((await app.qrs.changesSince(NOW)).records)).toBe(0);
        expect(app.store.get(NEW_KEY).status).toBe(7);
        expect(app.drainDelta()).toMatchObject({ rev: 3, prevRev: 3, cols: expect.objectContaining({ key: [] }) });

        // The running and the finished version were each written to the history once; the last line wins on load
        clock = NOW + 3 * MIN;
        await app.close();
        const lines = ofType(historyLines('2026-10-06'), 'r').filter((l) => l.r === NEW_RESULT);
        expect(lines).toEqual([
            expect.objectContaining({ s: 2, n: NODE2, tr: NOW + MIN, sp: null }),
            expect.objectContaining({ s: 7, n: NODE2, tr: NOW + MIN, sp: NOW + 2 * MIN, tt: null, app: NEW_APP }),
        ]);
    });

    test('refreshMetadata picks up renamed and new tasks and capacity changes, and prunes old executions', async () => {
        const stub = createQrsStub(now);
        // 7 days back: the user sync run from 2026-09-09 is more than 2 days before the window
        const app = makeApp(stub, makeConfig({ lookback: '7d' }));
        await app.init();
        expect(app.store.get(OLD_SYNC_KEY)).toBeDefined();

        stub.tasks = [
            ...baseTasks().map((t) => (t.id === CONTENT_MONITOR ? { ...t, name: 'Reload Content Monitor (nightly)' } : t)),
            {
                id: NEW_TASK,
                name: 'Reload New Sales',
                taskType: 0,
                enabled: false,
                app: { id: NEW_APP, name: 'New Sales', stream: null },
                tags: [],
            },
        ];
        stub.schedulers = [scheduler('Central.example.com', 0, 4), scheduler('Sense-Node1.example.com', 1, 6)];
        clock = NOW + 10 * MIN;

        expect(await app.refreshMetadata()).toBe(true);

        const delta = app.drainDelta();
        expect(delta.lanes.map((l) => [l.idx, l.name])).toEqual([
            [0, 'Reload Content Monitor (nightly)'],
            [7, 'Reload New Sales'],
        ]);
        expect(delta.lanes[1]).toMatchObject({ id: NEW_TASK, deleted: false, enabled: false, appName: 'New Sales' });
        expect(delta.removed).toEqual([OLD_SYNC_KEY]);
        expect(delta.rev).toBe(delta.prevRev + 1);
        expect(app.store.get(OLD_SYNC_KEY)).toBeUndefined();
        expect(app.analyticsPayload().capacity).toEqual({ nodes: [{ name: NODE1, maxConcurrentEngines: 6 }] });
        expect(app.snapshot().analytics.episodes[0]).toMatchObject({ capacity: 6, peakQueued: 2 });

        // No change
        expect(await app.refreshMetadata()).toBe(false);
        expect(app.drainDelta().lanes).toEqual([]);

        // Capacity only
        stub.schedulers = [scheduler('Sense-Node1.example.com', 2, 8)];
        expect(await app.refreshMetadata()).toBe(true);
        expect(app.drainDelta()).toMatchObject({ lanes: [], removed: [] });
        expect(app.analyticsPayload().capacity.nodes).toEqual([{ name: NODE1, maxConcurrentEngines: 8 }]);

        // Only the renamed and the new task are written to the history again
        await app.close();
        const tasks = ofType(historyLines('2026-10-06'), 'task');
        expect(tasks).toHaveLength(9);
        expect(tasks.slice(7).map((t) => t.name)).toEqual(['Reload Content Monitor (nightly)', 'Reload New Sales']);
    });

    test('a task created after start-up gets its lane from the metadata refresh its first run asks for', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        const { page, gaps, publish } = makePage(app);

        // A new reload task and a new user sync task (hidden by --task-type) run before the metadata knows them
        const NEW_SYNC = '12121212-3434-4565-8787-909090909090';
        const syncRun = {
            ...newTaskRow({ status: 7, stoppedAt: NOW + 2 * MIN, modifiedAt: NOW + 2 * MIN + 100 }),
            id: '13131313-2424-4535-8646-757575757575',
            taskID: NEW_SYNC,
            executionID: '13131313-2424-4535-8646-868686868686',
            appID: '00000000-0000-0000-0000-000000000000',
        };
        stub.rows.push(newTaskRow({ status: 2, modifiedAt: NOW + MIN + 600 }), syncRun);
        stub.tasks = [...baseTasks(), newTask(), { id: NEW_SYNC, name: 'User sync HR', taskType: 2, enabled: true, app: null, tags: [] }];
        clock = NOW + 3 * MIN;
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });

        // Not lanes of deleted tasks of unknown type, which would also pass --task-type: they wait for the metadata
        expect(app.lanes().get(NEW_TASK)).toBeUndefined();
        expect(app.lanes().get(NEW_SYNC)).toBeUndefined();
        expect(app.metadataWanted()).toBe(true);

        expect(await app.refreshMetadata()).toBe(true);
        publish({ changed: true, statusChanged: false });

        expect(app.metadataWanted()).toBe(false);
        expect(app.lanes().get(NEW_TASK)).toMatchObject({ idx: 7, name: 'Reload New Sales', taskType: 0, deleted: false, visible: true });
        expect(app.lanes().get(NEW_SYNC)).toMatchObject({ idx: 8, name: 'User sync HR', taskType: 2, deleted: false, visible: false });
        // The page got the new lane, with the run that earlier deltas left out, and nothing of the hidden task
        expect(gaps).toEqual([]);
        expect(page.lane(7)).toMatchObject({ id: NEW_TASK, name: 'Reload New Sales', deleted: false });
        expect(page.row(NEW_KEY)).toMatchObject({ lane: 7, status: 2 });
        expect(page.row(`r:${syncRun.id}`)).toBeUndefined();
        expect(page.lane(8)).toBeUndefined();
    });

    // BUG: drainDelta() only sends the node table when it grew during that call. refreshMetadata() registers new
    // scheduler nodes in the shared table first, so the next delta has no `nodes`, and pages that loaded the snapshot
    // earlier cannot resolve the node index of executions on the new node (tooltip, node filter).
    test('a scheduler node added by refreshMetadata reaches pages through the live delta', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        let pageNodes = app.snapshot().nodes;
        expect(pageNodes).toEqual([NODE1]);

        // One poller tick: changes, then the 10-minute metadata refresh, then apply and publish the delta
        stub.schedulers = [...baseSchedulers(), scheduler('Sense-Node2.example.com', 1, 2)];
        stub.tasks = [...baseTasks(), newTask()];
        stub.rows.push(newTaskRow({ status: 2, modifiedAt: NOW + MIN + 600 }));
        clock = NOW + 90 * 1000;
        const { records, cursor } = await app.qrs.changesSince(app.cursor);
        app.cursor = cursor;
        await app.refreshMetadata();
        app.applyQrsChanges(records);
        const delta = app.drainDelta();
        if (delta.nodes) pageNodes = delta.nodes;

        expect(delta.cols.key).toEqual([NEW_KEY]);
        expect(pageNodes[delta.cols.node[0]]).toBe(NODE2);
    });

    test('liveStatus: the live range, the QRS state, and running executions that have turned stale', async () => {
        const RUNNING = '55555555-6666-4777-8888-999999999999';
        const stub = createQrsStub(now);
        stub.rows.push({
            id: RUNNING,
            taskID: OPS_MONITOR,
            appID: appOf(OPS_MONITOR),
            executingNodeName: NODE1,
            status: 2,
            startTime: iso(NOW - 23 * 60 * MIN),
            stopTime: '1753-01-01T00:00:00.000Z',
            modifiedDate: iso(NOW - 23 * 60 * MIN + 1000),
            details: [],
        });
        stub.sessions = [{ id: 'session-1', executionResult: { id: RUNNING } }];
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();

        expect(app.liveStatus()).toEqual({
            rev: 1,
            now: NOW,
            from: NOW,
            coveredTo: NOW,
            qrs: { state: 'ok', message: 'QRS keeps only the last few executions of each task', lastOkAt: NOW },
            staleKeys: [],
        });

        // Two hours later the engine session is gone: the run is over 24 h old and its state is unknown
        clock = NOW + 120 * MIN;
        app.markLive(clock);
        app.setRunningResultIds(new Set());
        expect(app.liveStatus()).toMatchObject({ now: clock, from: NOW, coveredTo: clock, staleKeys: [`r:${RUNNING}`] });

        // An outage splits the live range: pages see the new start and reload their snapshot
        clock = NOW + 180 * MIN;
        app.breakLiveCoverage(clock);
        expect(app.liveStatus()).toMatchObject({ from: clock, coveredTo: clock });
        app.setStatus('qrs', { state: 'degraded', message: 'Live update failed' });
        expect(app.liveStatus().qrs).toMatchObject({ state: 'degraded', message: 'Live update failed' });
    });

    // What a page keeps of the snapshot and the live deltas (as the page's client store does): lanes by number, rows by
    // key, the node name table and the revision. A delta whose prevRev is ahead of the page's revision is a gap the page
    // cannot apply: like the real page, it then loads a fresh snapshot.
    const makePage = (app) => {
        let state;
        const applyCols = (cols) => {
            cols.key.forEach((key, i) => state.rows.set(key, { lane: cols.lane[i], status: cols.status[i], node: cols.node[i] }));
        };
        const load = () => {
            const snap = JSON.parse(JSON.stringify(app.snapshot()));
            state = { rev: snap.rev, nodes: snap.nodes, lanes: new Map(snap.lanes.map((l) => [l.idx, l])), rows: new Map() };
            applyCols(snap.cols);
        };
        load();
        const page = {
            snapshot: () => state,
            row: (key) => state.rows.get(key),
            lane: (idx) => state.lanes.get(idx),
            lanes: () => [...state.lanes.values()],
            nodes: () => state.nodes,
        };
        const gaps = [];
        const deltas = [];
        const sse = {
            clientCount: () => 1,
            broadcast: (event, data) => {
                if (event !== 'delta') return;
                const delta = JSON.parse(JSON.stringify(data));
                deltas.push(delta);
                if (delta.prevRev > state.rev) {
                    gaps.push(delta);
                    load();
                } else if (delta.rev >= state.rev) {
                    if (delta.nodes) state.nodes = delta.nodes;
                    for (const lane of delta.lanes) state.lanes.set(lane.idx, lane);
                    for (const key of delta.removed) state.rows.delete(key);
                    applyCols(delta.cols);
                    state.rev = delta.rev;
                }
            },
        };
        return { page, gaps, deltas, publish: createLivePublisher(app, sse) };
    };

    test('a page stays in step through changes of hidden tasks: no revision gaps, no reloads', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        const { page, gaps, deltas, publish } = makePage(app);

        // A user sync run (hidden by the default --task-type) ...
        const sync = structuredClone(ROWS.find((r) => `r:${r.id}` === OLD_SYNC_KEY));
        Object.assign(sync, {
            id: '77777777-8888-4999-8aaa-bbbbbbbbbbbb',
            startTime: iso(NOW + MIN),
            stopTime: iso(NOW + MIN + 10000),
            modifiedDate: iso(NOW + MIN + 11000),
            details: [],
        });
        stub.rows.push(sync);
        clock = NOW + 2 * MIN;
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });

        // ... then a Content Monitor run (visible)
        const cm = structuredClone(ROWS.find((r) => r.id === CM_RESULT));
        Object.assign(cm, {
            id: '88888888-9999-4aaa-8bbb-cccccccccccc',
            status: 7,
            startTime: iso(NOW + 3 * MIN),
            stopTime: iso(NOW + 4 * MIN),
            modifiedDate: iso(NOW + 4 * MIN + 100),
            details: [],
        });
        stub.rows.push(cm);
        clock = NOW + 5 * MIN;
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });

        expect(deltas.map((d) => [d.prevRev, d.rev, d.cols.key.length])).toEqual([
            [1, 2, 0],
            [2, 3, 1],
        ]);
        expect(gaps).toEqual([]);
        expect(page.snapshot().rev).toBe(app.store.rev());
        expect(page.row(`r:${cm.id}`)).toMatchObject({ lane: LANE[CONTENT_MONITOR], status: 7 });
    });

    test('a scheduler node added in a poll without executions still reaches the page, for later executions on it', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        const { page, gaps, publish } = makePage(app);

        // Poll 1: only the metadata refresh finds a new node (and a new task)
        stub.schedulers = [...baseSchedulers(), scheduler('Sense-Node2.example.com', 1, 2)];
        stub.tasks = [...baseTasks(), newTask()];
        clock = NOW + 10 * MIN;
        await app.refreshMetadata();
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });

        // Poll 2: a run on that node
        stub.rows.push(newTaskRow({ status: 7, stoppedAt: NOW + 2 * MIN, modifiedAt: NOW + 11 * MIN }));
        clock = NOW + 12 * MIN;
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });

        expect(gaps).toEqual([]);
        const row = page.row(NEW_KEY);
        expect(page.nodes()[row.node]).toBe(NODE2);
    });

    test('a task deleted in QRS while Ctrl-Q runs is marked deleted by the next refresh, and pages hear of it', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        const { page, gaps, publish } = makePage(app);

        stub.tasks = stub.tasks.filter((t) => t.id !== CAL_PERF_1);
        clock = NOW + 10 * MIN;
        expect(await app.refreshMetadata()).toBe(true);
        publish({ changed: true, statusChanged: false });

        expect(gaps).toEqual([]);
        expect(page.lane(LANE[CAL_PERF_1])).toMatchObject({ id: CAL_PERF_1, name: 'Reload Calendar perf 1', deleted: true });
        // Its runs stay
        expect(page.row(`r:${ROWS.find((r) => r.taskID === CAL_PERF_1).id}`)).toMatchObject({ lane: LANE[CAL_PERF_1] });
    });

    test('--app-tag is resolved again at every refresh: an app tagged later gets its lane, with its earlier runs', async () => {
        const stub = createQrsStub(now);
        stub.apps = [{ id: appOf(CONTENT_MONITOR) }];
        const app = makeApp(stub, makeConfig({ sources: 'qrs', appTag: 'Monitoring' }));
        await app.init();
        const { page, gaps, publish } = makePage(app);
        expect(page.lanes().map((l) => l.id)).toEqual([CONTENT_MONITOR]);

        // The tag is added to the Operations Monitor app
        stub.apps = [{ id: appOf(CONTENT_MONITOR) }, { id: appOf(OPS_MONITOR) }];
        clock = NOW + 10 * MIN;
        expect(await app.refreshMetadata()).toBe(true);
        publish({ changed: true, statusChanged: false });

        expect(callsTo(stub, '/qrs/app')).toHaveLength(2);
        expect(gaps).toEqual([]);
        expect(page.lanes().map((l) => l.id)).toEqual([CONTENT_MONITOR, OPS_MONITOR]);
        expect(page.row(OM_KEY)).toMatchObject({ lane: LANE[OPS_MONITOR], status: 7 });
    });

    test('a lane that turns hidden makes pages load a fresh snapshot, as a delta cannot take a lane off', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs', taskTag: 'monitoring' }));
        await app.init();
        const { page, gaps, deltas, publish } = makePage(app);
        expect(page.lanes().map((l) => l.id)).toEqual([CONTENT_MONITOR, OPS_MONITOR]);

        // The tag is taken off Content Monitor
        stub.tasks = baseTasks().map((t) => (t.id === CONTENT_MONITOR ? { ...t, tags: [] } : t));
        clock = NOW + 10 * MIN;
        expect(await app.refreshMetadata()).toBe(true);
        publish({ changed: true, statusChanged: false });

        // The delta claims to follow a revision no page has, so the page reloads
        expect(gaps).toHaveLength(1);
        expect(deltas[0].prevRev).toBeGreaterThan(1);
        expect(page.lanes().map((l) => l.id)).toEqual([OPS_MONITOR]);
        expect(page.row(CM_KEY)).toBeUndefined();
        expect(page.snapshot().rev).toBe(app.store.rev());

        // Later deltas follow on from the fresh snapshot
        const om = structuredClone(ROWS.find((r) => `r:${r.id}` === OM_KEY));
        Object.assign(om, {
            id: '88888888-9999-4aaa-8bbb-dddddddddddd',
            modifiedDate: iso(NOW + 11 * MIN),
            startTime: iso(NOW + 10 * MIN),
            stopTime: iso(NOW + 11 * MIN),
            details: [],
        });
        stub.rows.push(om);
        clock = NOW + 12 * MIN;
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });
        expect(gaps).toHaveLength(1);
        expect(page.row(`r:${om.id}`)).toMatchObject({ lane: LANE[OPS_MONITOR] });
    });

    test("executions evicted while live updates run: pages get the lanes' new coverage, so the evicted time is unknown", async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }), silentLogger, { maxRecords: 8 });
        await app.init();
        const { page, gaps, publish } = makePage(app);
        expect(page.lane(LANE[CONTENT_MONITOR]).coverage).toEqual([[CM_TRIGGERED, NOW]]);

        // Four more runs push the store over its cap of 8
        for (let i = 0; i < 4; i += 1) {
            const run = structuredClone(ROWS.find((r) => r.taskID === CAL_PERF_2));
            const t = NOW + 2000 + i * 1000;
            Object.assign(run, {
                id: `99999999-aaaa-4bbb-8ccc-00000000000${i}`,
                executionID: `99999999-aaaa-4bbb-8ccc-10000000000${i}`,
                status: 7,
                startTime: iso(t),
                stopTime: iso(t + 500),
                modifiedDate: iso(t + 600),
                details: [],
            });
            stub.rows.push(run);
        }
        clock = NOW + 10 * 1000;
        await pollChanges(app);
        publish({ changed: true, statusChanged: false });

        const completeFrom = app.coverage.completeFrom();
        expect(completeFrom).toBeGreaterThan(CM_TRIGGERED);
        expect(gaps).toEqual([]);
        for (const lane of app.snapshot().lanes) {
            expect(page.lane(lane.idx).coverage).toEqual(lane.coverage);
            expect(lane.coverage.every(([a]) => a >= completeFrom)).toBe(true);
        }
    });

    test('the eviction warning never hides a more serious history state, and survives the QRS badge recovering', async () => {
        const warning = expect.stringMatching(/Too many executions to keep in memory/);

        // An unusable history directory stays an error
        const blocker = path.join(dir, 'not-a-directory');
        fs.writeFileSync(blocker, 'x');
        const a = makeApp(createQrsStub(now), makeConfig({ historyDir: blocker }), silentLogger, { maxRecords: 5 });
        await a.init();
        expect(a.statuses()[1]).toMatchObject({ state: 'error', message: expect.stringContaining('cannot use history directory') });
        expect(a.statuses()[1].message).toEqual(warning);

        // Without the history file, it is a message on the QRS badge, and live updates still count as fine
        const stub = createQrsStub(now);
        const b = makeApp(stub, makeConfig({ sources: 'qrs' }), silentLogger, { maxRecords: 5 });
        await b.init();
        expect(b.statuses()[0]).toMatchObject({ state: 'ok', message: warning });
        expect(b.liveStatus().qrs).toMatchObject({ state: 'ok', message: warning });

        // A failed poll and a good one, which resets the QRS state
        const poller = createQrsPoller({ app: b, intervalMs: 10000, logger: silentLogger, onUpdate: () => {}, now, random: () => 0.5 });
        stub.failures.set('/qrs/executionresult/full', new Error('ECONNRESET'));
        clock += 10000;
        await poller.tickNow();
        expect(b.statuses()[0]).toMatchObject({
            state: 'degraded',
            message: expect.stringMatching(/^Live update failed .*; Too many executions/),
        });
        stub.failures.clear();
        clock += 30000;
        await poller.tickNow();
        await poller.stop();
        expect(b.statuses()[0]).toMatchObject({ state: 'ok', message: warning });
    });

    test.each([
        ['ahead of', 30 * 1000],
        ['behind', -30 * 1000],
    ])('with the Sense clock 30 s %s this computer, a short run still reaches live pages', async (_name, skewMs) => {
        const stub = createQrsStub(now);
        stub.skewMs = skewMs;
        const config = makeConfig({ sources: 'qrs' });
        const app = makeApp(stub, config);
        await app.init();
        const { page, gaps, publish } = makePage(app);
        const poller = createQrsPoller({ app, intervalMs: config.pollIntervalMs, logger: silentLogger, onUpdate: publish, now });

        // A 5-second reload, triggered 20 s after the start on the Sense clock. QRS lists it once it has finished.
        const run = structuredClone(ROWS.find((r) => r.taskID === CAL_PERF_1));
        const trig = NOW + skewMs + 20 * 1000;
        Object.assign(run, {
            id: '99999999-aaaa-4bbb-8ccc-dddddddddddd',
            executionID: '99999999-aaaa-4bbb-8ccc-eeeeeeeeeeee',
            status: 7,
            startTime: iso(trig),
            stopTime: iso(trig + 5000),
            modifiedDate: iso(trig + 5100),
            details: [],
        });
        for (let t = NOW + 10 * 1000; t <= NOW + 60 * 1000; t += 10 * 1000) {
            clock = t;
            if (!stub.rows.includes(run) && clock + skewMs >= trig + 5100) stub.rows.push(run);
            await poller.tickNow();
        }
        await poller.stop();

        expect(gaps).toEqual([]);
        expect(page.row(`r:${run.id}`)).toMatchObject({ lane: LANE[CAL_PERF_1], status: 7 });
    });

    test.each([
        ['ahead of', 2 * MIN],
        ['behind', -2 * MIN],
    ])('coverage, the window and the page clock follow the Sense clock when it is 2 minutes %s this computer', async (_name, skewMs) => {
        const stub = createQrsStub(now);
        stub.skewMs = skewMs;
        const app = makeApp(stub);
        await app.init();
        const SENSE_NOW = NOW + skewMs;

        // The page sets its clock from generatedAt and live.now
        const snap = app.snapshot();
        expect(snap.generatedAt).toBe(SENSE_NOW);
        expect(snap.window).toEqual({ from: SENSE_NOW - 30 * DAY, to: SENSE_NOW });
        expect(snap.live).toMatchObject({ now: SENSE_NOW, from: SENSE_NOW, coveredTo: SENSE_NOW });

        // A successful poll 15 s later by this computer's clock
        clock = NOW + 15 * 1000;
        app.markLive(clock);
        expect(app.coverage.live()).toEqual([SENSE_NOW, SENSE_NOW + 15 * 1000]);
        expect(app.liveStatus()).toMatchObject({ now: SENSE_NOW + 15 * 1000, from: SENSE_NOW, coveredTo: SENSE_NOW + 15 * 1000 });
        expect(app.statuses()[0].lastOkAt).toBe(SENSE_NOW + 15 * 1000);

        // The history file records what was watched on the Sense clock too
        await app.close();
        expect(ofType(historyLines('2026-10-06'), 'obs').map((l) => [l.from, l.to])).toEqual([[SENSE_NOW, SENSE_NOW + 15 * 1000]]);
    });

    test('markLive and breakLiveCoverage extend and split the coverage, and record it in the history', async () => {
        const app = makeApp(createQrsStub(now));
        await app.init();
        const cmCoverage = () => app.snapshot().lanes.find((l) => l.id === CONTENT_MONITOR).coverage;

        clock = NOW + MIN;
        app.markLive(clock);
        expect(app.coverage.globalRanges()).toEqual([[NOW, NOW + MIN]]);
        expect(cmCoverage()).toEqual([[CM_TRIGGERED, NOW + MIN]]);

        // Within 5 minutes of the last observation line: coverage moves on, no new line
        clock = NOW + 2 * MIN;
        app.markLive(clock);
        expect(app.coverage.globalRanges()).toEqual([[NOW, NOW + 2 * MIN]]);

        // An outage: the range up to the last good poll is kept, a new one starts
        clock = NOW + 20 * MIN;
        app.breakLiveCoverage(clock);
        clock = NOW + 21 * MIN;
        app.markLive(clock);
        expect(app.coverage.globalRanges()).toEqual([
            [NOW, NOW + 2 * MIN],
            [NOW + 20 * MIN, NOW + 21 * MIN],
        ]);
        expect(cmCoverage()).toEqual([
            [CM_TRIGGERED, NOW + 2 * MIN],
            [NOW + 20 * MIN, NOW + 21 * MIN],
        ]);

        // Closed a minute after the last poll: that minute was not watched, and the range up to the poll is written already
        clock = NOW + 22 * MIN;
        await app.close();
        const obs = await waitFor(() => {
            const lines = ofType(historyLines('2026-10-06'), 'obs');
            return lines.length >= 3 ? lines : null;
        });
        expect(obs.map((l) => [l.from, l.to]).sort((a, b) => a[0] - b[0] || a[1] - b[1])).toEqual([
            [NOW, NOW + MIN],
            [NOW, NOW + 2 * MIN],
            [NOW + 20 * MIN, NOW + 21 * MIN],
        ]);

        // The next run knows when Ctrl-Q was watching, gap included
        clock = NOW + 30 * MIN;
        const next = makeApp(createQrsStub(now));
        await next.init();
        expect(next.coverage.globalRanges()).toEqual(
            mergeIntervals([
                [NOW, NOW + 2 * MIN],
                [NOW + 20 * MIN, NOW + 21 * MIN],
            ])
        );
        expect(next.statuses()[1].coverage).toEqual({ fromMs: OLDEST_TRIGGERED, toMs: NOW + 21 * MIN });
    });

    // The poller and the app together, as the command runs them: polls that fail, or stop for good, do not count as
    // watched time, whenever Ctrl-Q is closed afterwards
    test.each([
        ['QRS is unreachable for two hours', Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })],
        ['live updates stopped (HTTP 401)', Object.assign(new Error('QRS GET failed: HTTP 401'), { status: 401 })],
    ])('closing Ctrl-Q after %s records the watched time up to the last successful poll only', async (_name, failure) => {
        const stub = createQrsStub(now);
        const config = makeConfig();
        const app = makeApp(stub, config);
        await app.init();
        const poller = createQrsPoller({
            app,
            intervalMs: config.pollIntervalMs,
            logger: silentLogger,
            onUpdate: () => {},
            now,
            random: () => 0.5,
        });

        clock = NOW + MIN;
        await poller.tickNow();
        stub.failures.set('/qrs/executionresult/full', failure);
        clock = NOW + 30 * MIN;
        await poller.tickNow();
        clock = NOW + 90 * MIN;
        await poller.tickNow();
        await poller.stop();
        clock = NOW + 120 * MIN;
        await app.close();

        const obs = ofType(historyLines('2026-10-06'), 'obs');
        expect(obs.map((l) => [l.from, l.to])).toEqual([[NOW, NOW + MIN]]);
        clock = NOW + 121 * MIN;
        const next = makeApp(createQrsStub(now), config);
        await next.init();
        expect(next.coverage.globalRanges()).toEqual([[NOW, NOW + MIN]]);
    });
});

describe('executionDetails', () => {
    test('asks QRS for the details of r: keys and returns null for unknown keys', async () => {
        const stub = createQrsStub(now);
        const app = makeApp(stub, makeConfig({ sources: 'qrs' }));
        await app.init();
        const byIdCalls = () => callsTo(stub, '/qrs/executionresult/full').filter((c) => c.query.filter.startsWith('id eq'));

        const details = await app.executionDetails(CM_KEY);

        expect(byIdCalls().map((c) => c.query.filter)).toEqual([`id eq ${CM_RESULT}`]);
        expect(details.record).toMatchObject({ key: CM_KEY, taskId: CONTENT_MONITOR, status: 8 });
        expect(details.task).toEqual({
            id: CONTENT_MONITOR,
            name: 'Reload Content Monitor',
            appName: 'Content Monitor',
            stream: 'Monitoring apps',
        });
        expect(details.qrs.scriptLogAvailable).toBe(true);
        expect(details.qrs.details).toHaveLength(8);
        expect(details.qrs.details[0]).toEqual({ t: CM_TRIGGERED, type: 2, message: 'Changing task state to Triggered' });

        // Unknown key: no QRS call
        expect(await app.executionDetails('r:00000000-0000-4000-8000-000000000000')).toBeNull();
        expect(await app.executionDetails('f:nope:1')).toBeNull();
        expect(byIdCalls()).toHaveLength(1);

        // QRS has since dropped the result
        stub.rows = stub.rows.filter((r) => r.id !== CM_RESULT);
        const gone = await app.executionDetails(CM_KEY);
        expect(gone.record.key).toBe(CM_KEY);
        expect(gone.qrs).toBeNull();

        // QRS cannot answer: the stored record is still there, and the reason why the details are not
        const warn = jest.spyOn(silentLogger, 'warn');
        stub.failures.set(
            '/qrs/executionresult/full',
            Object.assign(new Error('QRS GET /qrs/executionresult/full on h:4242 failed: HTTP 500'), { status: 500, reason: 'HTTP 500' })
        );
        const failed = await app.executionDetails(OM_KEY);
        expect(failed).toEqual({
            record: expect.objectContaining({ key: OM_KEY, taskId: OPS_MONITOR, status: 7 }),
            task: { id: OPS_MONITOR, name: 'Reload Operations Monitor', appName: 'Operations Monitor', stream: 'Monitoring apps' },
            qrs: null,
            qrsError: 'The details of this execution could not be read from QRS: HTTP 500',
        });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
    });
});

describe('failures', () => {
    test('init fails when the task metadata cannot be read, before touching the history directory', async () => {
        const stub = createQrsStub(now);
        stub.failures.set('/qrs/task/full', Object.assign(new Error('QRS GET /qrs/task/full failed: HTTP 503'), { status: 503 }));
        const app = makeApp(stub);

        await expect(app.init()).rejects.toThrow('HTTP 503');
        expect(fs.readdirSync(dir)).toEqual([]);
    });

    test('when the QRS snapshot fails, init fails and releases the history lock itself', async () => {
        const stub = createQrsStub(now);
        stub.failures.set('/qrs/executionsession/full', new Error('socket hang up'));
        const app = makeApp(stub);

        await expect(app.init()).rejects.toThrow('socket hang up');
        expect(fs.readdirSync(hostDir())).toEqual([]);

        // close() afterwards does no harm
        await app.close();
        expect(fs.readdirSync(hostDir())).toEqual([]);
    });

    test('a history file that cannot be read: Ctrl-Q starts on QRS alone, says so, and writes nothing to it', async () => {
        writeHistory('2026-10-05', [oldCmLine()]);
        const readFile = fsp.readFile;
        jest.spyOn(fsp, 'readFile').mockImplementation(async (file, ...rest) => {
            if (String(file).endsWith('2026-10-05.ndjson')) {
                throw Object.assign(new Error(`EACCES: permission denied, open '${file}'`), { code: 'EACCES' });
            }
            return readFile(file, ...rest);
        });
        const app = makeApp(createQrsStub(now));

        await app.init();

        const [qrs, history] = app.statuses();
        expect(qrs.state).toBe('ok');
        expect(history).toMatchObject({ state: 'error', hint: 'Check --history-dir.', message: expect.stringContaining('EACCES') });
        expect(app.snapshot().cols.key).toHaveLength(6);
        // The lock is released at once, and nothing is written
        expect(fs.existsSync(path.join(hostDir(), '.lock'))).toBe(false);
        clock = NOW + 10 * MIN;
        app.markLive(clock);
        await app.close();
        expect(fs.readdirSync(hostDir())).toEqual(['2026-10-05.ndjson']);
    });

    test('a history file that cannot be written: Ctrl-Q starts, the badge shows it until a write works, and nothing is lost', async () => {
        const append = jest
            .spyOn(fsp, 'appendFile')
            .mockRejectedValue(Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }));
        const warn = jest.fn();
        const app = makeApp(createQrsStub(now), makeConfig(), { ...silentLogger, warn });

        await app.init();

        expect(app.statuses()[1]).toMatchObject({
            state: 'error',
            message: 'cannot write to the history file: ENOSPC: no space left on device, write',
        });
        const waiting = app.history().pending();
        expect(waiting).toBeGreaterThan(0);

        // Still failing at the next poll: the lines stay queued, and the warning is not repeated
        clock = NOW + MIN;
        app.markLive(clock);
        await waitFor(() => append.mock.calls.length >= 2);
        expect(warn.mock.calls.filter(([m]) => m.includes('ENOSPC'))).toHaveLength(1);

        // The disk has room again
        append.mockRestore();
        clock = NOW + 2 * MIN;
        app.markLive(clock);
        await waitFor(() => app.statuses()[1].state === 'ok');
        expect(app.statuses()[1].message).toBe('');
        await app.close();
        expect(ofType(historyLines('2026-10-06'), 'r')).toHaveLength(6);
        expect(ofType(historyLines('2026-10-06'), 'task')).toHaveLength(7);
    });

    test('once the history store stops writing (too many lines waiting), the badge says so for the rest of the session', async () => {
        const app = makeApp(createQrsStub(now));
        await app.init();
        expect(app.statuses()[1].state).toBe('ok');

        jest.spyOn(app.history(), 'mode').mockReturnValue('error');
        jest.spyOn(app.history(), 'message').mockReturnValue('stopped writing to the history directory until Ctrl-Q is restarted');
        clock = NOW + MIN;
        app.markLive(clock);

        await waitFor(() => app.statuses()[1].state === 'error');
        expect(app.statuses()[1].message).toBe('stopped writing to the history directory until Ctrl-Q is restarted');
    });

    test('when another instance takes the history lock over, the badge says so and this one writes nothing more', async () => {
        const app = makeApp(createQrsStub(now));
        await app.init();
        const lockFile = path.join(hostDir(), '.lock');
        fs.writeFileSync(lockFile, JSON.stringify({ pid: 4242, host: 'other-computer', token: 'theirs' }));

        await app.history().heartbeat();
        clock = NOW + 10 * MIN;
        app.markLive(clock);

        await waitFor(() => app.statuses()[1].state === 'degraded');
        expect(app.statuses()[1].message).toMatch(/^another Ctrl-Q instance took over writing this history/);
        await app.close();
        expect(ofType(historyLines('2026-10-06'), 'obs')).toEqual([]);
        expect(JSON.parse(fs.readFileSync(lockFile, 'utf8'))).toMatchObject({ token: 'theirs' });
    });

    test('Ctrl-C while start-up waits for QRS releases the history lock', async () => {
        const stub = createQrsStub(now);
        let fail;
        const snapshotSent = new Promise((resolve, reject) => {
            fail = reject;
        });
        const request = async (options, req) => {
            if (req.path === '/qrs/executionresult/full') await snapshotSent;
            return stub.request(options, req);
        };
        const proc = Object.assign(new EventEmitter(), {
            platform: 'linux',
            stdout: new EventEmitter(),
            stderr: new EventEmitter(),
            exit: jest.fn(),
        });
        for (const level of ['info', 'warn']) jest.spyOn(globalLogger, level).mockImplementation(() => {});

        const result = taskGantt(makeConfig(), { request, processRef: proc }).then(
            () => 'started',
            (err) => err.message
        );
        await waitFor(() => fs.existsSync(path.join(hostDir(), '.lock')));

        proc.emit('SIGINT');
        await waitFor(() => proc.exit.mock.calls.length > 0);
        expect(proc.exit).toHaveBeenCalledWith(0);
        expect(fs.existsSync(path.join(hostDir(), '.lock'))).toBe(false);

        // The process would have ended here. Let the stalled request fail, so nothing else starts.
        fail(new Error('process exited'));
        expect(await result).toBe('process exited');
    });
});
