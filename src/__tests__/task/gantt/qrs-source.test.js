import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';

import { STATUS } from '../../../lib/task-gantt/model/status.js';

// axios must be mocked before qrs-json.js (and qrs-source.js, which imports it) is loaded, so both are imported
// dynamically below. A static import would load the real axios first and the mock would never be used.
const axiosRequest = jest.fn();
jest.unstable_mockModule('axios', () => ({
    default: { request: axiosRequest },
    request: axiosRequest,
}));

const { qrsRequestJson, QrsRequestError, qrsErrorHint } = await import('../../../lib/util/qseow/qrs-json.js');
const { toTaskInfo, toSchedulerNodes, createQrsSource } = await import('../../../lib/task-gantt/sources/qrs-source.js');

// Real QRS rows (anonymised) from the lab: 6 reload tasks started at once with capacity 4, so two of them queued.
// The last two rows are older runs of a task without an app (null-guid appID), i.e. a user sync task.
const ROWS = JSON.parse(fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8'));
const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794'; // queued ~46 s, then failed
const OPERATIONS_MONITOR = '0419086f-a935-4358-a356-da2f79069e78'; // queued ~49 s, newest modifiedDate in the fixture
const USER_SYNC = '0359bda0-22dc-4c46-983c-8724266eb4ef'; // two retained runs, 2026-09-09 and 2026-09-30
const NODE = 'sense-node1.example.com';
const byTask = (id) => ROWS.find((r) => r.taskID === id);
const resultOf = (id) => byTask(id).id;

const OPTIONS = {
    host: 'qlik.example.com',
    qrsPort: 4242,
    virtualProxy: '',
    authType: 'jwt',
    authJwt: 'fake-header.fake-payload.fake-sig',
};

const quietLogger = () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), verbose: jest.fn(), debug: jest.fn() });

/**
 * Stub for the injectable QRS request function. The handler maps a request to the `data` of the response.
 *
 * @param {Function} handler - (req) => data of the response.
 * @param {object} [param] - Options.
 * @param {number|null} [param.serverDate] - serverDate returned with every response.
 * @returns {Function} jest mock with the qrsRequestJson signature.
 */
function stubRequest(handler, { serverDate = null } = {}) {
    return jest.fn(async (options, req) => ({ status: 200, data: await handler(req), serverDate }));
}

/** QRS task (GET /qrs/task/full) for each task in the fixture: reloads with an app, plus one user sync task. */
function fixtureTasks() {
    const reloads = [...new Set(ROWS.filter((r) => r.taskID !== USER_SYNC).map((r) => r.taskID))].map((taskID, i) => ({
        id: taskID,
        name: `Reload ${i}`,
        taskType: 0,
        enabled: true,
        app: { id: byTask(taskID).appID, name: `App ${i}`, stream: null },
        tags: [],
    }));
    return [...reloads, { id: USER_SYNC, name: 'User sync', taskType: 2, enabled: true, tags: [] }];
}

/** A minimal execution result row, valid for fromExecutionResult(). */
function row(overrides = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        taskID: '22222222-2222-4222-8222-222222222222',
        executionID: '33333333-3333-4333-8333-333333333333',
        appID: '44444444-4444-4444-8444-444444444444',
        executingNodeName: NODE,
        status: STATUS.FINISHED_SUCCESS,
        startTime: '2026-10-06T07:00:00.000Z',
        stopTime: '2026-10-06T07:00:10.000Z',
        modifiedDate: '2026-10-06T07:00:10.100Z',
        details: [],
        ...overrides,
    };
}

describe('toTaskInfo', () => {
    test('maps a reload task with app, stream and tags', () => {
        const info = toTaskInfo({
            id: 't1',
            name: 'Reload sales',
            taskType: 0,
            enabled: true,
            app: { id: 'a1', name: 'Sales', stream: { id: 's1', name: 'Finance' } },
            tags: [{ id: 'g1', name: 'nightly' }, { name: 'prio-high' }],
            someOtherQrsField: 'ignored',
        });

        expect(info).toEqual({
            id: 't1',
            name: 'Reload sales',
            taskType: 0,
            enabled: true,
            appId: 'a1',
            appName: 'Sales',
            stream: 'Finance',
            tags: ['nightly', 'prio-high'],
        });
    });

    test('maps a user sync task without an app to nulls and no tags', () => {
        const info = toTaskInfo({ id: 't2', name: 'Sync AD', taskType: 2, enabled: false });

        expect(info).toEqual({
            id: 't2',
            name: 'Sync AD',
            taskType: 2,
            enabled: false,
            appId: null,
            appName: null,
            stream: null,
            tags: [],
        });
    });

    test('treats a missing enabled flag as enabled and an unpublished app as having no stream', () => {
        const info = toTaskInfo({ id: 't3', name: 'x', taskType: 0, app: { id: 'a3', name: 'Work', stream: null }, tags: null });

        expect(info.enabled).toBe(true);
        expect(info.appId).toBe('a3');
        expect(info.stream).toBeNull();
        expect(info.tags).toEqual([]);
    });
});

