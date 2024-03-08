/* eslint-disable no-console */
import { jest, test, expect, describe } from '@jest/globals';

import testConnection from '../lib/cmd/testconnection.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE,
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

// Connection test using JWT auth
describe('connection test (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

    test('Verify parameters', async () => {
        expect(options.host).not.toHaveLength(0);
        expect(options.port).not.toHaveLength(0);
        expect(options.authJwt).not.toHaveLength(0);
    });

    /**
     * Do connection test
     * VP = 'jwt'
     * Should succeed
     */
    test('do connection test (virtual proxy=jwt)', async () => {
        options.virtualProxy = 'jwt';

        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });

    /**
     * Do connection test
     * VP = 'jwt'
     * Should succeed
     */
    test('do connection test (virtual proxy=/jwt)', async () => {
        options.virtualProxy = '/jwt';

        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });
});
