import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { createRequire } from 'node:module';

import { rawRequest, silentLogger } from './web-test-helpers.mjs';

// Listening on ::1, as it goes wrong on some computers. The real node:http, except that listen() on ::1 can be made to
// fail: 'unavailable' as on a computer without an IPv6 loopback address (some containers, IPv6 switched off), or
// 'busy-once' as when another program holds that port number on ::1 (EADDRINUSE once, then the real listen()).
let ipv6 = 'unavailable';
const ipv6Ports = [];

const realHttp = createRequire(import.meta.url)('node:http');
jest.unstable_mockModule('node:http', () => {
    const createServer = (...args) => {
        const srv = realHttp.createServer(...args);
        const listen = srv.listen.bind(srv);
        srv.listen = (port, address, callback) => {
            if (address !== '::1') {
                return listen(port, address, callback);
            }
            ipv6Ports.push(port);
            if (ipv6 === 'unavailable' || (ipv6 === 'busy-once' && ipv6Ports.length === 1)) {
                const code = ipv6 === 'unavailable' ? 'EADDRNOTAVAIL' : 'EADDRINUSE';
                process.nextTick(() => srv.emit('error', Object.assign(new Error(`listen ${code} ::1`), { code })));
                return srv;
            }
            return listen(port, address, callback);
        };
        return srv;
    };
    return { ...realHttp, default: { ...realHttp, createServer }, createServer };
});

const { startWebServer } = await import('../../../lib/util/web/server.js');

const hello = [{ path: '/api/hello', handler: () => ({ hello: 'world' }) }];

beforeEach(() => {
    ipv6Ports.length = 0;
});

describe('startWebServer on localhost, when ::1 fails', () => {
    test('without IPv6, listens on 127.0.0.1 alone, and says so', async () => {
        ipv6 = 'unavailable';
        const logs = [];
        const web = await startWebServer({
            host: 'localhost',
            port: 0,
            logger: { ...silentLogger, verbose: (m) => logs.push(m) },
            apiRoutes: hello,
        });
        try {
            expect(web.servers).toHaveLength(1);
            expect((await rawRequest({ port: web.port, path: '/api/hello' })).status).toBe(200);
            expect(logs).toContain('Web server: ::1 is not available on this computer, listening on 127.0.0.1 only');
        } finally {
            await web.close();
        }
    });

    test('with port 0, picks another port when the one it got is taken on ::1', async () => {
        ipv6 = 'busy-once';
        const web = await startWebServer({ host: 'localhost', port: 0, logger: silentLogger, apiRoutes: hello });
        try {
            expect(ipv6Ports).toHaveLength(2);
            expect((await rawRequest({ port: web.port, path: '/api/hello' })).status).toBe(200);
        } finally {
            await web.close();
        }
    });

    test('with a fixed port, fails as "already in use" rather than move to another port', async () => {
        ipv6 = 'busy-once';
        // A port that was free a moment ago
        const probe = realHttp.createServer();
        await new Promise((resolve) => {
            probe.listen(0, '127.0.0.1', resolve);
        });
        const { port } = probe.address();
        await new Promise((resolve) => {
            probe.close(resolve);
        });

        await expect(startWebServer({ host: 'localhost', port, logger: silentLogger, apiRoutes: hello })).rejects.toThrow(
            `Port ${port} on localhost is already in use`
        );
        expect(ipv6Ports).toEqual([port]);
    });
});
