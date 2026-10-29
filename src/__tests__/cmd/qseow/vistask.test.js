import { jest, test, expect, describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { EventEmitter } from 'node:events';

// End-to-end tests of `qseow task-vis`: visTask() loads the task network through the real QRS code, with axios stubbed
// to answer like QRS from a fixture, and serves it on a real web server on a free port.

const SRC_DIR = new URL('../../../', import.meta.url);
const REPO_DIR = new URL('../../../../', import.meta.url);
const readSrc = (file) => fs.readFileSync(new URL(file, SRC_DIR));
const PACKAGE_VERSION = JSON.parse(fs.readFileSync(new URL('package.json', REPO_DIR), 'utf8')).version;
const SEA_CONFIG = JSON.parse(fs.readFileSync(new URL('sea-config.json', REPO_DIR), 'utf8'));

// QRS answers by path, see the fixture for the task network it describes
const QRS = JSON.parse(fs.readFileSync(new URL('../../testdata/task-vis/qrs-tasks.json', import.meta.url), 'utf8'));
const LOAD_SALES = '11111111-1111-4111-8111-111111111111';
const TRANSFORM_SALES = '22222222-2222-4222-8222-222222222222';
const PUBLISH = '33333333-3333-4333-8333-333333333333';
const LOOP_ONE = '44444444-4444-4444-8444-444444444444';
const LOOP_TWO = '55555555-5555-4555-8555-555555555555';
const COPY_FILES = '66666666-6666-4666-8666-666666666666';
const PUBLISH_NAME = 'Publish <img src=x onerror=alert(1)> dashboard';

const qrsCalls = [];
let qrsFailure = null;
const request = jest.fn(async (config) => {
    const url = new URL(config.url, config.baseURL);
    const qrsPath = url.pathname.replace(/^\/jwt(?=\/)/, '');
    qrsCalls.push({ method: config.method, origin: url.origin, path: qrsPath, headers: config.headers });
    if (qrsFailure && qrsPath === qrsFailure) {
        throw new Error(`Request failed with status code 403`);
    }
    if (config.method !== 'get' || !QRS[qrsPath]) {
        throw new Error(`unexpected QRS request ${config.method} ${qrsPath}`);
    }
    return { status: 200, data: JSON.stringify(QRS[qrsPath]) };
});
jest.unstable_mockModule('axios', () => ({ default: { request } }));

const { visTask, buildTaskVisPayload, TASK_VIS_ROUTES } = await import('../../../lib/cmd/qseow/vistask.js');
const { createAssetCatalog, checkSeaConfig } = await import('../../../lib/util/web/assets.js');
const { DEFAULT_CSP } = await import('../../../lib/util/web/server.js');
const { getLoggingLevel, setLoggingLevel, logger } = await import('../../../globals.js');
const { rawRequest } = await import('../../util/web/web-test-helpers.mjs');

// Options as the command line gives them
const OPTIONS = {
    logLevel: 'error',
    host: 'sense.example.com',
    port: '443',
    virtualProxy: 'jwt',
    secure: true,
    authType: 'jwt',
    authJwt: 'test-jwt',
    visHost: 'localhost',
    visPort: '0',
};

const running = [];
const start = async (options = {}, param = {}) => {
    const vis = await visTask({ ...OPTIONS, ...options }, { installSignalHandlers: false, ...param });
    if (vis) running.push(vis);
    return vis;
};

// 'localhost' may be IPv6 only, so connect the way a browser would
const get = (port, urlPath, headers = {}) => rawRequest({ port, path: urlPath, headers, host: 'localhost' });
const getJson = async (port, urlPath) => {
    const res = await get(port, urlPath);
    return { ...res, json: JSON.parse(res.body) };
};

const canConnect = (port) =>
    new Promise((resolve) => {
        const socket = net.connect({ host: 'localhost', port }, () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('error', () => resolve(false));
    });

let savedLogLevel;
beforeAll(() => {
    savedLogLevel = getLoggingLevel();
});
afterAll(() => {
    setLoggingLevel(savedLogLevel);
});

beforeEach(() => {
    qrsCalls.length = 0;
    qrsFailure = null;
});

afterEach(async () => {
    // close() is idempotent, so tests that already closed their server are fine here
    await Promise.all(running.splice(0).map((v) => v.close()));
    jest.restoreAllMocks();
});

describe('the web page', () => {
    test('is served at / as HTML with the strict default Content-Security-Policy', async () => {
        const vis = await start();
        const res = await get(vis.port, '/');

        expect(vis.url).toBe(`http://localhost:${vis.port}/`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
        const csp = res.headers['content-security-policy'];
        expect(csp).toBe(DEFAULT_CSP);
        expect(csp).not.toContain('unsafe-inline');
        expect(csp).not.toContain('unsafe-eval');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
        expect(res.body).toBe(readSrc('static/task-vis/index.html').toString('utf8'));
    });

    test('has no inline scripts, styles, event handlers or template placeholders', async () => {
        const vis = await start();
        const html = (await get(vis.port, '/')).body;

        const scriptTags = html.match(/<script\b[^>]*>/gi) || [];
        expect(scriptTags).toHaveLength(2);
        for (const tag of scriptTags) expect(tag).toMatch(/\ssrc="\/[^"]+"/);
        expect(html).not.toMatch(/<style\b/i);
        expect(html).not.toMatch(/\sstyle=/i);
        expect(html).not.toMatch(/\son[a-z]+=/i);
        expect(html).not.toContain('{{');
    });

    test('the page script puts all text into the page as text, never as HTML', () => {
        const code = readSrc('static/task-vis/main.js').toString('utf8');

        expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/);
        expect(code).toContain('textContent');
    });

    test('every file the page references is a served route', async () => {
        const vis = await start();
        const served = new Set(TASK_VIS_ROUTES.map((r) => r.url));
        const html = (await get(vis.port, '/')).body;

        const pageRefs = [...html.matchAll(/\s(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
        expect(pageRefs).toEqual(
            expect.arrayContaining([
                '/task-vis/main.js',
                '/task-vis/styles.css',
                '/vendor/vis-network/vis-network.min.js',
                '/vendor/vis-network/vis-network.min.css',
                '/vendor/vis-network/LICENSE-APACHE-2.0.txt',
                '/vendor/vis-network/LICENSE-MIT.txt',
                '/vendor/vis-network/LICENSE-bundled.txt',
            ])
        );
        for (const ref of pageRefs) expect({ ref, served: served.has(ref) }).toEqual({ ref, served: true });
    });

    test('every route serves its file unchanged, with a known MIME type; JavaScript as text/javascript', async () => {
        const vis = await start();

        for (const route of TASK_VIS_ROUTES) {
            const res = await get(vis.port, route.url);
            expect({ url: route.url, status: res.status }).toEqual({ url: route.url, status: 200 });
            expect(res.headers['content-type']).not.toBe('application/octet-stream');
            const expected = readSrc(route.file);
            // rawRequest decodes bodies as UTF-8; compare binary files by length and type only
            if (/\.(png|ico)$/.test(route.file)) {
                expect(Number(res.headers['content-length'])).toBe(expected.length);
            } else {
                expect(res.body).toBe(expected.toString('utf8'));
            }
        }
        for (const url of ['/task-vis/main.js', '/vendor/vis-network/vis-network.min.js']) {
            expect((await get(vis.port, url)).headers['content-type']).toBe('text/javascript; charset=utf-8');
        }
        expect((await get(vis.port, '/vendor/vis-network/vis-network.min.css')).headers['content-type']).toBe('text/css; charset=utf-8');
    });

    test('path traversal attempts, source paths and the old server URLs get 404 and no file content', async () => {
        const vis = await start();

        for (const urlPath of [
            '/../package.json',
            '/../../package.json',
            '/%2e%2e/package.json',
            '/%2E%2E/package.json',
            '/%2e%2e/%2e%2e/package.json',
            '/%2e%2e%2fpackage.json',
            '/..%2fpackage.json',
            '/..%2f..%2fpackage.json',
            '/task-vis/../../package.json',
            '/task-vis/%2e%2e/%2e%2e/package.json',
            '/vendor/vis-network/..%2f..%2f..%2f..%2fpackage.json',
            '/%2e%2e%5c%2e%2e%5cpackage.json',
            '/task-vis/main.js/../../../package.json',
            '//etc/passwd',
            '/static/task-vis/index.html',
            '/src/static/task-vis/index.html',
            '/index.html',
            '/404.html',
            '/vis-network.min.js',
            '/vis-network.min.js.map',
            '/vendor/vis-network/vis-network.min.js.map',
            '/nope',
        ]) {
            const res = await get(vis.port, urlPath);
            expect({ urlPath, status: res.status, body: res.body }).toEqual({ urlPath, status: 404, body: 'Not found' });
        }
    });
});

describe('the JSON API', () => {
    test('/api/network has the task network loaded from QRS', async () => {
        const vis = await start();
        const res = await getJson(vis.port, '/api/network');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.headers['content-security-policy']).toBe(DEFAULT_CSP);

        const { appVersion, counts, nodes, edges } = res.json;
        expect(appVersion).toBe(PACKAGE_VERSION);
        expect(counts).toEqual({ reloadTasks: 5, externalProgramTasks: 1, schemaTriggers: 3, compositeTriggers: 1 });

        // Tasks first, in QRS order, then schedule triggers and composite triggers
        expect(nodes.map((n) => [n.label, n.nodeType, n.shape, n.color])).toEqual([
            ['Load sales data', 'reloadTask', 'box', '#21ff06'],
            ['Transform sales', 'reloadTask', 'box', '#fb0207'],
            [PUBLISH_NAME, 'reloadTask', 'box', '#999'],
            ['Loop one', 'reloadTask', 'box', '#ffcc00'],
            ['Loop two', 'reloadTask', 'box', '#6cf'],
            ['Copy files', 'externalProgramTask', 'ellipse', '#fb0207'],
            ['Every morning', 'scheduleTrigger', 'triangle', '#FFA807'],
            ['Hourly copy', 'scheduleTrigger', 'triangle', '#BCB9BF'],
            ['Nightly loop', 'scheduleTrigger', 'triangle', '#FFA807'],
            ['Sales and files done', 'compositeTrigger', 'hexagon', '#FFA807'],
        ]);
        const node = (label) => nodes.find((n) => n.label === label);
        expect(node('Load sales data')).toEqual({
            id: LOAD_SALES,
            label: 'Load sales data',
            nodeType: 'reloadTask',
            typeName: 'Reload task',
            shape: 'box',
            color: '#21ff06',
            tooltip: {
                heading: 'Reload task',
                rows: [
                    ['Name', 'Load sales data'],
                    ['Task ID', LOAD_SALES],
                    ['Enabled', 'true'],
                    ['App', 'Sales'],
                    ['Last exec status', 'FinishedSuccess'],
                    ['Last exec start', '2026-10-29T05:00:03.000Z'],
                    ['Last exec stop', '2026-10-29T05:01:10.000Z'],
                ],
            },
        });
        expect(node('Copy files').tooltip).toEqual({
            heading: 'Ext. program task',
            rows: [
                ['Name', 'Copy files'],
                ['Task ID', COPY_FILES],
                ['Enabled', 'true'],
                ['Last exec status', 'Aborted'],
                ['Last exec start', '2026-10-29T04:00:00.000Z'],
                ['Last exec stop', '2026-10-29T04:02:00.000Z'],
            ],
        });
        expect(node('Every morning')).toMatchObject({ typeName: 'Schedule trigger', id: expect.stringMatching(/^node-/) });
        expect(node('Every morning').tooltip.rows).toEqual([
            ['Name', 'Every morning'],
            ['Enabled', 'true'],
            ['Schema', 'Daily'],
            ['Next', '2026-10-30T05:00:00.000Z'],
            ['Timezone', 'Europe/Stockholm'],
            ['Triggered times', '42'],
        ]);
        // A disabled trigger that never runs, and a custom schedule
        expect(node('Hourly copy').tooltip.rows).toEqual(
            expect.arrayContaining([
                ['Enabled', 'false'],
                ['Schema', 'Hourly'],
                ['Next', '-'],
            ])
        );
        expect(node('Nightly loop').tooltip.rows).toContainEqual(['Schema', 'Custom']);

        // Edges carry only what the diagram needs; two identical triggers are one labelled edge (drawn twice)
        const byIds = Object.fromEntries(nodes.map((n) => [n.id, n.label]));
        const named = edges.map((e) => [byIds[e.from], byIds[e.to], e.label]);
        expect(named).toEqual(
            expect.arrayContaining([
                ['Every morning', 'Load sales data', undefined],
                ['Load sales data', 'Transform sales', '2'],
                ['Transform sales', 'Sales and files done', undefined],
                ['Copy files', 'Sales and files done', undefined],
                ['Sales and files done', PUBLISH_NAME, undefined],
                ['Loop one', 'Loop two', undefined],
                ['Loop two', 'Loop one', undefined],
            ])
        );
        expect(named.filter(([from, to]) => from === 'Load sales data' && to === 'Transform sales')).toHaveLength(2);
        expect(edges).toHaveLength(10);
        for (const edge of edges) expect(Object.keys(edge).sort()).toEqual(edge.label ? ['from', 'label', 'to'] : ['from', 'to']);
    });

    test('names with HTML in them stay plain text in the data, for the page to show as text', async () => {
        const vis = await start();
        const { nodes } = (await getJson(vis.port, '/api/network')).json;
        const publish = nodes.find((n) => n.id === PUBLISH);

        expect(publish.label).toBe(PUBLISH_NAME);
        expect(publish.tooltip.rows).toContainEqual(['App', 'Dashboard <b>bold</b>']);
        // QRS says "never" with its null date
        expect(publish.tooltip.rows).toContainEqual(['Last exec start', '-']);
        expect(nodes.find((n) => n.id === TRANSFORM_SALES).tooltip.rows).toContainEqual(['App', 'Sales transform']);
    });

    test('--task-id narrows the diagram to the task chains the task is part of', async () => {
        const vis = await start({ taskId: [LOOP_ONE] });
        const { counts, nodes, edges } = (await getJson(vis.port, '/api/network')).json;

        expect(counts).toEqual({ reloadTasks: 2, externalProgramTasks: 0, schemaTriggers: 1, compositeTriggers: 0 });
        expect(nodes.map((n) => n.label)).toEqual(['Loop one', 'Loop two', 'Nightly loop']);
        const byIds = Object.fromEntries(nodes.map((n) => [n.id, n.label]));
        expect(edges.map((e) => [byIds[e.from], byIds[e.to]])).toEqual([
            ['Nightly loop', 'Loop one'],
            ['Loop one', 'Loop two'],
            ['Loop two', 'Loop one'],
        ]);
    });

    test('QRS is asked once per kind of object, with the JWT and an xrfkey', async () => {
        await start();

        expect(qrsCalls.map((c) => c.path).sort()).toEqual([
            '/qrs/compositeevent/full',
            '/qrs/externalprogramtask/full',
            '/qrs/reloadtask/full',
            '/qrs/schemaevent/full',
        ]);
        for (const call of qrsCalls) {
            expect(call).toMatchObject({ method: 'get', origin: 'https://sense.example.com' });
            expect(call.headers.Authorization).toBe('Bearer test-jwt');
            expect(call.headers['x-qlik-xrfkey']).toMatch(/^[A-Za-z0-9]{16}$/);
        }
    });

    test('a circular task chain and a duplicate trigger are logged as warnings', async () => {
        const warn = jest.spyOn(logger, 'warn');
        await start();
        const lines = warn.mock.calls.map((c) => String(c[0]));

        expect(lines).toContain('Found 1 circular task chains in task model');
        expect(lines).toContain(`   From task : [${LOOP_TWO}] "Loop two"`);
        expect(lines).toContain(`   To task   : [${LOOP_ONE}] "Loop one"`);
        expect(lines).toContain('Found 1 duplicate task triggers in task model, across all examined tasks.');
    });

    test('other web sites cannot read the API, and it only answers GET and HEAD', async () => {
        const vis = await start();

        const crossSite = await get(vis.port, '/api/network', { 'Sec-Fetch-Site': 'cross-site' });
        expect(crossSite.status).toBe(403);
        const foreignOrigin = await get(vis.port, '/api/network', { Origin: 'https://evil.example.com' });
        expect(foreignOrigin.status).toBe(403);

        const post = await rawRequest({
            port: vis.port,
            host: 'localhost',
            method: 'POST',
            path: '/api/network',
            headers: { 'x-ctrlq-csrf': '1' },
        });
        expect(post.status).toBe(405);
        expect(post.headers.allow).toBe('GET, HEAD');

        const sameOrigin = await get(vis.port, '/api/network', { 'Sec-Fetch-Site': 'same-origin' });
        expect(sameOrigin.status).toBe(200);
    });
});

describe('buildTaskVisPayload', () => {
    const task = (overrides) => ({
        taskId: 'task-1',
        taskName: 'Task',
        taskType: 0,
        taskEnabled: true,
        appName: 'App',
        taskLastStatus: 'FinishedSuccess',
        taskLastExecutionStartTimestamp: '',
        taskLastExecutionStopTimestamp: '',
        ...overrides,
    });

    test.each([
        ['FinishedSuccess', '#21ff06'],
        ['FinishedFail', '#fb0207'],
        ['Aborted', '#fb0207'],
        ['AbortInitiated', '#fd8008'],
        ['Aborting', '#fd8008'],
        ['Error', '#fd8008'],
        ['Reset', '#fd8008'],
        ['Triggered', '#6cf'],
        ['Queued', '#6cf'],
        ['Started', '#6cf'],
        ['Skipped', '#ffcc00'],
        ['NeverStarted', '#999'],
        ['?', '#999'],
        ['Retry', undefined],
    ])('a task whose last execution is %s is coloured %s', (status, color) => {
        const [node] = buildTaskVisPayload({ nodes: [], edges: [], tasks: [task({ taskLastStatus: status })] }).nodes;

        expect(node.color).toBe(color);
    });

    test('empty values show as "-", and an empty network has no nodes or edges', () => {
        const [node] = buildTaskVisPayload({ nodes: [], edges: [], tasks: [task({ appName: undefined })] }).nodes;
        expect(node.tooltip.rows).toContainEqual(['App', '-']);
        expect(node.tooltip.rows).toContainEqual(['Last exec start', '-']);

        expect(buildTaskVisPayload({ nodes: [], edges: [], tasks: [] })).toMatchObject({
            counts: { reloadTasks: 0, externalProgramTasks: 0, schemaTriggers: 0, compositeTriggers: 0 },
            nodes: [],
            edges: [],
        });
    });

    test('a meta node of unknown type is left out and logged', () => {
        const error = jest.spyOn(logger, 'error').mockImplementation(() => {});
        const payload = buildTaskVisPayload({ nodes: [{ id: 'node-x', metaNode: true, metaNodeType: 'mystery' }], edges: [], tasks: [] });

        expect(payload.nodes).toEqual([]);
        expect(error).toHaveBeenCalledWith('Task network: skipping node node-x of unknown meta node type "mystery"');
    });
});

describe('--vis-host and --vis-port', () => {
    test('a loopback host needs no access token', async () => {
        const vis = await start({ visHost: '127.0.0.1' });

        expect(vis.url).toBe(`http://127.0.0.1:${vis.port}/`);
        expect((await get(vis.port, '/')).status).toBe(200);
        expect((await get(vis.port, '/api/network')).status).toBe(200);
    });

    test('a non-loopback host gets an access token, which every request must present', async () => {
        const info = jest.spyOn(logger, 'info');
        const vis = await start({ visHost: '0.0.0.0' });
        const m = /^http:\/\/localhost:(\d+)\/\?token=([A-Za-z0-9_-]{32})$/.exec(vis.url);

        expect(m).not.toBeNull();
        expect(Number(m[1])).toBe(vis.port);
        const token = m[2];

        expect((await get(vis.port, '/')).status).toBe(401);
        expect((await get(vis.port, '/api/network')).status).toBe(401);
        expect((await get(vis.port, '/vendor/vis-network/vis-network.min.js')).status).toBe(401);
        expect((await get(vis.port, `/?token=${'x'.repeat(32)}`)).status).toBe(401);

        const page = await get(vis.port, `/?token=${token}`);
        expect(page.status).toBe(200);
        expect(page.headers['set-cookie'][0]).toMatch(new RegExp(`^ctrlq_token_${vis.port}=${token}; HttpOnly; SameSite=Strict`));

        const withCookie = await get(vis.port, '/api/network', { Cookie: `ctrlq_token_${vis.port}=${token}` });
        expect(withCookie.status).toBe(200);
        expect(JSON.parse(withCookie.body).counts.reloadTasks).toBe(5);

        const lines = info.mock.calls.map((c) => String(c[0]));
        expect(lines).toContain(`Task visualization, on this computer: ${vis.url}`);
        expect(lines).toContain(
            `Task visualization, from other computers: http://${os.hostname().toLowerCase()}:${vis.port}/?token=${token}`
        );
        expect(lines.some((l) => l.startsWith('The page is reachable from other computers. Share one of the URLs above'))).toBe(true);
    });

    test('a port in use rejects with a helpful error', async () => {
        const blocker = net.createServer();
        await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
        const { port } = blocker.address();
        try {
            await expect(start({ visHost: '127.0.0.1', visPort: String(port) })).rejects.toThrow(
                `Port ${port} on 127.0.0.1 is already in use`
            );
        } finally {
            await new Promise((resolve) => blocker.close(resolve));
        }
    });

    test('when QRS fails, there is no task network and no web server', async () => {
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        qrsFailure = '/qrs/schemaevent/full';
        const listen = jest.spyOn(net.Server.prototype, 'listen');

        await expect(start()).resolves.toBe(false);
        expect(listen).not.toHaveBeenCalled();
    });
});

describe('shutdown', () => {
    test('Ctrl-C closes the web server, then exits with code 0', async () => {
        const fakeProcess = Object.assign(new EventEmitter(), { platform: process.platform, exit: jest.fn() });
        const exited = new Promise((resolve) => fakeProcess.exit.mockImplementation(resolve));
        const vis = await start({}, { installSignalHandlers: true, processRef: fakeProcess });

        expect(await canConnect(vis.port)).toBe(true);
        expect(fakeProcess.listenerCount('SIGINT')).toBe(1);

        fakeProcess.emit('SIGINT');

        expect(await exited).toBe(0);
        expect(await canConnect(vis.port)).toBe(false);
    });

    test('close() stops the web server and can be called again', async () => {
        const vis = await start();

        await vis.close();
        expect(await canConnect(vis.port)).toBe(false);
        await expect(vis.close()).resolves.toBeUndefined();
    });
});

describe('embedded page files', () => {
    test('every task-vis route is embedded correctly in sea-config.json', () => {
        expect(checkSeaConfig(TASK_VIS_ROUTES, SEA_CONFIG.assets)).toEqual([]);
    });

    test('every task-vis route file exists when running from source', async () => {
        await expect(createAssetCatalog({ routes: TASK_VIS_ROUTES, isSea: false }).verifyAll()).resolves.toEqual({
            ok: true,
            missing: [],
        });
    });

    test('in a SEA binary every route loads the file sea-config.json embeds under its key', async () => {
        const catalog = createAssetCatalog({
            routes: TASK_VIS_ROUTES,
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
