/* eslint-disable no-console */
const { test, expect, describe } = require('@jest/globals');

const { getApps, getAppById } = require('../lib/util/app');

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

    taskType: process.env.CTRL_Q_TASK_TYPE || 'reload',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 5 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

// Mock logger
global.console = {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
};

// Define existing and non-existing tasks
const existingAppId1 = 'c840670c-7178-4a5e-8409-ba2da69127e2';
const existingAppId2 = '3a6c9a53-cb8d-42f3-a8ee-c083c1f8ed8e';
const nonExistingAppId1 = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d';
const tag1 = 'Test data';

// Get one app by ID
describe('getAppById', () => {
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
describe('getApps', () => {
    test('one app ID, no tags', async () => {
        const result = await getApps(options, [existingAppId1]);
        // error(`Result: ${JSON.stringify(result)}`);

        expect(result.length).toBe(1);
        expect(result[0].id).toBe(existingAppId1);
    });

    test('two app IDs, no tags', async () => {
        const result = await getApps(options, [existingAppId1, existingAppId2]);
        // error(`Result: ${JSON.stringify(result)}`);

        expect(result.length).toBe(2);
    });

    test('no app IDs, one tag', async () => {
        const result = await getApps(options, [], [tag1]);
        // error(`Result: ${JSON.stringify(result)}`);

        expect(result.length).toBeGreaterThan(0);
    });
});
