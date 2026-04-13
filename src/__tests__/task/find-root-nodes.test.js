/**
 * Unit tests for src/lib/task/find_root_nodes.js
 *
 * Tests the root node finding algorithm used for:
 * - Finding all upstream root nodes for a given task
 * - Detecting circular dependencies in task network
 * - Traversing upstream edges to find top-level tasks
 *
 * These are pure utility functions that don't require live Qlik connection.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { extFindRootNodes } from '../../lib/task/find_root_nodes.js';

/**
 * Mock logger for testing - captures log messages
 */
const createMockLogger = () => ({
    error: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
});

/**
 * Helper to create a task node
 */
const createNode = (id, isTopLevelNode = false, taskName = 'Task') => ({
    id,
    taskName,
    isTopLevelNode,
});

/**
 * Helper to create a task network
 */
const createTaskNetwork = (nodes, edges) => ({
    nodes: nodes || [],
    edges: edges || [],
});

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

describe('extFindRootNodes - Top Level Node', () => {
    test('should return node when it is already a root node', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', true, 'Root Task');
        const network = createTaskNetwork([node], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('task-1');
    });

    test('should return empty array when node has no upstream connections but is not top level', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', false, 'Non-root Task');
        const network = createTaskNetwork([node], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(result).toHaveLength(0);
    });
});

describe('extFindRootNodes - Single Upstream Root', () => {
    test('should find single root node in direct upstream', () => {
        const logger = createMockLogger();
        const rootNode = createNode('root-1', true, 'Root Task');
        const childNode = createNode('task-1', false, 'Child Task');
        const network = createTaskNetwork([rootNode, childNode], [{ from: 'root-1', to: 'task-1' }]);

        const result = extFindRootNodes({ taskNetwork: network }, childNode, logger);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('root-1');
    });

    test('should return empty when upstream node not found', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', false, 'Orphan Task');
        const network = createTaskNetwork([node], [{ from: 'non-existent', to: 'task-1' }]);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(result).toHaveLength(0);
        expect(logger.error).toHaveBeenCalled();
    });
});

describe('extFindRootNodes - Multiple Upstream Roots', () => {
    test('should find multiple root nodes from different paths', () => {
        const logger = createMockLogger();
        const rootNode1 = createNode('root-1', true, 'Root 1');
        const rootNode2 = createNode('root-2', true, 'Root 2');
        const taskNode = createNode('task-1', false, 'Task');
        const network = createTaskNetwork(
            [rootNode1, rootNode2, taskNode],
            [
                { from: 'root-1', to: 'task-1' },
                { from: 'root-2', to: 'task-1' },
            ]
        );

        const result = extFindRootNodes({ taskNetwork: network }, taskNode, logger);

        expect(result).toHaveLength(2);
    });

    test('should return all matching root nodes (no deduplication)', () => {
        const logger = createMockLogger();
        const rootNode = createNode('root-1', true, 'Single Root');
        const taskNode = createNode('task-1', false, 'Task');
        const network = createTaskNetwork(
            [rootNode, taskNode],
            [
                { from: 'root-1', to: 'task-1' },
                { from: 'root-1', to: 'task-1' },
            ]
        );

        const result = extFindRootNodes({ taskNetwork: network }, taskNode, logger);

        // Note: function returns all matches, no deduplication
        expect(result).toHaveLength(2);
    });
});

describe('extFindRootNodes - Nested Chain', () => {
    test('should find root node through nested chain (A→B→C→root)', () => {
        const logger = createMockLogger();
        const rootNode = createNode('root-1', true, 'Root');
        const intermediateNode = createNode('task-1', false, 'Intermediate');
        const targetNode = createNode('task-2', false, 'Target');
        const network = createTaskNetwork(
            [rootNode, intermediateNode, targetNode],
            [
                { from: 'root-1', to: 'task-1' },
                { from: 'task-1', to: 'task-2' },
            ]
        );

        const result = extFindRootNodes({ taskNetwork: network }, targetNode, logger);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('root-1');
    });

    test('should find root through complex chain with multiple paths', () => {
        const logger = createMockLogger();
        const rootNode1 = createNode('root-1', true, 'Root 1');
        const rootNode2 = createNode('root-2', true, 'Root 2');
        const nodeA = createNode('A', false, 'Node A');
        const nodeB = createNode('B', false, 'Node B');
        const network = createTaskNetwork(
            [rootNode1, rootNode2, nodeA, nodeB],
            [
                { from: 'root-1', to: 'A' },
                { from: 'root-2', to: 'A' },
                { from: 'A', to: 'B' },
            ]
        );

        const result = extFindRootNodes({ taskNetwork: network }, nodeB, logger);

        expect(result).toHaveLength(2);
    });
});

describe('extFindRootNodes - Circular Dependency', () => {
    test('should handle circular dependency (A→B→A)', () => {
        const logger = createMockLogger();
        const nodeA = createNode('root-1', true, 'Node A');
        const nodeB = createNode('task-1', false, 'Node B');
        const network = createTaskNetwork(
            [nodeA, nodeB],
            [
                { from: 'root-1', to: 'task-1' },
                { from: 'task-1', to: 'root-1' },
            ]
        );

        const result = extFindRootNodes({ taskNetwork: network }, nodeB, logger);

        expect(result).toHaveLength(1);
    });

    test('should detect self-loop', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', false, 'Self Loop');
        const network = createTaskNetwork([node], [{ from: 'task-1', to: 'task-1' }]);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(result).toHaveLength(0);
    });
});

describe('extFindRootNodes - visitedNodes Parameter', () => {
    test('should use provided visitedNodes set', () => {
        const logger = createMockLogger();
        const visitedNodes = new Set(['already-visited']);
        const node = createNode('task-1', false, 'Task');
        const network = createTaskNetwork([node], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger, visitedNodes);

        expect(result).toHaveLength(0);
    });

    test('visitedNodes should prevent revisiting nodes', () => {
        const logger = createMockLogger();
        const rootNode = createNode('root-1', true, 'Root');
        const node = createNode('task-1', false, 'Task');
        const visitedNodes = new Set(['root-1']);
        const network = createTaskNetwork([rootNode, node], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger, visitedNodes);

        expect(result).toHaveLength(0);
    });
});

describe('extFindRootNodes - Edge Cases', () => {
    test('should handle empty network', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', false, 'Task');
        const network = createTaskNetwork([], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(result).toHaveLength(0);
    });

    test('should return correct structure', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', true, 'Root');
        const network = createTaskNetwork([node], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(Array.isArray(result)).toBe(true);
    });

    test('should handle node with taskName property', () => {
        const logger = createMockLogger();
        const node = createNode('task-1', true, 'My Custom Task');
        const network = createTaskNetwork([node], []);

        const result = extFindRootNodes({ taskNetwork: network }, node, logger);

        expect(result[0].taskName).toBe('My Custom Task');
    });
});
