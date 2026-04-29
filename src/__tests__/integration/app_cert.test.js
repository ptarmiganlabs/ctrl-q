/* eslint-disable no-console */
/**
 * @fileoverview Integration tests for Qlik Sense app lookup utilities using certificate authentication.
 * @module integration/app_cert
 *
 * @description
 * Exercises the `getAppById` and `getApps` helper functions from the QSEoW app utility
 * module. Tests cover retrieving a single app by GUID, looking up multiple apps by their
 * GUIDs, and filtering apps by a tag name. Both positive (existing app) and negative
 * (non-existing app) scenarios are included.
 *
 * @requires ../../lib/util/qseow/app
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST               – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT               – QRS port (default: '4242')
 * - CTRL_Q_AUTH_TYPE          – Authentication type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Path to client certificate PEM (default: './cert/client.pem')
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Path to client private-key PEM (default: './cert/client_key.pem')
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Path to root/CA certificate PEM (default: './cert/root.pem')
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_SCHEMA_VERSION     – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE             – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 4242
 * - The following apps must exist on the server:
 *   - existingAppId1: c840670c-7178-4a5e-8409-ba2da69127e2
 *   - existingAppId2: 3a6c9a53-cb8d-42f3-a8ee-c083c1f8ed8e
 * - At least one app tagged with 'Test data' must exist on the server
 */
import { jest, test, expect, describe } from '@jest/globals';

import { getApps, getAppById } from '../../lib/util/qseow/app.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || 'reload',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 5 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

// Mock logger
// global.console = {
//     log: jest.fn(),
//     info: jest.fn(),
//     error: jest.fn(),
// };

// Define existing and non-existing tasks
const existingAppId1 = 'c840670c-7178-4a5e-8409-ba2da69127e2';
const existingAppId2 = '3a6c9a53-cb8d-42f3-a8ee-c083c1f8ed8e';
const nonExistingAppId1 = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d';
const tag1 = 'Test data';

/**
 * Test suite for {@link getAppById} with certificate authentication.
 * Retrieves a single app by its GUID and validates the returned object, as well as
 * the false-return behaviour when the GUID does not exist.
 */
describe('getAppById (cert auth)', () => {
    /**
     * @test Retrieve app by known existing GUID
     * @description Calls {@link getAppById} with a GUID that is known to exist on the server.
     * Input: existingAppId1 = 'c840670c-7178-4a5e-8409-ba2da69127e2'
     * Expected: result.id === existingAppId1
     */
    test('existing app ID', async () => {
        const result = await getAppById(existingAppId1, options);
        expect(result.id).toBe(existingAppId1);
    });

    /**
     * @test Retrieve app by non-existing GUID
     * @description Calls {@link getAppById} with a GUID that does not correspond to any app
     * on the server, verifying the function returns false rather than throwing.
     * Input: nonExistingAppId1 = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d'
     * Expected: result === false
     */
    test('non-existing app ID', async () => {
        const result = await getAppById(nonExistingAppId1, options);
        expect(result).toBe(false);
    });
});

/**
 * Test suite for {@link getApps} with certificate authentication.
 * Retrieves one or more apps by GUID list and/or tag name.
 * Validates that the returned array contains the expected number of apps.
 */
describe('getApps (cert auth)', () => {
    /**
     * @test Retrieve a single app by GUID array
     * @description Calls {@link getApps} with an array containing one GUID, verifying that
     * exactly one app is returned and its id matches the requested GUID.
     * Input: appIds = [existingAppId1], tags = []
     * Expected: result.length === 1, result[0].id === existingAppId1
     */
    test('one app ID, no tags', async () => {
        const result = await getApps(options, [existingAppId1]);
        // error(`Result: ${JSON.stringify(result)}`);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe(existingAppId1);
    });

    /**
     * @test Retrieve two apps by GUID array
     * @description Calls {@link getApps} with an array of two GUIDs, verifying that
     * both apps are returned.
     * Input: appIds = [existingAppId1, existingAppId2], tags = []
     * Expected: result.length === 2
     */
    test('two app IDs, no tags', async () => {
        const result = await getApps(options, [existingAppId1, existingAppId2]);
        // error(`Result: ${JSON.stringify(result)}`);

        expect(result.length).toBe(2);
    });

    /**
     * @test Retrieve apps by tag name
     * @description Calls {@link getApps} with an empty GUID array but one tag name, verifying
     * that at least one app tagged with 'Test data' is returned.
     * Input: appIds = [], tags = ['Test data']
     * Expected: result.length > 0
     */
    test('no app IDs, one tag', async () => {
        const result = await getApps(options, [], [tag1]);
        // error(`Result: ${JSON.stringify(result)}`);

        expect(result.length).toBeGreaterThan(0);
    });
});
