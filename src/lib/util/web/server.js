import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

import { logger as defaultLogger, isSea } from '../../../globals.js';
import { describeError } from './describe-error.js';
import { isTextMimeType } from './mime.js';

const gzip = promisify(zlib.gzip);

// Responses smaller than this are not worth compressing
const MIN_COMPRESS_BYTES = 1024;

// 'localhost' means both loopback addresses. Listening on the one the name resolves to first (::1 on macOS) would leave
// http://127.0.0.1:<port> unanswered, and the other address free for another program to take the same port.
const LOCALHOST_ADDRESSES = ['127.0.0.1', '::1'];

// Listening on ::1 fails with these when the computer has no IPv6 loopback address; 127.0.0.1 is then all there is
const NO_IPV6_CODES = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT']);

// Port 0 asks for a free port, but it is picked for the first address only. When another program holds that number on
// the second address, a new port is picked, this many times at most.
const PORT_0_ATTEMPTS = 5;

/**
 * Does a program accept connections on this address and port? On macOS and Windows, listening on 127.0.0.1 succeeds
 * even when another program listens on 0.0.0.0 with the same port, and then takes over its local traffic, silently.
 *
 * @param {string} address - IP address, e.g. '127.0.0.1'.
 * @param {number} port - Port.
 * @returns {Promise<boolean>} True if a connection was accepted.
 */
function acceptsConnections(address, port) {
    return new Promise((resolve) => {
        const socket = net.connect({ host: address, port });
        const done = (result) => {
            socket.destroy();
            resolve(result);
        };
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
        socket.setTimeout(1000, () => done(false));
    });
}

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

/**
 * Does an Accept-Encoding request header accept gzip? A coding with q=0 is refused, and '*' stands for every coding the
 * header does not name.
 *
 * @param {string} [header] - Accept-Encoding header value, e.g. 'gzip, deflate, br'.
 * @returns {boolean} True if a gzip-compressed response is acceptable.
 */
export function acceptsGzip(header) {
    let gzipQ = null;
    let anyQ = null;
    for (const part of String(header || '').split(',')) {
        const [coding, ...params] = part.split(';').map((s) => s.trim().toLowerCase());
        const qParam = params.find((p) => p.startsWith('q='));
        // A q value that is not a number counts as 0: the plain response is always acceptable
        const q = qParam === undefined ? 1 : Number(qParam.slice(2)) || 0;
        if (coding === 'gzip' || coding === 'x-gzip') {
            gzipQ = Math.max(gzipQ ?? 0, q);
        } else if (coding === '*') {
            anyQ = q;
        }
    }
    return (gzipQ ?? anyQ ?? 0) > 0;
}

/**
 * Does an If-None-Match request header match an entity tag? If-None-Match compares weakly, so a W/ prefix does not
 * matter, and '*' matches any representation.
 *
 * @param {string} [header] - If-None-Match header value: one or more entity tags, or '*'.
 * @param {string} etag - Entity tag of the representation that would be sent, e.g. '"3f2a"'.
 * @returns {boolean} True if the client's copy is current, so 304 can be sent.
 */
