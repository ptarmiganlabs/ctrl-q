/**
 * Unit tests for src/lib/task/get_root_nodes_from_filter.js
 *
 * Tests the extGetRootNodesFromFilter function which finds root nodes
 * in a task network by filtering on taskId or taskTag, then traversing
 * upstream to locate root/top-level nodes.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { extGetRootNodesFromFilter } from '../../lib/task/get_root_nodes_from_filter.js';

const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    error: jest.fn(),
});

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Validation / edge cases
// ---------------------------------------------------------------------------

describe('extGetRootNodesFromFilter - validation', () => {
    test('should return false when taskNetwork is missing', async () => {
        const logger = createMockLogger();
        const ctx = { options: {} };
        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Task network not available'));
    });

    test('should return false when options is missing', async () => {
        const logger = createMockLogger();
        const ctx = { taskNetwork: { nodes: [], edges: [] } };
        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Options not available'));
    });

    test('should return empty deduplicated array when no filters specified', async () => {
        const logger = createMockLogger();
        const ctx = {
            taskNetwork: { nodes: [], edges: [] },
            options: {},
        };
        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Filter by taskId
// ---------------------------------------------------------------------------

describe('extGetRootNodesFromFilter - taskId filter', () => {
    test('should find root when filtered node is itself a top-level node', async () => {
        const logger = createMockLogger();
        const rootNode = { id: 'task-1', taskName: 'Root Task', isTopLevelNode: true };
        const ctx = {
            taskNetwork: { nodes: [rootNode], edges: [] },
            options: { taskId: ['task-1'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('task-1');
        expect(ctx.findRootNodes).not.toHaveBeenCalled();
    });

    test('should traverse upstream to find root for non-root node', async () => {
        const logger = createMockLogger();
        const rootNode = { id: 'root', taskName: 'Root', isTopLevelNode: true };
        const childNode = { id: 'child', taskName: 'Child', isTopLevelNode: false };
        const ctx = {
            taskNetwork: { nodes: [rootNode, childNode], edges: [] },
            options: { taskId: ['child'] },
            findRootNodes: jest.fn().mockReturnValue([rootNode]),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('root');
    });

    test('should return false when no nodes match taskId filter', async () => {
        const logger = createMockLogger();
        const ctx = {
            taskNetwork: { nodes: [{ id: 'task-1', taskName: 'T', isTopLevelNode: true }], edges: [] },
            options: { taskId: ['nonexistent'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No tasks found'));
    });

    test('should handle multiple taskId filters', async () => {
        const logger = createMockLogger();
        const node1 = { id: 't1', taskName: 'Task 1', isTopLevelNode: true };
        const node2 = { id: 't2', taskName: 'Task 2', isTopLevelNode: true };
        const ctx = {
            taskNetwork: { nodes: [node1, node2], edges: [] },
            options: { taskId: ['t1', 't2'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toHaveLength(2);
    });

    test('should deduplicate root nodes found from multiple filters', async () => {
        const logger = createMockLogger();
        const rootNode = { id: 'root', taskName: 'Root', isTopLevelNode: true };
        const child1 = { id: 'c1', taskName: 'Child 1', isTopLevelNode: false };
        const child2 = { id: 'c2', taskName: 'Child 2', isTopLevelNode: false };
        const ctx = {
            taskNetwork: { nodes: [rootNode, child1, child2], edges: [] },
            options: { taskId: ['c1', 'c2'] },
            findRootNodes: jest.fn().mockReturnValue([rootNode]),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        // Both children point to same root; should be deduplicated
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('root');
    });
});

// ---------------------------------------------------------------------------
// Filter by taskTag
// ---------------------------------------------------------------------------

describe('extGetRootNodesFromFilter - taskTag filter', () => {
    test('should find root when filtered by tag on top-level node', async () => {
        const logger = createMockLogger();
        const node = { id: 'task-1', taskName: 'Prod Task', isTopLevelNode: true, taskTags: ['Production'] };
        const ctx = {
            taskNetwork: { nodes: [node], edges: [] },
            options: { taskTag: ['Production'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('task-1');
    });

    test('should skip nodes without taskTags property', async () => {
        const logger = createMockLogger();
        const nodeNoTags = { id: 't1', taskName: 'No Tags', isTopLevelNode: true };
        const nodeWithTags = { id: 't2', taskName: 'With Tags', isTopLevelNode: true, taskTags: ['Dev'] };
        const ctx = {
            taskNetwork: { nodes: [nodeNoTags, nodeWithTags], edges: [] },
            options: { taskTag: ['Dev'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('t2');
    });

    test('should return false when no nodes match tag filter', async () => {
        const logger = createMockLogger();
        const ctx = {
            taskNetwork: { nodes: [{ id: 't1', taskName: 'T', isTopLevelNode: true, taskTags: ['X'] }], edges: [] },
            options: { taskTag: ['NonExistent'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toBe(false);
    });

    test('should traverse upstream for tagged non-root node', async () => {
        const logger = createMockLogger();
        const rootNode = { id: 'root', taskName: 'Root', isTopLevelNode: true };
        const taggedChild = { id: 'child', taskName: 'Tagged Child', isTopLevelNode: false, taskTags: ['Important'] };
        const ctx = {
            taskNetwork: { nodes: [rootNode, taggedChild], edges: [] },
            options: { taskTag: ['Important'] },
            findRootNodes: jest.fn().mockReturnValue([rootNode]),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('root');
    });
});

// ---------------------------------------------------------------------------
// Circular dependency handling
// ---------------------------------------------------------------------------

describe('extGetRootNodesFromFilter - circular dependency', () => {
    test('should handle circular dependency via findRootNodes check', async () => {
        const logger = createMockLogger();
        const nodeA = { id: 'a', taskName: 'A', isTopLevelNode: false };
        const ctx = {
            taskNetwork: { nodes: [nodeA], edges: [] },
            options: { taskId: ['a'] },
            // Simulate circular detection: returns empty
            findRootNodes: jest.fn().mockReturnValue([]),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// taskTag overrides taskId (both specified)
// ---------------------------------------------------------------------------

describe('extGetRootNodesFromFilter - both taskId and taskTag', () => {
    test('should process taskTag after taskId (taskTag resets rootNodes)', async () => {
        const logger = createMockLogger();
        const nodeById = { id: 'by-id', taskName: 'By ID', isTopLevelNode: true };
        const nodeByTag = { id: 'by-tag', taskName: 'By Tag', isTopLevelNode: true, taskTags: ['Special'] };
        const ctx = {
            taskNetwork: { nodes: [nodeById, nodeByTag], edges: [] },
            options: { taskId: ['by-id'], taskTag: ['Special'] },
            findRootNodes: jest.fn(),
        };

        const result = await extGetRootNodesFromFilter(ctx, logger);
        // taskTag block resets rootNodes, so only tag-filtered result remains
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('by-tag');
    });
});
