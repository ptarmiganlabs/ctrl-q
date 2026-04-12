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

test('get tasks (verify parameters) ', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

// Test suite for creating user activity buckets custom property
describe('create user activity custom property (cert auth)', () => {
    test('do not overwrite existing custom property, default buckets, user directory [LAB]', async () => {
        options.userDirectory = ['LAB'];
        options.customPropertyName = 'Ctrl_Q_User_Activity_Bucket';
        options.force = true;

        const result = await createUserActivityBucketsCustomProperty(options);
        expect(result).toBe(true);
    });
});
