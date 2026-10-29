import axios from 'axios';

import { setupQrsConnection } from './qrs.js';

/**
 * Error from a QRS request. Carries the HTTP status, if there was a response, the short reason and a hint on what to
 * check. The message holds all of it.
 */
export class QrsRequestError extends Error {
    constructor(message, status, { reason = '', hint = '' } = {}) {
        super(hint ? `${message}. ${hint}` : message);
        this.name = 'QrsRequestError';
        this.status = status ?? null;
        this.reason = reason || message;
        this.hint = hint;
    }
}

// Error codes Node.js gives when the certificate of the server cannot be verified
const CERT_ERROR_CODES = new Set([
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_UNTRUSTED',
    'CERT_HAS_EXPIRED',
    'CERT_NOT_YET_VALID',
    'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/**
 * What to check for common connection and authentication errors.
 *
 * @param {object} options - Ctrl-Q options.
 * @param {number|undefined} status - HTTP status, if Sense answered.
 * @param {string|undefined} code - Error code, e.g. 'ECONNREFUSED'.
 * @returns {string} Hint, or '' if there is none.
 */
export function qrsErrorHint(options, status, code) {
    const jwt = options.authType === 'jwt';
    if (status === 401 || status === 403) {
        return jwt
            ? 'Check that the JWT is valid and not expired, and that --virtual-proxy is a virtual proxy that accepts JWTs'
            : 'Check that the certificate files are from this Sense site and that the user in --auth-user-dir/--auth-user-id may read from the QRS';
    }
    if (['ECONNREFUSED', 'ECONNRESET', 'EPROTO', 'EPIPE'].includes(code)) {
        return jwt
            ? 'With JWT authentication Ctrl-Q connects through the Sense proxy: usually --qrs-port 443 with --virtual-proxy <prefix>'
            : 'With certificate authentication the QRS port is usually 4242, and it must be open from this computer';
    }
    if (CERT_ERROR_CODES.has(code)) {
        return jwt
            ? 'The certificate of the Sense proxy could not be verified. Check that --host is the name in the certificate and that this computer trusts its CA (e.g. add the CA with the NODE_EXTRA_CA_CERTS environment variable), or use --secure false on a network you trust'
            : 'The certificate of the QRS could not be verified. Check that --host is the name in the certificate and that --auth-root-cert-file is the root certificate of this Sense site, or use --secure false on a network you trust';
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'Check the host name in --host';
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'Sense did not answer in time. Check --host, --qrs-port and firewalls';
    return '';
}

// Proxy session of each JWT connection, per options object: { cookies, login }. See requestWithProxySession().
const proxySessions = new WeakMap();

/**
 * The cookies a response sets, as the value of a Cookie header ('name=value; name2=value2'). The response to a JWT
 * login sets the proxy session cookie. Its name is the virtual proxy's "Session cookie header name", which the Sense
 * admin chooses (by convention X-Qlik-Session-<suffix>), so cookies are kept whatever their names.
 *
 * @param {object} [headers] - Response headers.
 * @returns {string|null} The cookies, or null if the response sets none.
 */
export function proxySessionCookies(headers) {
    const cookies = new Map();
    for (const setCookie of [headers?.['set-cookie'] ?? []].flat()) {
        const pair = String(setCookie).split(';')[0].trim();
        const eq = pair.indexOf('=');
        // An empty value deletes the cookie (logout)
        if (eq > 0 && eq < pair.length - 1) cookies.set(pair.slice(0, eq), pair);
    }
    return cookies.size ? [...cookies.values()].join('; ') : null;
}

/**
 * Send a request through a JWT virtual proxy, reusing one proxy session.
 *
 * The Sense proxy gives a client whose JWT it has validated a session, identified by a cookie, and the client can make
 * further requests without the JWT. A request with a JWT but without that cookie gets a new session, which lasts until
 * the virtual proxy's session inactivity timeout (default 30 minutes). So the JWT is only sent to log in. The cookies
 * from that response are sent instead of the JWT until the proxy answers 401 (the session has ended), and then the JWT
 * is sent again. Requests made while a login is under way wait for it, so that they share its session.
 *
 * @param {object} options - Ctrl-Q options. The session is kept per options object.
 * @param {object} config - Axios request config from setupQrsConnection(), with the JWT in the Authorization header.
 * @returns {Promise<object>} Axios response.
 */
async function requestWithProxySession(options, config) {
    if (!proxySessions.has(options)) proxySessions.set(options, { cookies: null, login: null });
    const session = proxySessions.get(options);
    const withCookies = (cookies) => {
        const { Authorization, ...headers } = config.headers;
        return { ...config, headers: { ...headers, Cookie: cookies } };
    };

    if (session.login) await session.login.catch(() => {});
    const cookies = session.cookies;
    if (cookies) {
        try {
            return await axios.request(withCookies(cookies));
        } catch (err) {
            if (err.response?.status !== 401) throw err;
            // The session has ended. Log in again, unless a parallel request already did.
            if (session.cookies === cookies) session.cookies = null;
            if (session.login) await session.login.catch(() => {});
            if (session.cookies) return axios.request(withCookies(session.cookies));
        }
    }

    const login = axios.request(config).then((res) => {
        session.cookies = proxySessionCookies(res.headers) ?? session.cookies;
        return res;
    });
    session.login = login;
    try {
        return await login;
    } finally {
        if (session.login === login) session.login = null;
    }
}

/**
 * Send a request to the Qlik Sense Repository Service and parse the JSON response.
 *
 * Wraps setupQrsConnection() (cert or JWT auth, xrfkey, virtual proxy). Unlike calling setupQrsConnection directly,
 * query parameter values are URL-encoded here, and errors never include request headers (which may hold a JWT or a
 * session cookie). With JWT auth the proxy session is reused, see requestWithProxySession().
 *
 * @param {object} options - Ctrl-Q options (host, qrsPort/port, auth...). Pass the same object to every request of a
 *   connection, so that JWT requests share a proxy session.
 * @param {object} request - Request.
 * @param {string} [request.method] - HTTP method, default 'get'.
 * @param {string} request.path - Path, e.g. '/qrs/task/full'.
 * @param {object} [request.query] - Query parameters, e.g. { filter: "name eq 'x'" }. Empty values are left out.
 * @param {*} [request.body] - Request body.
 * @param {number} [request.timeoutMs] - Timeout, overrides the default 60 s.
 * @returns {Promise<{status: number, data: *, serverDate: number|null}>} Parsed response, plus the server's Date header.
 */
export async function qrsRequestJson(options, { method = 'get', path, query = {}, body, timeoutMs } = {}) {
    const queryParameters = Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([name, value]) => ({ name, value: encodeURIComponent(String(value)) }));
    const config = setupQrsConnection(options, { method, path, body, queryParameters });
    if (timeoutMs) {
        config.timeout = timeoutMs;
    }

    let res;
    try {
        res = options.authType === 'jwt' ? await requestWithProxySession(options, config) : await axios.request(config);
    } catch (err) {
        // axios error messages hold no request headers, so they are safe to show
        const status = err.response?.status;
        let reason = err.message || err.code || 'unknown error';
        if (status) reason = `HTTP ${status}`;
        else if (err.code && !reason.includes(err.code)) reason = `${err.code}: ${reason}`;
        const where = `${options.host}:${options.qrsPort ?? options.port}`;
        throw new QrsRequestError(`QRS ${method.toUpperCase()} ${path} on ${where} failed: ${reason}`, status, {
            reason,
            hint: qrsErrorHint(options, status, err.code),
        });
    }

    let data = res.data;
    if (typeof data === 'string') {
        try {
            data = data.length ? JSON.parse(data) : null;
        } catch {
            throw new QrsRequestError(`QRS ${method.toUpperCase()} ${path} returned invalid JSON`, res.status);
        }
    }
    const serverDate = res.headers?.date ? Date.parse(res.headers.date) : null;
    return { status: res.status, data, serverDate: Number.isNaN(serverDate) ? null : serverDate };
}