describe('toSchedulerNodes', () => {
    test('keeps only schedulers that run reloads (Slave = 1, MasterAndSlave = 2) and lower-cases the host', () => {
        const nodes = toSchedulerNodes([
            {
                settings: { schedulerServiceType: 0, maxConcurrentEngines: 4 },
                serverNodeConfiguration: { hostName: 'Central.Example.com' },
            },
            {
                settings: { schedulerServiceType: 1, maxConcurrentEngines: 4 },
                serverNodeConfiguration: { hostName: 'Sense-Node1.Example.com' },
            },
            { settings: { schedulerServiceType: 2, maxConcurrentEngines: 8 }, serverNodeConfiguration: { hostName: ' RIM2.example.COM ' } },
            { settings: { schedulerServiceType: 3, maxConcurrentEngines: 2 }, serverNodeConfiguration: { hostName: 'future.example.com' } },
        ]);

        expect(nodes).toEqual([
            { nodeName: 'sense-node1.example.com', type: 1, maxConcurrentEngines: 4 },
            { nodeName: 'rim2.example.com', type: 2, maxConcurrentEngines: 8 },
        ]);
    });

    test('skips schedulers without settings and tolerates a missing node configuration', () => {
        const nodes = toSchedulerNodes([{}, { settings: null }, { settings: { schedulerServiceType: 1, maxConcurrentEngines: 3 } }]);

        expect(nodes).toEqual([{ nodeName: '', type: 1, maxConcurrentEngines: 3 }]);
    });

    test('returns an empty list for a missing response', () => {
        expect(toSchedulerNodes(undefined)).toEqual([]);
        expect(toSchedulerNodes(null)).toEqual([]);
        expect(toSchedulerNodes([])).toEqual([]);
    });
});

describe('createQrsSource.loadMetadata', () => {
    test('reads tasks, schedulers and the cluster id from QRS', async () => {
        const request = stubRequest((req) => {
            switch (req.path) {
                case '/qrs/task/full':
                    return [
                        {
                            id: 't1',
                            name: 'Reload',
                            taskType: 0,
                            app: { id: 'a1', name: 'App', stream: { name: 'Everyone' } },
                            tags: [{ name: 'x' }],
                        },
                        { id: 't2', name: 'Sync', taskType: 2, enabled: false },
                    ];
                case '/qrs/schedulerservice/full':
                    return [
                        {
                            settings: { schedulerServiceType: 0, maxConcurrentEngines: 4 },
                            serverNodeConfiguration: { hostName: 'Central' },
                        },
                        {
                            settings: { schedulerServiceType: 1, maxConcurrentEngines: 4 },
                            serverNodeConfiguration: { hostName: 'Sense-Node1.example.com' },
                        },
                    ];
                case '/qrs/servicecluster/full':
                    return [{ id: 'c0ffee00-0000-4000-8000-000000000001', name: 'ServiceCluster' }];
                default:
                    throw new Error(`unexpected path ${req.path}`);
            }
        });
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        const meta = await source.loadMetadata();

        expect(request).toHaveBeenCalledTimes(3);
        expect(request.mock.calls.map(([, req]) => req.path).sort()).toEqual([
            '/qrs/schedulerservice/full',
            '/qrs/servicecluster/full',
            '/qrs/task/full',
        ]);
        for (const [opts, req] of request.mock.calls) {
            expect(opts).toBe(OPTIONS);
            expect(req.method).toBe('get');
            expect(req.query).toBeUndefined();
        }
        expect(meta.clusterId).toBe('c0ffee00-0000-4000-8000-000000000001');
        expect(meta.schedulers).toEqual([{ nodeName: 'sense-node1.example.com', type: 1, maxConcurrentEngines: 4 }]);
        expect(meta.tasks).toEqual([
            { id: 't1', name: 'Reload', taskType: 0, enabled: true, appId: 'a1', appName: 'App', stream: 'Everyone', tags: ['x'] },
            { id: 't2', name: 'Sync', taskType: 2, enabled: false, appId: null, appName: null, stream: null, tags: [] },
        ]);
        expect([...source.taskTypes()]).toEqual([
            ['t1', 0],
            ['t2', 2],
        ]);
    });

    test('copes with empty responses: no tasks, no schedulers, no cluster', async () => {
        const request = stubRequest((req) => (req.path === '/qrs/servicecluster/full' ? [] : null));
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        const meta = await source.loadMetadata();

        expect(meta).toEqual({ tasks: [], schedulers: [], clusterId: null });
        expect(source.taskTypes().size).toBe(0);
    });

    test('replaces the task types on reload instead of merging them', async () => {
        let tasks = [{ id: 'old', name: 'Old', taskType: 0 }];
        const request = stubRequest((req) => (req.path === '/qrs/task/full' ? tasks : []));
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        await source.loadMetadata();
        expect(source.taskTypes().get('old')).toBe(0);

        tasks = [{ id: 'new', name: 'New', taskType: 1 }];
        await source.loadMetadata();
        expect(source.taskTypes().has('old')).toBe(false);
        expect(source.taskTypes().get('new')).toBe(1);
    });

    test('rejects when a QRS request fails', async () => {
        const request = jest.fn(async (options, req) => {
            if (req.path === '/qrs/schedulerservice/full')
                throw new QrsRequestError('QRS GET /qrs/schedulerservice/full failed: HTTP 403', 403);
            return { status: 200, data: [], serverDate: null };
        });
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        await expect(source.loadMetadata()).rejects.toMatchObject({ name: 'QrsRequestError', status: 403 });
    });
});

