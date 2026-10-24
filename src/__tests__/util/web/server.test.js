import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';

import { createAssetCatalog } from '../../../lib/util/web/assets.js';
import {
    startWebServer,
    isLoopbackHost,
    buildAllowedHosts,
    parseCookies,
    formatHostForUrl,
    createAccessToken,
    CSRF_HEADER,
} from '../../../lib/util/web/server.js';
import { rawRequest, silentLogger } from './web-test-helpers.mjs';

const BIG_JS = `// big file\n${'console.log("x");\n'.repeat(500)}`;
const FILES = {
    'static/demo/index.html': '<html>demo</html>',
    'static/demo/big.js': BIG_JS,
    'static/demo/logo.png': 'PNGDATA',
};

const makeAssets = () =>
    createAssetCatalog({
        routes: [
            { url: '/', file: 'static/demo/index.html' },
            { url: '/demo/big.js', file: 'static/demo/big.js' },
            { url: '/demo/logo.png', file: 'static/demo/logo.png' },
        ],
        isSea: true,
        getSeaAsset: (key) => {
            const content = FILES[key.slice(1)];
            if (content === undefined) {
                throw new Error('not found');
            }
            return new TextEncoder().encode(content).buffer;
        },
    });

describe('helpers', () => {
    test('isLoopbackHost', () => {
        expect(isLoopbackHost('localhost')).toBe(true);
        expect(isLoopbackHost('127.0.0.1')).toBe(true);
        expect(isLoopbackHost('127.10.0.1')).toBe(true);
        expect(isLoopbackHost('::1')).toBe(true);
        expect(isLoopbackHost('[::1]')).toBe(true);
        expect(isLoopbackHost('0.0.0.0')).toBe(false);
        expect(isLoopbackHost('192.168.1.10')).toBe(false);
        expect(isLoopbackHost('sense.example.com')).toBe(false);
    });

    test('buildAllowedHosts includes loopback names and the configured host', () => {
        const allowed = buildAllowedHosts('MyHost.example.com', 3001, ['::1']);

        expect(allowed.has('localhost:3001')).toBe(true);
        expect(allowed.has('127.0.0.1:3001')).toBe(true);
        expect(allowed.has('[::1]:3001')).toBe(true);
        expect(allowed.has('myhost.example.com:3001')).toBe(true);
        expect(allowed.has('localhost:3000')).toBe(false);
        expect(buildAllowedHosts('0.0.0.0', 3001).has('0.0.0.0:3001')).toBe(false);
    });

    test('buildAllowedHosts handles port 80 and host:port entries', () => {
        const at80 = buildAllowedHosts('localhost', 80);
        const forwarded = buildAllowedHosts('localhost', 3001, ['gateway.example.com:8443', '[fe80::1]:9000', '::1']);

        expect(at80.has('localhost')).toBe(true);
        expect(at80.has('localhost:80')).toBe(true);
        expect(forwarded.has('gateway.example.com:8443')).toBe(true);
        expect(forwarded.has('gateway.example.com:8443:3001')).toBe(false);
        expect(forwarded.has('[fe80::1]:9000')).toBe(true);
        expect(forwarded.has('[::1]:3001')).toBe(true);
    });

    test('parseCookies and formatHostForUrl', () => {
        expect(parseCookies('a=1; b = two ;c=x=y').get('c')).toEqual(['x=y']);
        expect(parseCookies('a=1; b = two; a=3').get('a')).toEqual(['1', '3']);
        expect(parseCookies(undefined).size).toBe(0);
        expect(formatHostForUrl('::1')).toBe('[::1]');
        expect(formatHostForUrl('localhost')).toBe('localhost');
    });

    test('createAccessToken returns long, URL-safe, random tokens', () => {
        const a = createAccessToken();

        expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
        expect(createAccessToken()).not.toBe(a);
    });
});

