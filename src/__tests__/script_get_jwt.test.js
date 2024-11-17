import { jest, test, expect, describe } from '@jest/globals';

import { getScript } from '../lib/cmd/qseow/getscript.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4747',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    appId: process.env.CTRL_Q_APP_ID || 'a3e0f5d2-000a-464f-998d-33d333b175d7',
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

// Get app script
describe('get app script (jwt auth)', () => {
    options.authType = 'jwt';
    options.port = '443';
    options.virtualProxy = 'jwt';

    test('Verify parameters', async () => {
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * Get app script
     * Should succeed
     */
    test('get app script', async () => {
        const result = await getScript(options);

        expect(result.appId).toBe('a3e0f5d2-000a-464f-998d-33d333b175d7');
        expect(result.appCreatedDate).toBe('2021-06-03T22:04:52.283Z');
        expect(result.appModifiedDate).toBe('2024-03-20T08:02:25.153Z');
        expect(result.appScript.length).toBe(1989);
    });
});
