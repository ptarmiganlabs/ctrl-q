/**
 * @fileoverview Integration tests for retrieving app metadata (load script + properties) from Qlik Sense using JWT authentication.
 * @module integration/app_metadata_get_jwt
 *
 * @description
 * JWT-authenticated counterpart of `app_metadata_get_cert.test.js`. Exercises
 * `getAppMetadata` in 'json-multiple' output format over port 443 via the configured
 * virtual proxy. Creates `./test-output-jwt` before the suite and deletes generated
 * files in `afterAll`.
 *
 * @requires ../../lib/cmd/qseow/app-metadata-get
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST          – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT          – Engine port (default: '443')
 * - CTRL_Q_JWT           – Bearer JWT token used for authentication (required, maps to authJwt)
 * - CTRL_Q_VIRTUAL_PROXY – Virtual proxy prefix (default: '')
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID  – Qlik user ID (required)
 * - CTRL_Q_APP_ID        – GUID of the app to read metadata from (default: 'a3e0f5d2-000a-464f-998d-33d333b175d7')
 * - CTRL_Q_SCHEMA_VERSION – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE        – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL     – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT  – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 443
 * - A JWT virtual proxy configured on the server that matches CTRL_Q_VIRTUAL_PROXY
 * - App 'a3e0f5d2-000a-464f-998d-33d333b175d7' must exist with a non-empty load script
 *
 * @cleanup
 * `beforeAll` creates `./test-output-jwt` if it does not exist.
 * `afterAll` deletes `./test-output-jwt/app-metadata_Unknown.json` if it was created.
 */
import { jest, test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { getAppMetadata } from '../../lib/cmd/qseow/app-metadata-get.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: 'jwt',
    authJwt: process.env.CTRL_Q_JWT || '',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '443',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    appId: process.env.CTRL_Q_APP_ID || 'a3e0f5d2-000a-464f-998d-33d333b175d7',
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
    outputFormat: 'json-multiple',
    outputDir: './test-output-jwt',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000;
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

beforeAll(() => {
    if (!existsSync(options.outputDir)) {
        mkdirSync(options.outputDir, { recursive: true });
    }
});

afterAll(() => {
    const jsonFile = `${options.outputDir}/app-metadata_Unknown.json`;
    if (existsSync(jsonFile)) {
        unlinkSync(jsonFile);
    }
});

/**
 * Test suite for {@link getAppMetadata} with JWT authentication.
 * Only the 'json-multiple' output format is tested in this variant.
 */
describe('get app metadata (jwt auth)', () => {
    /**
     * @test Verify parameters
     * @description Pre-flight guard confirming JWT token, host, user-dir, and user-id
     * are all non-empty before any live request is made.
     * Input: options with authType='jwt', populated from environment variables
     * Expected: authJwt, host, authUserDir, and authUserId are all non-empty
     */
    test('Verify parameters', async () => {
        expect(options.authJwt).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Retrieve metadata in json-multiple format (JWT)
     * @description Calls {@link getAppMetadata} with JWT auth and outputFormat='json-multiple',
     * asserting the result contains the expected appId and that both loadScript and properties
     * metadata fields are present.
     * Input: appId='a3e0f5d2-000a-464f-998d-33d333b175d7', outputFormat='json-multiple', outputDir='./test-output-jwt'
     * Expected: result is defined and non-empty; result[0].appId matches options.appId;
     *   result[0].metadata.loadScript and result[0].metadata.properties are defined
     */
    test('get app metadata (json-multiple)', async () => {
        const result = await getAppMetadata(options);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].appId).toBe(options.appId);
        expect(result[0].metadata).toBeDefined();
        expect(result[0].metadata.loadScript).toBeDefined();
        expect(result[0].metadata.properties).toBeDefined();
    });
});
