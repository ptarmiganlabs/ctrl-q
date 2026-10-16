import http from 'node:http';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

import { logger as defaultLogger, isSea } from '../../../globals.js';
import { isTextMimeType } from './mime.js';

const gzip = promisify(zlib.gzip);

// Responses smaller than this are not worth compressing
const MIN_COMPRESS_BYTES = 1024;

// Header that state-changing (non-GET) API calls must carry. Browsers cannot add custom headers to cross-site form
// posts, and cross-origin fetch() with custom headers needs a CORS preflight, which this server never approves.
export const CSRF_HEADER = 'x-ctrlq-csrf';

export const DEFAULT_CSP = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
].join('; ');

/**
 * Is the host name/address a loopback one, i.e. only reachable from this computer?
 *
 * @param {string} host - Host name or IP address, e.g. 'localhost', '127.0.0.1', '::1'.
 * @returns {boolean} True for loopback hosts.
 */
export function isLoopbackHost(host) {
    const h = String(host || '')
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '');
    return h === 'localhost' || h === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/**
 * Format a host for use in a URL or Host header, i.e. wrap IPv6 literals in brackets.
 *
 * @param {string} host - Host name or IP address.
 * @returns {string} Host as it appears in a URL.
 */
export function formatHostForUrl(host) {
    const h = String(host || '');
    return h.includes(':') && !h.startsWith('[') ? `[${h}]` : h;
}

// Does a host entry already carry a port, e.g. 'myhost:8080' or '[::1]:3001'? Bare IPv6 literals do not.
const hasPort = (h) => /^\[.*\]:\d+$/.test(h) || /^[^:]+:\d+$/.test(h);

/**
 * Build the set of Host header values this server answers to.
 * Checking the Host header stops DNS-rebinding attacks, where a web page tricks the browser into talking to the
 * local server under a foreign host name.
 *
 * @param {string} host - Host the server listens on.
 * @param {number} port - Port the server listens on.
 * @param {string[]} [extraHosts] - Additional host names to accept, optionally with a port (e.g. when port-forwarded).
 * @returns {Set<string>} Allowed Host header values, lower case.
 */
export function buildAllowedHosts(host, port, extraHosts = []) {
    const names = new Set(['localhost', '127.0.0.1', '[::1]']);
    const withPort = new Set();
    for (const h of [host, ...extraHosts]) {
        if (!h || h === '0.0.0.0' || h === '::') continue;
        const lower = String(h).toLowerCase();
        if (hasPort(lower)) withPort.add(lower);
        else names.add(formatHostForUrl(lower));
    }
    const allowed = new Set(withPort);
    for (const name of names) {
        allowed.add(`${name}:${port}`);
        // Browsers leave out the default port
        if (Number(port) === 80) allowed.add(name);
    }
    return allowed;
}

/**
 * Parse a Cookie request header. A name may occur more than once (cookies are not isolated per port).
 *
 * @param {string} header - Cookie header value.
 * @returns {Map<string, string[]>} Cookie names and all their values.
 */
export function parseCookies(header) {
    const cookies = new Map();
    for (const part of String(header || '').split(';')) {
        const idx = part.indexOf('=');
        if (idx > 0) {
            const name = part.slice(0, idx).trim();
            if (!cookies.has(name)) cookies.set(name, []);
            cookies.get(name).push(part.slice(idx + 1).trim());
        }
    }
    return cookies;
}

/**
 * Compare two strings in constant time.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {boolean} True if equal.
 */
