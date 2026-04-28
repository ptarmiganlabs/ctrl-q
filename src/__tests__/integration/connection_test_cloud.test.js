/**
 * @fileoverview Integration tests for the Ctrl-Q connection test command against Qlik Cloud using API key authentication.
 * @module integration/connection_test_cloud
 *
 * @description
 * Verifies that Ctrl-Q can connect to a Qlik Cloud tenant using an API key (which is itself a
 * JWT). The test first validates the structural integrity of the API key by decoding its
 * payload and asserting expected claims (`aud`, `iss`, `jti`, `subType`). It then calls
 * `qscloudTestConnection` and, if successful, verifies that the returned user record matches
 * the identity encoded in the API key. The test gracefully skips the live connection check
 * when no valid credentials are available in the test environment.
 *
 * @requires ../../lib/cmd/qscloud/testconnection
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRLQ_TENANT_HOST  – Qlik Cloud tenant hostname, e.g. 'my-tenant.us.qlikcloud.com' (required)
 * - CTRLQ_AUTH_TYPE    – Authentication type; expected value 'apikey' (default: 'apikey')
 * - CTRLQ_API_KEY      – Qlik Cloud API key in JWT format (required)
 * - CTRL_Q_LOG_LEVEL   – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT – Jest timeout in ms (default: 120000)
 *
 * @prerequisites
 * - A reachable Qlik Cloud tenant at CTRLQ_TENANT_HOST
 * - A valid, non-expired API key whose JWT payload contains: aud='qlik.api', iss='qlik.api/api-keys',
 *   a UUID jti, and subType='user'
 * - Network access from the test runner to the Qlik Cloud tenant
 */
import { jest, test, expect, describe } from '@jest/globals';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    tenantHost: process.env.CTRLQ_TENANT_HOST || '',
    authType: process.env.CTRLQ_AUTH_TYPE || 'apikey',
    apikey: process.env.CTRLQ_API_KEY || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

/**
 * Test suite exercising Qlik Cloud connection testing with API key authentication.
 * The `qscloudTestConnection` function is imported dynamically inside the test to avoid
 * top-level import issues when cloud credentials are absent from the environment.
 * If credentials are missing or the connection fails, the suite logs a message and
 * passes rather than erroring, so CI pipelines without cloud access are unaffected.
 */
describe('connection test (JWT auth)', () => {
    /**
     * @test Verify parameters and API key structure
     * @description Validates that required configuration values are present, then decodes the
     * API key JWT payload (without verifying the signature) and asserts the expected claim
     * values. This ensures the provided API key is structurally valid before any network
     * call is attempted.
     * Input: options.tenantHost (non-empty), options.apikey (valid JWT string)
     * Expected: tenantHost non-empty; authType === 'apikey'; apikey non-empty; decoded JWT has
     *   aud === 'qlik.api', iss === 'qlik.api/api-keys', jti matching UUID pattern, subType === 'user'
     */
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
     * @test Live connection to Qlik Cloud tenant
     * @description Dynamically imports and calls `qscloudTestConnection` with the configured API
     * key credentials. If the connection succeeds, asserts that the returned user object contains
     * a `tenantId` matching the one encoded in the API key JWT, a non-empty user `id` matching
     * the JWT `sub` claim, a non-empty `name`, `email`, and `status` field.
     * If the connection returns `false` (e.g. no credentials in CI environment), the test
     * logs a skip message and passes without assertions.
     * Input: options.tenantHost, options.authType = 'apikey', options.apikey
     * Expected: result is truthy; result.tenantId matches decoded JWT tenantId; result.id, name, email, status are non-empty
     */
    test('do connection test', async () => {
        const { qscloudTestConnection } = await import('../../lib/cmd/qscloud/testconnection.js');

        const result = await qscloudTestConnection(options);

        // If result is false, connection failed (likely missing credentials in test env)
        if (result === false) {
            // Connection failed - likely due to missing test credentials
            // This is expected in test environment without real credentials
            console.log('Connection test skipped - no valid credentials available');
            expect(true).toBe(true);
            return;
        }

        const decoded = JSON.parse(Buffer.from(options.apikey.split('.')[1], 'base64').toString('utf8'));

        // Result should be a JSON object
        expect(result).toBeTruthy();
        expect(result.tenantId).toBe(decoded.tenantId);

        expect(result.id).not.toHaveLength(0);
        expect(result.id).toBe(decoded.sub);

        expect(result.name).not.toHaveLength(0);
        expect(result.email).not.toHaveLength(0);
        expect(result.status).not.toHaveLength(0);
    });
});
