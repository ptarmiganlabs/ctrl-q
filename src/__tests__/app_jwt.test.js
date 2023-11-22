/* eslint-disable no-console */
const { test, expect, describe } = require('@jest/globals');

const { getApps, getAppById, appExistById, deleteAppById } = require('../lib/util/app');
const { importAppFromFile } = require('../lib/cmd/importapp');
const { sleep } = require('../globals');

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

// Get one app by ID
describe('getAppById (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

    test('existing app ID', async () => {
        const result = await getAppById(existingAppId1, options);
        expect(result.id).toBe(existingAppId1);
    });

    test('non-existing app ID', async () => {
        const result = await getAppById(nonExistingAppId1, options);
        expect(result).toBe(false);
    });
});

// Get one or more apps by ID and/or tag
describe('getApps (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

    test('one app ID, no tags', async () => {
        const result = await getApps(options, [existingAppId1]);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe(existingAppId1);
    });

    test('two app IDs, no tags', async () => {
        const result = await getApps(options, [existingAppId1, existingAppId2]);

        expect(result.length).toBe(2);
    });

    test('no app IDs, one tag', async () => {
        const result = await getApps(options, [], [tag1]);

        expect(result.length).toBeGreaterThan(0);
    });
});

// Delete an app given a valid app ID
describe('deleteAppById (JWT auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';
    options.fileType = 'excel';
    options.fileName = 'testdata/tasks.xlsx';
    options.sheetName = 'App import';
    options.sleepAppUpload = '500';

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
