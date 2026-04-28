/**
 * @fileoverview Integration tests for creating user activity bucket custom properties
 * using certificate authentication.
 * @module integration/activity_custom_property_create_cert
 *
 * @description
 * Exercises {@link createUserActivityBucketsCustomProperty} to create a Qlik Sense custom
 * property that categorises users into activity-time buckets. Tests the no-overwrite scenario
 * with default buckets ([1,7,14,30,90,180,365] days) and all standard license types.
 *
 * @requires ../../lib/cmd/qseow/createuseractivitycp
 *
 * @environment
 * - CTRL_Q_HOST               – Qlik Sense server hostname (required)
 * - CTRL_Q_PORT               – QRS port (default: '4242')
 * - CTRL_Q_AUTH_TYPE          – Auth type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Client certificate PEM path
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Client private-key PEM path
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Root/CA certificate PEM path
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_ACTIVITY_BUCKETS   – Day-count bucket thresholds (default: ['1','7','14','30','90','180','365'])
 * - CTRL_Q_LICENSE_TYPE       – License types to include (default: ['analyzer','analyzer-time','login','professional','user'])
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense server reachable at CTRL_Q_HOST on port 4242 via cert auth
 * - Custom property 'Ctrl_Q_User_Activity_Bucket' may or may not exist beforehand
 *   (test uses force=true to handle both cases)
 */
import { jest, test, expect, describe } from '@jest/globals';

import { createUserActivityBucketsCustomProperty } from '../../lib/cmd/qseow/createuseractivitycp.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    updateUserSleep: process.env.CTRL_Q_UPDATE_USER_SLEEP || 500,
    updateBatchSleep: process.env.CTRL_Q_UPDATE_BATCH_SLEEP || 3,
    updateBatchSize: process.env.CTRL_Q_UPDATE_BATCH_SIZE || 10,
    updateBatchSize: process.env.CTRL_Q_UPDATE_BATCH_SIZE || 10,
    activityBuckets: process.env.CTRL_Q_ACTIVITY_BUCKETS || ['1', '7', '14', '30', '90', '180', '365'],
    licenseType: process.env.CTRL_Q_LICENSE_TYPE || ['analyzer', 'analyzer-time', 'login', 'professional', 'user'],
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

/**
 * @test Verify parameters (cert auth)
 * @description Pre-flight guard: asserts certificate paths, host, and user credentials are non-empty.
 * Input: options populated from environment variables
 * Expected: authCertFile, authCertKeyFile, authRootCertFile, host, authUserDir, authUserId non-empty
 */
test('get tasks (verify parameters) ', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

/**
 * Test suite for {@link createUserActivityBucketsCustomProperty} with certificate authentication.
 * Uses force=true to handle cases where the custom property already exists.
 */
describe('create user activity custom property (cert auth)', () => {
    /**
     * @test Create custom property — no overwrite, default buckets, user directory LAB
     * @description Calls {@link createUserActivityBucketsCustomProperty} with default activity
     * buckets and all license types for the LAB user directory. Uses force=true.
     * Input: userDirectory=['LAB'], customPropertyName='Ctrl_Q_User_Activity_Bucket', force=true
     * Expected: result === true
     */
    test('do not overwrite existing custom property, default buckets, user directory [LAB]', async () => {
        options.userDirectory = ['LAB'];
        options.customPropertyName = 'Ctrl_Q_User_Activity_Bucket';
        options.force = true;

        const result = await createUserActivityBucketsCustomProperty(options);
        expect(result).toBe(true);
    });
});