export function matchesIfNoneMatch(header, etag) {
    const opaque = (tag) => tag.trim().replace(/^W\//, '');
    return String(header || '')
        .split(',')
        .some((tag) => tag.trim() === '*' || opaque(tag) === opaque(etag));
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
 * 'localhost' listens on both 127.0.0.1 and ::1 (::1 only where the computer has it), and fails if either is taken.
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
 * @returns {Promise<{server: http.Server, servers: http.Server[], port: number, url: string, close: Function}>} The
 *   running server. servers holds one http.Server per address listened on; server is the first of them.
 */
export async function startWebServer({
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
        throw new Error('startWebServer: host is required, e.g. "localhost"');
    }
    // As written in a URL or an environment variable: '[::1]' is the address ::1, and stray spaces are not part of it
    const bindHost = host.trim().replace(/^\[(.*)\]$/, '$1');
    if (!isLoopbackHost(bindHost) && !token) {
        throw new Error(`Binding the web server to "${host}" makes it reachable from other computers, which requires an access token`);
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
    // Static files with their hash and compressed copy, by URL. See loadStatic().
    const staticCache = new Map();
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

    const writeResponse = (req, res, status, headers, payload) => {
        if (res.headersSent || res.writableEnded) {
            logger.warn(`Web server: a second response for one request was dropped (${req.method} ${status})`);
            return;
        }
        if (res.destroyed) {
            // The browser closed the connection first, e.g. because the page was reloaded
            logger.verbose(`Web server: the client closed the connection before the response was sent (${req.method} ${status})`);
            return;
        }
        res.writeHead(status, headers);
        res.end(req.method === 'HEAD' ? undefined : payload);
    };

    const send = async (req, res, status, body, headers) => {
        responding.add(res);
        let payload = body;
        const outHeaders = { ...baseHeaders, ...headers };
        if (payload.length >= MIN_COMPRESS_BYTES && isTextMimeType(outHeaders['Content-Type'])) {
            // Varies by Accept-Encoding whichever encoding this client gets
            outHeaders.Vary = 'Accept-Encoding';
            if (acceptsGzip(req.headers['accept-encoding'])) {
                payload = await gzip(payload);
                outHeaders['Content-Encoding'] = 'gzip';
            }
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

    // A static file with its hash, and its compressed copy once one was asked for. Embedded (SEA) files cannot change,
    // so they are loaded and hashed once. Files on disk are read on every request, so edits show; the compressed copy
    // is kept while the content is unchanged.
    const loadStatic = async (route) => {
        const cached = staticCache.get(route.url);
        if (cached && assets.immutable) {
            return cached;
        }
        const content = await assets.load(route);
        const hash = crypto.createHash('sha1').update(content).digest('hex');
        if (cached?.hash === hash) {
            return cached;
        }
        const entry = {
            content,
            hash,
            compressible: content.length >= MIN_COMPRESS_BYTES && isTextMimeType(route.mimeType),
            gzipped: null,
        };
        staticCache.set(route.url, entry);
        return entry;
    };

    const sendStatic = async (req, res, route) => {
        responding.add(res);
        const entry = await loadStatic(route);
        const useGzip = entry.compressible && acceptsGzip(req.headers['accept-encoding']);
        // The compressed and the plain copy are different representations, so each has its own entity tag
        const etag = useGzip ? `"${entry.hash}-gzip"` : `"${entry.hash}"`;
        const headers = { ...baseHeaders, 'Content-Type': route.mimeType, 'Cache-Control': 'no-cache', ETag: etag };
        if (entry.compressible) {
            headers.Vary = 'Accept-Encoding';
        }

        if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
            writeResponse(req, res, 304, headers);
            return;
        }
        if (useGzip) {
            if (!entry.gzipped) {
                entry.gzipped = await gzip(entry.content);
            }
            writeResponse(req, res, 200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': entry.gzipped.length }, entry.gzipped);
            return;
        }
        writeResponse(req, res, 200, { ...headers, 'Content-Length': entry.content.length }, entry.content);
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
            logger.error(`Web server: error while handling ${req.method} ${pathname}: ${describeError(err)}`);
            if (!isSea && err?.stack) {
                logger.debug(err.stack);
            }
            if (!res.headersSent) {
                await sendText(req, res, 500, 'Internal server error').catch(() => res.destroy());
            } else {
                res.destroy();
            }
        }
    };

    // Malformed requests are left to Node: it answers 400 (431 for oversized headers, 408 for a request that took too
    // long), and never writes that into a response that is already being sent.
    const createServer = () =>
        http.createServer((req, res) => {
            requestHandler(req, res).catch((err) => {
                logger.error(`Web server: unexpected error: ${describeError(err)}`);
                res.destroy();
            });
        });

    const listen = (srv, address, listenPort) =>
        new Promise((resolve, reject) => {
            srv.once('error', reject);
            srv.listen(listenPort, address, () => {
                srv.off('error', reject);
                srv.on('error', (err) => logger.error(`Web server error: ${err.message}`));
                resolve();
            });
        });

    const servers = [];
    const close = () =>
        Promise.all(
            servers.map(
                (srv) =>
                    new Promise((resolveClose) => {
                        srv.close(() => resolveClose());
                        srv.closeAllConnections();
                    })
            )
        ).then(() => {});

    const [firstAddress, ...otherAddresses] = bindHost.toLowerCase() === 'localhost' ? LOCALHOST_ADDRESSES : [bindHost];
    const requestedPort = Number(port);
    if (requestedPort !== 0) {
        for (const address of [firstAddress, ...otherAddresses].filter(isLoopbackHost)) {
            if (await acceptsConnections(address, requestedPort)) {
                throw friendlyListenError({ code: 'EADDRINUSE' }, bindHost, requestedPort);
            }
        }
    }

    for (let attempt = 1; ; attempt += 1) {
        try {
            const first = createServer();
            await listen(first, firstAddress, requestedPort);
            servers.push(first);
            // Known as soon as the first address answers: requests may arrive from then on
            actualPort = first.address().port;
            allowed = buildAllowedHosts(bindHost, actualPort, allowedHosts);

            for (const address of otherAddresses) {
                const other = createServer();
                try {
                    await listen(other, address, actualPort);
                    servers.push(other);
                } catch (err) {
                    if (!NO_IPV6_CODES.has(err.code)) {
                        throw err;
                    }
                    logger.verbose(`Web server: ${address} is not available on this computer, listening on ${firstAddress} only`);
                }
            }
            break;
        } catch (err) {
            await close();
            servers.length = 0;
            if (requestedPort === 0 && err.code === 'EADDRINUSE' && attempt < PORT_0_ATTEMPTS) {
                continue;
            }
            throw friendlyListenError(err, bindHost, actualPort);
        }
    }

    const urlHost = bindHost === '0.0.0.0' || bindHost === '::' ? 'localhost' : formatHostForUrl(bindHost);
    const url = `http://${urlHost}:${actualPort}/${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    return { server: servers[0], servers, port: actualPort, url, close };
}