describe('createQrsSource.snapshot', () => {
    const SERVER_DATE = Date.parse('2026-10-06T06:31:25.000Z');

    function snapshotRequest({ results = ROWS, sessions = [], serverDate = SERVER_DATE } = {}) {
        return jest.fn(async (options, req) => {
            switch (req.path) {
                case '/qrs/task/full':
                    return { status: 200, data: fixtureTasks(), serverDate: null };
                case '/qrs/schedulerservice/full':
                case '/qrs/servicecluster/full':
                    return { status: 200, data: [], serverDate: null };
                case '/qrs/executionresult/full':
                    return { status: 200, data: results, serverDate };
                case '/qrs/executionsession/full':
                    // The session response's date must not be used as the server time
                    return { status: 200, data: sessions, serverDate: 1 };
                default:
                    throw new Error(`unexpected path ${req.path}`);
            }
        });
    }

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('asks only for results that ran, and reads the running execution sessions', async () => {
        const request = snapshotRequest();
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        await source.snapshot();

        const calls = request.mock.calls.map(([, req]) => req);
        expect(calls).toHaveLength(2);
        expect(calls).toContainEqual({ method: 'get', path: '/qrs/executionresult/full', query: { filter: 'status ne NeverStarted' } });
        expect(calls).toContainEqual({ method: 'get', path: '/qrs/executionsession/full', query: undefined });
    });

    test('normalises the lab fixture: records, task types, running ids, cursor, coverage and server time', async () => {
        const sessions = [
            { id: 's1', executionResult: { id: resultOf(OPERATIONS_MONITOR) } },
            { id: 's2', executionResult: null },
            { id: 's3' },
            { id: 's4', executionResult: { id: resultOf(CONTENT_MONITOR) } },
        ];
        const request = snapshotRequest({ sessions });
        const logger = quietLogger();
        const source = createQrsSource({ options: OPTIONS, logger, request });
        await source.loadMetadata();

        const snap = await source.snapshot();

        expect(snap.records).toHaveLength(ROWS.length);
        expect(snap.records.map((r) => r.key)).toEqual(ROWS.map((r) => `r:${r.id}`));
        expect(snap.records.every((r) => r.src === 1 && r.confidence === 'exact' && r.nodeName === NODE)).toBe(true);

        // Task types come from the metadata loaded before
        const cm = snap.records.find((r) => r.taskId === CONTENT_MONITOR);
        expect(cm.taskType).toBe(0);
        expect(cm.status).toBe(STATUS.FINISHED_FAIL);
        expect(cm.startedAt - cm.triggeredAt).toBeGreaterThan(45000); // it waited in the queue
        const sync = snap.records.filter((r) => r.taskId === USER_SYNC);
        expect(sync).toHaveLength(2);
        expect(sync.every((r) => r.taskType === 2 && r.appId === null)).toBe(true);

        expect(snap.runningResultIds).toEqual(new Set([resultOf(OPERATIONS_MONITOR), resultOf(CONTENT_MONITOR)]));

        // Newest modifiedDate of all rows, which is the Operations Monitor run
        expect(snap.maxModified).toBe(Date.parse(byTask(OPERATIONS_MONITOR).modifiedDate));
        expect(snap.maxModified).toBe(Math.max(...ROWS.map((r) => Date.parse(r.modifiedDate))));

        // QRS coverage per task starts at its oldest retained trigger
        expect(snap.oldestByTask.size).toBe(new Set(ROWS.map((r) => r.taskID)).size);
        expect(snap.oldestByTask.get(USER_SYNC)).toBe(Date.parse('2026-09-09T05:20:30.143Z'));
        expect(snap.oldestByTask.get(CONTENT_MONITOR)).toBe(Date.parse('2026-10-06T06:29:45.239Z'));

        expect(snap.serverTime).toBe(SERVER_DATE);
        expect(logger.verbose).toHaveBeenCalledWith(expect.stringContaining(`${ROWS.length} execution results, 2 running sessions`));
    });

    test('leaves task types null when metadata has not been loaded', async () => {
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: snapshotRequest() });

        const snap = await source.snapshot();

        expect(snap.records).toHaveLength(ROWS.length);
        expect(snap.records.every((r) => r.taskType === null)).toBe(true);
    });

    test('drops rows that never ran or have no task, and ignores rows without dates for cursor and coverage', async () => {
        const kept = row({ id: 'aaaaaaaa-0000-4000-8000-000000000001', taskID: 'task-a' });
        const undated = row({
            id: 'aaaaaaaa-0000-4000-8000-000000000002',
            taskID: 'task-b',
            status: STATUS.TRIGGERED,
            startTime: '1753-01-01T00:00:00.000Z',
            stopTime: '1753-01-01T00:00:00.000Z',
            modifiedDate: '1753-01-01T00:00:00.000Z',
        });
        const results = [
            row({ id: 'aaaaaaaa-0000-4000-8000-000000000003', status: STATUS.NEVER_STARTED }),
            row({ id: 'aaaaaaaa-0000-4000-8000-000000000004', taskID: null }),
            null,
            kept,
            undated,
        ];
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: snapshotRequest({ results }) });

        const snap = await source.snapshot();

        expect(snap.records.map((r) => r.resultId)).toEqual([kept.id, undated.id]);
        expect(snap.maxModified).toBe(Date.parse(kept.modifiedDate));
        expect([...snap.oldestByTask]).toEqual([['task-a', Date.parse(kept.startTime)]]);
    });

    test('handles an empty QRS: no records, no cursor, and falls back to the local clock', async () => {
        const now = Date.parse('2026-10-06T08:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const source = createQrsSource({
            options: OPTIONS,
            logger: quietLogger(),
            request: snapshotRequest({ results: null, sessions: null, serverDate: null }),
        });

        const snap = await source.snapshot();

        expect(snap.records).toEqual([]);
        expect(snap.runningResultIds.size).toBe(0);
        expect(snap.maxModified).toBeNull();
        expect(snap.oldestByTask.size).toBe(0);
        expect(snap.serverTime).toBe(now);
    });
});

