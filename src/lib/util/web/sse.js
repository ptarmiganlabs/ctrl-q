import { performance } from 'node:perf_hooks';

import { logger as defaultLogger } from '../../../globals.js';

// A client whose backlog (bytes buffered but not yet sent) stays above this for longer than the grace period below is
// disconnected. The browser reconnects by itself and then fetches a fresh snapshot.
const DEFAULT_MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

// How long a backlog may stay above the limit. Right after one large event, or several sent together, a client that
// reads fine is above it too, until its socket has drained; only a backlog that lasts means the client is not reading.
// A backlog above the limit plus twice the largest event so far is dropped at once: a client that reads has drained
// everything but the latest events, so the grace period never lets a stalled client hold more memory than that.
const DEFAULT_SLOW_CLIENT_GRACE_MS = 10000;

/**
 * Create a Server-Sent Events (SSE) hub. It keeps track of connected browsers and pushes events to all of them.
 *
 * Events carry no replay buffer. A client that reconnects is expected to fetch a full snapshot again.
 *
 * @param {object} [param] - Parameters.
 * @param {object} [param.logger] - Winston-style logger.
 * @param {number} [param.maxClients] - Max number of concurrent clients. More connections get HTTP 503.
 * @param {number} [param.pingIntervalMs] - Interval for keep-alive comments. 0 disables them.
 * @param {number} [param.retryMs] - Reconnect delay suggested to browsers.
 * @param {number} [param.maxBufferedBytes] - Backlog of unsent bytes above which a client counts as falling behind.
 * @param {number} [param.slowClientGraceMs] - A client whose backlog stays above maxBufferedBytes for longer than this
 *   is disconnected, and one whose backlog passes maxBufferedBytes plus twice the largest event at once.
 * @returns {{handle: Function, broadcast: Function, clientCount: Function, close: Function}} The hub.
 */
export function createSseHub({
    logger = defaultLogger,
    maxClients = 50,
    pingIntervalMs = 20000,
    retryMs = 5000,
    maxBufferedBytes = DEFAULT_MAX_BUFFERED_BYTES,
    slowClientGraceMs = DEFAULT_SLOW_CLIENT_GRACE_MS,
} = {}) {
    // Connected clients: response -> { behindSince }, when its backlog went above maxBufferedBytes, or null
    const clients = new Map();
    let pingTimer = null;
    let closed = false;
    // Size in bytes of the largest event broadcast so far
    let largestChunk = 0;

    const dropClient = (res) => {
        if (clients.delete(res)) {
            logger.verbose(`SSE: client disconnected, ${clients.size} connected`);
        }
        if (clients.size === 0 && pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
        }
    };

    const write = (res, chunk) => {
        if (res.writableEnded || res.destroyed) {
            dropClient(res);
            return;
        }
        // Judged before writing: the chunk about to be queued says nothing about whether the client reads. The clock is
        // monotonic, so a computer waking from sleep does not count the sleep as time spent behind.
        const client = clients.get(res);
        const now = performance.now();
        const backlog = res.writableLength;
        if (backlog <= maxBufferedBytes) {
            client.behindSince = null;
        } else if (
            backlog > maxBufferedBytes + 2 * largestChunk ||
            (client.behindSince !== null && now - client.behindSince > slowClientGraceMs)
        ) {
            logger.warn('SSE: dropping a client that is not keeping up');
            res.destroy();
            dropClient(res);
            return;
        }
        res.write(chunk);
        if (client.behindSince === null && res.writableLength > maxBufferedBytes) {
            client.behindSince = now;
        }
    };

    const startPing = () => {
        if (pingTimer || pingIntervalMs <= 0) {
            return;
        }
        pingTimer = setInterval(() => {
            for (const res of clients.keys()) {
                write(res, ': ping\n\n');
            }
        }, pingIntervalMs);
        pingTimer.unref();
    };

    /**
     * Handle an incoming SSE request. Call this from the web server's route handler.
     *
     * @param {import('node:http').IncomingMessage} req - Request.
     * @param {import('node:http').ServerResponse} res - Response, kept open for the lifetime of the connection.
     * @param {object} [headers] - Extra response headers, e.g. the web server's security headers (ctx.baseHeaders).
     */
    const handle = (req, res, headers = {}) => {
        if (clients.size >= maxClients) {
            res.writeHead(503, { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' });
            res.end('Too many connected clients');
            return;
        }

        const streamHeaders = {
            ...headers,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        };

        // After close() the hub never broadcasts again. The stream ends at once, as close() ends the others, and the
        // browser reconnects later, to a restarted server or to none. An error status would make it give up for good.
        if (closed) {
            res.writeHead(200, streamHeaders);
            res.end(`retry: ${retryMs}\n\n`);
            return;
        }

        // HEAD gets the headers only, and does not occupy a client slot
        if (req.method === 'HEAD') {
            res.writeHead(200, streamHeaders);
            res.end();
            return;
        }

        res.writeHead(200, streamHeaders);
        res.write(`retry: ${retryMs}\n\n`);

        clients.set(res, { behindSince: null });
        logger.verbose(`SSE: client connected, ${clients.size} connected`);
        startPing();

        // The response's 'close' is the end of the connection. The request's fires as soon as its body has been read,
        // which can be while the stream is still open.
        res.on('close', () => dropClient(res));
        res.on('error', () => dropClient(res));
    };

    /**
     * Send an event to all connected clients.
     *
     * @param {string} event - Event name, e.g. 'delta'.
     * @param {*} data - Payload, sent as JSON.
     * @param {number|string} [id] - Optional event id, e.g. a revision number.
     */
    const broadcast = (event, data, id) => {
        if (clients.size === 0) {
            return;
        }
        const idLine = id === undefined || id === null ? '' : `id: ${id}\n`;
        // JSON.stringify never emits raw newlines, so the payload always fits on one 'data:' line
        const chunk = `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        largestChunk = Math.max(largestChunk, Buffer.byteLength(chunk));
        for (const res of [...clients.keys()]) {
            write(res, chunk);
        }
    };

    /**
     * Disconnect all clients, stop the keep-alive timer, and turn away clients that connect afterwards.
     */
    const close = () => {
        closed = true;
        if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
        }
        for (const res of clients.keys()) {
            res.end();
        }
        clients.clear();
    };

    return { handle, broadcast, clientCount: () => clients.size, close };
}
