/**
 * @fileoverview Integration tests for retrieving app metadata (load script + properties) from Qlik Sense using certificate authentication.
 * @module integration/app_metadata_get_cert
 *
 * @description
 * Exercises `getAppMetadata` in two output-format modes: 'json-multiple' (one JSON file per
 * app) and 'json-single' (all apps in a single JSON file). The test creates the output
 * directory (`./test-output`) before the suite and removes any generated JSON files in
 * `afterAll` to keep the workspace clean.
 *
 * @requires ../../lib/cmd/qseow/app-metadata-get
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST               – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT               – Engine port (default: '4747')
 * - CTRL_Q_AUTH_TYPE          – Authentication type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Path to client certificate PEM (default: './cert/client.pem')
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Path to client private-key PEM (default: './cert/client_key.pem')
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Path to root/CA certificate PEM (default: './cert/root.pem')
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_APP_ID             – GUID of the app to read metadata from (default: 'a3e0f5d2-000a-464f-998d-33d333b175d7')
 * - CTRL_Q_SCHEMA_VERSION     – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE             – Whether to use HTTPS (default: true)
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on Engine port 4747
 * - App 'a3e0f5d2-000a-464f-998d-33d333b175d7' must exist and have a non-empty load script
 *
 * @cleanup
 * `beforeAll` creates `./test-output` if it does not exist.
 * `afterAll` deletes `./test-output/app-metadata_Unknown.json` if it was created.
 * The 'json-single' test deletes `./test-output/app-metadata.json` inline.
 */
import { jest, test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { getAppMetadata } from '../../lib/cmd/qseow/app-metadata-get.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4747',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    appId: process.env.CTRL_Q_APP_ID || 'a3e0f5d2-000a-464f-998d-33d333b175d7',
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
    outputFormat: 'json-multiple',
    outputDir: './test-output',
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
 * Test suite for {@link getAppMetadata} with certificate authentication.
 * Covers both 'json-multiple' (separate file per app) and 'json-single' (combined file)
 * output formats.
 */
describe('get app metadata (cert auth)', () => {
    /**
     * @test Verify parameters
     * @description Pre-flight guard confirming all required certificate authentication
     * parameters are present and non-empty.
     * Input: options populated from environment variables
     * Expected: cert file paths, host, user-dir, and user-id are all non-empty
     */
    test('Verify parameters', async () => {
        expect(options.authCertFile).not.toHaveLength(0);
        expect(options.authCertKeyFile).not.toHaveLength(0);
        expect(options.authRootCertFile).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Retrieve metadata in json-multiple format
     * @description Calls {@link getAppMetadata} with outputFormat='json-multiple', expecting
     * one result object per app. Asserts that the result contains the configured appId and
     * that both loadScript and properties fields are populated.
     * Input: appId='a3e0f5d2-000a-464f-998d-33d333b175d7', outputFormat='json-multiple', outputDir='./test-output'
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

    /**
     * @test Retrieve metadata in json-single format
     * @description Calls {@link getAppMetadata} with outputFormat='json-single', expecting
     * all apps combined in a single JSON file (`app-metadata.json`). Verifies the file
     * is created and then deletes it inline.
     * Input: appId='a3e0f5d2-000a-464f-998d-33d333b175d7', outputFormat='json-single', outputDir='./test-output'
     * Expected: result is defined with length === 1; './test-output/app-metadata.json' exists
     */
    test('get app metadata to single JSON file', async () => {
        const singleOptions = { ...options, outputFormat: 'json-single' };
        const result = await getAppMetadata(singleOptions);

        expect(result).toBeDefined();
        expect(result.length).toBe(1);

        const singleFile = `${options.outputDir}/app-metadata.json`;
        expect(existsSync(singleFile)).toBe(true);

        if (existsSync(singleFile)) {
            unlinkSync(singleFile);
        }
    });
});
