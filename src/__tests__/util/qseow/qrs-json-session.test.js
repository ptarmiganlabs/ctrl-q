/**
 * Unit tests for the reuse of the proxy session by qrsRequestJson() (src/lib/util/qseow/qrs-json.js) with JWT
 * authentication: the JWT is only sent to log in, later requests send the proxy's session cookie instead, and a 401
 * (the session has ended) makes Ctrl-Q log in with the JWT again.
 */
import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'node:url';

// axios must be mocked before qrs-json.js is loaded, so it is imported dynamically below. A static import would load
// the real axios first and the mock would never be used.
const axiosRequest = jest.fn();
jest.unstable_mockModule('axios', () => ({
    default: { request: axiosRequest },
    request: axiosRequest,
}));

const { qrsRequestJson, proxySessionCookies, QrsRequestError } = await import('../../../lib/util/qseow/qrs-json.js');

const JWT = 'eyJhbGciOiJSUzI1NiJ9.c2VjcmV0LXBheWxvYWQ.TOP-SECRET-SIGNATURE';
const SESSION_1 = 'X-Qlik-Session-jwt=8d6f2b1c-0000-4000-8000-000000000001';
const SESSION_2 = 'X-Qlik-Session-jwt=8d6f2b1c-0000-4000-8000-000000000002';

// A new options object per test: the proxy session is kept per options object
const jwtOptions = () => ({ host: 'qlik.example.com', qrsPort: '443', virtualProxy: 'jwt', secure: true, authType: 'jwt', authJwt: JWT });

const ok = (data, cookie) => ({
    status: 200,
    data: JSON.stringify(data),
    headers: cookie ? { 'set-cookie': [`${cookie}; Path=/; HttpOnly; SameSite=None; Secure`] } : {},
});

// Shaped like an AxiosError with a response
const httpError = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, headers: {} } });

// What each request sent: the JWT, the session cookie, both or neither
const sent = () =>
    axiosRequest.mock.calls.map(([config]) => {
        if (config.headers.Authorization && config.headers.Cookie) return 'jwt+cookie';
        if (config.headers.Authorization) return config.headers.Authorization === `Bearer ${JWT}` ? 'jwt' : 'wrong-jwt';
        return config.headers.Cookie ?? 'nothing';
    });

/**
 * A promise and the functions that settle it, to control when a mocked response arrives.
 *
 * @returns {{promise: Promise, resolve: Function, reject: Function}} Deferred.
 */
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    axiosRequest.mockReset();
});

describe('proxySessionCookies', () => {
    test('keeps the name and value of every cookie a response sets, without their attributes', () => {
        const headers = { 'set-cookie': ['BIGipServer=1234.5678.0000; Path=/', `${SESSION_1}; Path=/; HttpOnly; SameSite=None; Secure`] };

        expect(proxySessionCookies(headers)).toBe(`BIGipServer=1234.5678.0000; ${SESSION_1}`);
    });

    test('keeps a session cookie whatever the admin named it, also from a single header given as a string', () => {
        expect(proxySessionCookies({ 'set-cookie': ['X-Qlik-Session=abc; Path=/'] })).toBe('X-Qlik-Session=abc');
        expect(proxySessionCookies({ 'set-cookie': 'SenseJwtSession=def; Path=/jwt' })).toBe('SenseJwtSession=def');
    });

    test('keeps the last value of a cookie that is set twice', () => {
        expect(proxySessionCookies({ 'set-cookie': ['X-Qlik-Session-jwt=old', 'X-Qlik-Session-jwt=new'] })).toBe('X-Qlik-Session-jwt=new');
    });

    test('returns null when the response sets no cookie, or only deletes one', () => {
        expect(proxySessionCookies({})).toBeNull();
        expect(proxySessionCookies(undefined)).toBeNull();
        expect(proxySessionCookies({ 'set-cookie': [] })).toBeNull();
        expect(proxySessionCookies({ 'set-cookie': ['X-Qlik-Session-jwt=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'] })).toBeNull();
        expect(proxySessionCookies({ 'set-cookie': ['X-Qlik-Session-jwt'] })).toBeNull();
    });
});

