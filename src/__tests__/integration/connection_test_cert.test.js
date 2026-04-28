/**
 * @fileoverview Integration tests for the Ctrl-Q connection test command against Qlik Sense Enterprise (QSEoW) using certificate authentication.
 * @module integration/connection_test_cert
 *
 * @description
 * Verifies that Ctrl-Q can establish an authenticated connection to the Qlik Sense
 * Repository Service (QRS) using X.509 certificate-based authentication.
 * Two virtual-proxy variants are tested: an empty prefix and a single-slash ("/") prefix.
 * A successful connection must return a JSON object whose `schemaPath` property equals `"About"`.
 *
 * @requires ../../lib/cmd/qseow/testconnection
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST               – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT               – QRS port; overridden to '4242' inside the test suite
 * - CTRL_Q_AUTH_TYPE          – Authentication type; overridden to 'cert' inside the test suite
 * - CTRL_Q_AUTH_CERT_FILE     – Path to client certificate PEM (default: './cert/client.pem')
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Path to client private-key PEM (default: './cert/client_key.pem')
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Path to root/CA certificate PEM (default: './cert/root.pem')
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_SECURE             – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 4242
 * - Valid client certificate, private key, and root CA certificate files at the configured paths
 * - The Qlik user identified by CTRL_Q_AUTH_USER_DIR / CTRL_Q_AUTH_USER_ID must exist on the server
 */
import { jest, test, expect, describe } from '@jest/globals';

import { testConnection } from '../../lib/cmd/qseow/testconnection.js';

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

/**
 * Test suite exercising {@link testConnection} with certificate authentication.
 * The `authType` is forced to 'cert' and `port` to '4242' inside the suite so that
 * these values always take precedence over any environment-variable defaults.
 */
describe('connection test (cert auth)', () => {
    options.authType = 'cert';
    options.port = '4242';

    /**
     * @test Verify parameters
     * @description Pre-flight guard that confirms all required authentication parameters are
     * present and non-empty before any live network calls are made. Fails fast if the test
     * environment is misconfigured, preventing misleading failures in subsequent tests.
     * Input: options object populated from environment variables
     * Expected: authType === 'cert'; cert/key/root file paths, host, user-dir, and user-id are all non-empty strings
     */
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
     * @test Connection with empty virtual proxy
     * @description Calls {@link testConnection} with an empty virtual-proxy string, verifying that
     * the default (no virtual-proxy prefix) QRS endpoint is reachable via certificate auth.
     * Input: virtualProxy = '' (empty string), authType = 'cert', port = '4242'
     * Expected: result is a plain Object with schemaPath === 'About'
     */
    test('do connection test (virtual proxy=<empty>)', async () => {
        options.virtualProxy = '';
        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });

    /**
     * @test Connection with '/' virtual proxy prefix
     * @description Calls {@link testConnection} with virtualProxy set to '/' to confirm that a
     * bare-slash prefix is normalised correctly and still resolves to the QRS /about endpoint.
     * Input: virtualProxy = '/', authType = 'cert', port = '4242'
     * Expected: result is a plain Object with schemaPath === 'About'
     */
    test('do connection test (virtual proxy=/)', async () => {
        options.virtualProxy = '/';
        const result = await testConnection(options);

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.schemaPath).toBe('About');
    });
});