describe('startWebServer (no token)', () => {
    let web;
    const calls = [];

    beforeAll(async () => {
        web = await startWebServer({
            host: '127.0.0.1',
            port: 0,
            assets: makeAssets(),
            logger: silentLogger,
            apiRoutes: [
                { path: '/api/hello', handler: () => ({ hello: 'world' }) },
                { path: '/api/big', handler: () => ({ rows: Array.from({ length: 500 }, (_, i) => i) }) },
                { path: '/api/empty', handler: () => undefined },
                {
                    path: '/api/custom',
                    handler: ({ sendJson, query }) => sendJson(201, { q: query.get('q') }),
                },
                {
                    path: '/api/fail',
                    handler: () => {
                        throw new Error('boom with secret detail');
                    },
                },
                {
                    method: 'POST',
                    path: '/api/refresh',
                    handler: () => {
                        calls.push('refresh');
                        return { ok: true };
                    },
                },
            ],
        });
    });

    afterAll(async () => {
        await web.close();
    });

    test('reports its URL and actual port', () => {
        expect(web.port).toBeGreaterThan(0);
        expect(web.url).toBe(`http://127.0.0.1:${web.port}/`);
    });

    test('serves an allowlisted file with security headers', async () => {
        const res = await rawRequest({ port: web.port, path: '/' });

        expect(res.status).toBe(200);
        expect(res.body).toBe('<html>demo</html>');
        expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(res.headers['content-security-policy']).toContain("default-src 'none'");
        expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['referrer-policy']).toBe('no-referrer');
    });

    test('serves JavaScript as text/javascript and compresses it when asked', async () => {
        const plain = await rawRequest({ port: web.port, path: '/demo/big.js' });
        const zipped = await rawRequest({ port: web.port, path: '/demo/big.js', headers: { 'Accept-Encoding': 'gzip' } });

        expect(plain.headers['content-type']).toBe('text/javascript; charset=utf-8');
        expect(plain.headers['content-encoding']).toBeUndefined();
        expect(plain.body).toBe(BIG_JS);
        expect(zipped.headers['content-encoding']).toBe('gzip');
        expect(zipped.body).toBe(BIG_JS);
    });

    test('does not compress images', async () => {
        const res = await rawRequest({ port: web.port, path: '/demo/logo.png', headers: { 'Accept-Encoding': 'gzip' } });

        expect(res.headers['content-type']).toBe('image/png');
        expect(res.headers['content-encoding']).toBeUndefined();
    });

    test('HEAD returns headers without a body', async () => {
        const res = await rawRequest({ port: web.port, method: 'HEAD', path: '/' });

        expect(res.status).toBe(200);
        expect(res.body).toBe('');
        expect(Number(res.headers['content-length'])).toBe('<html>demo</html>'.length);
    });

    test.each([
        '/../package.json',
        '/../../package.json',
        '/%2e%2e/package.json',
        '/%2E%2E/%2E%2E/package.json',
        '/demo/../../package.json',
        '/..%2fpackage.json',
        '/..\\package.json',
        '/static/demo/index.html',
        '/demo/big.js/',
        '//etc/passwd',
        '/demo/big.js%00.png',
    ])('never serves anything outside the allowlist: %s', async (p) => {
        const res = await rawRequest({ port: web.port, path: p });

        expect([400, 404]).toContain(res.status);
        expect(res.body).not.toContain('"name"');
        expect(res.body).not.toContain('console.log');
    });

    test('rejects a foreign Host header (DNS rebinding)', async () => {
        const res = await rawRequest({ port: web.port, path: '/', headers: { Host: `evil.example.com:${web.port}` } });

        expect(res.status).toBe(403);
    });

    test('accepts loopback Host header variants', async () => {
        const a = await rawRequest({ port: web.port, path: '/', headers: { Host: `127.0.0.1:${web.port}` } });

        expect(a.status).toBe(200);
    });

    test('answers wrong methods on files with 405', async () => {
        const res = await rawRequest({ port: web.port, method: 'POST', path: '/' });

        expect(res.status).toBe(405);
        expect(res.headers.allow).toBe('GET, HEAD');
    });

    test('rejects OPTIONS (no CORS preflight is ever approved)', async () => {
        const res = await rawRequest({ port: web.port, method: 'OPTIONS', path: '/api/refresh' });

        expect(res.status).toBe(405);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('returns JSON from API handlers', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/hello' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(res.headers['cache-control']).toBe('no-store');
        expect(JSON.parse(res.body)).toEqual({ hello: 'world' });
    });

    test('compresses large JSON responses', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/big', headers: { 'Accept-Encoding': 'gzip, deflate' } });

        expect(res.headers['content-encoding']).toBe('gzip');
        expect(JSON.parse(res.body).rows).toHaveLength(500);
    });

    test('handlers can send their own response and read query parameters', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/custom?q=abc' });

        expect(res.status).toBe(201);
        expect(JSON.parse(res.body)).toEqual({ q: 'abc' });
    });

    test('handlers returning undefined give 204', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/empty' });

        expect(res.status).toBe(204);
    });

    test('a throwing handler gives 500 without leaking details, and the server keeps running', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/fail' });
        const after = await rawRequest({ port: web.port, path: '/api/hello' });

        expect(res.status).toBe(500);
        expect(res.body).not.toContain('secret');
        expect(after.status).toBe(200);
    });

    test('POST routes need the CSRF header', async () => {
        const without = await rawRequest({ port: web.port, method: 'POST', path: '/api/refresh' });
        const withHeader = await rawRequest({ port: web.port, method: 'POST', path: '/api/refresh', headers: { [CSRF_HEADER]: '1' } });

        expect(without.status).toBe(403);
        expect(withHeader.status).toBe(200);
        expect(calls).toEqual(['refresh']);
    });

    test('GET on a POST-only route gives 405', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/refresh' });

        expect(res.status).toBe(405);
        expect(res.headers.allow).toBe('POST');
    });

    test('unknown paths give 404', async () => {
        const res = await rawRequest({ port: web.port, path: '/nope' });

        expect(res.status).toBe(404);
    });

    test('a second server on the same port fails with a clear message', async () => {
        await expect(startWebServer({ host: '127.0.0.1', port: web.port, assets: makeAssets(), logger: silentLogger })).rejects.toThrow(
            /already in use/
        );
    });
});