function safeEqual(a, b) {
    const ba = Buffer.from(String(a ?? ''));
    const bb = Buffer.from(String(b ?? ''));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Create a random access token for a server reachable from other computers.
 *
 * @returns {string} URL-safe random token.
 */
export function createAccessToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function friendlyListenError(err, host, port) {
    if (err.code === 'EADDRINUSE') {
        return new Error(
            `Port ${port} on ${host} is already in use. Is another Ctrl-Q instance running? Pick another port with --vis-port.`
        );
    }
    if (err.code === 'EACCES') {
        return new Error(`No permission to listen on ${host}:${port}. Pick another port with --vis-port.`);
    }
    if (err.code === 'EADDRNOTAVAIL' || err.code === 'ENOTFOUND') {
        return new Error(`Address ${host} is not available on this computer. Check --vis-host.`);
    }
    return err;
}

/**
 * Is the request a cross-site one made by a browser, e.g. a script on another web site calling the API?
 * Uses Fetch Metadata (Sec-Fetch-Site) where the browser sends it, and the Origin header otherwise.
 *
 * @param {http.IncomingMessage} req - Request.
 * @param {Set<string>} allowedHosts - Allowed Host header values.
 * @param {boolean} hasToken - True when an access token is in use (then any origin of the server's own host is fine).
 * @returns {boolean} True if the request should be rejected.
 */
function isCrossSiteRequest(req, allowedHosts, hasToken) {
    const site = req.headers['sec-fetch-site'];
    if (site) {
        return site !== 'same-origin' && site !== 'none';
    }
    const origin = req.headers.origin;
    if (!origin || origin === 'null') {
        return origin === 'null';
    }
    try {
        const originHost = new URL(origin).host.toLowerCase();
        return hasToken ? originHost !== String(req.headers.host || '').toLowerCase() : !allowedHosts.has(originHost);
    } catch {
        return true;
    }
}

/**
 * Start a small, local web server that serves an allowlist of static files plus JSON API routes.
 *
 * Security properties:
 * - Static files are served by exact URL match only (see assets.js), so there is no path traversal.
 * - Only GET and HEAD, plus POST for API routes declared as POST (which must carry the CSRF header).
 * - Binding to anything but a loopback address requires an access token; every request must then present it: as
 *   ?token=..., the x-ctrlq-token header, or the cookie set the first time a valid ?token= is seen.
 * - Without a token, the Host header must be one of the allowed hosts (stops DNS rebinding).
 * - API routes reject cross-site browser requests (Sec-Fetch-Site / Origin), so other web sites cannot drive the API.
 * - Restrictive security headers (CSP, nosniff, no referrer, no framing) on every response.
 * - Request URLs are logged without their query string, so the token never reaches the log.
 *
 * @param {object} param - Parameters.
 * @param {string} param.host - Host/address to listen on, e.g. 'localhost'.
 * @param {number|string} param.port - Port to listen on. 0 picks a free port.
 * @param {object} [param.assets] - Asset catalog from createAssetCatalog().
 * @param {Array<{method?: string, path: string, handler: Function}>} [param.apiRoutes] - API routes. A handler gets the
 *   context { req, res, url, query, sendJson(status, value, headers), sendText(status, text, headers), baseHeaders }
 *   and either sends a response itself (await sendJson/sendText, or write to res directly, e.g. for SSE, using
 *   baseHeaders) or returns a value, which is sent as JSON. Returning undefined without responding gives 204.
 * @param {string[]} [param.allowedHosts] - Extra host names (optionally host:port) to accept in the Host header.
 * @param {string|null} [param.token] - Access token. Required when host is not a loopback address.
 * @param {string} [param.csp] - Content-Security-Policy header value.
 * @param {object} [param.logger] - Winston-style logger.
 * @returns {Promise<{server: http.Server, port: number, url: string, close: Function}>} The running server.
 */
export function startWebServer({
    host,
    port,
    assets,
    apiRoutes = [],
    allowedHosts = [],
    token = null,
    csp = DEFAULT_CSP,
    logger = defaultLogger,
} = {}) {
    if (!host || typeof host !== 'string') {
        return Promise.reject(new Error('startWebServer: host is required, e.g. "localhost"'));
    }
    if (!isLoopbackHost(host) && !token) {
        return Promise.reject(
            new Error(`Binding the web server to "${host}" makes it reachable from other computers, which requires an access token`)
        );
    }

    const routes = new Map();
    const methodsByPath = new Map();
    for (const route of apiRoutes) {
        const method = (route.method || 'GET').toUpperCase();
        if (!['GET', 'POST'].includes(method)) {
            throw new Error(`startWebServer: unsupported method ${method} for ${route.path}`);
        }
        routes.set(`${method} ${route.path}`, route.handler);
        if (!methodsByPath.has(route.path)) {
            methodsByPath.set(route.path, new Set());
        }
        methodsByPath.get(route.path).add(method);
    }

    let actualPort = Number(port);
    let allowed = new Set();
    // Cookies are not isolated per port, so the cookie name includes the port
    const tokenCookieName = () => `ctrlq_token_${actualPort}`;
    const assetCache = new Map();
    // Responses a handler has started sending, so the server does not send a second one
    const responding = new WeakSet();

    const baseHeaders = {
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
    };

    const acceptsGzip = (req) => /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));

    const writeResponse = (req, res, status, headers, payload) => {
        if (res.headersSent || res.writableEnded || res.destroyed) {
            logger.warn(`Web server: a second response for one request was dropped (${req.method} ${status})`);
            return;
        }
        res.writeHead(status, headers);
        res.end(req.method === 'HEAD' ? undefined : payload);
    };

    const send = async (req, res, status, body, headers) => {
        responding.add(res);
        let payload = body;
        const outHeaders = { ...baseHeaders, ...headers };
        if (payload.length >= MIN_COMPRESS_BYTES && isTextMimeType(outHeaders['Content-Type']) && acceptsGzip(req)) {
            payload = await gzip(payload);
            outHeaders['Content-Encoding'] = 'gzip';
            outHeaders.Vary = 'Accept-Encoding';
        }
        outHeaders['Content-Length'] = payload.length;
        writeResponse(req, res, status, outHeaders, payload);
    };

    const sendText = (req, res, status, text, extraHeaders = {}) =>
        send(req, res, status, Buffer.from(String(text)), { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });

    const sendJson = (req, res, status, value, extraHeaders = {}) =>
        send(req, res, status, Buffer.from(JSON.stringify(value)), {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders,
        });

    const sendStatic = async (req, res, route) => {
        responding.add(res);
        const content = await assets.load(route);
        const hash = crypto.createHash('sha1').update(content).digest('hex');
        const etag = `"${hash}"`;
        const headers = { ...baseHeaders, 'Content-Type': route.mimeType, 'Cache-Control': 'no-cache', ETag: etag };

        if (req.headers['if-none-match'] === etag) {
            writeResponse(req, res, 304, headers);
            return;
        }

        // Static files are compressed once per content version
        if (content.length >= MIN_COMPRESS_BYTES && isTextMimeType(route.mimeType) && acceptsGzip(req)) {
            let cached = assetCache.get(route.url);
            if (!cached || cached.hash !== hash) {
                cached = { hash, data: await gzip(content) };
                assetCache.set(route.url, cached);
            }
            writeResponse(
                req,
                res,
                200,
                { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': cached.data.length },
                cached.data
            );
            return;
        }
        writeResponse(req, res, 200, { ...headers, 'Content-Length': content.length }, content);
    };

    // Returns extra response headers to send (e.g. Set-Cookie), or null if the request is not authorized
    const checkToken = (req, url) => {
        if (!token) {
            return {};
        }
        const fromQuery = url.searchParams.get('token');
        if (fromQuery !== null && safeEqual(fromQuery, token)) {
            return { 'Set-Cookie': `${tokenCookieName()}=${token}; HttpOnly; SameSite=Strict; Path=/` };
        }
        if (safeEqual(req.headers['x-ctrlq-token'], token)) {
            return {};
        }
        const cookies = parseCookies(req.headers.cookie).get(tokenCookieName()) || [];
        return cookies.some((value) => safeEqual(value, token)) ? {} : null;
    };

    const requestHandler = async (req, res) => {
        let pathname = '?';
        res.on('finish', () => {
            const level = res.statusCode >= 500 ? 'error' : res.statusCode === 401 || res.statusCode === 403 ? 'warn' : 'verbose';
            logger[level](`Web server: ${req.method} ${pathname} ${res.statusCode}`);
        });

        try {
            let url;
            try {
                url = new URL(req.url, 'http://localhost');
                pathname = url.pathname;
            } catch {
                await sendText(req, res, 400, 'Bad request');
                return;
            }

            // Host check stops DNS rebinding. With an access token the token is the protection instead.
            if (!token && !allowed.has(String(req.headers.host || '').toLowerCase())) {
                await sendText(req, res, 403, 'Forbidden: unexpected Host header');
                return;
            }

            const extraHeaders = checkToken(req, url);
            if (extraHeaders === null) {
                await sendText(req, res, 401, 'Unauthorized: access token missing or wrong');
                return;
            }

            const method = req.method === 'HEAD' ? 'GET' : req.method;
            const apiHandler = routes.get(`${method} ${url.pathname}`);

            if (apiHandler) {
                if (isCrossSiteRequest(req, allowed, Boolean(token))) {
                    await sendText(req, res, 403, 'Forbidden: cross-site request');
                    return;
                }
                if (method !== 'GET' && req.headers[CSRF_HEADER] !== '1') {
                    await sendText(req, res, 403, `Forbidden: missing ${CSRF_HEADER} header`);
                    return;
                }
                for (const [name, value] of Object.entries(extraHeaders)) {
                    res.setHeader(name, value);
                }
                const ctx = {
                    req,
                    res,
                    url,
                    query: url.searchParams,
                    sendJson: (status, value, headers) => sendJson(req, res, status, value, headers),
                    sendText: (status, text, headers) => sendText(req, res, status, text, headers),
                    baseHeaders,
                };
                const result = await apiHandler(ctx);
                if (!responding.has(res) && !res.headersSent && !res.writableEnded) {
                    if (result === undefined) {
                        writeResponse(req, res, 204, baseHeaders);
                    } else {
                        await sendJson(req, res, 200, result);
                    }
                }
                return;
            }

            const route = assets?.lookup(url.pathname);
            if (route) {
                if (method !== 'GET') {
                    await sendText(req, res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
                    return;
                }
                for (const [name, value] of Object.entries(extraHeaders)) {
                    res.setHeader(name, value);
                }
                await sendStatic(req, res, route);
                return;
            }

            // Known path, wrong method?
            const methods = methodsByPath.get(url.pathname);
            if (methods) {
                const allow = [...methods].flatMap((m) => (m === 'GET' ? ['GET', 'HEAD'] : [m])).join(', ');
                await sendText(req, res, 405, 'Method not allowed', { Allow: allow });
                return;
            }

            await sendText(req, res, 404, 'Not found');
        } catch (err) {
            // Never log req.url: it may carry the access token
            logger.error(`Web server: error while handling ${req.method} ${pathname}: ${err.message}`);
            if (!isSea && err.stack) {
                logger.debug(err.stack);
            }
            if (!res.headersSent) {
                await sendText(req, res, 500, 'Internal server error').catch(() => res.destroy());
            } else {
                res.destroy();
            }
        }
    };

    const server = http.createServer((req, res) => {
        requestHandler(req, res).catch((err) => {
            logger.error(`Web server: unexpected error: ${err.message}`);
            res.destroy();
        });
    });

    server.on('clientError', (err, socket) => {
        if (socket.writable) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
        socket.destroy();
    });

    return new Promise((resolve, reject) => {
        const onStartupError = (err) => reject(friendlyListenError(err, host, port));
        server.once('error', onStartupError);

        server.listen(Number(port), host, () => {
            server.off('error', onStartupError);
            server.on('error', (err) => logger.error(`Web server error: ${err.message}`));

            actualPort = server.address().port;
            allowed = buildAllowedHosts(host, actualPort, allowedHosts);

            const urlHost = host === '0.0.0.0' || host === '::' ? 'localhost' : formatHostForUrl(host);
            const url = `http://${urlHost}:${actualPort}/${token ? `?token=${encodeURIComponent(token)}` : ''}`;

            const close = () =>
                new Promise((resolveClose) => {
                    server.close(() => resolveClose());
                    server.closeAllConnections();
                });

            resolve({ server, port: actualPort, url, close });
        });
    });
}
