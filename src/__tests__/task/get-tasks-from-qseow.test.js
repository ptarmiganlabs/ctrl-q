/**
 * Unit tests for extGetTasksFromQseow() from src/lib/task/get_tasks_from_qseow.js,
 * called the way the task model calls it, through QlikSenseTasks.getTasksFromQseow().
 *
 * axios is mocked (requires a live QRS). Tasks are added with the real, async
 * QlikSenseTasks.addTask().
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock axios before importing the modules under test (ESM hoisting)
jest.unstable_mockModule('axios', () => ({
    default: { request: jest.fn() },
}));

const axios = (await import('axios')).default;
const { logger } = await import('../../globals.js');
const { QlikSenseTasks } = await import('../../lib/task/class_alltasks.js');
const { QlikSenseTask } = await import('../../lib/task/class_task.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal task as returned by /qrs/reloadtask/full or /qrs/externalprogramtask/full.
 */
const makeQrsTask = (schemaPath, id) => ({
    schemaPath,
    id,
    name: `Task ${id}`,
    enabled: true,
    app: { id: `app-${id}`, name: `App ${id}`, published: false },
    operational: {
        lastExecutionResult: {
            startTime: '2024-06-15T10:00:00.000Z',
            stopTime: '2024-06-15T10:05:00.000Z',
            duration: 300000,
            executingNodeName: 'node-1',
            status: 7,
        },
        nextExecution: '2024-06-16T10:00:00.000Z',
    },
    tags: [],
    customProperties: [],
});

/**
 * A QRS response listing the given tasks, as axios returns it.
 */
const qrsResponse = (tasks) => ({ status: 200, data: JSON.stringify(tasks) });

/**
 * Wait for a promise, failing at once if it hasn't settled within the given time rather than when
 * the test times out.
 */
const settled = async (promise, ms = 1000) => {
    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`did not settle within ${ms} ms`)), ms);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
};

const options = { authType: 'jwt', authJwt: 'test-jwt', host: 'qlik.example.com', port: '443', virtualProxy: '' };

const newQlikSenseTasks = async () => {
    const qlikSenseTasks = new QlikSenseTasks();
    await qlikSenseTasks.init(options);
    return qlikSenseTasks;
};

beforeEach(() => {
    axios.request.mockReset();

    // Keep the errors logged by the failure tests out of the test output
    jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getTasksFromQseow
// ---------------------------------------------------------------------------

describe('QlikSenseTasks.getTasksFromQseow', () => {
    test('should resolve with every reload and external program task, in the order QRS returned them', async () => {
        axios.request
            .mockResolvedValueOnce(qrsResponse([makeQrsTask('ReloadTask', 'reload-1'), makeQrsTask('ReloadTask', 'reload-2')]))
            .mockResolvedValueOnce(qrsResponse([makeQrsTask('ExternalProgramTask', 'ext-1')]));

        // Make initialising each task take a turn of the event loop, so a task list returned
        // before every task has been added is caught however quickly QlikSenseTask.init() runs
        const { init } = QlikSenseTask.prototype;
        const inits = [];
        jest.spyOn(QlikSenseTask.prototype, 'init').mockImplementation(function initLater(...args) {
            const initDone = new Promise((resolve) => setImmediate(resolve)).then(() => init.apply(this, args));
            inits.push(initDone);
            return initDone;
        });

        const qlikSenseTasks = await newQlikSenseTasks();

        let taskList;
        let taskIdsWhenResolved;
        try {
            taskList = await settled(qlikSenseTasks.getTasksFromQseow());
            taskIdsWhenResolved = taskList.map((task) => task.taskId);
        } finally {
            // Let any initialisation still running finish before the test ends, whether or not getting the tasks worked
            await Promise.allSettled(inits);
        }

        expect(taskIdsWhenResolved).toEqual(['reload-1', 'reload-2', 'ext-1']);
        expect(taskList).toBe(qlikSenseTasks.taskList);
    });

    test('should log the status of each QRS response', async () => {
        axios.request.mockResolvedValueOnce(qrsResponse([])).mockResolvedValueOnce(qrsResponse([]));
        const debug = jest.spyOn(logger, 'debug');

        const qlikSenseTasks = await newQlikSenseTasks();
        await settled(qlikSenseTasks.getTasksFromQseow());

        expect(debug).toHaveBeenCalledWith('GET RELOAD TASK: Result=200');
        expect(debug).toHaveBeenCalledWith('GET EXT PROGRAM TASK: Result=200');
    });

    test('should reject, rather than never settle, when a task cannot be added', async () => {
        axios.request.mockResolvedValueOnce(qrsResponse([makeQrsTask('ReloadTask', 'reload-1')])).mockResolvedValueOnce(qrsResponse([]));
        jest.spyOn(QlikSenseTask.prototype, 'init').mockRejectedValue(new Error('cannot add task'));

        const qlikSenseTasks = await newQlikSenseTasks();

        await expect(settled(qlikSenseTasks.getTasksFromQseow())).rejects.toThrow('cannot add task');
    });

    test('should reject without asking QRS for external program tasks when getting the reload tasks fails', async () => {
        axios.request.mockRejectedValueOnce(new Error('QRS unavailable')).mockResolvedValueOnce(qrsResponse([]));

        const qlikSenseTasks = await newQlikSenseTasks();

        await expect(settled(qlikSenseTasks.getTasksFromQseow())).rejects.toThrow('QRS unavailable');
        expect(axios.request).toHaveBeenCalledTimes(1);
    });
});
