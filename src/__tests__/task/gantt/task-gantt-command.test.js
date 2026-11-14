import { jest, test, expect, describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { taskGantt } from '../../../lib/cmd/qseow/taskgantt.js';
import { validateTaskGanttOptions } from '../../../lib/task-gantt/options.js';
import { TASK_GANTT_ROUTES } from '../../../lib/task-gantt/page-routes.js';
import { QRS_NULL_DATE, SOURCE_BIT, SOURCE } from '../../../lib/task-gantt/defaults.js';
import { createAssetCatalog, checkSeaConfig } from '../../../lib/util/web/assets.js';
import { DEFAULT_CSP } from '../../../lib/util/web/server.js';
import { getLoggingLevel, setLoggingLevel, logger } from '../../../globals.js';
import { rawRequest } from '../../util/web/web-test-helpers.mjs';

// End-to-end tests of `qseow task-gantt`: taskGantt() with a stubbed QRS, a temporary history directory and a real web
// server on a free port.

const SRC_DIR = new URL('../../../', import.meta.url);
const REPO_DIR = new URL('../../../../', import.meta.url);
const readSrc = (file) => fs.readFileSync(new URL(file, SRC_DIR));
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(new URL('package.json', REPO_DIR), 'utf8')).version;
const SEA_CONFIG = JSON.parse(fs.readFileSync(new URL('sea-config.json', REPO_DIR), 'utf8'));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HOST = 'sense.example.com';
const NODE = 'sense-node1.example.com';
const CLUSTER_ID = '6a2fd3a8-6c8f-4e4f-9b1d-0f6c1d2e3a4b';
const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
const OPERATIONS_MONITOR = '0419086f-a935-4358-a356-da2f79069e78';
const USER_SYNC_TASK = '0359bda0-22dc-4c46-983c-8724266eb4ef';

// Real, anonymised QRS rows: 6 reload tasks triggered at once with maxConcurrentEngines 4, plus two older runs of a
// user sync task (6 and 27 days earlier).
const FIXTURE = JSON.parse(fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8'));
const BURST_AT = Date.parse('2026-10-06T06:29:45.192Z');
const BURST_ROWS = FIXTURE.filter((r) => r.taskID !== USER_SYNC_TASK);
const CONTENT_MONITOR_RESULT = BURST_ROWS.find((r) => r.taskID === CONTENT_MONITOR).id;

const reloadTask = (id, name, appId, appName) => ({
    id,
    name,
    taskType: 0,
    enabled: true,
    app: { id: appId, name: appName, stream: { name: 'Monitoring apps' } },
    tags: [{ name: 'Monitoring' }],
});

// GET /qrs/task/full
const QRS_TASKS = [
    reloadTask(CONTENT_MONITOR, 'Reload Content Monitor', 'c7178a65-a153-4f63-bbd7-10990fcffb69', 'Content Monitor'),
    reloadTask('a87ae597-be31-4453-be04-5b4f67489d8d', 'Reload License Monitor', '621dfb6b-96a0-41f6-9989-1df9aaaa6ca8', 'License Monitor'),
    reloadTask(OPERATIONS_MONITOR, 'Reload Operations Monitor', '378f1b1d-5e53-40ea-89e9-79c30ee24145', 'Operations Monitor'),
    reloadTask('8d2c5d0c-12e2-4dc8-9832-de1ae367a373', 'Reload Sales', 'f9640fa6-5d33-4429-8171-beefb93b9311', 'Sales'),
    reloadTask('60f56836-b6e4-4690-8896-a2262c4ebb8c', 'Reload Finance', 'db1b2df9-81a9-4f45-811d-904924bc4150', 'Finance'),
    reloadTask('5fee7b84-76f8-4cc1-ba4f-466d8eefa8be', 'Reload HR', 'd683eb71-2a5c-4520-b259-041ca2d90bb0', 'HR'),
    { id: USER_SYNC_TASK, name: 'User sync AD', taskType: 2, enabled: true, tags: [] },
];

// GET /qrs/schedulerservice/full: a reloading node (host name in mixed case) and a master-only central node
const QRS_SCHEDULERS = [
    { settings: { schedulerServiceType: 2, maxConcurrentEngines: 4 }, serverNodeConfiguration: { hostName: 'Sense-Node1.example.com' } },
    { settings: { schedulerServiceType: 0, maxConcurrentEngines: 4 }, serverNodeConfiguration: { hostName: 'central.example.com' } },
];

const shiftIso = (value, offset) =>
    typeof value === 'string' && value !== QRS_NULL_DATE ? new Date(Date.parse(value) + offset).toISOString() : value;

/**
 * The fixture rows, moved in time so the burst happened about 2 hours ago (the app's clock is the real one). The
 * shift is a whole number of minutes, so the data lands on the same sub-minute positions as in the lab run.
 *
 * @returns {Array<object>} QRS execution result rows.
 */
function recentRows() {
    const offset = Math.floor((Date.now() - 2 * HOUR - BURST_AT) / 60000) * 60000;
    return FIXTURE.map((row) => ({
        ...row,
        createdDate: shiftIso(row.createdDate, offset),
        modifiedDate: shiftIso(row.modifiedDate, offset),
        startTime: shiftIso(row.startTime, offset),
        stopTime: shiftIso(row.stopTime, offset),
        details: row.details.map((d) => ({ ...d, detailCreatedDate: shiftIso(d.detailCreatedDate, offset) })),
    }));
}

/**
 * A stub of qrsRequestJson() that answers like QRS, including the execution result filters the command uses.
 *
 * @param {Array<object>} rows - Execution results QRS holds. May be changed later to simulate new executions.
 * @returns {object} { request, rows, sessions, calls }.
 */
function createQrsStub(rows) {
    const stub = { rows, sessions: [], calls: [] };
    const ok = (data) => ({ status: 200, data: structuredClone(data), serverDate: Date.now() });

    stub.request = async (options, { method = 'get', path: urlPath, query = {} } = {}) => {
        stub.calls.push({ options, method, path: urlPath, filter: query.filter });
        if (method !== 'get') throw new Error(`unexpected QRS request ${method} ${urlPath}`);
        switch (urlPath) {
            case '/qrs/task/full':
                return ok(QRS_TASKS);
            case '/qrs/schedulerservice/full':
                return ok(QRS_SCHEDULERS);
            case '/qrs/servicecluster/full':
                return ok([{ id: CLUSTER_ID, name: 'ServiceCluster' }]);
            case '/qrs/executionsession/full':
                return ok(stub.sessions);
            case '/qrs/executionresult/full': {
                const filter = query.filter ?? '';
                if (filter === 'status ne NeverStarted') return ok(stub.rows.filter((r) => r.status !== 0));
                const since = /^modifiedDate gt '([^']+)'$/.exec(filter);
                if (since) return ok(stub.rows.filter((r) => Date.parse(r.modifiedDate) > Date.parse(since[1])));
                const byId = /^id eq ([0-9a-f-]{36})$/.exec(filter);
                if (byId) return ok(stub.rows.filter((r) => r.id === byId[1]));
                throw new Error(`unexpected execution result filter "${filter}"`);
            }
            default:
                throw new Error(`unexpected QRS request ${method} ${urlPath}`);
        }
    };
    return stub;
}

