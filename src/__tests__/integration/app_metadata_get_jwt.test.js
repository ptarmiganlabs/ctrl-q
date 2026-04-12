import { jest, test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { getAppMetadata } from '../../../../lib/cmd/qseow/app-metadata-get.js';

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

describe('get app metadata (jwt auth)', () => {
    test('Verify parameters', async () => {
        expect(options.authJwt).not.toHaveLength(0);
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
});
