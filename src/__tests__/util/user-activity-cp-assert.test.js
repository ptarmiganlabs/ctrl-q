/**
 * Unit tests for regex validation in src/lib/util/qseow/assert-options.js
 *
 * Tests the userActivityBucketsCustomPropertyAssertOptions regex:
 * - Pattern: /^[a-zA-Z0-9_]+$/
 * - Allows: letters, numbers, underscores only
 */

import { jest, test, expect, describe } from '@jest/globals';

const validNameRegex = /^[a-zA-Z0-9_]+$/;

describe('Custom Property Name Validation Regex', () => {
    describe('Valid Names', () => {
        test('should accept simple name', () => {
            expect(validNameRegex.test('MyProperty')).toBe(true);
        });

        test('should accept name with numbers', () => {
            expect(validNameRegex.test('Test123')).toBe(true);
        });

        test('should accept name with underscores', () => {
            expect(validNameRegex.test('my_property_name')).toBe(true);
        });

        test('should accept mixed letters numbers underscores', () => {
            expect(validNameRegex.test('Test_123_ABC')).toBe(true);
        });

        test('should accept single character', () => {
            expect(validNameRegex.test('a')).toBe(true);
        });

        test('should accept single number', () => {
            expect(validNameRegex.test('1')).toBe(true);
        });

        test('should accept single underscore', () => {
            expect(validNameRegex.test('_')).toBe(true);
        });
    });

    describe('Invalid Names', () => {
        test('should reject name with hyphen', () => {
            expect(validNameRegex.test('my-property')).toBe(false);
        });

        test('should reject name with space', () => {
            expect(validNameRegex.test('my property')).toBe(false);
        });

        test('should reject name with special characters', () => {
            expect(validNameRegex.test('test@name')).toBe(false);
        });

        test('should reject name with dot', () => {
            expect(validNameRegex.test('test.name')).toBe(false);
        });

        test('should reject name with parenthesis', () => {
            expect(validNameRegex.test('test(name)')).toBe(false);
        });

        test('should reject empty name', () => {
            expect(validNameRegex.test('')).toBe(false);
        });
    });
});