/**
 * GET a URL and return the body as a Buffer (decompressed if gzipped), plus the raw bytes on the wire.
 *
 * @param {object} param - { port, path, host, headers }.
 * @returns {Promise<{status: number, headers: object, raw: Buffer, body: Buffer}>} Response.
 */
function getBytes({ port, path: urlPath, host = 'localhost', headers = {} }) {
    return new Promise((resolve, reject) => {
        const req = http.get({ host, port, path: urlPath, headers, agent: false }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks);
                const body = res.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(raw) : raw;
                resolve({ status: res.statusCode, headers: res.headers, raw, body });
            });
        });
        req.on('error', reject);
    });
}

const get = (port, urlPath, headers = {}) => rawRequest({ port, path: urlPath, headers, host: 'localhost' });

const getJson = async (port, urlPath) => {
    const res = await get(port, urlPath);
    return { ...res, json: JSON.parse(res.body) };
};

/**
 * Open the live update stream (Server-Sent Events) of a running page server.
 *
 * @param {number} port - Server port.
 * @returns {Promise<object>} { res, text(), waitFor(regex, timeoutMs), ended, destroy() }.
 */
function openEventStream(port) {
    return new Promise((resolve, reject) => {
        const req = http.get(
            { host: 'localhost', port, path: '/api/events', headers: { Accept: 'text/event-stream' }, agent: false },
            (res) => {
                let buf = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    buf += chunk;
                });
                const ended = new Promise((resolveEnd) => res.on('end', resolveEnd));
                const waitFor = (re, timeoutMs = 5000) =>
                    new Promise((resolveWait, rejectWait) => {
                        const check = () => {
                            const m = re.exec(buf);
                            if (m) {
                                cleanup();
                                resolveWait(m);
                            }
                        };
                        const timer = setTimeout(() => {
                            cleanup();
                            rejectWait(new Error(`timed out waiting for ${re} in the event stream, got ${JSON.stringify(buf)}`));
                        }, timeoutMs);
                        const cleanup = () => {
                            clearTimeout(timer);
                            res.off('data', check);
                        };
                        res.on('data', check);
                        check();
                    });
                resolve({ res, text: () => buf, waitFor, ended, destroy: () => req.destroy() });
            }
        );
        req.on('error', reject);
    });
}

