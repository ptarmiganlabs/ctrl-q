/**
 * Unit tests for the --secure option in setupQrsConnection() (src/lib/util/qseow/qrs.js).
 *
 * Every QRS request must check the certificate of the Sense server unless --secure is false, with certificate as well
 * as JWT authentication. Commander passes --secure as the string 'true' or 'false' when it is given on the command line
 * or in CTRLQ_SECURE, and as the boolean true when it is left out.
 */
import { jest, test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// axios must be mocked before the modules that use it are loaded, so they are imported dynamically below. A static
// import would load the real axios first and the mock would never be used.
const axiosRequest = jest.fn();
jest.unstable_mockModule('axios', () => ({
    default: { request: axiosRequest },
    request: axiosRequest,
}));

const { rejectUnauthorized, setupQrsConnection } = await import('../../../lib/util/qseow/qrs.js');
const { testConnection } = await import('../../../lib/cmd/qseow/testconnection.js');

const JWT = 'eyJhbGciOiJSUzI1NiJ9.c2VjcmV0LXBheWxvYWQ.TOP-SECRET-SIGNATURE';

// Certificate authentication reads the client certificate, its key and the root certificate from files
let certDir;

beforeAll(() => {
    certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-q-qrs-secure-'));
    for (const name of ['client.pem', 'client_key.pem', 'root.pem']) {
        fs.writeFileSync(path.join(certDir, name), `test ${name}\n`);
    }
});

afterAll(() => {
    fs.rmSync(certDir, { recursive: true, force: true });
});

/**
 * Options as commander passes them to a command.
 *
 * @param {string} authType - 'cert' or 'jwt'.
 * @param {boolean|string|undefined} secure - Value of --secure; undefined leaves the option out.
 * @returns {object} Options.
 */
function optionsFor(authType, secure) {
    const options = { logLevel: 'error', host: 'qlik.example.com', authType };
    if (secure !== undefined) options.secure = secure;
    if (authType === 'cert') {
        return {
            ...options,
            port: '4242',
            virtualProxy: '',
            authUserDir: 'INTERNAL',
            authUserId: 'sa_api',
            authCertFile: path.join(certDir, 'client.pem'),
            authCertKeyFile: path.join(certDir, 'client_key.pem'),
            authRootCertFile: path.join(certDir, 'root.pem'),
        };
    }
    return { ...options, port: '443', virtualProxy: 'jwt', authJwt: JWT };
}

// [auth type, --secure value, whether the certificate is checked]
const CASES = [
    ['cert', true, true],
    ['cert', 'true', true],
    ['cert', 'false', false],
    ['cert', false, false],
    ['jwt', true, true],
    ['jwt', 'true', true],
    ['jwt', 'false', false],
    ['jwt', false, false],
];

describe('rejectUnauthorized', () => {
    test.each([true, 'true', 'TRUE', undefined, null, '', 'yes', 'no', '0'])('checks certificates for --secure %p', (secure) => {
        expect(rejectUnauthorized({ secure })).toBe(true);
    });

    test.each([false, 'false', 'FALSE', 'False', ' false '])('does not check certificates for --secure %p', (secure) => {
        expect(rejectUnauthorized({ secure })).toBe(false);
    });

    test('checks certificates when --secure is missing', () => {
        expect(rejectUnauthorized({})).toBe(true);
    });
});

describe('setupQrsConnection: https agent', () => {
    test.each(CASES)('%s auth, --secure %p: rejectUnauthorized is %p', (authType, secure, expected) => {
        const config = setupQrsConnection(optionsFor(authType, secure), { method: 'get', path: '/qrs/about' });

        expect(config.httpsAgent.options.rejectUnauthorized).toBe(expected);
    });

    test.each(['cert', 'jwt'])('%s auth checks the certificate when --secure is missing', (authType) => {
        const config = setupQrsConnection(optionsFor(authType, undefined), { method: 'get', path: '/qrs/about' });

        expect(config.httpsAgent.options.rejectUnauthorized).toBe(true);
    });

    test('cert auth still sends the client certificate and checks the server against the root certificate', () => {
        const config = setupQrsConnection(optionsFor('cert', true), { method: 'get', path: '/qrs/about' });

        expect(config.httpsAgent.options).toMatchObject({ cert: 'test client.pem\n', key: 'test client_key.pem\n', ca: 'test root.pem\n' });
        expect(config.headers['X-Qlik-User']).toBe('UserDirectory=INTERNAL;UserId=sa_api');
        expect(config.headers.Authorization).toBeUndefined();
    });

    test('JWT auth sends the bearer token, no client certificate, and checks the server against the CAs Node.js trusts', () => {
        const config = setupQrsConnection(optionsFor('jwt', true), { method: 'get', path: '/qrs/about' });

        expect(config.headers.Authorization).toBe(`Bearer ${JWT}`);
        expect(config.baseURL).toBe('https://qlik.example.com:443');
        expect(config.url).toMatch(/^\/jwt\/qrs\/about\?xrfkey=/);
        expect(config.httpsAgent.options.cert).toBeUndefined();
        expect(config.httpsAgent.options.key).toBeUndefined();
        expect(config.httpsAgent.options.ca).toBeUndefined();
    });
});

describe('https agent of the requests axios sends', () => {
    beforeEach(() => {
        axiosRequest.mockReset();
    });

    test.each(CASES)(
        'testConnection (qseow connection-test), %s auth, --secure %p: rejectUnauthorized is %p',
        async (authType, secure, expected) => {
            axiosRequest.mockResolvedValue({ status: 200, data: '{"buildVersion":"31.62.0.0","buildDate":"5/12/2026"}', headers: {} });

            const about = await testConnection(optionsFor(authType, secure));

            expect(about).toMatchObject({ buildVersion: '31.62.0.0' });
            expect(axiosRequest).toHaveBeenCalledTimes(1);
            expect(axiosRequest.mock.calls[0][0].httpsAgent.options.rejectUnauthorized).toBe(expected);
        }
    );
});