describe('startWebServer (with access token)', () => {
    let web;
    const token = 'test-token-0123456789abcdefghij';

    beforeAll(async () => {
        web = await startWebServer({
            host: '127.0.0.1',
            port: 0,
            assets: makeAssets(),
            token,
            logger: silentLogger,
            apiRoutes: [{ path: '/api/hello', handler: () => ({ hello: 'world' }) }],
        });
    });

    afterAll(async () => {
        await web.close();
    });

    test('puts the token in the URL', () => {
        expect(web.url).toBe(`http://127.0.0.1:${web.port}/?token=${token}`);
    });

    test('rejects requests without the token, even with a valid Host', async () => {
        const res = await rawRequest({ port: web.port, path: '/' });

        expect(res.status).toBe(401);
    });

    test('rejects a wrong token', async () => {
        const res = await rawRequest({ port: web.port, path: '/?token=wrong' });

        expect(res.status).toBe(401);
    });

    test('accepts ?token= and sets an HttpOnly, SameSite=Strict cookie', async () => {
        const res = await rawRequest({ port: web.port, path: `/?token=${token}`, headers: { Host: `my-laptop.lan:${web.port}` } });

        expect(res.status).toBe(200);
        expect(res.headers['set-cookie'][0]).toBe(`ctrlq_token_${web.port}=${token}; HttpOnly; SameSite=Strict; Path=/`);
    });

    test('accepts the cookie and the header on later requests', async () => {
        const byCookie = await rawRequest({ port: web.port, path: '/api/hello', headers: { Cookie: `ctrlq_token_${web.port}=${token}` } });
        const byHeader = await rawRequest({ port: web.port, path: '/api/hello', headers: { 'x-ctrlq-token': token } });

        expect(byCookie.status).toBe(200);
        expect(byHeader.status).toBe(200);
    });
});

describe('startWebServer refuses unsafe configurations', () => {
    test('a missing host is rejected', async () => {
        await expect(startWebServer({ port: 0, logger: silentLogger })).rejects.toThrow('host is required');
    });

    test.each(['0.0.0.0', '::', '192.168.1.10', 'my-laptop.lan'])('binding to %s without a token is rejected', async (host) => {
        await expect(startWebServer({ host, port: 0, logger: silentLogger })).rejects.toThrow('requires an access token');
    });

    test('binding to all interfaces with a token works, and a forged Host header does not bypass the token', async () => {
        const token = createAccessToken();
        const web = await startWebServer({
            host: '0.0.0.0',
            port: 0,
            token,
            logger: silentLogger,
            apiRoutes: [{ path: '/api/hello', handler: () => ({ hello: 'world' }) }],
        });
        try {
            expect(web.url).toBe(`http://localhost:${web.port}/?token=${token}`);
            const forged = await rawRequest({ port: web.port, path: '/api/hello', headers: { Host: `127.0.0.1:${web.port}` } });
            const ok = await rawRequest({ port: web.port, path: `/api/hello?token=${token}` });
            expect(forged.status).toBe(401);
            expect(ok.status).toBe(200);
        } finally {
            await web.close();
        }
    });
});

