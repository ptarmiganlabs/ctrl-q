/* eslint-disable no-console */
/**
 * @fileoverview Integration tests for retrieving in-app bookmarks using certificate authentication.
 * @module integration/bookmark_get_cert
 *
 * @description
 * Exercises {@link getBookmark} to list bookmarks from Qlik Sense apps via the Engine API
 * (port 4747). Tests cover: a non-existing app, an app with no bookmarks, an app with two
 * bookmarks (JSON and table output), retrieving a single specific bookmark by ID, and
 * retrieving specific bookmarks by ID list and by name. Duplicate test names are intentional
 * (same scenario, different outputFormat).
 *
 * @requires ../../lib/cmd/qseow/getbookmark
 *
 * @environment
 * - CTRL_Q_HOST               – Qlik Sense server hostname (required)
 * - CTRL_Q_PORT               – Engine API port (default: '4747')
 * - CTRL_Q_AUTH_TYPE          – Auth type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Client certificate PEM path
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Client private-key PEM path
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Root/CA certificate PEM path
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_ID_TYPE            – Bookmark lookup type (default: 'name')
 * - CTRL_Q_OUTPUT_FORMAT      – Output format (default: 'json')
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense Engine API reachable at CTRL_Q_HOST on port 4747
 * - App 'e5d051f0-34c6-4f47-9bc8-7dfabf784f18' must exist and contain exactly two bookmarks:
 *   '5ec99a44-3ffd-4a35-8fb9-6c0899cf07ea' ('Bookmark 1')
 *   'c49210ea-3005-4f2c-8697-52fe541b51d8' ('Bookmark 2')
 * - App '449f2186-0e86-4e19-b46f-c4c23212d730' must exist with no bookmarks
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

/**
 * @test Verify parameters (cert auth)
 * @description Pre-flight guard: asserts certificate paths, host, user credentials, idType,
 * and outputFormat are all non-empty.
 * Input: options populated from environment variables
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
 * Test suite for {@link getBookmark} with certificate authentication.
 * Covers: non-existing app, existing app with no bookmarks, app with bookmarks
 * (JSON and table output), retrieval by single ID, by multiple IDs, and by name.
 */
