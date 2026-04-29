/**
 * @fileoverview Integration tests for scrambling field values in Qlik Sense apps using certificate authentication.
 * @module integration/app_scramble_cert
 *
 * @description
 * Exercises `scrambleField`, which creates a copy of an existing app with specified field
 * values replaced by scrambled (anonymised) data. Tests cover the happy path (successful
 * scramble without post-processing), error paths (missing fields, missing app name, missing
 * app ID, non-existing app ID, invalid GUID), and post-scramble actions (publish to stream
 * by ID or name, replace an existing unpublished app by ID or name, replace a published
 * app by ID). A shared `createdAppIdUnpublished1` / `createdAppIdPublished1` variable
 * captures the GUID of apps created by earlier tests for reuse in later replace tests.
 *
 * @requires ../../lib/cmd/qseow/scramblefield
 * @requires uuid
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST               – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT               – QRS port (qrsPort, default: '4242')
 * - CTRL_Q_ENGINE_PORT        – Engine port (default: '4747')
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
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on QRS port 4242 / Engine port 4747
 * - Source app '2933711d-6638-41d4-a2d2-6dd2d965208b' ("Ctrl-Q CLI") with fields 'Dim4' and 'Dim2'
 * - Stream '9143a1bf-abc3-46f4-8dcb-a1a0ea35860a' ("Ctrl-Q demo apps") must exist for publish tests
 *
 * @cleanup
 * Apps created during 'do not publish' and 'publish' tests are reused by 'replace' tests.
 * The suite does not explicitly delete them; manual cleanup may be required if tests fail
 * partway through. The empty 'replace published' describe block is a placeholder for
 * future tests.
 */
import { jest, test, expect, describe } from '@jest/globals';
import { validate as uuidValidate } from 'uuid';

import { scrambleField } from '../../lib/cmd/qseow/scramblefield.js';

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

/**
 * Test suite for {@link scrambleField} – scramble without post-processing (cert auth).
 * Resets `options` to the initial snapshot before each test so that one test cannot
 * contaminate the next. Captures the GUID of the app created in the happy-path test
 * (`createdAppIdUnpublished1`) for reuse in the 'replace' suite.
 */
