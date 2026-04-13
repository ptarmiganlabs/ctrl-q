/**
 * Unit tests for src/lib/task/class_task.js — QlikSenseTask.init()
 *
 * Tests property mapping for both ReloadTask and ExternalProgramTask
 * from both `from_qseow` and `from_file` sources, sentinel timestamp
 * conversion, duration formatting, status mapping, tag/CP mapping,
 * and anonymization via dynamic `random-words` import.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';

// Mock random-words before importing class_task (it does dynamic import('random-words'))
jest.unstable_mockModule('random-words', () => ({
    default: jest.fn(({ min, max, join }) => 'mocked random words'),
    generate: jest.fn(({ min, max, join }) => 'mocked random words'),
}));

const { QlikSenseTask } = await import('../../lib/task/class_task.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ReloadTask object accepted by QlikSenseTask.init()
 * when source is 'from_qseow'.
 */
const makeQseowReloadTask = (overrides = {}) => ({
    schemaPath: 'ReloadTask',
    id: 'task-abc-123',
    name: 'Demo Reload Task',
    enabled: true,
    maxRetries: 3,
    taskSessionTimeout: 1440,
    isPartialReload: false,
    isManuallyTriggered: false,
    app: {
        id: 'app-1',
        name: 'My App',
        published: true,
        stream: { name: 'Production' },
    },
    operational: {
        lastExecutionResult: {
            startTime: '2024-06-15T10:00:00.000Z',
            stopTime: '2024-06-15T10:05:00.000Z',
            duration: 300000, // 5 minutes
            executingNodeName: 'node-1',
            status: 7, // FinishedSuccess
        },
        nextExecution: '2024-06-16T10:00:00.000Z',
    },
    tags: [{ name: 'Daily' }, { name: 'Production' }],
    customProperties: [{ definition: { name: 'env' }, value: 'prod' }],
    ...overrides,
});

/**
 * Build a minimal ExternalProgramTask for from_qseow.
 */
const makeQseowExtProgramTask = (overrides = {}) => ({
    schemaPath: 'ExternalProgramTask',
    id: 'ext-task-1',
    name: 'Nightly Cleanup',
    enabled: false,
    path: '/opt/scripts/cleanup.sh',
    parameters: '--force',
    maxRetries: 0,
    taskSessionTimeout: 60,
    operational: {
        lastExecutionResult: {
            startTime: '2024-06-15T23:00:00.000Z',
            stopTime: '2024-06-15T23:01:00.000Z',
            duration: 60000,
            executingNodeName: 'node-2',
            status: 7,
        },
        nextExecution: '2024-06-16T23:00:00.000Z',
    },
    tags: [],
    customProperties: [],
    ...overrides,
});

/**
 * Build a minimal ReloadTask for from_file source.
 */
const makeFileReloadTask = (overrides = {}) => ({
    schemaPath: 'ReloadTask',
    id: 'file-task-1',
    name: 'File Reload',
    enabled: true,
    maxRetries: 2,
    taskSessionTimeout: 720,
    isPartialReload: true,
    isManuallyTriggered: true,
    app: {
        id: 'app-file-1',
        name: 'File App',
        published: false,
        stream: { name: '' },
    },
    tags: [{ name: 'Staging' }],
    customProperties: [{ definition: { name: 'team' }, value: 'analytics' }],
    schemaEvents: [{ id: 'se-1' }],
    compositeEvents: [{ id: 'ce-1' }],
    ...overrides,
});

// ---------------------------------------------------------------------------
// from_qseow — ReloadTask
// ---------------------------------------------------------------------------

