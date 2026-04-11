import { jest, test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { getAppMetadata } from '../../../lib/cmd/qseow/app-metadata-get.js';

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

describe('get app metadata (cert auth)', () => {
    test('Verify parameters', async () => {
        expect(options.authCertFile).not.toHaveLength(0);
        expect(options.authCertKeyFile).not.toHaveLength(0);
        expect(options.authRootCertFile).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    test('get app metadata (json-multiple)', async () => {
        const result = await getAppMetadata(options);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].appId).toBe(options.appId);
        expect(result[0].metadata).toBeDefined();
        expect(result[0].metadata.loadScript).toBeDefined();
        expect(result[0].metadata.properties).toBeDefined();
    });

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