describe('scramble fields, do not publish (cert auth)', () => {
    /**
     * @test Happy path — scramble with valid source app and field names
     * @description Calls {@link scrambleField} with an existing source app, two field names,
     * and a new app name. Expects a new unpublished app to be created.
     * Input: appId='2933711d-...', fieldName=['Dim4','Dim2'], newAppName='..._first', newAppCmd=''
     * Expected: result.newAppCmd === ''; result.newAppId is a valid UUID; result.status === 'success';
     *   createdAppIdUnpublished1 is set to result.newAppId
     */
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

    /**
     * @test Error path — no field names provided
     * @description Calls {@link scrambleField} with an empty fieldName array, verifying that
     * the function returns an error status rather than creating an app.
     * Input: appId='2933711d-...', fieldName=[], newAppCmd=''
     * Expected: result.newAppId is undefined; result.status === 'error'
     */
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

    /**
     * @test Error path — no new app name provided
     * @description Calls {@link scrambleField} with an empty newAppName, verifying that the
     * function returns an error rather than creating an unnamed app.
     * Input: appId='2933711d-...', fieldName=['Dim4','Dim2'], newAppName='', newAppCmd=''
     * Expected: result.newAppId is undefined; result.status === 'error'
     */
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

    /**
     * @test Error path — no source app ID provided
     * @description Calls {@link scrambleField} with an empty appId string, verifying that
     * the function returns an error without attempting to open any app.
     * Input: appId='', fieldName=['Dim4','Dim2'], newAppName='...'
     * Expected: result.newAppId is undefined; result.status === 'error'
     */
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

    /**
     * @test Error path — non-existing source app ID
     * @description Calls {@link scrambleField} with a GUID that has the right format but
     * does not correspond to any app on the server.
     * Input: appId='2933711d-6638-41d4-a2d2-6dd2d965208c' (non-existing)
     * Expected: result.newAppId is undefined; result.status === 'error'
     */
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

    /**
     * @test Error path — source app ID with invalid GUID format
     * @description Calls {@link scrambleField} with a GUID that fails UUID validation,
     * verifying early rejection before any network call is made.
     * Input: appId='9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d' (invalid GUID)
     * Expected: result.newAppId is undefined; result.status === 'error'
     */
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

/**
 * Test suite for {@link scrambleField} – scramble and publish to a stream (cert auth).
 * Tests publishing the scrambled app to an existing stream by ID, non-existing stream ID,
 * invalid stream GUID, existing stream name, and non-existing stream name.
 * Captures the GUID of the published app (`createdAppIdPublished1`) for reuse in the
 * 'replace' suite.
 */
describe('scramble fields, publish (cert auth)', () => {
    /**
     * @test Publish to existing stream by ID
     * @description Scrambles the source app and publishes the result to a known stream ID.
     * Input: newAppCmd='publish', newAppCmdId='9143a1bf-...' ("Ctrl-Q demo apps")
     * Expected: result.newAppCmd === 'publish'; result.newAppId is a valid UUID;
     *   result.status === 'success'; createdAppIdPublished1 is set to result.newAppId
     */
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

    /**
     * @test Publish to non-existing stream ID
     * @description Scrambles the source app and attempts to publish to a stream GUID that
     * does not exist on the server.
     * Input: newAppCmd='publish', newAppCmdId='9143a1bf-...-860b' (non-existing)
     * Expected: result.status === 'error'
     */
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

    /**
     * @test Publish to stream with invalid GUID format
     * @description Scrambles the source app and attempts to publish to a stream GUID that
     * fails UUID validation, expecting early rejection.
     * Input: newAppCmd='publish', newAppCmdId='9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3f' (invalid)
     * Expected: result.status === 'error'
     */
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

    /**
     * @test Publish to existing stream by name
     * @description Scrambles the source app and publishes to a stream resolved by name.
     * Input: newAppCmd='publish', newAppCmdName='Ctrl-Q demo apps'
     * Expected: result.newAppCmd === 'publish'; result.newAppId is a valid UUID; result.status === 'success'
     */
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

    /**
     * @test Publish to non-existing stream name
     * @description Scrambles the source app and attempts to publish to a stream name that
     * does not exist on the server.
     * Input: newAppCmd='publish', newAppCmdName='Ctrl-Q demo apps - Non-existing'
     * Expected: result.status === 'error'
     */
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

/**
 * Test suite for {@link scrambleField} – scramble and replace an existing unpublished app (cert auth).
 * Uses app GUIDs captured by the 'do not publish' and 'publish' suites. Exercises replace
 * by unpublished app ID, published app ID, non-existing ID, invalid GUID, app name
 * (exactly one match), and non-existing app name.
 */
describe('scramble fields, replace unpublished (cert auth)', () => {
    /**
     * @test Replace existing unpublished app by ID
     * @description Scrambles the source app and replaces an existing unpublished app
     * (created by the 'existing source app ID' test) using its GUID.
     * Input: newAppCmd='replace', newAppCmdId=createdAppIdUnpublished1, force=true
     * Expected: result.newAppCmd === 'replace'; result.newAppId is a valid UUID; result.status === 'success'
     */
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

    /**
     * @test Replace existing published app by ID
     * @description Scrambles the source app and replaces an existing published app
     * (created by the 'publish' suite) using its GUID.
     * Input: newAppCmd='replace', newAppCmdId=createdAppIdPublished1, force=true
     * Expected: result.newAppCmd === 'replace'; result.newAppId is a valid UUID; result.status === 'success'
     */
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

    /**
     * @test Replace with non-existing target app ID
     * @description Scrambles the source app and attempts to replace an app whose GUID does
     * not exist on the server.
     * Input: newAppCmd='replace', newAppCmdId='2933711d-...-208c' (non-existing), force=true
     * Expected: result.status === 'error'
     */
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

    /**
     * @test Replace with invalid GUID target app ID
     * @description Scrambles the source app and attempts to replace a target app whose GUID
     * fails UUID validation, expecting early rejection.
     * Input: newAppCmd='replace', newAppCmdId='9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d' (invalid GUID)
     * Expected: result.status === 'error'
     */
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

    /**
     * @test Replace unpublished app by name (unique match)
     * @description Scrambles the source app and replaces an existing unpublished app resolved
     * by its name. Only one app with the target name exists, so name resolution succeeds.
     * Input: newAppCmd='replace', newAppCmdName='_Ctrl-Q CLI - Scrambled_first', force=true
     * Expected: result.newAppCmd === 'replace'; result.status === 'success'
     */
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
        expect(result.status).toBe('success');
    });

    /**
     * @test Replace with non-existing target app name
     * @description Scrambles the source app and attempts to replace a target app resolved
     * by a name that does not exist on the server.
     * Input: newAppCmd='replace', newAppCmdName='_Ctrl-Q CLI - Scrambled_non_existing', force=true
     * Expected: result.status === 'error'
     */
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

/**
 * Test suite for {@link scrambleField} – scramble and replace a published app (cert auth).
 * Placeholder suite; no test cases are currently implemented.
 */
describe('scramble fields, replace published (cert auth)', () => {});

// Clean up. Delete created apps.
