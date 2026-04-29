/**
 * @fileoverview Integration tests for retrieving a Qlik Sense app load script using JWT authentication.
 * @module integration/script_get_jwt
 *
 * @description
 * JWT-authenticated counterpart of `script_get_cert.test.js`. Exercises `getScript` over
 * port 443 via the 'jwt' virtual proxy against the same reference test app, asserting
 * identical field values (app GUID, creation/modification timestamps, script length 1989).
 *
 * @requires ../../lib/cmd/qseow/getscript
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST          – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT          – Overridden to '443' inside the test suite
 * - CTRL_Q_AUTH_TYPE     – Overridden to 'jwt' inside the test suite
 * - CTRL_Q_AUTH_JWT      – Bearer JWT token used for authentication (required)
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID  – Qlik user ID (required)
 * - CTRL_Q_APP_ID        – App GUID (default: 'a3e0f5d2-000a-464f-998d-33d333b175d7')
 * - CTRL_Q_SCHEMA_VERSION – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE        – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL     – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT  – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 443
 * - A JWT virtual proxy named 'jwt' configured on the server
 * - App 'a3e0f5d2-000a-464f-998d-33d333b175d7' must exist with its load script unchanged
 */
import { jest, test, expect, describe } from '@jest/globals';

import { getScript } from '../../lib/cmd/qseow/getscript.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4747',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    appId: process.env.CTRL_Q_APP_ID || 'a3e0f5d2-000a-464f-998d-33d333b175d7',
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

/**
 * Test suite for {@link getScript} with JWT authentication.
 * Forces authType = 'jwt', port = '443', virtualProxy = 'jwt' inside the suite.
 */
describe('get app script (jwt auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

    /**
     * @test Verify parameters
     * @description Pre-flight guard confirming host, user-dir, and user-id are non-empty.
     * Input: options with authType='jwt', port='443', virtualProxy='jwt'
     * Expected: host, authUserDir, and authUserId are all non-empty
     */
    test('Verify parameters', async () => {
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Retrieve and validate app load script (JWT)
     * @description Calls {@link getScript} with JWT auth for the reference test app and
     * asserts identical field values as the cert variant.
     * Input: appId='a3e0f5d2-000a-464f-998d-33d333b175d7', authType='jwt', port='443', virtualProxy='jwt'
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