describe('createQrsSource.changesSince', () => {
    const CURSOR = Date.parse('2026-10-06T06:31:00.000Z');

    function changesRequest(results) {
        return stubRequest((req) => {
            if (req.path !== '/qrs/executionresult/full') throw new Error(`unexpected path ${req.path}`);
            return results;
        });
    }

    test('asks for results modified after the cursor minus a 5 s overlap, and advances the cursor to the newest change', async () => {
        const request = changesRequest(ROWS.filter((r) => Date.parse(r.modifiedDate) > CURSOR - 5000));
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        const res = await source.changesSince(CURSOR);

        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][1]).toEqual({
            method: 'get',
            path: '/qrs/executionresult/full',
            query: { filter: "modifiedDate gt '2026-10-06T06:30:55.000Z'" },
        });
        expect(res.records.map((r) => r.taskId).sort()).toEqual(
            [CONTENT_MONITOR, OPERATIONS_MONITOR, '8d2c5d0c-12e2-4dc8-9832-de1ae367a373', '5fee7b84-76f8-4cc1-ba4f-466d8eefa8be'].sort()
        );
        expect(res.cursor).toBe(Date.parse(byTask(OPERATIONS_MONITOR).modifiedDate));
    });

    test('uses a custom overlap', async () => {
        const request = changesRequest([]);
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        await source.changesSince(CURSOR, 60000);

        expect(request.mock.calls[0][1].query).toEqual({ filter: "modifiedDate gt '2026-10-06T06:30:00.000Z'" });
    });

    test('never moves the cursor backwards when only overlap rows (older than the cursor) come back', async () => {
        const cursor = Date.parse('2026-10-06T06:31:23.000Z'); // after every row in the fixture
        const overlap = ROWS.filter((r) => Date.parse(r.modifiedDate) > cursor - 5000);
        expect(overlap.length).toBeGreaterThan(0);
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: changesRequest(overlap) });

        const res = await source.changesSince(cursor);

        // The overlap rows are still returned (the store ignores versions it already has) ...
        expect(res.records).toHaveLength(overlap.length);
        // ... but the cursor stays where it was
        expect(res.cursor).toBe(cursor);
    });

    test('keeps the cursor for an empty response and for rows without a modifiedDate', async () => {
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: changesRequest(null) });
        expect(await source.changesSince(CURSOR)).toEqual({ records: [], cursor: CURSOR });

        const undated = row({ modifiedDate: null, status: STATUS.STARTED, stopTime: null });
        const neverStarted = row({
            id: 'bbbbbbbb-0000-4000-8000-000000000001',
            status: STATUS.NEVER_STARTED,
            modifiedDate: '2030-01-01T00:00:00.000Z',
        });
        const source2 = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: changesRequest([undated, neverStarted]) });
        const res = await source2.changesSince(CURSOR);

        expect(res.records.map((r) => r.resultId)).toEqual([undated.id]);
        // A NeverStarted row is dropped, so its (far future) modifiedDate must not move the cursor either
        expect(res.cursor).toBe(CURSOR);
    });

    test('chained polls advance monotonically and tag records with the loaded task types', async () => {
        let next = [];
        const request = jest.fn(async (options, req) => {
            if (req.path === '/qrs/task/full') return { status: 200, data: [{ id: 'task-a', name: 'A', taskType: 0 }], serverDate: null };
            if (req.path === '/qrs/executionresult/full') return { status: 200, data: next, serverDate: null };
            return { status: 200, data: [], serverDate: null };
        });
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });
        await source.loadMetadata();

        next = [row({ taskID: 'task-a', modifiedDate: '2026-10-06T07:00:10.000Z' })];
        const first = await source.changesSince(CURSOR);
        expect(first.cursor).toBe(Date.parse('2026-10-06T07:00:10.000Z'));
        expect(first.records[0].taskType).toBe(0);

        next = [
            row({ taskID: 'task-a', modifiedDate: '2026-10-06T07:00:10.000Z' }),
            row({ id: 'cccccccc-0000-4000-8000-000000000001', taskID: 'task-a', modifiedDate: '2026-10-06T07:00:20.500Z' }),
        ];
        const second = await source.changesSince(first.cursor);
        expect(request.mock.calls.at(-1)[1].query.filter).toBe("modifiedDate gt '2026-10-06T07:00:05.000Z'");
        expect(second.cursor).toBe(Date.parse('2026-10-06T07:00:20.500Z'));
        expect(second.records).toHaveLength(2);
    });
});

