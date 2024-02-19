/* eslint-disable no-console */
import { jest, test, expect, describe } from '@jest/globals';

import { taskExistById, getTaskByName, getTaskById } from '../lib/util/task.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || 'reload',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

// Mock logger
// global.console = {
//     log: jest.fn(),
//     info: jest.fn(),
//     error: jest.fn(),
// };

// Define existing and non-existing tasks
const existingTaskId = 'e9100e69-4e8e-414b-bf88-10a1110c43a9';
const existingTaskName = '[ctrl-q unit test] app 1, task 1';
const multipleMatchingTaskNames = '[ctrl-q unit test] app 1, task 2 (duplicates exist)';
const nonExistingTaskId = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d';
const nonExistingTaskName = 'Non-existing task 298374293874298734';

// Check if task exists by ID
describe('taskExistById: Check if task exists by ID (cert auth)', () => {
    test('existing task', async () => {
        const result = await taskExistById(existingTaskId, options);
        expect(result).toBe(true);
    });

    test('non-existing task', async () => {
        const result = await taskExistById(nonExistingTaskId, options);
        expect(result).toBe(false);
    });
});

// Get task by name
describe('getTaskByName: Get task by name (cert auth)', () => {
    test('no matching task', async () => {
        const result = await getTaskByName(nonExistingTaskName, options);
        expect(result).toBe(false);
    });

    test('1 matching task name', async () => {
        const result = await getTaskByName(existingTaskName, options);
        expect(result.id).toEqual(existingTaskId);
    });

    test('multiple matching task names', async () => {
        const result = await getTaskByName(multipleMatchingTaskNames, options);

        // Should return false
        expect(result).toEqual(false);

        // Ensure correct substring was written to global console log
        expect(global.console.log).toHaveBeenCalledWith(
            expect.stringContaining(`More than one task with name ${multipleMatchingTaskNames} found.`)
        );
    });

    test('no task name provided', async () => {
        const result = await getTaskByName('', options);
        expect(result).toEqual(false);
    });
});

// Get task by ID
describe('getTaskById: Get task by ID (cert auth)', () => {
    test('no matching task', async () => {
        const result = await getTaskById(nonExistingTaskId, options);
        expect(result).toEqual(false);
    });

    test('1 matching task', async () => {
        const result = await getTaskById(existingTaskId, options);
        expect(result.id).toEqual(existingTaskId);
    });

    test('no task id provided', async () => {
        const result = await getTaskById('', options);
        expect(result).toEqual(false);
    });
});
