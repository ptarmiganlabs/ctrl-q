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
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'Check the host name in --host';
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'Sense did not answer in time. Check --host, --qrs-port and firewalls';
    return '';
}

/**
 * Send a request to the Qlik Sense Repository Service and parse the JSON response.
 *
 * Wraps setupQrsConnection() (cert or JWT auth, xrfkey, virtual proxy). Unlike calling setupQrsConnection directly,
 * query parameter values are URL-encoded here, and errors never include request headers (which may hold a JWT).
 *
 * @param {object} options - Ctrl-Q options (host, qrsPort/port, auth...).
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
        res = await axios.request(config);
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
