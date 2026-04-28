/**
 * @fileoverview Integration tests for Qlik Sense task lookup utilities using JWT authentication.
 * @module integration/task_jwt
 *
 * @description
 * Mirrors `task_cert.test.js` but forces `authType = 'jwt'`, `port = '443'`, and
 * `virtualProxy = 'jwt'` for all suites. Exercises `taskExistById`, `getTaskByName`,
 * and `getTaskById` through the JWT virtual proxy. Tests cover existence checks,
 * name-based lookup (including ambiguous multi-match), ID-based retrieval, and empty
 * input handling.
 * `global.console` is replaced with Jest mocks to suppress log output during the suite.
 *
 * @requires ../../lib/util/qseow/task
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST           – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT           – QRS port (default: '4242'; overridden to '443' for JWT)
 * - CTRL_Q_AUTH_TYPE      – Authentication type (default: 'cert'; overridden to 'jwt')
 * - CTRL_Q_AUTH_USER_DIR  – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID   – Qlik user ID (required)
 * - CTRL_Q_AUTH_JWT       – JWT Bearer token (required for JWT auth)
 * - CTRL_Q_SCHEMA_VERSION – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE         – Whether to use HTTPS (default: true)
 * - CTRL_Q_TASK_TYPE      – Task type filter (default: 'reload')
 * - CTRL_Q_LOG_LEVEL      – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT   – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 443 with JWT virtual proxy
 * - Reload task 'e9100e69-4e8e-414b-bf88-10a1110c43a9' named '[ctrl-q unit test] app 1, task 1' must exist
 * - At least two tasks named '[ctrl-q unit test] app 1, task 2 (duplicates exist)' must exist
 *   (to test the multiple-match ambiguity path)
 */
import { jest, test, expect, describe } from '@jest/globals';

import { taskExistById, getTaskByName, getTaskById } from '../../lib/util/qseow/task.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
    authJwt: process.env.CTRL_Q_AUTH_JWT || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || 'reload',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

// Mock logger
global.console = {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
};

// Define existing and non-existing tasks
const existingTaskId = 'e9100e69-4e8e-414b-bf88-10a1110c43a9';
const existingTaskName = '[ctrl-q unit test] app 1, task 1';
const multipleMatchingTaskNames = '[ctrl-q unit test] app 1, task 2 (duplicates exist)';
const nonExistingTaskId = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d';
const nonExistingTaskName = 'Non-existing task 298374293874298734';

options.authType = 'jwt';
options.port = '443';
options.virtualProxy = 'jwt';

/**
 * Test suite for {@link taskExistById} with JWT authentication.
 * Checks task existence by GUID for both an existing and a non-existing task ID.
 */
describe('taskExistById: Check if task exists by ID (jwt auth)', () => {
    /**
     * @test Task exists — known valid task ID
     * @description Calls {@link taskExistById} with a GUID known to exist on the server.
     * Input: existingTaskId = 'e9100e69-4e8e-414b-bf88-10a1110c43a9'
     * Expected: result === true
     */
    test('existing task', async () => {
        const result = await taskExistById(existingTaskId, options);
        expect(result).toBe(true);
    });

    /**
     * @test Task does not exist — non-existing GUID
     * @description Calls {@link taskExistById} with a GUID that does not correspond to any task.
     * Input: nonExistingTaskId = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d'
     * Expected: result === false
     */
    test('non-existing task', async () => {
        const result = await taskExistById(nonExistingTaskId, options);
        expect(result).toBe(false);
    });
});

/**
 * Test suite for {@link getTaskByName} with JWT authentication.
 * Looks up tasks by name string and handles: no match, exactly one match, multiple matches
 * (ambiguous — returns false), and an empty name string.
 */
describe('getTaskByName: Get task by name (jwt auth)', () => {
    /**
     * @test Name lookup with no matching task
     * @description Calls {@link getTaskByName} with a task name that does not exist.
     * Input: nonExistingTaskName = 'Non-existing task 298374293874298734'
     * Expected: result === false
     */
    test('no matching task', async () => {
        const result = await getTaskByName(nonExistingTaskName, options);
        expect(result).toBe(false);
    });

    /**
     * @test Name lookup with exactly one matching task
     * @description Calls {@link getTaskByName} with a name matching exactly one task and
     * verifies the returned task ID.
     * Input: existingTaskName = '[ctrl-q unit test] app 1, task 1'
     * Expected: result.id === existingTaskId
     */
    test('1 matching task name', async () => {
        const result = await getTaskByName(existingTaskName, options);
        expect(result.id).toEqual(existingTaskId);
    });

    /**
     * @test Name lookup with multiple matching tasks (ambiguous)
     * @description Calls {@link getTaskByName} with a name shared by two or more tasks.
     * The function returns false rather than an arbitrary result.
     * Input: multipleMatchingTaskNames = '[ctrl-q unit test] app 1, task 2 (duplicates exist)'
     * Expected: result === false
     */
    test('multiple matching task names', async () => {
        const result = await getTaskByName(multipleMatchingTaskNames, options);

        // Should return false
        expect(result).toEqual(false);

        // Ensure correct substring was written to global console log
        // TODO: Fix this test
        // expect(global.console.log).toHaveBeenCalledWith(
        //     expect.stringContaining(`More than one task with name ${multipleMatchingTaskNames} found.`)
        // );
    });

    /**
     * @test Name lookup with empty task name
     * @description Calls {@link getTaskByName} with an empty string, verifying early rejection.
     * Input: taskName = ''
     * Expected: result === false
     */
    test('no task name provided', async () => {
        const result = await getTaskByName('', options);
        expect(result).toEqual(false);
    });
});

/**
 * Test suite for {@link getTaskById} with JWT authentication.
 * Retrieves a task by its GUID and handles: non-existing GUID, valid GUID, and empty string.
 */
describe('getTaskById: Get task by ID (jwt auth)', () => {
    /**
     * @test ID lookup with non-existing task GUID
     * @description Calls {@link getTaskById} with a GUID that does not correspond to any task.
     * Input: nonExistingTaskId = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d'
     * Expected: result === false
     */
    test('no matching task', async () => {
        const result = await getTaskById(nonExistingTaskId, options);
        expect(result).toEqual(false);
    });

    /**
     * @test ID lookup with known valid task GUID
     * @description Calls {@link getTaskById} with an existing task GUID and verifies the
     * returned task object.
     * Input: existingTaskId = 'e9100e69-4e8e-414b-bf88-10a1110c43a9'
     * Expected: result.id === existingTaskId
     */
    test('1 matching task', async () => {
        const result = await getTaskById(existingTaskId, options);
        expect(result.id).toEqual(existingTaskId);
    });

    /**
     * @test ID lookup with empty task ID
     * @description Calls {@link getTaskById} with an empty string, verifying early rejection.
     * Input: taskId = ''
     * Expected: result === false
     */
    test('no task id provided', async () => {
        const result = await getTaskById('', options);
        expect(result).toEqual(false);
    });
});
