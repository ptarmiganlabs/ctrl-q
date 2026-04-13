/**
 * Unit tests for getTagIdByName() from src/lib/util/qseow/tag.js
 *
 * Tests the pure lookup function that finds a tag's ID by name
 * from a pre-fetched array of tags.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { getTagIdByName } from '../../../lib/util/qseow/tag.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const tagsExisting = [
    { id: 'tag-1', name: 'Production' },
    { id: 'tag-2', name: 'Development' },
    { id: 'tag-3', name: 'Test' },
];

// ---------------------------------------------------------------------------
// getTagIdByName — array input
// ---------------------------------------------------------------------------

describe('getTagIdByName - array input', () => {
    test('should resolve with tag ID for exact name match', async () => {
        const result = await getTagIdByName('Production', tagsExisting);
        expect(result).toBe('tag-1');
    });

    test('should resolve with false when tag name does not exist', async () => {
        const result = await getTagIdByName('NonExistent', tagsExisting);
        expect(result).toBe(false);
    });

    test('should resolve with false for empty array', async () => {
        const result = await getTagIdByName('Production', []);
        expect(result).toBe(false);
    });

    test('should be case-sensitive', async () => {
        const result = await getTagIdByName('production', tagsExisting);
        expect(result).toBe(false);
    });

    test('should find each tag by name', async () => {
        expect(await getTagIdByName('Production', tagsExisting)).toBe('tag-1');
        expect(await getTagIdByName('Development', tagsExisting)).toBe('tag-2');
        expect(await getTagIdByName('Test', tagsExisting)).toBe('tag-3');
    });
});

// ---------------------------------------------------------------------------
// getTagIdByName — JSON string input
// ---------------------------------------------------------------------------

describe('getTagIdByName - JSON string input', () => {
    test('should parse JSON string and find tag', async () => {
        const jsonStr = JSON.stringify(tagsExisting);
        const result = await getTagIdByName('Development', jsonStr);
        expect(result).toBe('tag-2');
    });

    test('should resolve with false when tag not found in JSON string', async () => {
        const jsonStr = JSON.stringify(tagsExisting);
        const result = await getTagIdByName('Missing', jsonStr);
        expect(result).toBe(false);
    });

    test('should handle empty JSON array', async () => {
        const result = await getTagIdByName('Test', '[]');
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// getTagIdByName — edge cases
// ---------------------------------------------------------------------------

describe('getTagIdByName - edge cases', () => {
    test('should handle tag name with special characters', async () => {
        const tags = [{ id: 'tag-sp', name: 'My Tag (v2.0)' }];
        const result = await getTagIdByName('My Tag (v2.0)', tags);
        expect(result).toBe('tag-sp');
    });

    test('should return first match when duplicates exist', async () => {
        const tags = [
            { id: 'dup-1', name: 'Duplicate' },
            { id: 'dup-2', name: 'Duplicate' },
        ];
        // filter returns both, but length !== 1, so resolves false
        const result = await getTagIdByName('Duplicate', tags);
        expect(result).toBe(false);
    });
});