describe('QlikSenseTask.init — from_qseow ReloadTask', () => {
    test('should map core task properties', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowReloadTask();
        await t.init('from_qseow', task, false);

        expect(t.sourceType).toBe('from_qseow');
        expect(t.taskId).toBe('task-abc-123');
        expect(t.taskName).toBe('Demo Reload Task');
        expect(t.taskEnabled).toBe(true);
        expect(t.appId).toBe('app-1');
        expect(t.appName).toBe('My App');
        expect(t.appPublished).toBe(true);
        expect(t.appStream).toBe('Production');
        expect(t.taskMaxRetries).toBe(3);
        expect(t.taskSessionTimeout).toBe(1440);
        expect(t.isPartialReload).toBe(false);
        expect(t.isManuallyTriggered).toBe(false);
        expect(t.taskType).toBe(0);
        expect(t.completeTaskObject).toBe(task);
    });

    test('should format execution timestamps and duration', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowReloadTask(), false);

        expect(t.taskLastExecutionStartTimestamp).toBe('2024-06-15T10:00:00.000Z');
        expect(t.taskLastExecutionStopTimestamp).toBe('2024-06-15T10:05:00.000Z');
        expect(t.taskLastExecutionDuration).toBe('0:05:00'); // 5 min
        expect(t.taskLastExecutionExecutingNodeName).toBe('node-1');
        expect(t.taskNextExecutionTimestamp).toBe('2024-06-16T10:00:00.000Z');
    });

    test('should convert sentinel timestamp 1753-01-01 to empty string', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowReloadTask({
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
        });
        await t.init('from_qseow', task, false);

        expect(t.taskLastExecutionStartTimestamp).toBe('');
        expect(t.taskLastExecutionStopTimestamp).toBe('');
        expect(t.taskNextExecutionTimestamp).toBe('');
    });

    test('should map task execution status using lookup map', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowReloadTask(), false);
        expect(t.taskLastStatus).toBe('FinishedSuccess'); // status 7

        const t2 = new QlikSenseTask();
        await t2.init('from_qseow', makeQseowReloadTask({
            operational: {
                ...makeQseowReloadTask().operational,
                lastExecutionResult: { ...makeQseowReloadTask().operational.lastExecutionResult, status: 8 },
            },
        }), false);
        expect(t2.taskLastStatus).toBe('FinishedFail');
    });

    test('should return "?" when status is missing', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowReloadTask({
            operational: {
                lastExecutionResult: {
                    startTime: '2024-01-01T00:00:00.000Z',
                    stopTime: '2024-01-01T00:00:00.000Z',
                    duration: 0,
                    executingNodeName: '',
                    // status intentionally omitted
                },
                nextExecution: '2024-01-01T00:00:00.000Z',
            },
        });
        await t.init('from_qseow', task, false);
        expect(t.taskLastStatus).toBe('?');
    });

    test('should map tags and custom properties to friendly strings', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowReloadTask(), false);

        expect(t.taskTagsFriendly).toEqual(['Daily', 'Production']);
        expect(t.taskCustomPropertiesFriendly).toEqual(['env=prod']);
    });

    test('should set appStream to empty string when app is unpublished', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowReloadTask({
            app: { id: 'a1', name: 'Private', published: false, stream: { name: 'ShouldBeIgnored' } },
        }), false);
        expect(t.appStream).toBe('');
    });

    test('should anonymize task and app names when anonymizeTaskNames is true', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowReloadTask(), true);

        // With mocked random-words, names are replaced with the mock return value
        expect(t.taskName).toBe('mocked random words');
        expect(t.appName).toBe('mocked random words');
    });

    test('should not set taskId when id is missing', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowReloadTask();
        delete task.id;
        await t.init('from_qseow', task, false);
        expect(t.taskId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// from_qseow — ExternalProgramTask
// ---------------------------------------------------------------------------

describe('QlikSenseTask.init — from_qseow ExternalProgramTask', () => {
    test('should map core ext-program properties', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowExtProgramTask();
        await t.init('from_qseow', task, false);

        expect(t.sourceType).toBe('from_qseow');
        expect(t.taskId).toBe('ext-task-1');
        expect(t.taskName).toBe('Nightly Cleanup');
        expect(t.taskEnabled).toBe(false);
        expect(t.path).toBe('/opt/scripts/cleanup.sh');
        expect(t.parameters).toBe('--force');
        expect(t.taskType).toBe(1);
    });

    test('should map execution timestamps and duration', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowExtProgramTask(), false);

        expect(t.taskLastExecutionStartTimestamp).toBe('2024-06-15T23:00:00.000Z');
        expect(t.taskLastExecutionDuration).toBe('0:01:00'); // 1 min
    });

    test('should anonymize ext-program task names', async () => {
        const t = new QlikSenseTask();
        await t.init('from_qseow', makeQseowExtProgramTask(), true);
        expect(t.taskName).toBe('mocked random words');
    });
});

// ---------------------------------------------------------------------------
// from_file — ReloadTask
// ---------------------------------------------------------------------------

