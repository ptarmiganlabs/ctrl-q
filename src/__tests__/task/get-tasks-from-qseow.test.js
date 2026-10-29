/**
 * Unit tests for extGetTasksFromQseow() from src/lib/task/get_tasks_from_qseow.js,
 * called the way the task model calls it, through QlikSenseTasks.getTasksFromQseow().
 *
 * axios is mocked (requires a live QRS). Tasks are added with the real, async
 * QlikSenseTasks.addTask().
 */

import { jest, describe, test, expect } from '@jest/globals';

// Mock axios before importing the modules under test (ESM hoisting)
jest.unstable_mockModule('axios', () => ({
    default: { request: jest.fn() },
}));

const axios = (await import('axios')).default;
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

const options = { authType: 'jwt', authJwt: 'test-jwt', host: 'qlik.example.com', port: '443', virtualProxy: '' };

// ---------------------------------------------------------------------------
// getTasksFromQseow
// ---------------------------------------------------------------------------

describe('QlikSenseTasks.getTasksFromQseow', () => {
    test('should resolve with every reload and external program task, in the order QRS returned them', async () => {
        axios.request
            .mockResolvedValueOnce({
                status: 200,
                data: JSON.stringify([makeQrsTask('ReloadTask', 'reload-1'), makeQrsTask('ReloadTask', 'reload-2')]),
            })
            .mockResolvedValueOnce({ status: 200, data: JSON.stringify([makeQrsTask('ExternalProgramTask', 'ext-1')]) });

        // Make initialising each task take a turn of the event loop, so a task list returned
        // before every task has been added is caught however quickly QlikSenseTask.init() runs
        const { init } = QlikSenseTask.prototype;
        const inits = [];
        const initSpy = jest.spyOn(QlikSenseTask.prototype, 'init').mockImplementation(function initLater(...args) {
            const initDone = new Promise((resolve) => setImmediate(resolve)).then(() => init.apply(this, args));
            inits.push(initDone);
            return initDone;
        });

        const qlikSenseTasks = new QlikSenseTasks();
        await qlikSenseTasks.init(options);
        const taskList = await qlikSenseTasks.getTasksFromQseow();
        const taskIdsWhenResolved = taskList.map((task) => task.taskId);

        // Let any initialisation still running finish before the test ends
        await Promise.allSettled(inits);
        initSpy.mockRestore();

        expect(taskIdsWhenResolved).toEqual(['reload-1', 'reload-2', 'ext-1']);
        expect(taskList).toBe(qlikSenseTasks.taskList);
    });
});
