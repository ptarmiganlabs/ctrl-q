/**
 * Unit tests for getTask() and parseTable() from src/lib/cmd/qseow/gettask.js, the qseow task-get command.
 *
 * axios is mocked (requires a live QRS).
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock axios before importing the modules under test (ESM hoisting)
jest.unstable_mockModule('axios', () => ({
    default: { request: jest.fn() },
}));

const axios = (await import('axios')).default;
const { logger } = await import('../../../globals.js');
const { getTask, parseTable } = await import('../../../lib/cmd/qseow/gettask.js');
const { QlikSenseTask } = await import('../../../lib/task/class_task.js');

/**
 * A reload task as /qrs/reloadtask/full returns it for a task that has never run.
 */
const neverRunReloadTask = {
    schemaPath: 'ReloadTask',
    id: 'reload-1',
    name: 'Never run',
    enabled: true,
    maxRetries: 0,
    taskSessionTimeout: 1440,
    isPartialReload: false,
    isManuallyTriggered: false,
    app: { id: 'app-1', name: 'App 1', published: false },
    operational: {
        lastExecutionResult: {
            startTime: '1753-01-01T00:00:00.000Z',
            stopTime: '1753-01-01T00:00:00.000Z',
            duration: 0,
            executingNodeName: '',
            status: 0,
        },
        nextExecution: '1753-01-01T00:00:00.000Z',
    },
    tags: [],
    customProperties: [],
};

const options = {
    authType: 'jwt',
    authJwt: 'test-jwt',
    host: 'qlik.example.com',
    port: '443',
    virtualProxy: '',
    logLevel: 'error',
    outputFormat: 'table',
    outputDest: 'screen',
    taskType: ['reload', 'ext-program'],
};

beforeEach(() => {
    axios.request.mockReset();

    // Keep the errors logged by the failure tests out of the test output
    jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getTask', () => {
    test('should return false, rather than throw, when the task model cannot be built', async () => {
        // The tags arrive, then QRS fails when asked for the reload tasks
        axios.request.mockResolvedValueOnce({ status: 200, data: '[]' }).mockRejectedValue(new Error('QRS unavailable'));

        await expect(getTask(options)).resolves.toBe(false);
    });
});

describe('parseTable', () => {
    test('should show a task that has never run as 💤 NeverStarted', async () => {
        const task = new QlikSenseTask();
        await task.init('from_qseow', neverRunReloadTask, false);
        const qlikSenseTasks = {
            taskNetwork: { tasks: [task] },
            qlikSenseSchemaEvents: { schemaEventList: [] },
            qlikSenseCompositeEvents: { compositeEventList: [] },
        };
        const info = jest.spyOn(logger, 'info').mockImplementation(() => {});

        const tableOptions = { outputDest: 'screen', taskType: ['reload'], tableDetails: ['lastexecution'] };
        await expect(parseTable(tableOptions, qlikSenseTasks, [])).resolves.toBe(true);

        const printed = info.mock.calls.map(([message]) => String(message)).join('\n');
        expect(printed).toContain('💤 NeverStarted');
    });
});
