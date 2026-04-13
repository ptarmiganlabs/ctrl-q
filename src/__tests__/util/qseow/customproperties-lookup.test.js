/**
 * Unit tests for pure lookup functions in src/lib/util/qseow/customproperties.js
 *
 * Tests getCustomPropertyIdByName(), getCustomPropertyDefinitionByName(),
 * and doesCustomPropertyValueExist() which are pure lookups over pre-fetched arrays.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import {
    getCustomPropertyIdByName,
    getCustomPropertyDefinitionByName,
    doesCustomPropertyValueExist,
} from '../../../lib/util/qseow/customproperties.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const makeCp = (id, name, objectTypes, choiceValues = []) => ({
    id,
    name,
    objectTypes,
    choiceValues,
});

const cpExisting = [
    makeCp('cp-1', 'Department', ['App', 'ReloadTask'], ['Sales', 'Marketing', 'IT']),
    makeCp('cp-2', 'Environment', ['App'], ['Dev', 'Test', 'Prod']),
    makeCp('cp-3', 'Owner', ['ReloadTask', 'ExternalProgramTask'], ['Alice', 'Bob']),
];

// ---------------------------------------------------------------------------
// getCustomPropertyIdByName
// ---------------------------------------------------------------------------

describe('getCustomPropertyIdByName', () => {
    test('should return ID for exact match with valid objectType', () => {
        const result = getCustomPropertyIdByName('ReloadTask', 'Department', cpExisting);
        expect(result).toBe('cp-1');
    });

    test('should return ID with case-insensitive objectType check', () => {
        const result = getCustomPropertyIdByName('reloadtask', 'Department', cpExisting);
        expect(result).toBe('cp-1');
    });

    test('should return false when CP name does not exist', () => {
        const result = getCustomPropertyIdByName('App', 'NonExistent', cpExisting);
        expect(result).toBe(false);
    });

    test('should return false when CP exists but not valid for objectType', () => {
        const result = getCustomPropertyIdByName('ReloadTask', 'Environment', cpExisting);
        expect(result).toBe(false);
    });

    test('should return false for empty cpExisting array', () => {
        const result = getCustomPropertyIdByName('App', 'Department', []);
        expect(result).toBe(false);
    });

    test('should handle App objectType correctly', () => {
        const result = getCustomPropertyIdByName('App', 'Department', cpExisting);
        expect(result).toBe('cp-1');
    });

    test('should handle ExternalProgramTask objectType', () => {
        const result = getCustomPropertyIdByName('ExternalProgramTask', 'Owner', cpExisting);
        expect(result).toBe('cp-3');
    });
});

// ---------------------------------------------------------------------------
// getCustomPropertyDefinitionByName
// ---------------------------------------------------------------------------

describe('getCustomPropertyDefinitionByName', () => {
    test('should return full definition for exact match', () => {
        const result = getCustomPropertyDefinitionByName('App', 'Department', cpExisting);
        expect(result).toEqual(cpExisting[0]);
    });

    test('should return false when CP name does not exist', () => {
        const result = getCustomPropertyDefinitionByName('App', 'Missing', cpExisting);
        expect(result).toBe(false);
    });

    test('should return false when CP exists but not valid for objectType', () => {
        const result = getCustomPropertyDefinitionByName('ReloadTask', 'Environment', cpExisting);
        expect(result).toBe(false);
    });

    test('should return the object with all properties', () => {
        const result = getCustomPropertyDefinitionByName('App', 'Environment', cpExisting);
        expect(result.id).toBe('cp-2');
        expect(result.name).toBe('Environment');
        expect(result.choiceValues).toEqual(['Dev', 'Test', 'Prod']);
    });

    test('should handle case-insensitive objectType', () => {
        const result = getCustomPropertyDefinitionByName('app', 'Environment', cpExisting);
        expect(result).toEqual(cpExisting[1]);
    });
});

// ---------------------------------------------------------------------------
// doesCustomPropertyValueExist
// ---------------------------------------------------------------------------

describe('doesCustomPropertyValueExist', () => {
    test('should return ID when value exists in choiceValues', () => {
        const result = doesCustomPropertyValueExist('App', 'Department', 'Sales', cpExisting);
        expect(result).toBe('cp-1');
    });

    test('should return false when value does not exist in choiceValues', () => {
        const result = doesCustomPropertyValueExist('App', 'Department', 'Unknown', cpExisting);
        expect(result).toBe(false);
    });

    test('should return false when CP name does not exist', () => {
        const result = doesCustomPropertyValueExist('App', 'Missing', 'Sales', cpExisting);
        expect(result).toBe(false);
    });

    test('should return false when CP exists but not valid for objectType', () => {
        const result = doesCustomPropertyValueExist('ReloadTask', 'Environment', 'Dev', cpExisting);
        expect(result).toBe(false);
    });

    test('should be case-sensitive for value matching', () => {
        const result = doesCustomPropertyValueExist('App', 'Department', 'sales', cpExisting);
        expect(result).toBe(false);
    });

    test('should return false for empty cpExisting array', () => {
        const result = doesCustomPropertyValueExist('App', 'Department', 'Sales', []);
        expect(result).toBe(false);
    });

    test('should handle multiple valid values', () => {
        expect(doesCustomPropertyValueExist('App', 'Environment', 'Dev', cpExisting)).toBe('cp-2');
        expect(doesCustomPropertyValueExist('App', 'Environment', 'Test', cpExisting)).toBe('cp-2');
        expect(doesCustomPropertyValueExist('App', 'Environment', 'Prod', cpExisting)).toBe('cp-2');
    });
});
