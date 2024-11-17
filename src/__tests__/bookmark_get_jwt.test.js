import { jest, test, expect, describe } from '@jest/globals';

import { getBookmark } from '../lib/cmd/qseow/getbookmark.js';

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

// Test suite for app export
describe('get in-app bookmarks (jwt auth)', () => {
    /**
     * All bookmarks in app that doesn't exist, JSON output
     *
     * --app-id <id>
     * --id-type id
     * --output-format json
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
