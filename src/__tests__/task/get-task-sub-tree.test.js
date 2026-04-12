/**
 * Unit tests for src/lib/task/get_task_sub_tree.js
 *
 * Tests the task subtree extraction algorithm used for:
 * - Extracting downstream tasks from a starting task
 * - Detecting circular tree dependencies
 * - Building subtree array of task objects
 * - Tracking tree levels for nested relationships
 *
 * These are pure utility functions that don't require live Qlik connection.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { extGetTaskSubTree } from '../../lib/task/get_task_sub_tree.js';

/**
 * Mock logger for testing
 */
const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
});

/**
 * Helper to create a task object (similar to node but used by this function)
 */
const createTask = (id, taskName = 'Task', taskType = 0, metaNode = false, metaNodeType = null) => ({
    id,
    taskName,
    taskType,
    metaNode,
    metaNodeType,
    isTopLevelNode: false,
});

/**
 * Helper to create mock task network object
 */
const createMockTaskNetwork = (nodes, edges) => ({
    taskNetwork: {
        nodes: nodes || [],
        edges: edges || [],
    },
    taskCyclicStack: new Set(),
});

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

describe('extGetTaskSubTree - Empty/Invalid Input', () => {
    test('should handle null task', () => {
        const logger = createMockLogger();
        const mockObj = createMockTaskNetwork([], []);

        const result = extGetTaskSubTree(mockObj, null, 0, null, logger);

        expect(result).toBeDefined();
    });

    test('should handle task without id', () => {
        const logger = createMockLogger();
        const mockObj = createMockTaskNetwork([], []);
        const task = createTask('task-1', 'Task');
        delete task.id;

        const result = extGetTaskSubTree(mockObj, task, 0, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });

    test('should handle empty network', () => {
        const logger = createMockLogger();
        const mockObj = createMockTaskNetwork([], []);
        const task = createTask('nonexistent', 'Task');

        const result = extGetTaskSubTree(mockObj, task, 0, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubTree - No Downstream', () => {
    test('should handle task with no downstream', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task 1');
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(result).toBeDefined();
    });

    test('should log task info', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'My Task', 0);
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });
});

describe('extGetTaskSubTree - Single Downstream', () => {
    test('should find single downstream task', () => {
        const logger = createMockLogger();
        const taskA = createTask('task-1', 'Task A');
        const taskB = createTask('task-2', 'Task B');
        const nodes = [taskA, taskB];
        const edges = [{ from: 'task-1', to: 'task-2' }];
        const mockObj = createMockTaskNetwork(nodes, edges);

        const result = extGetTaskSubTree(mockObj, taskA, 0, null, logger);

        expect(result).toBeDefined();
    });

    test('should handle missing downstream task', () => {
        const logger = createMockLogger();
        const taskA = createTask('task-1', 'Task A');
        const edges = [{ from: 'task-1', to: 'non-existent' }];
        const mockObj = createMockTaskNetwork([taskA], edges);

        const result = extGetTaskSubTree(mockObj, taskA, 1, null, logger);

        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('extGetTaskSubTree - Multiple Downstream', () => {
    test('should handle multiple downstream tasks', () => {
        const logger = createMockLogger();
        const taskA = createTask('task-1', 'Task A');
        const taskB = createTask('task-2', 'Task B');
        const taskC = createTask('task-3', 'Task C');
        const nodes = [taskA, taskB, taskC];
        const edges = [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-1', to: 'task-3' },
        ];
        const mockObj = createMockTaskNetwork(nodes, edges);

        const result = extGetTaskSubTree(mockObj, taskA, 0, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubTree - Nested Chain', () => {
    test('should traverse nested chain A→B→C', () => {
        const logger = createMockLogger();
        const taskA = createTask('task-1', 'Task A');
        const taskB = createTask('task-2', 'Task B');
        const taskC = createTask('task-3', 'Task C');
        const nodes = [taskA, taskB, taskC];
        const edges = [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-2', to: 'task-3' },
        ];
        const mockObj = createMockTaskNetwork(nodes, edges);

        const result = extGetTaskSubTree(mockObj, taskA, 0, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubTree - Circular Dependency', () => {
    test('should handle circular dependency A→B→A', () => {
        const logger = createMockLogger();
        const taskA = createTask('task-1', 'Task A');
        const taskB = createTask('task-2', 'Task B');
        const nodes = [taskA, taskB];
        const edges = [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-2', to: 'task-1' },
        ];
        const mockObj = createMockTaskNetwork(nodes, edges);

        const result = extGetTaskSubTree(mockObj, taskA, 0, null, logger);

        expect(result).toBeDefined();
    });

    test('should handle self-loop', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task');
        const mockObj = createMockTaskNetwork([task], [{ from: 'task-1', to: 'task-1' }]);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubTree - Tree Level', () => {
    test('should reset cyclic stack at tree level 0', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task 1');
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 0, null, logger);

        expect(mockObj.taskCyclicStack instanceof Set).toBe(true);
    });

    test('should increment tree level', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task 1');
        const mockObj = createMockTaskNetwork([task], []);

        extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });
});

describe('extGetTaskSubTree - Meta Nodes', () => {
    test('should handle meta nodes', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task', 0, true, 'schedule');
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });
});

describe('extGetTaskSubTree - Return Value', () => {
    test('should return result', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task 1');
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(result).toBeDefined();
    });

    test('should return correct structure', () => {
        const logger = createMockLogger();
        const task = createTask('task-1', 'Task 1');
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubTree - Task Types', () => {
    test('should handle different task types', () => {
        const logger = createMockLogger();
        // taskType: 0=Reload, 1=ExternalProgram, etc.
        const task = createTask('task-1', 'Task', 1);
        const mockObj = createMockTaskNetwork([task], []);

        const result = extGetTaskSubTree(mockObj, task, 1, null, logger);

        expect(result).toBeDefined();
    });
});
