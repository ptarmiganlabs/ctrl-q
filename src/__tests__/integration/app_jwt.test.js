/* eslint-disable no-console */
/**
 * @fileoverview Integration tests for Qlik Sense app lookup and deletion utilities using JWT authentication.
 * @module integration/app_jwt
 *
 * @description
 * JWT-authenticated counterpart of `app_cert.test.js`. Exercises `getAppById`, `getApps`,
 * and `deleteAppById` over port 443 via the 'jwt' virtual proxy. Additionally tests the
 * full upload-then-delete lifecycle: apps are imported from the test Excel file and then
 * each created app is verified to exist before being deleted, ensuring the teardown leaves
 * the server in the same state it was found in.
 *
 * @requires ../../lib/util/qseow/app
 * @requires ../../lib/cmd/qseow/importapp
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST          – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT          – Overridden to '443' inside the test suite
 * - CTRL_Q_AUTH_TYPE     – Overridden to 'jwt' inside the test suite
 * - CTRL_Q_AUTH_JWT      – Bearer JWT token used for authentication (required)
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID  – Qlik user ID (required)
 * - CTRL_Q_SCHEMA_VERSION – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE        – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL     – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT  – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 443
 * - A JWT virtual proxy named 'jwt' configured on the server
 * - The following apps must exist on the server:
 *   - existingAppId1: c840670c-7178-4a5e-8409-ba2da69127e2
 *   - existingAppId2: 3a6c9a53-cb8d-42f3-a8ee-c083c1f8ed8e
 * - At least one app tagged 'Test data' must exist on the server
 * - Test data file: testdata/tasks.xlsx with sheet 'App import' containing app import rows
 *
 * @cleanup
 * The `deleteAppById` test uploads apps from testdata/tasks.xlsx and then deletes every
 * uploaded app. The server is left in its original state after the test completes.
 */
import { jest, test, expect, describe } from '@jest/globals';

import { getApps, getAppById, appExistById, deleteAppById } from '../../lib/util/qseow/app.js';
import { importAppFromFile } from '../../lib/cmd/qseow/importapp.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
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
 * Test suite for {@link getAppById} with JWT authentication.
 * Forces authType = 'jwt', port = '443', virtualProxy = 'jwt' for all tests in this group.
 * Validates both existing-app and non-existing-app behaviour.
 */
describe('getAppById (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

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
     * @description Calls {@link getAppById} with a GUID that does not correspond to any app,
     * verifying the function returns false rather than throwing.
     * Input: nonExistingAppId1 = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d'
     * Expected: result === false
     */
    test('non-existing app ID', async () => {
        const result = await getAppById(nonExistingAppId1, options);
        expect(result).toBe(false);
    });
});

/**
 * Test suite for {@link getApps} with JWT authentication.
 * Forces authType = 'jwt', port = '443', virtualProxy = 'jwt' for all tests in this group.
 * Validates array-based app retrieval by GUID list and by tag name.
 */
describe('getApps (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

    /**
     * @test Retrieve a single app by GUID array
     * @description Calls {@link getApps} with an array containing one GUID.
     * Input: appIds = [existingAppId1], tags = []
     * Expected: result.length === 1, result[0].id === existingAppId1
     */
    test('one app ID, no tags', async () => {
        const result = await getApps(options, [existingAppId1]);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe(existingAppId1);
    });

    /**
     * @test Retrieve two apps by GUID array
     * @description Calls {@link getApps} with an array of two GUIDs.
     * Input: appIds = [existingAppId1, existingAppId2], tags = []
     * Expected: result.length === 2
     */
    test('two app IDs, no tags', async () => {
        const result = await getApps(options, [existingAppId1, existingAppId2]);

        expect(result.length).toBe(2);
    });

    /**
     * @test Retrieve apps by tag name
     * @description Calls {@link getApps} with an empty GUID array but one tag name.
     * Input: appIds = [], tags = ['Test data']
     * Expected: result.length > 0
     */
    test('no app IDs, one tag', async () => {
        const result = await getApps(options, [], [tag1]);

        expect(result.length).toBeGreaterThan(0);
    });
});

/**
 * Test suite for app deletion via {@link deleteAppById} with JWT authentication.
 * Performs a full upload-then-delete lifecycle using the test Excel file as the import source.
 * Forces authType = 'jwt', port = '443', virtualProxy = 'jwt', fileType = 'excel'.
 */
describe('deleteAppById (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';
    options.fileType = 'excel';
    options.fileName = 'testdata/tasks.xlsx';
    options.sheetName = 'App import';
    options.sleepAppUpload = '500';

    /**
     * @test Upload apps from Excel then delete each uploaded app
     * @description Imports apps from the 'App import' sheet of testdata/tasks.xlsx, then
     * iterates over every created app, verifies it exists via {@link appExistById}, and
     * deletes it via {@link deleteAppById}. Ensures no orphaned apps remain after the test.
     * Input: testdata/tasks.xlsx sheet 'App import', sleepAppUpload = '500' ms between uploads
     * Expected: importAppFromFile returns appList with length > 0; each app that exists is
     *   successfully deleted (deleteAppById returns true); apps that do not exist are skipped
     */
    test('upload a few apps, then delete them', async () => {
        // Upload apps
        let result = await importAppFromFile(options);
        expect(result.appList.length).toBeGreaterThan(0);

        // console.log('Sleeping 10 seconds');
        // await sleep(10000);
        // console.log('Done sleeping');

        // Loop over all apps in the appList
        for (let i = 0; i < result.appList.length; ) {
            // id of uploaded app
            const appId = result.appList[i].appComplete.createdAppId;
            // console.log(`App ID: ${appId}`);

            // Check if app exists
            const appExists = await appExistById(appId, options);

            if (appExists) {
                // Delete app
                const resultDelete = await deleteAppById(appId, options);
                expect(resultDelete).toBe(true);
            } else {
                // App does not exist
                expect(appExists).toBe(false);
                // console.log(`App ${appId} does not exist in Sense. Skipping delete.`);
            }
            i += 1;
        }
    });
});