describe('createQrsSource.runningResultIds / isRunningStatus', () => {
    test('returns the execution result ids of the running sessions', async () => {
        const request = stubRequest((req) =>
            req.path === '/qrs/executionsession/full'
                ? [{ executionResult: { id: 'r1' } }, { executionResult: {} }, {}, { executionResult: { id: 'r2' } }]
                : []
        );
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        expect(await source.runningResultIds()).toEqual(new Set(['r1', 'r2']));
        expect(request).toHaveBeenCalledWith(OPTIONS, { method: 'get', path: '/qrs/executionsession/full', query: undefined });
    });

    test('returns an empty set when nothing runs', async () => {
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: stubRequest(() => null) });

        expect((await source.runningResultIds()).size).toBe(0);
    });

    test('isRunningStatus is true only for Triggered, Queued and Started', () => {
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: stubRequest(() => []) });

        expect([STATUS.TRIGGERED, STATUS.QUEUED, STATUS.STARTED].every(source.isRunningStatus)).toBe(true);
        expect(
            [STATUS.NEVER_STARTED, STATUS.ABORTED, STATUS.FINISHED_SUCCESS, STATUS.FINISHED_FAIL, STATUS.SKIPPED, STATUS.ERROR].some(
                source.isRunningStatus
            )
        ).toBe(false);
    });
});