describe('QlikSenseTask.init — from_file ReloadTask', () => {
    test('should map basic properties from file source', async () => {
        const t = new QlikSenseTask();
        const task = makeFileReloadTask();
        await t.init('from_file', task, false);

        expect(t.sourceType).toBe('from_file');
        expect(t.taskId).toBe('file-task-1');
        expect(t.taskName).toBe('File Reload');
        expect(t.taskEnabled).toBe(true);
        expect(t.appId).toBe('app-file-1');
        expect(t.appPublished).toBe(false);
        expect(t.appStream).toBe('');
        expect(t.isPartialReload).toBe(true);
        expect(t.isManuallyTriggered).toBe(true);
        expect(t.taskType).toBe(0);
    });

    test('should store schema and composite events from file', async () => {
        const t = new QlikSenseTask();
        await t.init('from_file', makeFileReloadTask(), false);

        expect(t.schemaEvents).toEqual([{ id: 'se-1' }]);
        expect(t.compositeEvents).toEqual([{ id: 'ce-1' }]);
    });

    test('should map tags and custom properties from file', async () => {
        const t = new QlikSenseTask();
        await t.init('from_file', makeFileReloadTask(), false);

        expect(t.taskTagsFriendly).toEqual(['Staging']);
        expect(t.taskCustomPropertiesFriendly).toEqual(['team=analytics']);
    });

    test('should not set execution timestamps for file source', async () => {
        const t = new QlikSenseTask();
        await t.init('from_file', makeFileReloadTask(), false);

        // from_file code path does not set these properties
        expect(t.taskLastExecutionStartTimestamp).toBeUndefined();
        expect(t.taskLastExecutionStopTimestamp).toBeUndefined();
        expect(t.taskLastExecutionDuration).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// from_file — ExternalProgramTask
// ---------------------------------------------------------------------------

describe('QlikSenseTask.init — from_file ExternalProgramTask', () => {
    test('should map ext-program properties from file', async () => {
        const t = new QlikSenseTask();
        const task = {
            schemaPath: 'ExternalProgramTask',
            id: 'ext-file-1',
            name: 'Ext from File',
            enabled: true,
            path: '/bin/sync',
            parameters: '--dry-run',
            maxRetries: 1,
            taskSessionTimeout: 30,
            tags: [{ name: 'Nightly' }],
            customProperties: [],
        };
        await t.init('from_file', task, false);

        expect(t.sourceType).toBe('from_file');
        expect(t.taskId).toBe('ext-file-1');
        expect(t.taskName).toBe('Ext from File');
        expect(t.path).toBe('/bin/sync');
        expect(t.parameters).toBe('--dry-run');
        expect(t.taskType).toBe(1);
        expect(t.taskTagsFriendly).toEqual(['Nightly']);
    });
});

// ---------------------------------------------------------------------------
// Duration formatting edge cases
// ---------------------------------------------------------------------------

describe('QlikSenseTask.init — duration formatting', () => {
    test('should format zero duration as 0:00:00', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowReloadTask({
            operational: {
                lastExecutionResult: {
                    startTime: '2024-01-01T00:00:00.000Z',
                    stopTime: '2024-01-01T00:00:00.000Z',
                    duration: 0,
                    executingNodeName: '',
                    status: 0,
                },
                nextExecution: '2024-01-01T00:00:00.000Z',
            },
        });
        await t.init('from_qseow', task, false);
        expect(t.taskLastExecutionDuration).toBe('0:00:00');
    });

    test('should format long duration correctly', async () => {
        const t = new QlikSenseTask();
        const task = makeQseowReloadTask({
            operational: {
                lastExecutionResult: {
                    startTime: '2024-01-01T00:00:00.000Z',
                    stopTime: '2024-01-01T02:30:45.000Z',
                    duration: 9045000, // 2h 30m 45s
                    executingNodeName: '',
                    status: 7,
                },
                nextExecution: '2024-01-01T00:00:00.000Z',
            },
        });
        await t.init('from_qseow', task, false);
        expect(t.taskLastExecutionDuration).toBe('2:30:45');
    });
});

// ---------------------------------------------------------------------------
// Case insensitivity of source parameter
// ---------------------------------------------------------------------------

describe('QlikSenseTask.init — source case insensitivity', () => {
    test('should accept FROM_QSEOW in any case', async () => {
        const t = new QlikSenseTask();
        await t.init('FROM_QSEOW', makeQseowReloadTask(), false);
        expect(t.sourceType).toBe('from_qseow');
    });

    test('should accept From_File in any case', async () => {
        const t = new QlikSenseTask();
        await t.init('From_File', makeFileReloadTask(), false);
        expect(t.sourceType).toBe('from_file');
    });
});