let historyDir;
let qrs;
const running = [];

const lockPath = () => path.join(historyDir, HOST, '.lock');

const makeConfig = (options = {}, overrides = {}) => {
    const result = validateTaskGanttOptions({
        host: HOST,
        authType: 'cert',
        lookback: '24h',
        sources: 'qrs,history-file',
        pollInterval: '0',
        historyRetentionDays: '90',
        historyDir,
        visHost: 'localhost',
        visPort: '0',
        ...options,
    });
    if (!result.ok) throw new Error(result.errors.join('; '));
    return { ...result.config, ...overrides };
};

const start = async (config = makeConfig(), request = qrs.request) => {
    const gantt = await taskGantt(config, { installSignalHandlers: false, request });
    running.push(gantt);
    return gantt;
};

let savedLogLevel;
beforeAll(() => {
    savedLogLevel = getLoggingLevel();
    setLoggingLevel('error');
});
afterAll(() => {
    setLoggingLevel(savedLogLevel);
});

beforeEach(() => {
    historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrlq-task-gantt-cmd-'));
    qrs = createQrsStub(recentRows());
});

afterEach(async () => {
    // close() is idempotent, so tests that already closed their server are fine here
    await Promise.all(running.splice(0).map((g) => g.close()));
    fs.rmSync(historyDir, { recursive: true, force: true });
});

