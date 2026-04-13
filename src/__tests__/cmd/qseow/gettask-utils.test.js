/**
 * Unit tests for pure utility functions from src/lib/cmd/qseow/gettask.js
 *
 * Tests compareTree(), compareTable(), and cleanupTaskTree() which are
 * pure functions used for sorting and formatting task data structures.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { cleanupTaskTree, compareTree, compareTable } from '../../../lib/cmd/qseow/gettask.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// compareTree
// ---------------------------------------------------------------------------

describe('compareTree', () => {
    test('should return -1 when a.text < b.text', () => {
        expect(compareTree({ text: 'Alpha' }, { text: 'Beta' })).toBe(-1);
    });

    test('should return 1 when a.text > b.text', () => {
        expect(compareTree({ text: 'Beta' }, { text: 'Alpha' })).toBe(1);
    });

    test('should return 0 when a.text === b.text', () => {
        expect(compareTree({ text: 'Same' }, { text: 'Same' })).toBe(0);
    });

    test('should sort uppercase before lowercase', () => {
        // JS string comparison: 'A' < 'a'
        expect(compareTree({ text: 'Alpha' }, { text: 'alpha' })).toBe(-1);
    });

    test('should handle empty text strings', () => {
        expect(compareTree({ text: '' }, { text: '' })).toBe(0);
    });

    test('should sort empty string before non-empty', () => {
        expect(compareTree({ text: '' }, { text: 'A' })).toBe(-1);
    });

    test('should be usable with Array.sort()', () => {
        const items = [{ text: 'C' }, { text: 'A' }, { text: 'B' }];
        items.sort(compareTree);
        expect(items.map((i) => i.text)).toEqual(['A', 'B', 'C']);
    });
});

// ---------------------------------------------------------------------------
// compareTable
// ---------------------------------------------------------------------------

describe('compareTable', () => {
    test('should sort by schemaPath first', () => {
        const a = { taskName: 'Z', completeTaskObject: { schemaPath: 'ExternalProgramTask' } };
        const b = { taskName: 'A', completeTaskObject: { schemaPath: 'ReloadTask' } };
        expect(compareTable(a, b)).toBe(-1);
    });

    test('should sort by taskName when schemaPath is equal', () => {
        const a = { taskName: 'Alpha', completeTaskObject: { schemaPath: 'ReloadTask' } };
        const b = { taskName: 'Beta', completeTaskObject: { schemaPath: 'ReloadTask' } };
        expect(compareTable(a, b)).toBe(-1);
    });

    test('should return 0 for identical schemaPath and taskName', () => {
        const a = { taskName: 'Same', completeTaskObject: { schemaPath: 'ReloadTask' } };
        const b = { taskName: 'Same', completeTaskObject: { schemaPath: 'ReloadTask' } };
        expect(compareTable(a, b)).toBe(0);
    });

    test('should return 1 when a comes after b', () => {
        const a = { taskName: 'Z', completeTaskObject: { schemaPath: 'ReloadTask' } };
        const b = { taskName: 'A', completeTaskObject: { schemaPath: 'ReloadTask' } };
        expect(compareTable(a, b)).toBe(1);
    });

    test('should be usable with Array.sort()', () => {
        const tasks = [
            { taskName: 'B', completeTaskObject: { schemaPath: 'ReloadTask' } },
            { taskName: 'A', completeTaskObject: { schemaPath: 'ReloadTask' } },
            { taskName: 'C', completeTaskObject: { schemaPath: 'ExternalProgramTask' } },
        ];
        tasks.sort(compareTable);
        // ExternalProgramTask|C < ReloadTask|A < ReloadTask|B
        expect(tasks.map((t) => t.taskName)).toEqual(['C', 'A', 'B']);
    });
});

// ---------------------------------------------------------------------------
// cleanupTaskTree
// ---------------------------------------------------------------------------

describe('cleanupTaskTree', () => {
    test('should remove all properties except text and children', () => {
        const tree = [
            {
                text: 'Root',
                id: '123',
                taskId: 'abc',
                children: [],
            },
        ];

        cleanupTaskTree(tree);

        expect(tree[0]).toEqual({ text: 'Root', children: [] });
        expect(tree[0].id).toBeUndefined();
        expect(tree[0].taskId).toBeUndefined();
    });

    test('should handle empty array', () => {
        const tree = [];
        cleanupTaskTree(tree);
        expect(tree).toEqual([]);
    });

    test('should recursively clean nested children', () => {
        const tree = [
            {
                text: 'Root',
                extra: true,
                children: [
                    {
                        text: 'Child',
                        deep: 'value',
                        children: [
                            {
                                text: 'Grandchild',
                                another: 42,
                            },
                        ],
                    },
                ],
            },
        ];

        cleanupTaskTree(tree);

        expect(tree[0].extra).toBeUndefined();
        expect(tree[0].children[0].deep).toBeUndefined();
        expect(tree[0].children[0].children[0].another).toBeUndefined();
        expect(tree[0].text).toBe('Root');
        expect(tree[0].children[0].text).toBe('Child');
        expect(tree[0].children[0].children[0].text).toBe('Grandchild');
    });

    test('should handle nodes without children property', () => {
        const tree = [
            {
                text: 'Leaf',
                id: '1',
            },
        ];

        cleanupTaskTree(tree);

        expect(tree[0]).toEqual({ text: 'Leaf' });
    });

    test('should handle multiple sibling nodes', () => {
        const tree = [
            { text: 'A', extra: 1 },
            { text: 'B', extra: 2 },
            { text: 'C', extra: 3 },
        ];

        cleanupTaskTree(tree);

        expect(tree).toEqual([{ text: 'A' }, { text: 'B' }, { text: 'C' }]);
    });

    test('should preserve text value through cleanup', () => {
        const tree = [
            {
                text: 'Special chars: ÅÄÖ & <script>',
                id: 'x',
            },
        ];

        cleanupTaskTree(tree);

        expect(tree[0].text).toBe('Special chars: ÅÄÖ & <script>');
    });
});
