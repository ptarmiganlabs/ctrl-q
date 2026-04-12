/**
 * Unit tests for src/lib/task/find_circular_task_chain.js
 *
 * Tests the circular task chain detection algorithm used for:
 * - Detecting circular dependencies in task networks
 * - Finding duplicate edges in task triggers
 * - Graph traversal for task relationship analysis
 *
 * These are pure utility functions that don't require live Qlik connection.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { findCircularTaskChains } from '../../lib/task/find_circular_task_chain.js';

/**
 * Mock logger for testing - captures log messages
 */
const createMockLogger = () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
});

/**
 * Helper to create a basic task network
 */
const createTaskNetwork = (nodes, edges) => ({
    nodes: nodes || [],
    edges: edges || [],
    tasks: [],
});

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

describe('findCircularTaskChains - Empty Network', () => {
    test('should handle empty nodes array', () => {
        const logger = createMockLogger();
        const network = createTaskNetwork([], []);

        const result = findCircularTaskChains(network, logger);

        expect(result).toEqual({ circularTaskChains: [], duplicateEdges: [] });
    });

    test('should handle null network', () => {
        const logger = createMockLogger();

        const result = findCircularTaskChains(null, logger);

        expect(result).toBe(false);
    });

    test('should handle undefined nodes', () => {
        const logger = createMockLogger();
        const network = createTaskNetwork(undefined, []);

        const result = findCircularTaskChains(network, logger);

        // Returns empty result when nodes is undefined but network exists
        expect(result).toEqual({ circularTaskChains: [], duplicateEdges: [] });
    });
});

describe('findCircularTaskChains - Linear Chain (No Circles)', () => {
    test('should handle single task with no edges', () => {
        const logger = createMockLogger();
        const nodes = [{ id: 'task-1', name: 'Task 1', isTopLevelNode: true }];
        const network = createTaskNetwork(nodes, []);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains).toHaveLength(0);
        expect(result.duplicateEdges).toHaveLength(0);
    });

    test('should handle two tasks in linear chain (A→B)', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        const edges = [{ from: 'task-1', to: 'task-2', rule: [] }];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains).toHaveLength(0);
        expect(result.duplicateEdges).toHaveLength(0);
    });

    test('should handle three tasks in linear chain (A→B→C)', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
            { id: 'task-3', name: 'Task 3', isTopLevelNode: false },
        ];
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [] },
            { from: 'task-2', to: 'task-3', rule: [] },
        ];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains).toHaveLength(0);
    });
});

describe('findCircularTaskChains - Circular Dependencies', () => {
    test('should detect simple circular dependency (A→B→A)', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [] },
            { from: 'task-2', to: 'task-1', rule: [] },
        ];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains.length).toBeGreaterThan(0);
    });

    test('should detect self-loop (A→A)', () => {
        const logger = createMockLogger();
        const nodes = [{ id: 'task-1', name: 'Task 1', isTopLevelNode: true }];
        const edges = [{ from: 'task-1', to: 'task-1', rule: [] }];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains.length).toBeGreaterThan(0);
    });

    test('should detect multiple circular dependencies', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
            { id: 'task-3', name: 'Task 3', isTopLevelNode: false },
        ];
        // Circle: A→B→A and B→C→B
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [] },
            { from: 'task-2', to: 'task-1', rule: [] },
            { from: 'task-2', to: 'task-3', rule: [] },
            { from: 'task-3', to: 'task-2', rule: [] },
        ];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains.length).toBeGreaterThanOrEqual(1);
    });
});

describe('findCircularTaskChains - Duplicate Edges', () => {
    test('should detect duplicate edges with same target and rule', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        // Two edges from task-1 to task-2 with the same rule state
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [{ id: 'rule-1', ruleState: 1 }] },
            { from: 'task-1', to: 'task-2', rule: [{ id: 'rule-2', ruleState: 1 }] },
        ];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.duplicateEdges.length).toBeGreaterThan(0);
    });

    test('should not flag edges with different rule states as duplicates', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        // Two edges with different rule states (1 = TaskSuccessful, 2 = TaskFail)
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [{ id: 'rule-1', ruleState: 1 }] },
            { from: 'task-1', to: 'task-2', rule: [{ id: 'rule-2', ruleState: 2 }] },
        ];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.duplicateEdges).toHaveLength(0);
    });
});

describe('findCircularTaskChains - Edge Cases', () => {
    test('should handle parallel edges to different targets', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
            { id: 'task-3', name: 'Task 3', isTopLevelNode: false },
        ];
        // task-1 connects to both task-2 and task-3
        const edges = [
            { from: 'task-1', to: 'task-2', rule: [] },
            { from: 'task-1', to: 'task-3', rule: [] },
        ];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains).toHaveLength(0);
        expect(result.duplicateEdges).toHaveLength(0);
    });

    test('should handle non-existent node references in edges', () => {
        const logger = createMockLogger();
        const nodes = [{ id: 'task-1', name: 'Task 1', isTopLevelNode: true }];
        // Edge points to non-existent node
        const edges = [{ from: 'task-1', to: 'non-existent', rule: [] }];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        // Should still return result, possibly with errors logged
        expect(result).toBeDefined();
    });

    test('should handle edge without rule property', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        // Edge with no rule property
        const edges = [{ from: 'task-1', to: 'task-2' }];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result.circularTaskChains).toHaveLength(0);
    });

    test('should handle single rule object (not array)', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true },
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        // Rule as single object instead of array
        const edges = [{ from: 'task-1', to: 'task-2', rule: { id: 'rule-1', ruleState: 1 } }];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(result).toBeDefined();
    });
});

describe('findCircularTaskChains - Network Structure', () => {
    test('should use isTopLevelNode to find root nodes', () => {
        const logger = createMockLogger();
        const nodes = [
            { id: 'task-1', name: 'Task 1', isTopLevelNode: true }, // Root
            { id: 'task-2', name: 'Task 2', isTopLevelNode: false },
        ];
        const edges = [{ from: 'task-1', to: 'task-2', rule: [] }];
        const network = createTaskNetwork(nodes, edges);

        const result = findCircularTaskChains(network, logger);

        expect(logger.info).toHaveBeenCalled();
        expect(result).toBeDefined();
    });

    test('should return correct structure', () => {
        const logger = createMockLogger();
        const nodes = [{ id: 'task-1', name: 'Task 1', isTopLevelNode: true }];
        const network = createTaskNetwork(nodes, []);

        const result = findCircularTaskChains(network, logger);

        expect(result).toHaveProperty('circularTaskChains');
        expect(result).toHaveProperty('duplicateEdges');
        expect(Array.isArray(result.circularTaskChains)).toBe(true);
        expect(Array.isArray(result.duplicateEdges)).toBe(true);
    });
});