describe('qrsRequestJson: proxy session of JWT connections', () => {
    test('sends the JWT only to log in, then the session cookie instead', async () => {
        axiosRequest.mockResolvedValueOnce(ok([1], SESSION_1)).mockResolvedValue(ok([2]));
        const options = jwtOptions();

        expect((await qrsRequestJson(options, { path: '/qrs/task/full' })).data).toEqual([1]);
        expect((await qrsRequestJson(options, { path: '/qrs/executionresult/full' })).data).toEqual([2]);
        await qrsRequestJson(options, { path: '/qrs/executionsession/full' });

        expect(sent()).toEqual(['jwt', SESSION_1, SESSION_1]);
        // Everything else about the request stays as setupQrsConnection() made it
        const [login, reuse] = axiosRequest.mock.calls.map(([config]) => config);
        expect(reuse.url).toMatch(/^\/jwt\/qrs\/executionresult\/full\?xrfkey=/);
        expect(reuse.headers['x-qlik-xrfkey']).toMatch(/^[A-Za-z0-9]{16}$/);
        expect(reuse.httpsAgent.options).toEqual(login.httpsAgent.options);
        expect(login.headers.Cookie).toBeUndefined();
    });

    test('sends back all cookies of the login, whatever the session cookie is named', async () => {
        axiosRequest
            .mockResolvedValueOnce({
                status: 200,
                data: '[]',
                headers: { 'set-cookie': ['BIGipServer=1234.5678.0000; Path=/', 'SenseJwtSession=abc; Path=/jwt; HttpOnly; Secure'] },
            })
            .mockResolvedValue(ok([]));
        const options = jwtOptions();

        await qrsRequestJson(options, { path: '/qrs/a' });
        await qrsRequestJson(options, { path: '/qrs/b' });

        expect(sent()).toEqual(['jwt', 'BIGipServer=1234.5678.0000; SenseJwtSession=abc']);
    });

    test('logs in with the JWT again when the session has ended (401), and keeps the new session', async () => {
        axiosRequest
            .mockResolvedValueOnce(ok([1], SESSION_1))
            .mockRejectedValueOnce(httpError(401))
            .mockResolvedValueOnce(ok([2], SESSION_2))
            .mockResolvedValue(ok([3]));
        const options = jwtOptions();

        await qrsRequestJson(options, { path: '/qrs/task/full' });
        expect((await qrsRequestJson(options, { path: '/qrs/task/full' })).data).toEqual([2]);
        expect((await qrsRequestJson(options, { path: '/qrs/task/full' })).data).toEqual([3]);

        expect(sent()).toEqual(['jwt', SESSION_1, 'jwt', SESSION_2]);
    });

    test('gives up after one new login: a JWT that is rejected is an error, not a loop', async () => {
        axiosRequest.mockResolvedValueOnce(ok([1], SESSION_1)).mockRejectedValue(httpError(401));
        const options = jwtOptions();
        await qrsRequestJson(options, { path: '/qrs/task/full' });

        const err = await qrsRequestJson(options, { path: '/qrs/task/full' }).catch((e) => e);

        expect(err).toBeInstanceOf(QrsRequestError);
        expect(err.status).toBe(401);
        expect(err.hint).toMatch(/JWT is valid and not expired/);
        expect(sent()).toEqual(['jwt', SESSION_1, 'jwt']);
    });

    test('a rejected JWT at the first request is sent once', async () => {
        axiosRequest.mockRejectedValue(httpError(401));

        await expect(qrsRequestJson(jwtOptions(), { path: '/qrs/task/full' })).rejects.toMatchObject({ status: 401 });

        expect(sent()).toEqual(['jwt']);
    });

    test('keeps the session on other errors (403, network), without sending the JWT again', async () => {
        axiosRequest
            .mockResolvedValueOnce(ok([1], SESSION_1))
            .mockRejectedValueOnce(httpError(403))
            .mockRejectedValueOnce(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))
            .mockResolvedValue(ok([2]));
        const options = jwtOptions();
        await qrsRequestJson(options, { path: '/qrs/task/full' });

        await expect(qrsRequestJson(options, { path: '/qrs/task/full' })).rejects.toMatchObject({ status: 403 });
        await expect(qrsRequestJson(options, { path: '/qrs/task/full' })).rejects.toMatchObject({ reason: 'ECONNRESET: socket hang up' });
        await qrsRequestJson(options, { path: '/qrs/task/full' });

        expect(sent()).toEqual(['jwt', SESSION_1, SESSION_1, SESSION_1]);
    });

    test('parallel requests wait for the login, so that they share its session', async () => {
        const login = deferred();
        axiosRequest.mockImplementationOnce(() => login.promise).mockResolvedValue(ok([2]));
        const options = jwtOptions();

        const all = Promise.all(
            ['/qrs/task/full', '/qrs/schedulerservice/full', '/qrs/servicecluster/full'].map((path) => qrsRequestJson(options, { path }))
        );
        await Promise.resolve();
        expect(sent()).toEqual(['jwt']);
        login.resolve(ok([1], SESSION_1));
        await all;

        expect(sent()).toEqual(['jwt', SESSION_1, SESSION_1]);
    });

    test('parallel requests that find the session ended log in once', async () => {
        axiosRequest.mockResolvedValueOnce(ok([1], SESSION_1));
        const options = jwtOptions();
        await qrsRequestJson(options, { path: '/qrs/task/full' });

        const relogin = deferred();
        axiosRequest.mockImplementation(async (config) => {
            if (config.headers.Cookie === SESSION_1) throw httpError(401);
            if (config.headers.Authorization) return relogin.promise;
            return ok(['new session']);
        });
        const all = Promise.all([qrsRequestJson(options, { path: '/qrs/a' }), qrsRequestJson(options, { path: '/qrs/b' })]);
        await new Promise((resolve) => setImmediate(resolve));
        relogin.resolve(ok(['relogin'], SESSION_2));
        const results = await all;

        expect(sent().filter((s) => s === 'jwt')).toHaveLength(2); // the first login and one new login
        expect(sent().slice(1)).toEqual([SESSION_1, SESSION_1, 'jwt', SESSION_2]);
        expect(results.flatMap((r) => r.data).sort()).toEqual(['new session', 'relogin']);
    });

    test('a request waiting for a login that fails logs in itself', async () => {
        const login = deferred();
        axiosRequest.mockImplementationOnce(() => login.promise).mockResolvedValue(ok([2], SESSION_2));
        const options = jwtOptions();

        const first = qrsRequestJson(options, { path: '/qrs/a' }).catch((e) => e);
        const second = qrsRequestJson(options, { path: '/qrs/b' });
        login.reject(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }));

        expect(await first).toBeInstanceOf(QrsRequestError);
        expect((await second).data).toEqual([2]);
        expect(sent()).toEqual(['jwt', 'jwt']);
    });

    test('keeps sending the JWT when the proxy sets no session cookie, as before', async () => {
        axiosRequest.mockResolvedValue(ok([1]));
        const options = jwtOptions();

        await qrsRequestJson(options, { path: '/qrs/a' });
        await qrsRequestJson(options, { path: '/qrs/b' });

        expect(sent()).toEqual(['jwt', 'jwt']);
    });

    test('keeps one session per options object', async () => {
        axiosRequest
            .mockResolvedValueOnce(ok([1], SESSION_1))
            .mockResolvedValueOnce(ok([2], SESSION_2))
            .mockResolvedValue(ok([3]));
        const first = jwtOptions();
        const second = jwtOptions();

        await qrsRequestJson(first, { path: '/qrs/a' });
        await qrsRequestJson(second, { path: '/qrs/a' });
        await qrsRequestJson(first, { path: '/qrs/b' });
        await qrsRequestJson(second, { path: '/qrs/b' });

        expect(sent()).toEqual(['jwt', 'jwt', SESSION_1, SESSION_2]);
    });

    test('certificate authentication never sends a cookie', async () => {
        axiosRequest.mockResolvedValue(ok([1], SESSION_1));
        // setupQrsConnection reads the certificate files; any readable file will do, as axios is mocked
        const anyFile = fileURLToPath(import.meta.url);
        const options = {
            host: 'qlik.example.com',
            qrsPort: '4242',
            virtualProxy: '',
            secure: 'false',
            authType: 'cert',
            authUserDir: 'INTERNAL',
            authUserId: 'sa_api',
            authCertFile: anyFile,
            authCertKeyFile: anyFile,
            authRootCertFile: anyFile,
        };

        await qrsRequestJson(options, { path: '/qrs/a' });
        await qrsRequestJson(options, { path: '/qrs/b' });

        expect(sent()).toEqual(['nothing', 'nothing']);
        expect(axiosRequest.mock.calls[1][0].headers['X-Qlik-User']).toBe('UserDirectory=INTERNAL;UserId=sa_api');
    });

    test('errors never show the session cookie or the JWT', async () => {
        axiosRequest.mockResolvedValueOnce(ok([1], SESSION_1)).mockImplementation(async (config) => {
            const e = httpError(config.headers.Cookie ? 401 : 403);
            e.config = config;
            e.request = {
                _header: `GET ${config.url} HTTP/1.1\r\nCookie: ${config.headers.Cookie}\r\nAuthorization: ${config.headers.Authorization}\r\n`,
            };
            throw e;
        });
        const options = jwtOptions();
        await qrsRequestJson(options, { path: '/qrs/task/full' });

        const err = await qrsRequestJson(options, { path: '/qrs/task/full' }).catch((e) => e);

        expect(err).toMatchObject({ name: 'QrsRequestError', status: 403 });
        for (const text of [err.message, String(err), err.stack, JSON.stringify(err)]) {
            expect(text).not.toContain(SESSION_1.split('=')[1]);
            expect(text).not.toContain(JWT);
        }
    });
});
