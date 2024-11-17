import { jest, test, expect, describe } from '@jest/globals';

import { setTaskCustomProperty } from '../lib/cmd/qseow/settaskcp.js';
import { getTaskById } from '../lib/util/qseow/task.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'jwt',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '443',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || 'jwt',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || ['reload', 'ext-program'],
    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

// Define eixsting tasks
const existingTaskId = 'e9100e69-4e8e-414b-bf88-10a1110c43a9';

test('set custom properties (verify parameters)', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

// Test suite for app export
describe('set custom property on reload task (jwt auth)', () => {
    /**
     * One task ID, replace any existing CPs with 2 new ones
     *
     * ----task-id <id>
     * --update-mode replace
     * --overwrite
     */
    test('replace task cp', async () => {
        options.updateMode = 'replace';
        options.overwrite = true;
        options.taskId = [existingTaskId];
        options.customPropertyName = 'ctrl_q_unit_test_1';
        options.customPropertyValue = ['Value 1', 'Value 2'];

        const result = await setTaskCustomProperty(options);

        // Result should be true
        expect(result).toBe(true);

        // Get task and verify that CPs have been set
        const task = await getTaskById(existingTaskId, options);

        // Find how many values the ctrl_q_unit_test_1 CP has
        const cp = task.customProperties.filter((item) => item.definition.name === options.customPropertyName);
        expect(cp.length).toBe(2);

        // Verify that CP has the correct values
        expect(cp[0].value).toBe('Value 1');
        expect(cp[1].value).toBe('Value 2');
    });

    /**
     * One task ID, append any existing CPs with 1 new one
     *
     * ----task-id <id>
     * --update-mode append
     */
    test('append task cp', async () => {
        options.updateMode = 'append';
        options.overwrite = true;
        options.taskId = [existingTaskId];
        options.customPropertyName = 'ctrl_q_unit_test_1';
        options.customPropertyValue = ['Value 3'];

        const result = await setTaskCustomProperty(options);

        // Result should be true
        expect(result).toBe(true);

        // Get task and verify that CPs have been set
        const task = await getTaskById(existingTaskId, options);

        // Find how many values the ctrl_q_unit_test_1 CP has
        const cp = task.customProperties.filter((item) => item.definition.name === options.customPropertyName);
        expect(cp.length).toBe(3);

        // Verify that CP has the correct values
        expect(cp[2].value).toBe('Value 3');
    });
});
