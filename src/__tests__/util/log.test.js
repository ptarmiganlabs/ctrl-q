import { jest, test, expect, describe, afterEach } from '@jest/globals';

import { logger, setLoggingLevel } from '../../globals.js';
import { redactOptions, redactAxiosConfig, logStartupInfo } from '../../lib/util/log.js';

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJ1c2VyIjoiZ29yYW4ifQ.c2lnbmF0dXJl';

/**
 * Tests for redaction of credentials before CLI options or request configs are logged.
 */
describe('redactOptions', () => {
    test('replaces JWT, API key and password values', () => {
        const result = redactOptions({ authJwt: JWT, jwt: JWT, apikey: 'abc', password: 'pw', host: 'sense.example.com' });

        expect(result).toEqual({
            authJwt: '<redacted>',
            jwt: '<redacted>',
            apikey: '<redacted>',
            password: '<redacted>',
            host: 'sense.example.com',
        });
    });

    test('keeps certificate file paths, which are not secrets', () => {
        const options = { authCertFile: './cert/client.pem', authCertKeyFile: './cert/client_key.pem' };

        expect(redactOptions(options)).toEqual(options);
    });

    test('leaves empty credential options as they are, so missing values are still visible in logs', () => {
        expect(redactOptions({ authJwt: undefined, jwt: '' })).toEqual({ authJwt: undefined, jwt: '' });
    });

    test('does not modify the original object', () => {
        const options = { authJwt: JWT };
        redactOptions(options);

        expect(options.authJwt).toBe(JWT);
    });

    test('passes non-objects through', () => {
        expect(redactOptions(undefined)).toBeUndefined();
        expect(redactOptions(null)).toBeNull();
    });
});

describe('redactAxiosConfig', () => {
    test('replaces the Authorization header and hides the https agent', () => {
        const config = {
            url: '/qrs/about?xrfkey=abc',
            headers: { Authorization: `Bearer ${JWT}`, 'x-qlik-xrfkey': 'abc' },
            httpsAgent: { options: { key: 'PRIVATE KEY' } },
        };

        const result = redactAxiosConfig(config);

        expect(result.headers.Authorization).toBe('<redacted>');
        expect(result.headers['x-qlik-xrfkey']).toBe('abc');
        expect(result.httpsAgent).toBe('<https agent>');
        expect(JSON.stringify(result)).not.toContain(JWT);
        expect(JSON.stringify(result)).not.toContain('PRIVATE KEY');
    });
});

describe('logStartupInfo', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        setLoggingLevel('info');
    });

    test('never writes the JWT to the log', () => {
        setLoggingLevel('verbose');
        const lines = [];
        for (const level of ['info', 'verbose', 'debug']) {
            jest.spyOn(logger, level).mockImplementation((msg) => lines.push(String(msg)));
        }

        logStartupInfo({ logLevel: 'verbose', host: 'sense.example.com', authType: 'jwt', authJwt: JWT }, 'task-gantt', 'desc');

        const output = lines.join('\n');
        expect(output).toContain('sense.example.com');
        expect(output).toContain('<redacted>');
        expect(output).not.toContain(JWT);
    });
});