describe('get in-app bookmarks (cert auth)', () => {
    /**
     * @test Get bookmarks from a non-existing app
     * @description Calls {@link getBookmark} with an app ID that does not exist.
     * Input: appId='449f2186-0e86-4e19-b46f-c4c23212d731', idType='id', outputFormat='json'
     * Expected: result === false
     */
    test('get all bookmarks from app that does not exist', async () => {
        options.appId = appIdNoExists;
        options.idType = 'id';
        options.outputFormat = 'json';

        const result = await getBookmark(options);

        // Result should be false
        expect(result).toBe(false);
    });

    /**
     * @test Get all bookmarks from app with no bookmarks
     * @description Calls {@link getBookmark} for an app that exists but has no bookmarks.
     * Input: appId='449f2186-0e86-4e19-b46f-c4c23212d730', idType='id', outputFormat='json'
     * Expected: result is an empty array
     */
    test('get all bookmarks from app that has no bookmarks in it', async () => {
        options.appId = appIdExistsNoBookmarks1;
        options.idType = 'id';
        options.outputFormat = 'json';

        const result = await getBookmark(options);

        // Result should be empty array
        expect(result).toStrictEqual([]);
    });

    /**
     * @test Get all bookmarks from app with bookmarks — JSON output
     * @description Calls {@link getBookmark} for the test app containing two bookmarks,
     * with JSON output. Verifies both bookmark IDs in order.
     * Input: appId='e5d051f0-...', idType='id', outputFormat='json'
     * Expected: result.length === 2; result[0].qInfo.qId === bookmark2; result[1].qInfo.qId === bookmark1
     */
    test('get all bookmarks from app that has bookmarks in it', async () => {
        options.appId = appIdExistsHasBookmarks1;
        options.idType = 'id';
        options.outputFormat = 'json';

        const result = await getBookmark(options);

        // Result should be array with 2 bookmarks
        expect(result.length).toBe(2);

        // Verify that the bookmarks have the correct IDs
        expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark2);
        expect(result[1].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
    });

    /**
     * @test Get all bookmarks from app with bookmarks — table output
     * @description Same as JSON variant but with outputFormat='table'. Verifies bookmark IDs.
     * Input: appId='e5d051f0-...', idType='id', outputFormat='table'
     * Expected: result.length === 2; both bookmark IDs present
     */
    test('get all bookmarks from app that has bookmarks in it', async () => {
        options.appId = appIdExistsHasBookmarks1;
        options.idType = 'id';
        options.outputFormat = 'table';

        const result = await getBookmark(options);

        // Result should be array with 2 bookmarks
        expect(result.length).toBe(2);

        // Verify that the bookmarks have the correct IDs
        // Compare against all bookmarks in app, i.e. appIdExistsHasBookmarks1Bookmark1 and appIdExistsHasBookmarks1Bookmark2
        expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark2);
        expect(result[1].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
    });

    /**
     * @test Get one specific bookmark by ID
     * @description Calls {@link getBookmark} filtering to a single bookmark by GUID.
     * Input: appId='e5d051f0-...', bookmark=[bookmark1Id], idType='id', outputFormat='json'
     * Expected: result.length === 1; result[0].qInfo.qId === bookmark1Id
     */
    test('get 1 specific bookmark from app that has bookmarks in it', async () => {
        options.appId = appIdExistsHasBookmarks1;
        options.idType = 'id';
        options.outputFormat = 'json';
        options.bookmark = [appIdExistsHasBookmarks1Bookmark1];

        const result = await getBookmark(options);

        // Result should be array with 1 bookmark
        expect(result.length).toBe(1);

        // Verify that the bookmarks have the correct IDs
        expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
    });

    /**
     * @test Get two specific bookmarks by ID list
     * @description Calls {@link getBookmark} filtering to two bookmarks by GUID list.
     * Input: appId='e5d051f0-...', bookmark=[bookmark1Id, bookmark2Id], idType='id'
     * Expected: result.length === 2; both bookmark IDs present in order
     */
    test('get 2 specific bookmarks from app that has bookmarks in it', async () => {
        options.appId = appIdExistsHasBookmarks1;
        options.idType = 'id';
        options.outputFormat = 'json';
        options.bookmark = [appIdExistsHasBookmarks1Bookmark1, appIdExistsHasBookmarks1Bookmark2];

        const result = await getBookmark(options);

        // Result should be array with 2 bookmarks
        expect(result.length).toBe(2);

        // Verify that the bookmarks have the correct IDs
        expect(result[0].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark1);
        expect(result[1].qInfo.qId).toBe(appIdExistsHasBookmarks1Bookmark2);
    });

    /**
     * @test Get two specific bookmarks by name
     * @description Calls {@link getBookmark} filtering to two bookmarks by name.
     * Input: appId='e5d051f0-...', bookmark=['Bookmark 1', 'Bookmark 2'], idType='name'
     * Expected: result.length === 2; result[0].qMeta.title === 'Bookmark 1'; result[1].qMeta.title === 'Bookmark 2'
     */
    test('get 2 specific bookmarks from app that has bookmarks in it', async () => {
        options.appId = appIdExistsHasBookmarks1;
        options.idType = 'name';
        options.outputFormat = 'json';
        options.bookmark = ['Bookmark 1', 'Bookmark 2'];

        const result = await getBookmark(options);

        // Result should be array with 2 bookmark
        expect(result.length).toBe(2);

        // Verify that the bookmarks have the correct IDs
        expect(result[0].qMeta.title).toBe('Bookmark 1');
        expect(result[1].qMeta.title).toBe('Bookmark 2');
    });
});
