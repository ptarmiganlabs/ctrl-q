import { jest, test, expect, describe } from '@jest/globals';
import { validate as uuidValidate } from 'uuid';

import { scrambleField } from '../lib/cmd/qseow/scramblefield.js';

let options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    qrsPort: process.env.CTRL_Q_PORT || '4242',
    enginePort: process.env.CTRL_Q_ENGINE_PORT || '4747',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
};

const optionsStart = JSON.parse(JSON.stringify(options));

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 5 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

// Define parameters for coming tests
const existingAppIdExisting1 = '2933711d-6638-41d4-a2d2-6dd2d965208b'; // "Ctrl-Q CLI"
const existingAppIdNonExisting1 = '2933711d-6638-41d4-a2d2-6dd2d965208c';
const existingAppIInvalidGuid1 = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d';

const targetStreamId1 = '9143a1bf-abc3-46f4-8dcb-a1a0ea35860a'; // "Ctrl-Q demo apps"
const targetStreamIdNonExisting1 = '9143a1bf-abc3-46f4-8dcb-a1a0ea35860b';
const targetStreamIdInvalidGuid1 = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3f';
const targetStreamNameExisting1 = 'Ctrl-Q demo apps';
const targetStreamNameNonExisting1 = 'Ctrl-Q demo apps - Non-existing';

const targetAppName1 = '_Ctrl-Q CLI - Scrambled';

const field1 = 'Dim4';
const field2 = 'Dim2';

let createdAppIdUnpublished1;
let createdAppIdPublished1;

// Scramble fields in existing app, no further action
describe('scramble fields, do not publish (cert auth)', () => {
    // Happy path, everything is provided
    test('existing source app ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = '';
        options.newAppName = targetAppName1 + '_first';
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('');
        expect(uuidValidate(result.newAppId)).toBe(true); // App ID should be UUID
        expect(result.status).toBe('success');

        // Save app ID for later use
        createdAppIdUnpublished1 = result.newAppId;
    });

    // Scramble app without specifying any fields
    test('existing source app ID, no fields specified', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = '';
        options.newAppName = targetAppName1;
        options.fieldName = [];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('');
        expect(result.newAppId).toBeUndefined();
        expect(result.status).toBe('error');
    });

    // Scramble app without specifying new app name
    test('existing source app ID, no new app name specified', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = '';
        options.newAppName = '';
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('');
        expect(result.newAppId).toBeUndefined();
        expect(result.status).toBe('error');
    });

    // Scramble app without specifying app ID
    test('no source app ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = '';
        options.newAppCmd = '';
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('');
        expect(result.newAppId).toBeUndefined();
        expect(result.status).toBe('error');
    });

    // Scramble app ID that does not exist
    test('non-existing source app ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdNonExisting1;
        options.newAppCmd = '';
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('');
        expect(result.newAppId).toBeUndefined();
        expect(result.status).toBe('error');
    });

    // Scramble app ID with invalid GUID
    test('source app ID with invalid GUID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIInvalidGuid1;
        options.newAppCmd = '';
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('');
        expect(result.newAppId).toBeUndefined();
        expect(result.status).toBe('error');
    });
});

// Scramble fields in existing app, publish
describe('scramble fields, publish (cert auth)', () => {
    // Scramble app and publish to existing stream ID
    test('existing source app ID, existing stream ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = 'publish';
        options.newAppCmdId = targetStreamId1;
        options.newAppName = targetAppName1 + '_published';
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('publish');
        expect(uuidValidate(result.newAppId)).toBe(true); // App ID should be UUID
        expect(result.status).toBe('success');

        // Save app ID for later use
        createdAppIdPublished1 = result.newAppId;
    });

    // Scramble app and publish to non-existing stream ID
    test('existing source app ID, non-existing stream ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = 'publish';
        options.newAppCmdId = targetStreamIdNonExisting1;
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('publish');
        expect(result.status).toBe('error');
    });

    // Scramble app and publish to stream with invalid GUID
    test('existing source app ID, stream ID with invalid GUID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = 'publish';
        options.newAppCmdId = targetStreamIdInvalidGuid1;
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('publish');
        expect(result.status).toBe('error');
    });

    // Scramble app and publish to existing stream name
    test('existing source app ID, existing stream name', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = 'publish';
        options.newAppCmdName = targetStreamNameExisting1;
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('publish');
        expect(uuidValidate(result.newAppId)).toBe(true); // App ID should be UUID
        expect(result.status).toBe('success');
    });

    // Scramble app and publish to non-existing stream name
    test('existing source app ID, non-existing stream name', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppCmd = 'publish';
        options.newAppCmdName = targetStreamNameNonExisting1;
        options.newAppName = targetAppName1;
        options.fieldName = [field1, field2];

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('publish');
        expect(result.status).toBe('error');
    });
});

// Scramble fields in existing app, replace
describe('scramble fields, replace unpublished (cert auth)', () => {
    // Scramble app and replace existing unpublished app by ID
    test('existing source app ID, existing unpublished app ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppName = targetAppName1;
        options.newAppCmd = 'replace';
        options.newAppCmdId = createdAppIdUnpublished1;
        options.fieldName = [field1, field2];
        options.force = true;

        console.log(options);

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('replace');
        expect(uuidValidate(result.newAppId)).toBe(true); // App ID should be UUID
        expect(result.status).toBe('success');
    });

    // Scramble app and replace existing published app by ID
    test('existing source app ID, existing published app ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppName = targetAppName1;
        options.newAppCmd = 'replace';
        options.newAppCmdId = createdAppIdPublished1;
        options.fieldName = [field1, field2];
        options.force = true;

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('replace');
        expect(uuidValidate(result.newAppId)).toBe(true); // App ID should be UUID
        expect(result.status).toBe('success');
    });

    // Scramble app and replace non-existing app ID
    test('existing source app ID, non-existing app ID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppName = targetAppName1;
        options.newAppCmd = 'replace';
        options.newAppCmdId = existingAppIdNonExisting1;
        options.fieldName = [field1, field2];
        options.force = true;

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('replace');
        expect(result.status).toBe('error');
    });

    // Scramble app and replace app with invalid GUID
    test('existing source app ID, app ID with invalid GUID', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppName = targetAppName1;
        options.newAppCmd = 'replace';
        options.newAppCmdId = existingAppIInvalidGuid1;
        options.fieldName = [field1, field2];
        options.force = true;

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('replace');
        expect(result.status).toBe('error');
    });

    // Scramble app and replace unpublish app by name, only one app with this name exists
    test('existing source app ID, existing unpublished app by name, only one app with this name exists', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppName = targetAppName1;
        options.newAppCmd = 'replace';
        options.newAppCmdName = targetAppName1 + '_first';
        options.fieldName = [field1, field2];
        options.force = true;

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('replace');
        expect(uuidValidate(result.newAppId)).toBe(true); // App ID should be UUID
        expect(result.status).toBe('success');
    });

    // Scramble app and replace app by name, no app with this name exists
    test('existing source app ID, non-existing app by name', async () => {
        // Reset options
        options = JSON.parse(JSON.stringify(optionsStart));

        options.appId = existingAppIdExisting1;
        options.newAppName = targetAppName1;
        options.newAppCmd = 'replace';
        options.newAppCmdName = targetAppName1 + '_non_existing';
        options.fieldName = [field1, field2];
        options.force = true;

        const result = await scrambleField(options);
        expect(result.newAppCmd).toBe('replace');
        expect(result.status).toBe('error');
    });
});

// Scramble fields in existing app, replace published app
describe('scramble fields, replace published (cert auth)', () => {});

// Clean up. Delete created apps.
