/**
 * @fileoverview Integration tests for retrieving in-app bookmarks using JWT authentication.
 * @module integration/bookmark_get_jwt
 *
 * @description
 * Mirrors `bookmark_get_cert.test.js` but uses JWT auth (port 443, virtualProxy='jwt').
 * Most tests in the describe block are commented out; only the non-existing app test is active.
 * The active test verifies that {@link getBookmark} returns false when the app does not exist.
 *
 * @requires ../../lib/cmd/qseow/getbookmark
 *
 * @environment
 * - CTRL_Q_HOST         – Qlik Sense server hostname (required)
 * - CTRL_Q_PORT         – Engine API port (default: '4747'; overridden to '443')
 * - CTRL_Q_AUTH_TYPE    – Auth type (default: 'cert'; overridden to 'jwt')
 * - CTRL_Q_AUTH_CERT_FILE / KEY / ROOT – Cert paths (present but not used for JWT)
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID – Qlik user ID (required)
 * - CTRL_Q_AUTH_JWT     – JWT Bearer token (required)
 * - CTRL_Q_ID_TYPE      – Bookmark lookup type (default: 'name')
 * - CTRL_Q_OUTPUT_FORMAT – Output format (default: 'json')
 * - CTRL_Q_LOG_LEVEL    – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense server reachable at CTRL_Q_HOST on port 443 via JWT virtual proxy
 * - App '449f2186-0e86-4e19-b46f-c4c23212d731' must NOT exist
 */
import { jest, test, expect, describe } from '@jest/globals';

import { getBookmark } from '../../lib/cmd/qseow/getbookmark.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4747',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
    idType: process.env.CTRL_Q_ID_TYPE || 'name',
    outputFormat: process.env.CTRL_Q_OUTPUT_FORMAT || 'json',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

const appIdNoExists = '449f2186-0e86-4e19-b46f-c4c23212d731';
const appIdExistsNoBookmarks1 = '449f2186-0e86-4e19-b46f-c4c23212d730';
const appIdExistsHasBookmarks1 = 'e5d051f0-34c6-4f47-9bc8-7dfabf784f18';
const appIdExistsHasBookmarks1Bookmark1 = '5ec99a44-3ffd-4a35-8fb9-6c0899cf07ea';
const appIdExistsHasBookmarks1Bookmark2 = 'c49210ea-3005-4f2c-8697-52fe541b51d8';

options.authType = 'jwt';
options.port = '443';
options.virtualProxy = 'jwt';

/**
 * @test Verify parameters (JWT auth)
 * @description Pre-flight guard: asserts certificate paths (present even for JWT), host, user
 * credentials, idType, and outputFormat are non-empty.
 * Input: options with authType='jwt', port='443', virtualProxy='jwt'
 * Expected: all checked fields are non-empty
 */
test('get bookmark (verify parameters)', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
    expect(options.idType).not.toHaveLength(0);
    expect(options.outputFormat).not.toHaveLength(0);
});

/**
 * Test suite for {@link getBookmark} with JWT authentication.
 * Most tests are currently commented out. Only the non-existing app scenario is active.
 */
describe('get in-app bookmarks (jwt auth)', () => {
    /**
     * @test Get bookmarks from a non-existing app (JWT)
     * @description Calls {@link getBookmark} with an app ID that does not exist, via JWT auth.
     * Input: appId='449f2186-0e86-4e19-b46f-c4c23212d731', idType='id', outputFormat='json'
     * Expected: result === false
     */
    test('get all bookmarks from app that does not exist', async () => {
        options.appId = appIdNoExists;
        options.idType = 'id';
        options.outputFormat = 'json';

        console.log(options);
        const result = await getBookmark(options);

        // Result should be false
        expect(result).toBe(false);
    });

    // /**
    //  * All bookmarks in app, JSON output
    //  * No bookmarks exist in app that exist
    //  *
    //  * --app-id <id>
    //  * --id-type id
    //  * --output-format json
    //  */
    // test('get all bookmarks from app that has no bookmarks in it', async () => {
    //     options.appId = appIdExistsNoBookmarks1;
    //     options.idType = 'id';
    //     options.outputFormat = 'json';

    //     const result = await getBookmark(options);

    //     // Result should be empty array
    //     expect(result).toStrictEqual([]);
    // });

    // /**
    //  * All bookmarks in app, JSON output
    //  * App has 2 bookmarks
    //  *
    //  * --app-id <id>
    //  * --id-type id
    //  * --output-format json
    //  */
    // test('get all bookmarks from app that has bookmarks in it', async () => {
    //     options.appId = appIdExistsHasBookmarks1;
    //     options.idType = 'id';
    //     options.outputFormat = 'json';

    //     const result = await getBookmark(options);

    //     // Result should be array with 2 bookmarks
    //     expect(result.length).toBe(2);

    //     // Verify that the bookmarks have the correct IDs
    //     expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
    //     expect(result[1].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark2);
    // });

    // /**
    //  * All bookmarks in app, table output
    //  * App has 2 bookmarks
    //  *
    //  * --app-id <id>
    //  * --id-type id
    //  * --output-format json
    //  */
    // test('get all bookmarks from app that has bookmarks in it', async () => {
    //     options.appId = appIdExistsHasBookmarks1;
    //     options.idType = 'id';
    //     options.outputFormat = 'table';

    //     const result = await getBookmark(options);

    //     // Result should be array with 2 bookmarks
    //     expect(result.length).toBe(2);

    //     // Verify that the bookmarks have the correct IDs
    //     expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
    //     expect(result[1].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark2);
    // });

    // /**
    //  * Get 2 specific bookmarks (based on ID) from app, JSON output
    //  * App has 2 bookmarks
    //  *
    //  * --app-id <id>
    //  * --id-type id
    //  * --output-format json
    //  * --bookmark [<id>, <id>]
    //  */
    // test('get 2 specific bookmarks from app that has bookmarks in it', async () => {
    //     options.appId = appIdExistsHasBookmarks1;
    //     options.idType = 'id';
    //     options.outputFormat = 'json';
    //     options.bookmark = [appIdExistsHasBookmarks1Bookmark1, appIdExistsHasBookmarks1Bookmark2];

    //     const result = await getBookmark(options);

    //     // Result should be array with 2 bookmarks
    //     expect(result.length).toBe(2);

    //     // Verify that the bookmarks have the correct IDs
    //     expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
    //     expect(result[1].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark2);
    // });

    // /**
    //  * Get 2 specific bookmarks (based on name) from app, JSON output
    //  * App has 2 bookmarks
    //  *
    //  * --app-id <id>
    //  * --id-type name
    //  * --output-format json
    //  * --bookmark [<name>, <name>]
    //  */
    // test('get 2 specific bookmarks from app that has bookmarks in it', async () => {
    //     options.appId = appIdExistsHasBookmarks1;
    //     options.idType = 'name';
    //     options.outputFormat = 'json';
    //     options.bookmark = ['Bookmark 1', 'Bookmark 2'];

    //     const result = await getBookmark(options);

    //     // Result should be array with 2 bookmark
    //     expect(result.length).toBe(2);

    //     // Verify that the bookmarks have the correct IDs
    //     expect(result[0].qMeta.title).toBe('Bookmark 1');
    //     expect(result[1].qMeta.title).toBe('Bookmark 2');
    // });
});