describe('startWebServer hardening', () => {
    let web;
    const logs = [];
    const capture = {
        error: (m) => logs.push(m),
        warn: (m) => logs.push(m),
        info: (m) => logs.push(m),
        verbose: (m) => logs.push(m),
        debug: (m) => logs.push(m),
    };
    const token = 'secret-token-0123456789abcdefgh';

    beforeAll(async () => {
        web = await startWebServer({
            host: '127.0.0.1',
            port: 0,
            token,
            assets: makeAssets(),
            logger: capture,
            apiRoutes: [
                { path: '/api/hello', handler: () => ({ hello: 'world' }) },
                {
                    path: '/api/fail',
                    handler: () => {
                        throw new Error('boom');
                    },
                },
                {
                    // Calls sendJson without awaiting it, then returns undefined
                    path: '/api/unawaited',
                    handler: ({ sendJson }) => {
                        sendJson(200, { rows: Array.from({ length: 300 }, (_, i) => i) });
                    },
                },
            ],
        });
    });

    afterAll(async () => {
        await web.close();
    });

    const auth = { 'x-ctrlq-token': token };

    test('never logs the access token, also when a request fails', async () => {
        await rawRequest({ port: web.port, path: `/api/fail?token=${token}` });
        await rawRequest({ port: web.port, path: `/?token=${token}` });

        expect(logs.some((l) => l.includes('/api/fail'))).toBe(true);
        expect(logs.some((l) => l.includes(token))).toBe(false);
    });

    test('rejects cross-site browser requests to the API', async () => {
        const crossSite = await rawRequest({ port: web.port, path: '/api/hello', headers: { ...auth, 'Sec-Fetch-Site': 'cross-site' } });
        const sameSite = await rawRequest({ port: web.port, path: '/api/hello', headers: { ...auth, 'Sec-Fetch-Site': 'same-site' } });
        const foreignOrigin = await rawRequest({
            port: web.port,
            path: '/api/hello',
            headers: { ...auth, Origin: 'http://evil.example.com' },
        });
        const nullOrigin = await rawRequest({ port: web.port, path: '/api/hello', headers: { ...auth, Origin: 'null' } });

        expect(crossSite.status).toBe(403);
        expect(sameSite.status).toBe(403);
        expect(foreignOrigin.status).toBe(403);
        expect(nullOrigin.status).toBe(403);
    });

    test('accepts same-origin browser requests and non-browser clients', async () => {
        const sameOrigin = await rawRequest({ port: web.port, path: '/api/hello', headers: { ...auth, 'Sec-Fetch-Site': 'same-origin' } });
        const typedUrl = await rawRequest({ port: web.port, path: '/api/hello', headers: { ...auth, 'Sec-Fetch-Site': 'none' } });
        const ownOrigin = await rawRequest({
            port: web.port,
            path: '/api/hello',
            headers: { ...auth, Origin: `http://localhost:${web.port}` },
        });
        const curl = await rawRequest({ port: web.port, path: '/api/hello', headers: auth });

        expect([sameOrigin.status, typedUrl.status, ownOrigin.status, curl.status]).toEqual([200, 200, 200, 200]);
    });

    test('a handler that does not await sendJson still gets exactly one response', async () => {
        const res = await rawRequest({ port: web.port, path: '/api/unawaited', headers: { ...auth, 'Accept-Encoding': 'gzip' } });
        const after = await rawRequest({ port: web.port, path: '/api/hello', headers: auth });

        expect(res.status).toBe(200);
        expect(JSON.parse(res.body).rows).toHaveLength(300);
        expect(after.status).toBe(200);
    });

    test('accepts the token cookie even when another cookie of the same name comes first', async () => {
        const res = await rawRequest({
            port: web.port,
            path: '/api/hello',
            headers: { Cookie: `ctrlq_token_${web.port}=stale; ctrlq_token_${web.port}=${token}` },
        });

        expect(res.status).toBe(200);
    });

    test('static files carry an ETag and answer 304 when unchanged', async () => {
        const first = await rawRequest({ port: web.port, path: '/demo/big.js', headers: auth });
        const second = await rawRequest({
            port: web.port,
            path: '/demo/big.js',
            headers: { ...auth, 'If-None-Match': first.headers.etag },
        });

        expect(first.headers.etag).toMatch(/^"[0-9a-f]{40}"$/);
        expect(second.status).toBe(304);
        expect(second.body).toBe('');
    });

    test('logs one line per request, at warn level for rejected ones', async () => {
        logs.length = 0;
        await rawRequest({ port: web.port, path: '/api/hello' });

        expect(logs).toContain('Web server: GET /api/hello 401');
    });
});
