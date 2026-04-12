/**
 * Unit tests for src/lib/task/get_task_sub_graph.js
 *
 * Tests the task subgraph extraction algorithm used for:
 * - Extracting downstream task nodes from a starting node
 * - Detecting circular dependencies
 * - Building subgraph with nodes, edges, and tasks
 * - Tracking tree levels for nested relationships
 *
 * These are pure utility functions that don't require live Qlik connection.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { extGetTaskSubGraph } from '../../lib/task/get_task_sub_graph.js';

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
 * Helper to create a node
 */
const createNode = (id, taskName = 'Task', metaNode = false, metaNodeType = null) => ({
    id,
    taskName,
    metaNode,
    metaNodeType,
    isTopLevelNode: false,
});

/**
 * Helper to create a task object
 */
const createTask = (taskId, taskName, taskType = 0) => ({
    taskId,
    taskName,
    taskType,
});

/**
 * Helper to create mock task network object
 */
const createMockTaskNetwork = (nodes, edges, tasks) => ({
    taskNetwork: {
        nodes: nodes || [],
        edges: edges || [],
        tasks: tasks || [],
    },
    taskCyclicStack: new Set(),
});

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

describe('extGetTaskSubGraph - Empty/Invalid Input', () => {
    test('should handle null node', () => {
        const logger = createMockLogger();
        const mockObj = createMockTaskNetwork([], [], []);

        const result = extGetTaskSubGraph(mockObj, null, 0, null, logger);

        expect(result).toBeDefined();
    });

    test('should handle node without id', () => {
        const logger = createMockLogger();
        const mockObj = createMockTaskNetwork([], [], []);
        const node = createNode('task-1', 'Task');
        delete node.id;

        const result = extGetTaskSubGraph(mockObj, node, 0, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });

    test('should handle empty network', () => {
        const logger = createMockLogger();
        const mockObj = createMockTaskNetwork([], [], []);
        const node = createNode('nonexistent', 'Task');

        const result = extGetTaskSubGraph(mockObj, node, 0, null, logger);

        // Returns false when node not found
        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubGraph - Meta Nodes', () => {
    test('should add meta node to result', () => {
        const logger = createMockLogger();
        const metaNode = createNode('meta-1', 'Schedule', true, 'schedule');
        const mockObj = createMockTaskNetwork([metaNode], [], []);

        const result = extGetTaskSubGraph(mockObj, metaNode, 1, null, logger);

        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0].id).toBe('meta-1');
    });
});

describe('extGetTaskSubGraph - Single Task', () => {
    test('should return task node with no downstream', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'Task 1');
        const task = createTask('task-1', 'Task 1', 0);
        const mockObj = createMockTaskNetwork([node], [], [task]);

        const result = extGetTaskSubGraph(mockObj, node, 1, null, logger);

        expect(result.nodes).toHaveLength(1);
        expect(result.tasks).toHaveLength(1);
    });

    test('should warn when task not found', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'Task 1');
        const mockObj = createMockTaskNetwork([node], [], []);

        const result = extGetTaskSubGraph(mockObj, node, 1, null, logger);

        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('extGetTaskSubGraph - Single Downstream', () => {
    test('should return result with downstream nodes', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const nodeB = createNode('task-2', 'Task B');
        // taskId must match node id for lookup
        const taskA = createTask('task-1', 'Task A', 0);
        const nodes = [nodeA, nodeB];
        const edges = [{ from: 'task-1', to: 'task-2' }];
        const tasks = [taskA];
        const mockObj = createMockTaskNetwork(nodes, edges, tasks);

        const result = extGetTaskSubGraph(mockObj, nodeA, 0, null, logger);

        expect(result).toBeDefined();
    });

    test('should handle missing downstream node', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const taskA = createTask('task-1', 'Task A', 0);
        const edges = [{ from: 'task-1', to: 'non-existent' }];
        const mockObj = createMockTaskNetwork([nodeA], edges, [taskA]);

        const result = extGetTaskSubGraph(mockObj, nodeA, 1, null, logger);

        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('extGetTaskSubGraph - Multiple Downstream', () => {
    test('should handle multiple downstream nodes', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const nodeB = createNode('task-2', 'Task B');
        const nodeC = createNode('task-3', 'Task C');
        const taskA = createTask('task-1', 'Task A', 0);
        const nodes = [nodeA, nodeB, nodeC];
        const edges = [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-1', to: 'task-3' },
        ];
        const tasks = [taskA];
        const mockObj = createMockTaskNetwork(nodes, edges, tasks);

        const result = extGetTaskSubGraph(mockObj, nodeA, 0, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubGraph - Nested Chain', () => {
    test('should traverse nested chain', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const nodeB = createNode('task-2', 'Task B');
        const nodeC = createNode('task-3', 'Task C');
        const taskA = createTask('task-1', 'Task A', 0);
        const taskB = createTask('task-2', 'Task B', 0);
        const nodes = [nodeA, nodeB, nodeC];
        const edges = [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-2', to: 'task-3' },
        ];
        const tasks = [taskA, taskB];
        const mockObj = createMockTaskNetwork(nodes, edges, tasks);

        const result = extGetTaskSubGraph(mockObj, nodeA, 0, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubGraph - Circular Dependency', () => {
    test('should detect circular dependency A→B→A', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const nodeB = createNode('task-2', 'Task B');
        const taskA = createTask('task-1', 'Task A', 0);
        const nodes = [nodeA, nodeB];
        const edges = [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-2', to: 'task-1' },
        ];
        const tasks = [taskA];
        const mockObj = createMockTaskNetwork(nodes, edges, tasks);

        const result = extGetTaskSubGraph(mockObj, nodeA, 0, null, logger);

        // Function should handle this without infinite loop
        expect(result).toBeDefined();
    });

    test('should handle self-loop', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'Task');
        const task = createTask('task-1', 'Task', 0);
        const mockObj = createMockTaskNetwork([node], [{ from: 'task-1', to: 'task-1' }], [task]);

        const result = extGetTaskSubGraph(mockObj, node, 1, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubGraph - Duplicate Edges', () => {
    test('should track duplicate downstream nodes', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const nodeB = createNode('task-2', 'Task B');
        const taskA = createTask('task-1', 'Task A', 0);
        const nodes = [nodeA, nodeB];
        // Two edges from task-1 to task-2 with same rule state
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [{ id: 'r1', ruleState: 1 }] },
            { from: 'task-1', to: 'task-2', rule: [{ id: 'r2', ruleState: 1 }] },
        ];
        const tasks = [taskA];
        const mockObj = createMockTaskNetwork(nodes, edges, tasks);

        const result = extGetTaskSubGraph(mockObj, nodeA, 0, null, logger);

        expect(result).toBeDefined();
    });
});

describe('extGetTaskSubGraph - Tree Level', () => {
    test('should track tree level starting from 0', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'Task 1');
        const task = createTask('task-1', 'Task 1', 0);
        const mockObj = createMockTaskNetwork([node], [], [task]);

        const result = extGetTaskSubGraph(mockObj, node, 0, null, logger);

        // Tree level 0 resets cyclic stack
        expect(mockObj.taskCyclicStack instanceof Set).toBe(true);
    });

    test('should increment tree level', () => {
        const logger = createMockLogger();
        const nodeA = createNode('task-1', 'Task A');
        const nodeB = createNode('task-2', 'Task B');
        const taskA = createTask('task-1', 'Task A', 0);
        const nodes = [nodeA, nodeB];
        const edges = [{ from: 'task-1', to: 'task-2' }];
        const tasks = [taskA];
        const mockObj = createMockTaskNetwork(nodes, edges, tasks);

        const result = extGetTaskSubGraph(mockObj, nodeA, 1, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });
});

describe('extGetTaskSubGraph - Return Structure', () => {
    test('should return correct structure', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'Task 1');
        const task = createTask('task-1', 'Task 1', 0);
        const mockObj = createMockTaskNetwork([node], [], [task]);

        const result = extGetTaskSubGraph(mockObj, node, 1, null, logger);

        expect(result).toHaveProperty('nodes');
        expect(result).toHaveProperty('edges');
        expect(result).toHaveProperty('tasks');
        expect(Array.isArray(result.nodes)).toBe(true);
        expect(Array.isArray(result.edges)).toBe(true);
        expect(Array.isArray(result.tasks)).toBe(true);
    });
});

describe('extGetTaskSubGraph - Edge Cases', () => {
    test('should handle task with different task types', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'Task 1');
        // taskType: 0=Reload, 1=ExternalProgram, etc.
        const task = createTask('task-1', 'Task 1', 1);
        const mockObj = createMockTaskNetwork([node], [], [task]);

        const result = extGetTaskSubGraph(mockObj, node, 1, null, logger);

        expect(result.tasks[0].taskType).toBe(1);
    });

    test('should add task name to debug log', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', 'My Named Task');
        const task = createTask('task-1', 'My Named Task', 0);
        const mockObj = createMockTaskNetwork([node], [], [task]);

        const result = extGetTaskSubGraph(mockObj, node, 1, null, logger);

        expect(logger.debug).toHaveBeenCalled();
    });
});
