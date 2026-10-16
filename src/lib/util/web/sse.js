import { logger as defaultLogger } from '../../../globals.js';

// A client that falls this far behind (bytes buffered but not yet sent) is disconnected.
// The browser reconnects by itself and then fetches a fresh snapshot.
const DEFAULT_MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

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
 * @param {number} [param.maxBufferedBytes] - A client with more unsent bytes than this is disconnected.
 * @returns {{handle: Function, broadcast: Function, clientCount: Function, close: Function}} The hub.
 */
export function createSseHub({
    logger = defaultLogger,
    maxClients = 50,
    pingIntervalMs = 20000,
    retryMs = 5000,
    maxBufferedBytes = DEFAULT_MAX_BUFFERED_BYTES,
} = {}) {
    const clients = new Set();
    let pingTimer = null;

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
        res.write(chunk);
        if (res.writableLength > maxBufferedBytes) {
            logger.warn('SSE: dropping a client that is not keeping up');
            res.destroy();
            dropClient(res);
        }
    };

    const startPing = () => {
        if (pingTimer || pingIntervalMs <= 0) {
            return;
        }
        pingTimer = setInterval(() => {
            for (const res of clients) {
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

        // HEAD gets the headers only, and does not occupy a client slot
        if (req.method === 'HEAD') {
            res.writeHead(200, streamHeaders);
            res.end();
            return;
        }

        res.writeHead(200, streamHeaders);
        res.write(`retry: ${retryMs}\n\n`);

        clients.add(res);
        logger.verbose(`SSE: client connected, ${clients.size} connected`);
        startPing();

        req.on('close', () => dropClient(res));
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
        for (const res of [...clients]) {
            write(res, chunk);
        }
    };

    /**
     * Disconnect all clients and stop the keep-alive timer.
     */
    const close = () => {
        if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
        }
        for (const res of clients) {
            res.end();
        }
        clients.clear();
    };

    return { handle, broadcast, clientCount: () => clients.size, close };
}