describe('createQrsSource.executionDetails', () => {
    test.each([
        ['not a uuid', 'abc'],
        ['an OData injection attempt', "570f641f-6e79-455b-bc1a-533a99bbb5a7 or id ne ''"],
        ['an empty string', ''],
        ['undefined', undefined],
    ])('rejects %s before sending any request', async (_label, id) => {
        const request = stubRequest(() => []);
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        await expect(source.executionDetails(id)).rejects.toThrow('invalid execution result id');
        expect(request).not.toHaveBeenCalled();
    });

    test('returns null when QRS no longer has the result', async () => {
        const request = stubRequest(() => []);
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request });

        expect(await source.executionDetails('570f641f-6e79-455b-bc1a-533a99bbb5a7')).toBeNull();
        expect(request).toHaveBeenCalledWith(OPTIONS, {
            method: 'get',
            path: '/qrs/executionresult/full',
            query: { filter: 'id eq 570f641f-6e79-455b-bc1a-533a99bbb5a7' },
        });

        const nullData = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: stubRequest(() => null) });
        expect(await nullData.executionDetails('570f641f-6e79-455b-bc1a-533a99bbb5a7')).toBeNull();
    });

    test('returns the details sorted by time, plus whether a script log exists', async () => {
        const cm = byTask(CONTENT_MONITOR);
        const source = createQrsSource({ options: OPTIONS, logger: quietLogger(), request: stubRequest(() => [cm]) });

        const res = await source.executionDetails(cm.id);

        expect(res.scriptLogAvailable).toBe(true);
        expect(res.details).toHaveLength(cm.details.length);
        expect(res.details[0]).toEqual({ t: Date.parse('2026-10-06T06:29:45.239Z'), type: 2, message: 'Changing task state to Triggered' });
        expect(res.details.at(-1)).toEqual({ t: Date.parse('2026-10-06T06:31:10.481Z'), type: 2, message: 'Max retries reached (0)' });
        const times = res.details.map((d) => d.t);
        expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    test('reports a missing script log and missing details', async () => {
        const source = createQrsSource({
            options: OPTIONS,
            logger: quietLogger(),
            request: stubRequest(() => [{ id: '570f641f-6e79-455b-bc1a-533a99bbb5a7', details: null }]),
        });

        expect(await source.executionDetails('570f641f-6e79-455b-bc1a-533a99bbb5a7')).toEqual({ details: [], scriptLogAvailable: false });
    });
});

