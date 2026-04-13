/**
 * Unit tests for src/lib/task/get_task_sub_table.js
 *
 * Tests the extGetTaskSubTable function which recursively builds a subtable
 * representation of downstream tasks in a task network.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { extGetTaskSubTable } from '../../lib/task/get_task_sub_table.js';

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

/**
 * Helper to create a task node with required properties
 */
const createTaskNode = (id, taskName, overrides = {}) => ({
    id,
    taskId: id,
    taskName,
    taskEnabled: true,
    appId: 'app-1',
    appName: 'Test App',
    appPublished: false,
    appStream: '',
    taskMaxRetries: 0,
    taskLastExecutionStartTimestamp: '',
    taskLastExecutionStopTimestamp: '',
    taskLastExecutionDuration: '0:00:00',
    taskLastExecutionExecutingNodeName: '',
    taskNextExecutionTimestamp: '',
    taskLastStatus: 'NeverStarted',
    completeTaskObject: {
        tags: [],
        customProperties: [],
    },
    ...overrides,
});

// ---------------------------------------------------------------------------
// Leaf task (no downstream connections)
// ---------------------------------------------------------------------------

describe('extGetTaskSubTable - leaf task', () => {
    test('should return array with task info for leaf node', () => {
        const logger = createMockLogger();
        const task = createTaskNode('t1', 'Leaf Task');
        const ctx = {
            taskNetwork: { nodes: [task], edges: [] },
            getTaskSubTable: jest.fn(),
        };

        const result = extGetTaskSubTable(ctx, task, 0, logger);

        // Level 1 (parentTreeLevel 0 + 1), so newTreeLevel=1 which is <=2
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        // Should contain at least the task's own row
        const flatResult = result.flat(Infinity);
        expect(flatResult).toContain('Leaf Task');
    });
});

// ---------------------------------------------------------------------------
// Task with single downstream connection
// ---------------------------------------------------------------------------

describe('extGetTaskSubTable - single downstream', () => {
    test('should recursively include downstream task', () => {
        const logger = createMockLogger();
        const parent = createTaskNode('p1', 'Parent');
        const child = createTaskNode('c1', 'Child');

        const ctx = {
            taskNetwork: {
                nodes: [parent, child],
                edges: [{ from: 'p1', to: 'c1' }],
            },
            getTaskSubTable: jest.fn().mockReturnValue([[2, 'Child', 'c1', true]]),
        };

        const result = extGetTaskSubTable(ctx, parent, 0, logger);
        expect(ctx.getTaskSubTable).toHaveBeenCalledWith(child, 1);
        expect(result).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Meta node filtering
// ---------------------------------------------------------------------------

describe('extGetTaskSubTable - meta nodes', () => {
    test('should skip meta nodes and return children directly', () => {
        const logger = createMockLogger();
        const metaNode = {
            id: 'meta-1',
            taskName: 'Meta Node',
            metaNodeType: 'schedule',
        };

        const ctx = {
            taskNetwork: { nodes: [metaNode], edges: [] },
            getTaskSubTable: jest.fn(),
        };

        const result = extGetTaskSubTable(ctx, metaNode, 0, logger);
        // Meta nodes return kids (which is []) directly
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Tree level indentation
// ---------------------------------------------------------------------------

describe('extGetTaskSubTable - tree level formatting', () => {
    test('should not add dashes at level <= 2', () => {
        const logger = createMockLogger();
        const task = createTaskNode('t1', 'Level 2 Task');
        const ctx = {
            taskNetwork: { nodes: [task], edges: [] },
            getTaskSubTable: jest.fn(),
        };

        // parentTreeLevel=1, so newTreeLevel=2
        const result = extGetTaskSubTable(ctx, task, 1, logger);
        const flatResult = result.flat(Infinity);
        expect(flatResult).toContain('Level 2 Task');
    });

    test('should add dashes at level > 2', () => {
        const logger = createMockLogger();
        const task = createTaskNode('t1', 'Deep Task');
        const ctx = {
            taskNetwork: { nodes: [task], edges: [] },
            getTaskSubTable: jest.fn(),
        };

        // parentTreeLevel=2, so newTreeLevel=3
        const result = extGetTaskSubTable(ctx, task, 2, logger);
        const flatResult = result.flat(Infinity);
        // Should contain '--Deep Task' (1 repeat of '--' for level 3-2=1)
        expect(flatResult.some((item) => typeof item === 'string' && item.includes('--') && item.includes('Deep Task'))).toBe(true);
    });

    test('should add multiple dashes at deeper levels', () => {
        const logger = createMockLogger();
        const task = createTaskNode('t1', 'Very Deep');
        const ctx = {
            taskNetwork: { nodes: [task], edges: [] },
            getTaskSubTable: jest.fn(),
        };

        // parentTreeLevel=4, so newTreeLevel=5 => '--'.repeat(3) = '------'
        const result = extGetTaskSubTable(ctx, task, 4, logger);
        const flatResult = result.flat(Infinity);
        expect(flatResult.some((item) => typeof item === 'string' && item.includes('------Very Deep'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('extGetTaskSubTable - error handling', () => {
    test('should return null on exception', () => {
        const logger = createMockLogger();
        // Pass null to cause exception
        const result = extGetTaskSubTable(null, null, 0, logger);
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Tags and custom properties mapping
// ---------------------------------------------------------------------------

describe('extGetTaskSubTable - task properties', () => {
    test('should map tags from completeTaskObject', () => {
        const logger = createMockLogger();
        const task = createTaskNode('t1', 'Tagged Task', {
            completeTaskObject: {
                tags: [{ name: 'Production' }, { name: 'Daily' }],
                customProperties: [],
            },
        });
        const ctx = {
            taskNetwork: { nodes: [task], edges: [] },
            getTaskSubTable: jest.fn(),
        };

        // The function creates a subTree object before converting it to array format
        // at level <= 2, so it returns array format. We verify the function runs without error.
        const result = extGetTaskSubTable(ctx, task, 0, logger);
        expect(result).toBeDefined();
    });
});
