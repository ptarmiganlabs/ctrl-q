/**
 * @fileoverview Integration tests for setting custom properties on tasks using certificate authentication.
 * @module integration/task_custom_property_set_cert
 *
 * @description
 * Exercises {@link setTaskCustomProperty} to set and append custom property values on a Qlik
 * Sense reload task. Tests cover the 'replace' update mode (overwrites existing values with
 * new ones) and the 'append' mode (adds values to existing ones). After each operation the
 * task is fetched by ID to assert the custom property state.
 *
 * @requires ../../lib/cmd/qseow/settaskcp
 * @requires ../../lib/util/qseow/task
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
 * - CTRL_Q_TASK_TYPE          – Task type filter (default: ['reload','ext-program'])
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense server reachable at CTRL_Q_HOST on port 4242 via cert auth
 * - Reload task 'e9100e69-4e8e-414b-bf88-10a1110c43a9' must exist
 * - Custom property 'ctrl_q_unit_test_1' must exist with values 'Value 1', 'Value 2', 'Value 3'
 * - Tests run sequentially: 'replace' first sets 2 values; 'append' then adds a 3rd
 */
import { jest, test, expect, describe } from '@jest/globals';

import { setTaskCustomProperty } from '../../lib/cmd/qseow/settaskcp.js';
import { getTaskById } from '../../lib/util/qseow/task.js';

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

    taskType: process.env.CTRL_Q_TASK_TYPE || ['reload', 'ext-program'],
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

options.fileType = 'excel';
options.fileName = `./testdata/tasks.xlsx`;
options.sheetName = 'App import';
options.port = '4242';

// Define eixsting tasks
const existingTaskId = 'e9100e69-4e8e-414b-bf88-10a1110c43a9';

/**
 * @test Verify parameters (cert auth)
 * @description Pre-flight guard: asserts certificate paths, host, and user credentials are non-empty.
 * Input: options populated from environment variables
 * Expected: all cert-related fields are non-empty
 */
test('set custom properties (verify parameters)', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

/**
 * Test suite for {@link setTaskCustomProperty} with certificate authentication.
 * Tests run in order: 'replace' first sets 2 values, 'append' then adds a 3rd.
 */
describe('set custom property on reload task (cert auth)', () => {
    /**
     * @test Replace mode — set 2 custom property values
     * @description Calls {@link setTaskCustomProperty} with updateMode='replace' and
     * customPropertyValue=['Value 1','Value 2']. After the call, fetches the task and
     * asserts 2 CP values are present.
     * Input: taskId=existingTaskId, customPropertyName='ctrl_q_unit_test_1', updateMode='replace'
     * Expected: result === true; task has exactly 2 CP values: 'Value 1' and 'Value 2'
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
     * @test Append mode — add one more custom property value
     * @description Calls {@link setTaskCustomProperty} with updateMode='append' and
     * customPropertyValue=['Value 3']. Runs after 'replace' test. Asserts the task now has 3 CP values.
     * Input: taskId=existingTaskId, customPropertyName='ctrl_q_unit_test_1', updateMode='append'
     * Expected: result === true; task has 3 CP values; cp[2].value === 'Value 3'
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
