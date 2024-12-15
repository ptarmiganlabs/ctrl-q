import { jest, test, expect, describe } from '@jest/globals';

import { testConnection } from '../../../lib/cmd/qseow/testconnection.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE,
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
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

// Connection test using cert auth
describe('connection test (cert auth)', () => {
    options.authType = 'cert';
    options.port = '4242';

    test('Verify parameters', async () => {
        expect(options.authType).toBe('cert');
        expect(options.authCertFile).not.toHaveLength(0);
        expect(options.authCertKeyFile).not.toHaveLength(0);
        expect(options.authRootCertFile).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * Do connection test
     * VP = <empty>
     * Should succeed
     */
    test('do connection test (virtual proxy=<empty>)', async () => {
        options.virtualProxy = '';
        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });

    /**
     * Do connection test
     * VP = '/'
     * Should succeed
     */
    test('do connection test (virtual proxy=/)', async () => {
        options.virtualProxy = '/';
        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });
});
