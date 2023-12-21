/* eslint-disable no-console */
const { test, expect, describe } = require('@jest/globals');

const { importAppFromFile } = require('../lib/cmd/importapp');
const { appExistById, deleteAppById } = require('../lib/util/app');

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

// Test suite for app export
describe('import apps from QVF files (cert auth)', () => {
    test('get tasks (verify parameters)', async () => {
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * One tag, overwrite
     *
     * --file-name ./testdata/tasks.xlsx
     * --sheet-name 'App import'
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
            // eslint-disable-next-line no-await-in-loop
            const appExists = await appExistById(appId, options);

            if (appExists) {
                // Delete app
                // eslint-disable-next-line no-await-in-loop
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
