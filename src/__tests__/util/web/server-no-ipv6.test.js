import { jest, test, expect, describe } from '@jest/globals';
import { createRequire } from 'node:module';

import { rawRequest, silentLogger } from './web-test-helpers.mjs';

// A computer without an IPv6 loopback address (some containers, IPv6 switched off): listening on ::1 fails with
// EADDRNOTAVAIL. The real node:http, except that listen() on ::1 fails that way.
const realHttp = createRequire(import.meta.url)('node:http');
jest.unstable_mockModule('node:http', () => {
    const createServer = (...args) => {
        const srv = realHttp.createServer(...args);
        const listen = srv.listen.bind(srv);
        srv.listen = (port, address, callback) => {
            if (address !== '::1') {
                return listen(port, address, callback);
            }
            process.nextTick(() => srv.emit('error', Object.assign(new Error('listen EADDRNOTAVAIL ::1'), { code: 'EADDRNOTAVAIL' })));
            return srv;
        };
        return srv;
    };
    return { ...realHttp, default: { ...realHttp, createServer }, createServer };
});

const { startWebServer } = await import('../../../lib/util/web/server.js');

describe('startWebServer on localhost, without IPv6', () => {
    test('listens on 127.0.0.1 alone, and says so', async () => {
        const logs = [];
        const web = await startWebServer({
            host: 'localhost',
            port: 0,
            logger: { ...silentLogger, verbose: (m) => logs.push(m) },
            apiRoutes: [{ path: '/api/hello', handler: () => ({ hello: 'world' }) }],
        });
        try {
            expect(web.servers).toHaveLength(1);
            expect((await rawRequest({ port: web.port, path: '/api/hello' })).status).toBe(200);
            expect(logs).toContain('Web server: ::1 is not available on this computer, listening on 127.0.0.1 only');
        } finally {
            await web.close();
        }
    });
});
