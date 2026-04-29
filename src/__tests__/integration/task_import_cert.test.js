/**
 * @fileoverview Integration tests for importing tasks from CSV files using certificate authentication.
 * @module integration/task_import_cert
 *
 * @description
 * Exercises {@link importTaskFromFile} by importing reload and external-program tasks from
 * CSV fixtures in `./testdata/`. Each test imports tasks, asserts the expected result count,
 * then deletes every imported task as cleanup. The test data files cover:
 * - tasks-1.csv: single reload task, no triggers
 * - tasks-2.csv: single reload task, one schema trigger
 * - tasks-3.csv: single reload task, one composite trigger
 * - tasks-4.csv: two reload tasks with composite and schema triggers
 * - tasks-5.csv: one external-program task, schema trigger
 * - tasks-6.csv: one external-program task, composite trigger
 * - tasks-7.csv: complex mix — 18 tasks, many schema and composite triggers
 *
 * @requires ../../lib/cmd/qseow/importtask
 * @requires ../../lib/util/qseow/task
 * @requires ../../lib/util/qseow/lookups
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
 * - CTRL_Q_UPDATE_MODE        – Import mode (default: 'create')
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense server reachable at CTRL_Q_HOST on port 4242 via cert auth
 * - CSV test data files present in `./testdata/` (tasks-1.csv through tasks-7.csv)
 * - Apps and streams referenced in task CSV files must exist
 *
 * @cleanup
 * Each test deletes every task it created using `deleteReloadTaskById` or
 * `deleteExternalProgramTaskById` after verifying the result count.
 */
import { jest, test, expect, describe } from '@jest/globals';

import { importTaskFromFile } from '../../lib/cmd/qseow/importtask.js';
import { getTaskById, deleteExternalProgramTaskById, deleteReloadTaskById } from '../../lib/util/qseow/task.js';
import { mapTaskType } from '../../lib/util/qseow/lookups.js';

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
    updateMode: process.env.CTRL_Q_UPDATE_MODE || 'create',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

/**
 * Test suite for {@link importTaskFromFile} with certificate authentication.
 * Each test reads a CSV fixture, imports the described tasks, verifies the count,
 * and deletes all created tasks afterwards.
 */
describe('import task (cert auth)', () => {
    /**
     * @test Verify parameters (cert auth)
     * @description Pre-flight guard: asserts certificate paths, host, and user credentials are non-empty.
     * Input: options populated from environment variables
     * Expected: authCertFile, authCertKeyFile, authRootCertFile, host, authUserDir, authUserId non-empty
     */
    test('get tasks (verify parameters)', async () => {
        expect(options.authCertFile).not.toHaveLength(0);
        expect(options.authCertKeyFile).not.toHaveLength(0);
        expect(options.authRootCertFile).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Import from tasks-1.csv — single reload task with no triggers
     * @description Imports one reload task with no scheduling triggers.
     * Asserts result length is 1, then deletes the created task.
     * Input: fileType='csv', fileName='./testdata/tasks-1.csv'
     * Expected: result.length === 1; task deleted successfully
     */
    test('csv 1: reload task, no triggers', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-1.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 1
        expect(result).not.toBe(false);
        expect(result.length).toBe(1);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            await deleteReloadTaskById(taskId, options);
        }
    });

    /**
     * @test Import from tasks-2.csv — reload task with one schema trigger
     * @description Imports one reload task configured with a single schema (time-based) trigger.
     * Input: fileType='csv', fileName='./testdata/tasks-2.csv'
     * Expected: result.length === 1; task deleted
     */
    test('csv 2: reload task, 1 schema trigger', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-2.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 1
        expect(result).not.toBe(false);
        expect(result.length).toBe(1);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            await deleteReloadTaskById(taskId, options);
        }
    });

    /**
     * @test Import from tasks-3.csv — reload task with one composite trigger
     * @description Imports one reload task configured with a single composite (event-based) trigger.
     * Input: fileType='csv', fileName='./testdata/tasks-3.csv'
     * Expected: result.length === 1; task deleted
     */
    test('csv 3: reload task, 1 composite trigger', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-3.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 1
        expect(result).not.toBe(false);
        expect(result.length).toBe(1);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            await deleteReloadTaskById(taskId, options);
        }
    });

    /**
     * @test Import from tasks-4.csv — two reload tasks, composite & schema triggers
     * @description Imports two reload tasks, one with a composite trigger and one with a schema trigger.
     * Input: fileType='csv', fileName='./testdata/tasks-4.csv'
     * Expected: result.length === 2; both tasks deleted
     */
    test('csv 4: 2 reload tasks, composite & schema triggers', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-4.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 2
        expect(result).not.toBe(false);
        expect(result.length).toBe(2);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            await deleteReloadTaskById(taskId, options);
        }
    });

    /**
     * @test Import from tasks-5.csv — one external-program task with schema trigger
     * @description Imports one external-program (non-reload) task with a schema trigger.
     * Cleanup uses `deleteExternalProgramTaskById`.
     * Input: fileType='csv', fileName='./testdata/tasks-5.csv'
     * Expected: result.length === 1; ext-program task deleted
     */
    test('csv 5: 1 ext program task, schema trigger', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-5.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 1
        expect(result).not.toBe(false);
        expect(result.length).toBe(1);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            await deleteExternalProgramTaskById(taskId, options);
        }
    });

    /**
     * @test Import from tasks-6.csv — one external-program task with composite trigger
     * @description Imports one external-program task with a composite trigger.
     * Input: fileType='csv', fileName='./testdata/tasks-6.csv'
     * Expected: result.length === 1; ext-program task deleted
     */
    test('csv 6: 1 ext program task, composite trigger', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-6.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 1
        expect(result).not.toBe(false);
        expect(result.length).toBe(1);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            await deleteExternalProgramTaskById(taskId, options);
        }
    });

    /**
     * @test Import from tasks-7.csv — complex mix, 18 tasks, many triggers
     * @description Imports 18 tasks (reload and external-program) with many schema and composite
     * triggers. After import, each task is fetched by ID to determine its type, then deleted
     * with the appropriate delete function.
     * Input: fileType='csv', fileName='./testdata/tasks-7.csv'
     * Expected: result.length === 18; all tasks deleted
     */
    test('csv 7: complex. many schema and composite triggers', async () => {
        const inputDir = './testdata';
        const inputFile = `tasks-7.csv`;

        options.fileType = 'csv';
        options.fileName = `${inputDir}/${inputFile}`;

        const result = await importTaskFromFile(options);

        // Result should be array with length 1
        expect(result).not.toBe(false);
        expect(result.length).toBe(18);

        // Delete all tasks in array
        for (let i = 0; i < result.length; i += 1) {
            const task = result[i];
            const { taskId } = task;

            // Call getTaskById to verify that task exists and what task type it is
            const task2 = await getTaskById(taskId, options);
            const taskType = mapTaskType.get(task2.taskType);

            // taskType should be 'Reload' or 'External Program'
            if (taskType === 'Reload') {
                await deleteReloadTaskById(taskId, options);
            } else if (taskType === 'ExternalProgram') {
                await deleteExternalProgramTaskById(taskId, options);
            }
        }
    });
});
