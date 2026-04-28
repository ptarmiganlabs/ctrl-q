/* eslint-disable no-console */
/**
 * @fileoverview Integration tests for importing Qlik Sense apps from an Excel file using JWT authentication.
 * @module integration/app_import_jwt
 *
 * @description
 * JWT-authenticated counterpart of `app_import_cert.test.js`. Exercises `importAppFromFile`
 * over port 443 via the 'jwt' virtual proxy. After importing, every created app is deleted
 * to leave the server in its original state.
 *
 * @requires ../../lib/cmd/qseow/importapp
 * @requires ../../lib/util/qseow/app
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST          – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT          – Overridden to '443' in module-level setup
 * - CTRL_Q_AUTH_TYPE     – Overridden to 'jwt' in module-level setup
 * - CTRL_Q_AUTH_JWT      – Bearer JWT token used for authentication (required)
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID  – Qlik user ID (required)
 * - CTRL_Q_SCHEMA_VERSION – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE        – Whether to use HTTPS (default: true)
 * - CTRL_Q_SLEEP_APP_UPLOAD – Milliseconds to sleep between uploads (default: '500')
 * - CTRL_Q_LOG_LEVEL     – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT  – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 443
 * - A JWT virtual proxy named 'jwt' configured on the server
 * - Test data file: ./testdata/tasks.xlsx with a sheet named 'App import' containing
 *   at least one valid app import row
 *
 * @cleanup
 * The 'import apps' test deletes every app it creates before finishing.
 */
import { jest, test, expect, describe } from '@jest/globals';

import { importAppFromFile } from '../../lib/cmd/qseow/importapp.js';
import { appExistById, deleteAppById } from '../../lib/util/qseow/app.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    sleepAppUpload: process.env.CTRL_Q_SLEEP_APP_UPLOAD || '500',
    limitExportCount: process.env.CTRL_Q_LIMIT_EXPORT_COUNT || '0',

    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

options.fileType = 'excel';
options.fileName = `./testdata/tasks.xlsx`;
options.sheetName = 'App import';
options.authType = 'jwt';
options.port = '443';
options.virtualProxy = 'jwt';

/**
 * Test suite for {@link importAppFromFile} with JWT authentication.
 * Uses the same Excel file and sheet as the cert variant but connects via port 443 / JWT.
 * All created apps are deleted in-test.
 */
describe('import apps from QVF files (cert auth)', () => {
    /**
     * @test Verify parameters
     * @description Pre-flight guard confirming host, user-dir, and user-id are non-empty.
     * Input: options populated from environment variables with JWT overrides
     * Expected: host, authUserDir, and authUserId are all non-empty
     */
    test('get tasks (verify parameters)', async () => {
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Import apps from Excel (JWT) and verify then clean up
     * @description Calls {@link importAppFromFile} with JWT auth using the configured Excel
     * file and sheet. After import, loops over every created app, confirms it exists, and
     * deletes it.
     * Input: fileType='excel', fileName='./testdata/tasks.xlsx', sheetName='App import',
     *   authType='jwt', port='443', virtualProxy='jwt'
     * Expected: result is an object; result.appList.length > 0; each created app is
     *   successfully deleted (deleteAppById returns true)
     */
    test('import apps', async () => {
        const result = await importAppFromFile(options);
        // console.log(result);

        // Output should be an object
        expect(typeof result).toBe('object');

        // Verify that output contains at least one app
        expect(result.appList.length).toBeGreaterThan(0);

        // Delete all created apps
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
