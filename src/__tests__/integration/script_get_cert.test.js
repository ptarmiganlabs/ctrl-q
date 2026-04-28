/**
 * @fileoverview Integration tests for retrieving a Qlik Sense app load script using certificate authentication.
 * @module integration/script_get_cert
 *
 * @description
 * Exercises `getScript` against a known test app and validates specific properties of the
 * returned script object: the app GUID, the creation and last-modified timestamps, and the
 * exact character length of the load script (1989 characters). Pinning the script length
 * detects unintended modifications to the reference test app.
 *
 * @requires ../../lib/cmd/qseow/getscript
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST               – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT               – Engine port (default: '4747')
 * - CTRL_Q_AUTH_TYPE          – Authentication type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Path to client certificate PEM (default: './cert/client.pem')
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Path to client private-key PEM (default: './cert/client_key.pem')
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Path to root/CA certificate PEM (default: './cert/root.pem')
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_APP_ID             – App GUID (default: 'a3e0f5d2-000a-464f-998d-33d333b175d7')
 * - CTRL_Q_SCHEMA_VERSION     – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE             – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on Engine port 4747
 * - App 'a3e0f5d2-000a-464f-998d-33d333b175d7' must exist with its load script unchanged:
 *   created 2021-06-03T22:04:52.283Z, last modified 2024-03-20T08:02:25.153Z, script length 1989 chars
 */
import { jest, test, expect, describe } from '@jest/globals';

import { getScript } from '../../lib/cmd/qseow/getscript.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4747',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    appId: process.env.CTRL_Q_APP_ID || 'a3e0f5d2-000a-464f-998d-33d333b175d7',
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

/**
 * Test suite for {@link getScript} with certificate authentication.
 */
describe('get app script (cert auth)', () => {
    /**
     * @test Verify parameters
     * @description Pre-flight guard confirming all required certificate authentication
     * parameters are non-empty.
     * Input: options populated from environment variables
     * Expected: cert file paths, host, user-dir, and user-id are all non-empty
     */
    test('Verify parameters', async () => {
        expect(options.authCertFile).not.toHaveLength(0);
        expect(options.authCertKeyFile).not.toHaveLength(0);
        expect(options.authRootCertFile).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Retrieve and validate app load script
     * @description Calls {@link getScript} for the configured app and asserts specific
     * field values to detect any unintended modifications to the reference test app.
     * Input: appId='a3e0f5d2-000a-464f-998d-33d333b175d7', authType='cert', port='4747'
     * Expected: result.appId === 'a3e0f5d2-000a-464f-998d-33d333b175d7';
     *   result.appCreatedDate === '2021-06-03T22:04:52.283Z';
     *   result.appModifiedDate === '2024-03-20T08:02:25.153Z';
     *   result.appScript.length === 1989
     */
    test('get app script', async () => {
        const result = await getScript(options);

        expect(result.appId).toBe('a3e0f5d2-000a-464f-998d-33d333b175d7');
        expect(result.appCreatedDate).toBe('2021-06-03T22:04:52.283Z');
        expect(result.appModifiedDate).toBe('2024-03-20T08:02:25.153Z');
        expect(result.appScript.length).toBe(1989);
    });
});