describe('qrsRequestJson', () => {
    const JWT = 'eyJhbGciOiJSUzI1NiJ9.c2VjcmV0LXBheWxvYWQ.TOP-SECRET-SIGNATURE';
    const JWT_OPTIONS = { ...OPTIONS, authJwt: JWT };
    const ok = (data, headers = {}) => ({ status: 200, data, headers });

    beforeEach(() => {
        axiosRequest.mockReset();
    });

    test('builds a JWT request: base URL, xrfkey, bearer token, default 60 s timeout', async () => {
        axiosRequest.mockResolvedValue(ok([]));

        await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/task/full' });

        expect(axiosRequest).toHaveBeenCalledTimes(1);
        const config = axiosRequest.mock.calls[0][0];
        expect(config.method).toBe('get');
        expect(config.baseURL).toBe('https://qlik.example.com:4242');
        expect(config.headers.Authorization).toBe(`Bearer ${JWT}`);
        const xrf = config.headers['x-qlik-xrfkey'];
        expect(xrf).toMatch(/^[A-Za-z0-9]{16}$/);
        expect(config.url).toBe(`/qrs/task/full?xrfkey=${xrf}`);
        expect(config.timeout).toBe(60000);
        expect(config.data).toBeUndefined();
    });

    test('URL-encodes query values and leaves out empty ones', async () => {
        axiosRequest.mockResolvedValue(ok([]));

        await qrsRequestJson(JWT_OPTIONS, {
            path: '/qrs/executionresult/full',
            query: {
                filter: "modifiedDate gt '2026-10-06T06:30:55.000Z'",
                empty: '',
                nothing: null,
                missing: undefined,
                zero: 0,
                tricky: 'a&b=c#d?e',
            },
        });

        const { url, headers } = axiosRequest.mock.calls[0][0];
        const xrf = headers['x-qlik-xrfkey'];
        expect(url).toBe(
            `/qrs/executionresult/full?xrfkey=${xrf}` +
                "&filter=modifiedDate%20gt%20'2026-10-06T06%3A30%3A55.000Z'" +
                '&zero=0' +
                '&tricky=a%26b%3Dc%23d%3Fe'
        );
        // The encoded filter must decode back to exactly what was asked for
        expect(new URL(url, 'https://x').searchParams.get('filter')).toBe("modifiedDate gt '2026-10-06T06:30:55.000Z'");
        expect(new URL(url, 'https://x').searchParams.get('tricky')).toBe('a&b=c#d?e');
    });

    test('sends the method and body', async () => {
        axiosRequest.mockResolvedValue({ status: 201, data: { id: 'x' }, headers: {} });

        const res = await qrsRequestJson(JWT_OPTIONS, { method: 'post', path: '/qrs/task/start', body: { ids: ['a'] } });

        expect(axiosRequest.mock.calls[0][0]).toMatchObject({ method: 'post', data: { ids: ['a'] } });
        expect(res).toEqual({ status: 201, data: { id: 'x' }, serverDate: null });
    });

    test('parses a string JSON body and passes an already parsed body through', async () => {
        axiosRequest.mockResolvedValueOnce(ok('[{"id":"t1","name":"Reload"}]'));
        axiosRequest.mockResolvedValueOnce(ok({ already: 'parsed' }));

        expect((await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/task/full' })).data).toEqual([{ id: 't1', name: 'Reload' }]);
        expect((await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).data).toEqual({ already: 'parsed' });
    });

    test('returns null data for an empty body', async () => {
        axiosRequest.mockResolvedValue({ status: 204, data: '', headers: {} });

        expect(await qrsRequestJson(JWT_OPTIONS, { method: 'delete', path: '/qrs/tag/x' })).toEqual({
            status: 204,
            data: null,
            serverDate: null,
        });
    });

    test('throws QrsRequestError for invalid JSON, with the response status', async () => {
        axiosRequest.mockResolvedValue(ok('<html>Proxy login</html>'));

        const err = await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/task/full' }).catch((e) => e);

        expect(err).toBeInstanceOf(QrsRequestError);
        expect(err.name).toBe('QrsRequestError');
        expect(err.status).toBe(200);
        expect(err.message).toBe('QRS GET /qrs/task/full returned invalid JSON');
    });

    test('throws QrsRequestError with the HTTP status, and never leaks request headers (JWT)', async () => {
        axiosRequest.mockImplementation(async (config) => {
            // Shaped like an AxiosError: carries the request config, including the Authorization header
            const e = new Error('Request failed with status code 401');
            e.code = 'ERR_BAD_REQUEST';
            e.config = config;
            e.request = { _header: `GET ${config.url} HTTP/1.1\r\nAuthorization: Bearer ${JWT}\r\n` };
            e.response = { status: 401, statusText: 'Unauthorized', headers: {}, data: 'Unauthorized', config };
            e.toJSON = () => ({ message: e.message, config });
            throw e;
        });

        const err = await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/task/full', query: { filter: "name eq 'x'" } }).catch((e) => e);

        expect(err).toBeInstanceOf(QrsRequestError);
        expect(err.status).toBe(401);
        expect(err.reason).toBe('HTTP 401');
        expect(err.hint).toMatch(/JWT is valid and not expired/);
        expect(err.message).toBe(`QRS GET /qrs/task/full on qlik.example.com:4242 failed: HTTP 401. ${err.hint}`);
        expect(err.config).toBeUndefined();
        expect(err.request).toBeUndefined();
        expect(err.response).toBeUndefined();
        expect(err.cause).toBeUndefined();
        for (const text of [err.message, String(err), err.stack, JSON.stringify(err)]) {
            expect(text).not.toContain(JWT);
            expect(text).not.toContain('Bearer');
        }
    });

    test('keeps the host, the reason and the error code when there is no response (network error, timeout)', async () => {
        axiosRequest.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:4242'), { code: 'ECONNREFUSED' }));
        axiosRequest.mockRejectedValueOnce(Object.assign(new Error('timeout of 1000ms exceeded'), { code: 'ECONNABORTED' }));
        axiosRequest.mockRejectedValueOnce(new Error('socket hang up'));
        axiosRequest.mockRejectedValueOnce(
            Object.assign(new Error('Hostname/IP does not match'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' })
        );

        await expect(qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).rejects.toMatchObject({
            name: 'QrsRequestError',
            status: null,
            reason: 'connect ECONNREFUSED 10.0.0.1:4242',
            message: expect.stringMatching(
                /^QRS GET \/qrs\/about on qlik.example.com:4242 failed: connect ECONNREFUSED 10.0.0.1:4242\. With JWT/
            ),
        });
        await expect(qrsRequestJson(JWT_OPTIONS, { method: 'put', path: '/qrs/about' })).rejects.toMatchObject({
            status: null,
            reason: 'ECONNABORTED: timeout of 1000ms exceeded',
            hint: expect.stringMatching(/did not answer in time/),
        });
        await expect(qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).rejects.toMatchObject({
            status: null,
            hint: '',
            message: 'QRS GET /qrs/about on qlik.example.com:4242 failed: socket hang up',
        });
        await expect(qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).rejects.toMatchObject({
            reason: 'ERR_TLS_CERT_ALTNAME_INVALID: Hostname/IP does not match',
        });
    });

    test('hints at the usual mistakes for certificate and JWT authentication', () => {
        const cert = { authType: 'cert' };
        const jwt = { authType: 'jwt' };
        expect(qrsErrorHint(cert, 403)).toMatch(/certificate files are from this Sense site/);
        expect(qrsErrorHint(jwt, 401)).toMatch(/--virtual-proxy/);
        expect(qrsErrorHint(cert, undefined, 'ECONNREFUSED')).toMatch(/usually 4242/);
        expect(qrsErrorHint(jwt, undefined, 'ECONNRESET')).toMatch(/--qrs-port 443 with --virtual-proxy/);
        expect(qrsErrorHint(cert, undefined, 'ENOTFOUND')).toMatch(/--host/);
        expect(qrsErrorHint(cert, 500)).toBe('');
        expect(qrsErrorHint(cert, undefined, 'EWHATEVER')).toBe('');
    });

    test('timeoutMs overrides the default timeout', async () => {
        axiosRequest.mockResolvedValue(ok([]));

        await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/task/full', timeoutMs: 1234 });
        await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/task/full', timeoutMs: 0 });

        expect(axiosRequest.mock.calls[0][0].timeout).toBe(1234);
        // 0 is "not set", not "no timeout"
        expect(axiosRequest.mock.calls[1][0].timeout).toBe(60000);
    });

    test('parses the server time from the Date header, null when missing or invalid', async () => {
        axiosRequest.mockResolvedValueOnce(ok([], { date: 'Tue, 06 Oct 2026 06:31:22 GMT' }));
        axiosRequest.mockResolvedValueOnce(ok([], { date: 'not a date' }));
        axiosRequest.mockResolvedValueOnce({ status: 200, data: [] });

        expect((await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).serverDate).toBe(Date.UTC(2026, 9, 6, 6, 31, 22));
        expect((await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).serverDate).toBeNull();
        expect((await qrsRequestJson(JWT_OPTIONS, { path: '/qrs/about' })).serverDate).toBeNull();
    });

    test('is the default request function of createQrsSource (filters are encoded on the wire)', async () => {
        axiosRequest.mockImplementation(async (config) => {
            if (config.url.startsWith('/qrs/executionresult/full')) {
                return ok(JSON.stringify([byTask(CONTENT_MONITOR)]), { date: 'Tue, 06 Oct 2026 06:31:22 GMT' });
            }
            return ok('[]');
        });
        const source = createQrsSource({ options: JWT_OPTIONS, logger: quietLogger() });

        const snap = await source.snapshot();

        const urls = axiosRequest.mock.calls.map(([config]) => config.url);
        expect(urls.some((u) => u.startsWith('/qrs/executionresult/full?') && u.endsWith('&filter=status%20ne%20NeverStarted'))).toBe(true);
        expect(snap.records.map((r) => r.taskId)).toEqual([CONTENT_MONITOR]);
        expect(snap.serverTime).toBe(Date.UTC(2026, 9, 6, 6, 31, 22));
    });
});