describe('the web page', () => {
    test('is served at / as HTML with a strict Content-Security-Policy', async () => {
        const gantt = await start();
        const res = await get(gantt.port, '/');

        expect(gantt.url).toBe(`http://localhost:${gantt.port}/`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
        const csp = res.headers['content-security-policy'];
        expect(csp).toBe(DEFAULT_CSP);
        expect(csp).toContain("default-src 'none'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("style-src 'self'");
        expect(csp).not.toContain('unsafe-inline');
        expect(csp).not.toContain('unsafe-eval');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
        expect(res.body).toBe(readSrc('static/task-gantt/index.html').toString('utf8'));
    });

    test('has no inline scripts, styles or event handlers, which the CSP would block', async () => {
        const gantt = await start();
        const html = (await get(gantt.port, '/')).body;

        const scriptTags = html.match(/<script\b[^>]*>/gi) || [];
        expect(scriptTags.length).toBeGreaterThan(0);
        for (const tag of scriptTags) expect(tag).toMatch(/\ssrc="\/[^"]+"/);
        expect(html).not.toMatch(/<style\b/i);
        expect(html).not.toMatch(/\sstyle=/i);
        expect(html).not.toMatch(/\son[a-z]+=/i);
    });

    test('serves its JavaScript modules, including the sweep code shared with the backend, as text/javascript', async () => {
        const gantt = await start();
        const main = await get(gantt.port, '/task-gantt/main.js');
        const sweep = await get(gantt.port, '/task-gantt/lib/sweep.js');

        expect(main.status).toBe(200);
        expect(main.headers['content-type']).toBe('text/javascript; charset=utf-8');
        expect(main.body).toBe(readSrc('static/task-gantt/main.js').toString('utf8'));
        expect(sweep.status).toBe(200);
        expect(sweep.headers['content-type']).toBe('text/javascript; charset=utf-8');
        expect(sweep.body).toBe(readSrc('lib/task-gantt/shared/sweep.js').toString('utf8'));
    });

    test('serves the vendored ECharts byte-identical, plain and gzip-compressed, with a working ETag', async () => {
        const gantt = await start();
        const vendored = readSrc('static/vendor/echarts/echarts.min.js');

        const plain = await getBytes({ port: gantt.port, path: '/vendor/echarts/echarts.min.js' });
        expect(plain.status).toBe(200);
        expect(plain.headers['content-type']).toBe('text/javascript; charset=utf-8');
        expect(plain.headers['content-encoding']).toBeUndefined();
        expect(plain.body.equals(vendored)).toBe(true);

        const gzipped = await getBytes({
            port: gantt.port,
            path: '/vendor/echarts/echarts.min.js',
            headers: { 'Accept-Encoding': 'gzip' },
        });
        expect(gzipped.headers['content-encoding']).toBe('gzip');
        expect(gzipped.raw.length).toBeLessThan(vendored.length);
        expect(gzipped.body.equals(vendored)).toBe(true);

        const revalidated = await getBytes({
            port: gantt.port,
            path: '/vendor/echarts/echarts.min.js',
            headers: { 'If-None-Match': plain.headers.etag },
        });
        expect(revalidated.status).toBe(304);
        expect(revalidated.raw.length).toBe(0);
    });

    test('every route serves its file unchanged, with a known MIME type', async () => {
        const gantt = await start();

        for (const route of TASK_GANTT_ROUTES) {
            const res = await getBytes({ port: gantt.port, path: route.url });
            expect({ url: route.url, status: res.status }).toEqual({ url: route.url, status: 200 });
            expect(res.headers['content-type']).not.toBe('application/octet-stream');
            expect(res.body.equals(readSrc(route.file))).toBe(true);
        }
    });

    test('every file the page references and every module import is a served route', async () => {
        const gantt = await start();
        const served = new Set(TASK_GANTT_ROUTES.map((r) => r.url));
        const html = (await get(gantt.port, '/')).body;

        const pageRefs = [...html.matchAll(/\s(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
        expect(pageRefs).toEqual(
            expect.arrayContaining(['/task-gantt/main.js', '/task-gantt/styles.css', '/vendor/echarts/echarts.min.js'])
        );
        for (const ref of pageRefs) expect({ ref, served: served.has(ref) }).toEqual({ ref, served: true });

        const modules = TASK_GANTT_ROUTES.filter((r) => r.url.startsWith('/task-gantt/') && r.url.endsWith('.js'));
        let imports = 0;
        for (const route of modules) {
            const code = (await get(gantt.port, route.url)).body;
            for (const m of code.matchAll(/\bfrom\s+'([^']+)'/g)) {
                const target = new URL(m[1], `http://localhost${route.url}`).pathname;
                expect({ in: route.url, import: m[1], served: served.has(target) }).toEqual({ in: route.url, import: m[1], served: true });
                imports += 1;
            }
        }
        expect(imports).toBeGreaterThanOrEqual(4);
    });

    test('unknown paths, source paths and traversal attempts get 404', async () => {
        const gantt = await start();

        for (const urlPath of [
            '/nope',
            '/static/task-gantt/index.html',
            '/task-gantt/../../package.json',
            '/task-gantt/%2e%2e/package.json',
        ]) {
            const res = await get(gantt.port, urlPath);
            expect({ urlPath, status: res.status }).toEqual({ urlPath, status: 404 });
        }
    });
});

describe('the JSON API', () => {
    test('/api/config describes the page', async () => {
        const gantt = await start();
        const res = await getJson(gantt.port, '/api/config');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.headers['content-security-policy']).toBe(DEFAULT_CSP);
        expect(res.json).toEqual({
            appVersion: PACKAGE_VERSION,
            senseHost: HOST,
            lookbackMs: DAY,
            pollIntervalMs: 0,
            sources: ['qrs', 'history-file'],
        });
    });

    test('/api/snapshot has the lanes, capacity and executions loaded from QRS', async () => {
        const gantt = await start();
        const { status, json: snap } = await getJson(gantt.port, '/api/snapshot');

        expect(status).toBe(200);
        expect(snap.live).toBeNull();
        expect(snap.window.to - snap.window.from).toBe(DAY);
        expect(Math.abs(snap.window.to - Date.now())).toBeLessThan(60000);

        // One lane per QRS task, in QRS order
        expect(snap.lanes.map((l) => l.name)).toEqual(QRS_TASKS.map((t) => t.name));
        const laneOf = (taskId) => snap.lanes.find((l) => l.id === taskId);
        expect(laneOf(CONTENT_MONITOR)).toMatchObject({
            appName: 'Content Monitor',
            stream: 'Monitoring apps',
            tags: ['Monitoring'],
            taskType: 0,
        });
        expect(laneOf(USER_SYNC_TASK)).toMatchObject({ name: 'User sync AD', taskType: 2, appId: null, deleted: false });

        // Only reloading schedulers count, with normalised host names
        expect(snap.capacity).toEqual({ nodes: [{ name: NODE, maxConcurrentEngines: 4 }] });
        expect(snap.nodes).toContain(NODE);

        // The burst is in the 24h window; the older user sync runs (6 and 27 days earlier) are not
        expect([...snap.cols.key].sort()).toEqual(BURST_ROWS.map((r) => `r:${r.id}`).sort());
        const row = (taskId) => {
            const i = snap.cols.key.indexOf(`r:${BURST_ROWS.find((r) => r.taskID === taskId).id}`);
            return Object.fromEntries(Object.entries(snap.cols).map(([col, values]) => [col, values[i]]));
        };
        const cm = row(CONTENT_MONITOR);
        expect(cm).toMatchObject({ lane: laneOf(CONTENT_MONITOR).idx, status: 8, src: SOURCE_BIT[SOURCE.QRS], flags: 0 });
        expect(snap.nodes[cm.node]).toBe(NODE);
        expect(cm.startedAt - cm.triggeredAt).toBe(46449);
        expect(cm.queuedAt - cm.triggeredAt).toBe(401);
        expect(row(OPERATIONS_MONITOR).startedAt - row(OPERATIONS_MONITOR).triggeredAt).toBe(49259);
        expect(row('8d2c5d0c-12e2-4dc8-9832-de1ae367a373').queuedAt).toBeNull();

        const statuses = Object.fromEntries(snap.sources.map((s) => [s.id, s]));
        expect(statuses.qrs).toMatchObject({ state: 'ok', records: FIXTURE.length });
        expect(statuses['history-file']).toMatchObject({ state: 'ok', records: 0 });

        // The congestion the lab run was made for: 4 running, 2 queued, the two monitors waited longest
        const [episode] = snap.analytics.episodes;
        expect(episode).toMatchObject({ node: NODE, capacity: 4, peakRunning: 4, peakQueued: 2 });
        expect(episode.tasks.slice(0, 2).map((t) => t.name)).toEqual(
            expect.arrayContaining(['Reload Content Monitor', 'Reload Operations Monitor'])
        );

        // QRS was asked with the command's connection options and the snapshot filter
        expect(qrs.calls.length).toBeGreaterThanOrEqual(5);
        expect(qrs.calls.every((c) => c.options.host === HOST && c.options.qrsPort === '4242')).toBe(true);
        expect(qrs.calls.filter((c) => c.path === '/qrs/executionresult/full').map((c) => c.filter)).toEqual(['status ne NeverStarted']);
    });

    test('/api/execution returns the record, its task and the QRS details, and rejects bad keys', async () => {
        const gantt = await start();

        const res = await getJson(gantt.port, `/api/execution?key=r:${CONTENT_MONITOR_RESULT}`);
        expect(res.status).toBe(200);
        expect(res.json.record).toMatchObject({ key: `r:${CONTENT_MONITOR_RESULT}`, taskId: CONTENT_MONITOR, status: 8, nodeName: NODE });
        expect(res.json.record.failureReason).toMatch(/^Message from ReloadProvider: Reload failed/);
        expect(res.json.task).toEqual({
            id: CONTENT_MONITOR,
            name: 'Reload Content Monitor',
            appName: 'Content Monitor',
            stream: 'Monitoring apps',
        });
        expect(res.json.qrs.scriptLogAvailable).toBe(true);
        const times = res.json.qrs.details.map((d) => d.t);
        expect(times).toEqual([...times].sort((a, b) => a - b));
        expect(res.json.qrs.details[0].message).toBe('Changing task state to Triggered');
        expect(res.json.qrs.details).toHaveLength(8);
        expect(qrs.calls.some((c) => c.filter === `id eq ${CONTENT_MONITOR_RESULT}`)).toBe(true);

        const invalid = await getJson(gantt.port, '/api/execution?key=bogus');
        expect(invalid.status).toBe(400);
        expect(invalid.json).toEqual({ error: 'invalid key' });

        const injection = await getJson(gantt.port, `/api/execution?key=${encodeURIComponent(`r:${CONTENT_MONITOR_RESULT} or 1 eq 1`)}`);
        expect(injection.status).toBe(400);

        const unknown = await getJson(gantt.port, '/api/execution?key=r:00000000-1111-2222-3333-444444444444');
        expect(unknown.status).toBe(404);
        expect(unknown.json).toEqual({ error: 'unknown execution' });
    });
});

describe('live updates', () => {
    test('with --poll-interval 0 there is no /api/events route and the snapshot is not live', async () => {
        const gantt = await start(makeConfig({ pollInterval: '0' }));

        expect((await get(gantt.port, '/api/events')).status).toBe(404);
        expect((await getJson(gantt.port, '/api/snapshot')).json.live).toBeNull();
    });

    test('with a poll interval, /api/events is an event stream that starts with a retry line', async () => {
        const gantt = await start(makeConfig({ pollInterval: '5' }));
        expect(gantt.app).toBeDefined();
        expect((await getJson(gantt.port, '/api/config')).json.pollIntervalMs).toBe(5000);
        expect((await getJson(gantt.port, '/api/snapshot')).json.live).toMatchObject({ pollIntervalMs: 5000, qrs: { state: 'ok' } });

        const stream = await openEventStream(gantt.port);
        try {
            expect(stream.res.statusCode).toBe(200);
            expect(stream.res.headers['content-type']).toBe('text/event-stream; charset=utf-8');
            expect(stream.res.headers['content-security-policy']).toBe(DEFAULT_CSP);
            await stream.waitFor(/^retry: \d+\n\n/);
            expect(stream.text()).toMatch(/^retry: 5000\n\n/);
        } finally {
            stream.destroy();
        }
    });

    test('close() ends a connected event stream and resolves', async () => {
        const gantt = await start(makeConfig({ pollInterval: '5' }));
        const stream = await openEventStream(gantt.port);
        await stream.waitFor(/^retry: /);

        await expect(gantt.close()).resolves.toBeUndefined();
        await stream.ended;
        await expect(get(gantt.port, '/')).rejects.toThrow();
    });

    test('executions QRS reports as modified since the cursor are pushed as delta and analytics events', async () => {
        // 200 ms instead of the 5 s minimum of the CLI, so the test does not have to wait
        const gantt = await start(makeConfig({ pollInterval: '5' }, { pollIntervalMs: 200 }));
        const stream = await openEventStream(gantt.port);
        await stream.waitFor(/^retry: /);

        // A new execution of the Content Monitor task starts in Sense
        const resultId = 'c0ffee00-0000-4000-8000-000000000001';
        const t0 = Date.now();
        const iso = (ms) => new Date(ms).toISOString();
        qrs.rows.push({
            id: resultId,
            createdDate: iso(t0 - 5000),
            modifiedDate: iso(t0),
            taskID: CONTENT_MONITOR,
            executionID: 'c0ffee00-0000-4000-8000-000000000002',
            appID: 'c7178a65-a153-4f63-bbd7-10990fcffb69',
            executingNodeName: NODE,
            status: 2,
            startTime: iso(t0 - 5000),
            stopTime: QRS_NULL_DATE,
            scriptLogAvailable: false,
            details: [
                { detailsType: 2, message: 'Changing task state to Triggered', detailCreatedDate: iso(t0 - 5000) },
                { detailsType: 2, message: 'Changing task state from Triggered to Started', detailCreatedDate: iso(t0 - 4000) },
            ],
        });
        qrs.sessions.push({ id: 'c0ffee00-0000-4000-8000-000000000003', executionResult: { id: resultId } });

        const [, rev, data] = await stream.waitFor(
            new RegExp(`id: (\\d+)\\nevent: delta\\ndata: (\\{[^\\n]*r:${resultId}[^\\n]*\\})\\n\\n`)
        );
        const delta = JSON.parse(data);
        expect(delta.rev).toBe(Number(rev));
        expect(delta.rev).toBeGreaterThan(delta.prevRev);
        const i = delta.cols.key.indexOf(`r:${resultId}`);
        expect(delta.cols.status[i]).toBe(2);
        expect(delta.cols.stoppedAt[i]).toBeNull();
        expect(delta.cols.startedAt[i]).toBe(t0 - 4000);
        expect(delta.cols.flags[i]).toBe(0);
        // Unchanged executions are not sent again
        expect(delta.cols.key.every((k) => !BURST_ROWS.some((r) => k === `r:${r.id}`))).toBe(true);

        const [, analyticsData] = await stream.waitFor(/event: analytics\ndata: ([^\n]*)\n\n/);
        const analytics = JSON.parse(analyticsData);
        expect(analytics.capacity).toEqual({ nodes: [{ name: NODE, maxConcurrentEngines: 4 }] });
        expect(analytics.sources.find((s) => s.id === 'qrs').state).toBe('ok');

        // The poller asked for changes since the newest modifiedDate of the snapshot, less the 5 s overlap
        const newestModified = Math.max(...qrs.rows.filter((r) => r.id !== resultId).map((r) => Date.parse(r.modifiedDate)));
        const pollFilters = qrs.calls.filter((c) => /^modifiedDate gt /.test(c.filter ?? '')).map((c) => c.filter);
        expect(pollFilters[0]).toBe(`modifiedDate gt '${iso(newestModified - 5000)}'`);
        // Something was running, so the running sessions were refreshed
        expect(qrs.calls.some((c) => c.path === '/qrs/executionsession/full')).toBe(true);

        // The new execution is part of a fresh snapshot too
        const snap = (await getJson(gantt.port, '/api/snapshot')).json;
        expect(snap.cols.key).toContain(`r:${resultId}`);
        stream.destroy();
    });
});

describe('--vis-allow-remote', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('gives a URL with an access token, which every request must present', async () => {
        const info = jest.spyOn(logger, 'info');
        const gantt = await start(makeConfig({ visHost: '0.0.0.0', visAllowRemote: true }));
        const m = /^http:\/\/localhost:(\d+)\/\?token=([A-Za-z0-9_-]{32})$/.exec(gantt.url);

        expect(m).not.toBeNull();
        expect(Number(m[1])).toBe(gantt.port);
        const token = m[2];
        const req = (urlPath, headers = {}) => rawRequest({ port: gantt.port, path: urlPath, headers });

        expect((await req('/')).status).toBe(401);
        expect((await req('/api/snapshot')).status).toBe(401);
        expect((await req(`/?token=${'x'.repeat(32)}`)).status).toBe(401);

        const page = await req(`/?token=${token}`);
        expect(page.status).toBe(200);
        expect(page.headers['set-cookie'][0]).toMatch(new RegExp(`^ctrlq_token_${gantt.port}=${token}; HttpOnly; SameSite=Strict`));

        const withCookie = await req('/api/config', { Cookie: `ctrlq_token_${gantt.port}=${token}` });
        expect(withCookie.status).toBe(200);
        expect(JSON.parse(withCookie.body).senseHost).toBe(HOST);
        expect((await req('/api/snapshot', { 'x-ctrlq-token': token })).status).toBe(200);

        // The log shows URLs other computers can use, not only the one with localhost
        const lines = info.mock.calls.map((c) => String(c[0]));
        expect(lines).toContain(`Task Gantt chart, on this computer: ${gantt.url}`);
        const hostname = os.hostname().toLowerCase();
        expect(lines).toContain(`Task Gantt chart, from other computers: http://${hostname}:${gantt.port}/?token=${token}`);
        expect(lines.some((l) => l.startsWith('The page is reachable from other computers. Share one of the URLs above'))).toBe(true);
    });

    test('without a remote host there is no token', async () => {
        const gantt = await start(makeConfig({ visHost: '127.0.0.1' }));

        expect(gantt.url).toBe(`http://127.0.0.1:${gantt.port}/`);
        expect((await rawRequest({ port: gantt.port, path: '/' })).status).toBe(200);
    });

    test('a loopback host gets no token, and no claim that other computers can reach it, even with --vis-allow-remote', async () => {
        const info = jest.spyOn(logger, 'info');
        const gantt = await start(makeConfig({ visHost: '127.0.0.1', visAllowRemote: true }));

        expect(gantt.url).toBe(`http://127.0.0.1:${gantt.port}/`);
        expect((await rawRequest({ port: gantt.port, path: '/' })).status).toBe(200);
        const lines = info.mock.calls.map((c) => String(c[0]));
        expect(lines).toContain(`Task Gantt chart: ${gantt.url}`);
        expect(lines.some((l) => l.includes('reachable from other computers'))).toBe(false);
    });
});

describe('history file and shutdown', () => {
    test('close() resolves, releases the history lock and leaves the finished executions on disk', async () => {
        const gantt = await start();
        expect(JSON.parse(fs.readFileSync(lockPath(), 'utf8'))).toMatchObject({ pid: process.pid, host: os.hostname() });

        await expect(gantt.close()).resolves.toBeUndefined();

        expect(fs.existsSync(lockPath())).toBe(false);
        const files = fs.readdirSync(path.join(historyDir, HOST)).filter((n) => n.endsWith('.ndjson'));
        expect(files.length).toBeGreaterThan(0);
        const lines = files.flatMap((n) =>
            fs
                .readFileSync(path.join(historyDir, HOST, n), 'utf8')
                .split('\n')
                .filter(Boolean)
                .map((l) => JSON.parse(l))
        );
        for (const n of files) {
            const header = JSON.parse(fs.readFileSync(path.join(historyDir, HOST, n), 'utf8').split('\n')[0]);
            expect(header).toEqual({ v: 1, host: HOST, clusterId: CLUSTER_ID });
        }
        expect(
            lines
                .filter((l) => l.t === 'r')
                .map((l) => l.r)
                .sort()
        ).toEqual(FIXTURE.map((r) => r.id).sort());
        expect(new Set(lines.filter((l) => l.t === 'task').map((l) => l.id))).toEqual(new Set(QRS_TASKS.map((t) => t.id)));

        // The server is gone too
        await expect(get(gantt.port, '/')).rejects.toThrow();
    });

    test('a restart shows executions from the history file that QRS no longer has', async () => {
        const first = await start();
        await first.close();

        qrs.rows = [];
        const second = await start();
        const snap = (await getJson(second.port, '/api/snapshot')).json;

        expect([...snap.cols.key].sort()).toEqual(BURST_ROWS.map((r) => `r:${r.id}`).sort());
        expect(new Set(snap.cols.src)).toEqual(new Set([SOURCE_BIT[SOURCE.HISTORY]]));
        const statuses = Object.fromEntries(snap.sources.map((s) => [s.id, s]));
        expect(statuses['history-file']).toMatchObject({ state: 'ok', records: BURST_ROWS.length });
        expect(statuses.qrs).toMatchObject({ state: 'ok', records: 0 });
        expect(JSON.parse(fs.readFileSync(lockPath(), 'utf8'))).toMatchObject({ pid: process.pid, host: os.hostname() });
    });

    test('when another running Ctrl-Q holds the history lock, the history is read-only and its lock is left alone', async () => {
        // The parent process stands in for the other, still running, instance
        fs.mkdirSync(path.join(historyDir, HOST), { recursive: true });
        fs.writeFileSync(lockPath(), String(process.ppid));
        const gantt = await start();
        const snap = (await getJson(gantt.port, '/api/snapshot')).json;

        expect(snap.sources.find((s) => s.id === 'history-file')).toMatchObject({
            state: 'degraded',
            message: expect.stringContaining('read-only'),
        });
        expect(snap.cols.key).toHaveLength(BURST_ROWS.length);
        await gantt.close();
        expect(fs.readFileSync(lockPath(), 'utf8')).toBe(String(process.ppid));
        expect(fs.readdirSync(path.join(historyDir, HOST))).toEqual(['.lock']);
    });

    test('an unusable history directory degrades the history source but the page still works', async () => {
        const notADir = path.join(historyDir, 'file');
        fs.writeFileSync(notADir, 'x');
        const gantt = await start(makeConfig({ historyDir: notADir }));
        const snap = (await getJson(gantt.port, '/api/snapshot')).json;

        const history = snap.sources.find((s) => s.id === 'history-file');
        expect(history.state).toBe('error');
        expect(history.message).toMatch(/cannot use history directory/);
        expect(snap.cols.key).toHaveLength(BURST_ROWS.length);
        await expect(gantt.close()).resolves.toBeUndefined();
    });

    test('with --sources qrs nothing is written to the history directory', async () => {
        const gantt = await start(makeConfig({ sources: 'qrs' }));
        const snap = (await getJson(gantt.port, '/api/snapshot')).json;

        expect(snap.sources.find((s) => s.id === 'history-file').state).toBe('disabled');
        await gantt.close();
        expect(fs.readdirSync(historyDir)).toEqual([]);
    });
});

describe('startup failures', () => {
    test('a failing QRS metadata request rejects, without taking the history lock', async () => {
        const failing = async (options, req) => {
            if (req.path === '/qrs/task/full') throw new Error('QRS GET /qrs/task/full failed: HTTP 403');
            return qrs.request(options, req);
        };

        await expect(taskGantt(makeConfig(), { installSignalHandlers: false, request: failing })).rejects.toThrow('HTTP 403');
        expect(fs.existsSync(lockPath())).toBe(false);
    });

    test('a port in use rejects with a helpful error and releases the history lock', async () => {
        const blocker = net.createServer();
        await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
        const { port } = blocker.address();
        try {
            await expect(
                taskGantt(makeConfig({ visHost: '127.0.0.1', visPort: String(port) }), {
                    installSignalHandlers: false,
                    request: qrs.request,
                })
            ).rejects.toThrow(`Port ${port} on 127.0.0.1 is already in use`);
            expect(fs.existsSync(path.join(historyDir, HOST))).toBe(true);
            expect(fs.existsSync(lockPath())).toBe(false);
        } finally {
            await new Promise((resolve) => blocker.close(resolve));
        }
    });
});

describe('embedded page files', () => {
    test('every task-gantt route is embedded correctly in sea-config.json', () => {
        expect(checkSeaConfig(TASK_GANTT_ROUTES, SEA_CONFIG.assets)).toEqual([]);
    });

    test('every task-gantt route file exists when running from source', async () => {
        await expect(createAssetCatalog({ routes: TASK_GANTT_ROUTES, isSea: false }).verifyAll()).resolves.toEqual({
            ok: true,
            missing: [],
        });
    });

    test('in a SEA binary every route loads the file sea-config.json embeds under its key', async () => {
        const catalog = createAssetCatalog({
            routes: TASK_GANTT_ROUTES,
            isSea: true,
            getSeaAsset: (key) => {
                const file = SEA_CONFIG.assets[key];
                if (!file) throw new Error(`no SEA asset ${key}`);
                const buf = fs.readFileSync(new URL(file, REPO_DIR));
                return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            },
        });

        await expect(catalog.verifyAll()).resolves.toEqual({ ok: true, missing: [] });
        for (const route of catalog.routes) {
            expect((await catalog.load(route)).equals(readSrc(route.file))).toBe(true);
        }
    });
});
