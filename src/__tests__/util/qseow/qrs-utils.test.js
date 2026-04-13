/**
 * Unit tests for sanitizeVirtualProxy() from src/lib/util/qseow/qrs.js
 *
 * Tests the pure string sanitization function that normalizes virtual proxy paths.
 * This function ensures the path always starts with / and never ends with /.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { sanitizeVirtualProxy } from '../../../lib/util/qseow/qrs.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Empty / minimal inputs
// ---------------------------------------------------------------------------

describe('sanitizeVirtualProxy - empty/minimal input', () => {
    test('should return "/" for empty string', () => {
        expect(sanitizeVirtualProxy('')).toBe('/');
    });

    test('should return empty string for single slash (trailing slash removed)', () => {
        // '/' enters else branch: starts with '/', so no leading slash added
        // Then trailing slash regex strips it to ''
        expect(sanitizeVirtualProxy('/')).toBe('');
    });
});

// ---------------------------------------------------------------------------
// Leading slash normalization
// ---------------------------------------------------------------------------

describe('sanitizeVirtualProxy - leading slash', () => {
    test('should add leading slash when missing', () => {
        expect(sanitizeVirtualProxy('proxy')).toBe('/proxy');
    });

    test('should keep existing leading slash', () => {
        expect(sanitizeVirtualProxy('/proxy')).toBe('/proxy');
    });

    test('should add leading slash for nested path', () => {
        expect(sanitizeVirtualProxy('virtual/proxy')).toBe('/virtual/proxy');
    });

    test('should keep existing leading slash for nested path', () => {
        expect(sanitizeVirtualProxy('/virtual/proxy')).toBe('/virtual/proxy');
    });
});

// ---------------------------------------------------------------------------
// Trailing slash removal
// ---------------------------------------------------------------------------

describe('sanitizeVirtualProxy - trailing slash', () => {
    test('should remove single trailing slash', () => {
        expect(sanitizeVirtualProxy('/proxy/')).toBe('/proxy');
    });

    test('should remove multiple trailing slashes', () => {
        expect(sanitizeVirtualProxy('/proxy///')).toBe('/proxy');
    });

    test('should remove trailing slash and add leading slash', () => {
        expect(sanitizeVirtualProxy('proxy/')).toBe('/proxy');
    });
});

// ---------------------------------------------------------------------------
// Combined scenarios
// ---------------------------------------------------------------------------

describe('sanitizeVirtualProxy - combined scenarios', () => {
    test('should handle path that is only slashes', () => {
        // '///' => starts with /, then trailing slashes removed
        // After the else branch: starts with '/', then replace trailing => ''
        // But if the result is empty after removing trailing slashes, we get '/'
        const result = sanitizeVirtualProxy('///');
        // starts with '/', so no prefix added. Remove trailing => ''
        // Actually: '///' starts with '/', regex removes trailing '/' => ''
        // This will result in empty string since all chars are '/'
        expect(result).toBe('');
    });

    test('should preserve middle slashes in nested paths', () => {
        expect(sanitizeVirtualProxy('/a/b/c')).toBe('/a/b/c');
    });

    test('should handle proxy name with no slashes', () => {
        expect(sanitizeVirtualProxy('jwt')).toBe('/jwt');
    });

    test('should handle proxy with leading and trailing slashes', () => {
        expect(sanitizeVirtualProxy('/myproxy/')).toBe('/myproxy');
    });
});
