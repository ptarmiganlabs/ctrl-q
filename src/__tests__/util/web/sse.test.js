import { test, expect, describe, afterEach } from '@jest/globals';
import http from 'node:http';

import { createSseHub } from '../../../lib/util/web/sse.js';
import { startWebServer } from '../../../lib/util/web/server.js';
import { silentLogger } from './web-test-helpers.mjs';

// Open an SSE connection and collect what arrives
function connect(port) {
    return new Promise((resolve, reject) => {
        const req = http.get(
            { host: '127.0.0.1', port, path: '/api/events', headers: { Host: `localhost:${port}` }, agent: false },
            (res) => {
                const received = { status: res.statusCode, headers: res.headers, text: '' };
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    received.text += chunk;
                });
                resolve({ req, res, received });
            }
        );
        req.on('error', reject);
    });
}

const waitFor = async (predicate, timeoutMs = 2000) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('timeout waiting for condition');
        }
        await new Promise((r) => {
            setTimeout(r, 10);
        });
    }
};

describe('createSseHub', () => {
    let web;
    let hub;

    afterEach(async () => {
        hub?.close();
        await web?.close();
    });

    const start = async (hubOptions) => {
        hub = createSseHub({ logger: silentLogger, ...hubOptions });
        web = await startWebServer({
            host: '127.0.0.1',
            port: 0,
            logger: silentLogger,
            apiRoutes: [{ path: '/api/events', handler: ({ req, res, baseHeaders }) => hub.handle(req, res, baseHeaders) }],
        });
    };

    test('sends event-stream headers and the retry hint', async () => {
        await start({ retryMs: 1234 });
        const client = await connect(web.port);
        await waitFor(() => client.received.text.includes('retry'));

        expect(client.received.status).toBe(200);
        expect(client.received.headers['content-type']).toBe('text/event-stream; charset=utf-8');
        expect(client.received.headers['cache-control']).toBe('no-cache, no-transform');
        expect(client.received.text).toBe('retry: 1234\n\n');
        expect(client.received.headers['content-security-policy']).toContain("default-src 'none'");
        expect(client.received.headers['x-content-type-options']).toBe('nosniff');
        client.req.destroy();
    });

    test('HEAD gets the headers without occupying a client slot', async () => {
        await start({ maxClients: 1 });
        const res = await new Promise((resolve, reject) => {
            const req = http.request(
                {
                    host: '127.0.0.1',
                    port: web.port,
                    method: 'HEAD',
                    path: '/api/events',
                    headers: { Host: `localhost:${web.port}` },
                    agent: false,
                },
                resolve
            );
            req.on('error', reject);
            req.end();
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/event-stream; charset=utf-8');
        expect(hub.clientCount()).toBe(0);
        const real = await connect(web.port);
        await waitFor(() => hub.clientCount() === 1);
        real.req.destroy();
    });

    test('drops a client that does not keep up', async () => {
        await start({ maxBufferedBytes: 1000 });
        const slow = await connect(web.port);
        await waitFor(() => hub.clientCount() === 1);
        slow.res.pause();

        const big = 'x'.repeat(200000);
        for (let i = 0; i < 50 && hub.clientCount() > 0; i += 1) {
            hub.broadcast('bulk', { big });
            await new Promise((r) => {
                setTimeout(r, 5);
            });
        }

        expect(hub.clientCount()).toBe(0);
        slow.req.destroy();
    });

    test('broadcasts JSON events with ids to all clients', async () => {
        await start();
        const a = await connect(web.port);
        const b = await connect(web.port);
        await waitFor(() => hub.clientCount() === 2);

        hub.broadcast('delta', { rev: 7, text: 'line1\nline2' }, 7);
        await waitFor(() => a.received.text.includes('event: delta') && b.received.text.includes('event: delta'));

        expect(a.received.text).toContain('id: 7\nevent: delta\ndata: {"rev":7,"text":"line1\\nline2"}\n\n');
        expect(b.received.text).toContain('event: delta');
        a.req.destroy();
        b.req.destroy();
    });

    test('forgets clients that disconnect', async () => {
        await start();
        const a = await connect(web.port);
        await waitFor(() => hub.clientCount() === 1);

        a.req.destroy();
        await waitFor(() => hub.clientCount() === 0);

        expect(() => hub.broadcast('x', {})).not.toThrow();
    });

    test('sends keep-alive pings', async () => {
        await start({ pingIntervalMs: 20 });
        const a = await connect(web.port);
        await waitFor(() => a.received.text.includes(': ping'));

        expect(a.received.text).toContain(': ping\n\n');
        a.req.destroy();
    });

    test('refuses clients beyond maxClients with 503', async () => {
        await start({ maxClients: 1 });
        const a = await connect(web.port);
        await waitFor(() => hub.clientCount() === 1);
        const b = await connect(web.port);

        expect(b.received.status).toBe(503);
        a.req.destroy();
        b.req.destroy();
    });

    test('close() ends all connections', async () => {
        await start();
        const a = await connect(web.port);
        await waitFor(() => hub.clientCount() === 1);
        const ended = new Promise((resolve) => {
            a.res.on('end', resolve);
        });

        hub.close();
        await ended;

        expect(hub.clientCount()).toBe(0);
    });
});
