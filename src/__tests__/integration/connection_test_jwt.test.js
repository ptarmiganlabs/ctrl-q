/**
 * @fileoverview Integration tests for the Ctrl-Q connection test command against Qlik Sense Enterprise (QSEoW) using JWT authentication.
 * @module integration/connection_test_jwt
 *
 * @description
 * Verifies that Ctrl-Q can establish an authenticated connection to the Qlik Sense
 * Repository Service (QRS) via JSON Web Token (JWT) authentication over HTTPS port 443.
 * Two virtual-proxy variants are tested: `"jwt"` and `"/jwt"` (with leading slash).
 * A successful connection must return a JSON object whose `schemaPath` property equals `"About"`.
 * This is the JWT-auth counterpart of `connection_test_cert.test.js`.
 *
 * @requires ../../lib/cmd/qseow/testconnection
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST         – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT         – Overridden to '443' inside the test suite
 * - CTRL_Q_AUTH_TYPE    – Overridden to 'jwt' inside the test suite
 * - CTRL_Q_AUTH_JWT     – Bearer JWT token used for authentication (required)
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID – Qlik user ID (required)
 * - CTRL_Q_SECURE       – Overridden to false inside the test suite
 * - CTRL_Q_LOG_LEVEL    – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 443
 * - A JWT virtual proxy named 'jwt' configured on the server
 * - A valid JWT token issued for a user that exists in the Qlik Sense user directory
 */
import { jest, test, expect, describe } from '@jest/globals';

import { testConnection } from '../../lib/cmd/qseow/testconnection.js';

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

/**
 * Test suite exercising {@link testConnection} with JWT authentication.
 * The `authType` is forced to 'jwt', `port` to '443', `virtualProxy` to 'jwt', and
 * `secure` to false inside the suite so that these values always take precedence over
 * any environment-variable defaults.
 */
describe('connection test (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';
    options.secure = false;

    /**
     * @test Verify parameters
     * @description Pre-flight guard that confirms all required JWT authentication parameters are
     * present before any live network calls are made. Validates that the host, port, and JWT
     * token are all non-empty and that the port is explicitly '443'.
     * Input: options object populated from environment variables
     * Expected: authType === 'jwt', port === '443', host and authJwt are non-empty
     */
    test('Verify parameters', async () => {
        expect(options.authType).toBe('jwt');
        expect(options.host).not.toHaveLength(0);
        expect(options.port).not.toHaveLength(0);
        expect(options.port).toBe('443');
        expect(options.authJwt).not.toHaveLength(0);
    });

    /**
     * @test Connection with 'jwt' virtual proxy
     * @description Calls {@link testConnection} with virtualProxy = 'jwt', verifying the
     * standard JWT virtual proxy path is reachable and returns a valid QRS About response.
     * Input: virtualProxy = 'jwt', authType = 'jwt', port = '443', secure = false
     * Expected: result is a plain Object with schemaPath === 'About'
     */
    test('do connection test (virtual proxy=jwt)', async () => {
        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });

    /**
     * @test Connection with '/jwt' virtual proxy prefix
     * @description Calls {@link testConnection} with virtualProxy = '/jwt' to confirm that a
     * leading-slash prefix is normalised correctly and still resolves to the correct
     * JWT-authenticated QRS /about endpoint.
     * Input: virtualProxy = '/jwt', authType = 'jwt', port = '443', secure = false
     * Expected: result is a plain Object with schemaPath === 'About'
     */
    test('do connection test (virtual proxy=/jwt)', async () => {
        options.virtualProxy = '/jwt';

        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });
});
