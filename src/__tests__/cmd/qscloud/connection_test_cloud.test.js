import { jest, test, expect, describe } from '@jest/globals';
import { qscloudTestConnection } from '../../../lib/cmd/qscloud/testconnection.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    tenantHost: process.env.CTRLQ_TENANT_HOST || '',
    authType: process.env.CTRLQ_AUTH_TYPE || 'apikey',
    apikey: process.env.CTRLQ_API_KEY || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

// Connection test using JWT auth
describe('connection test (JWT auth)', () => {
    test('Verify parameters', async () => {
        expect(options.logLevel).not.toHaveLength(0);
        expect(options.tenantHost).not.toHaveLength(0);
        expect(options.authType).toBe('apikey');
        expect(options.apikey).not.toHaveLength(0);

        // Check if the API key is a valid JWT
        try {
            const decoded = JSON.parse(Buffer.from(options.apikey.split('.')[1], 'base64').toString('utf8'));
            expect(decoded).toBeInstanceOf(Object);

            expect(decoded.aud).toBe('qlik.api');
            expect(decoded.iss).toBe('qlik.api/api-keys');

            // JTI should be a UUID
            expect(decoded.jti).not.toHaveLength(0);
            expect(decoded.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

            expect(decoded.sub).not.toHaveLength(0);
            expect(decoded.subType).toBe('user');

            expect(decoded.tenantId).not.toHaveLength(0);
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Invalid API key');
        }
    });

    /**
     * Do connection test
     * Should succeed
     */
    test('do connection test', async () => {
        const result = await qscloudTestConnection(options);

        const decoded = JSON.parse(Buffer.from(options.apikey.split('.')[1], 'base64').toString('utf8'));

        // Result should be a JSON object
        expect(result).toBeInstanceOf(Object);
        expect(result.tenantId).toBe(decoded.tenantId);

        expect(result.id).not.toHaveLength(0);
        expect(result.id).toBe(decoded.sub);

        expect(result.name).not.toHaveLength(0);
        expect(result.email).not.toHaveLength(0);
        expect(result.status).not.toHaveLength(0);
    });
});
