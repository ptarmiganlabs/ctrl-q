/**
 * Unit tests for pure validator functions in src/lib/util/qseow/assert-options.js
 *
 * Tests all exported validate*() functions — no process.exit, no live Qlik connection.
 */

import { describe, test, expect } from '@jest/globals';
import {
    validateMasterItemImportOptions,
    validateMasterItemMeasureDeleteOptions,
    validateMasterItemDimDeleteOptions,
    validateTaskImportOptions,
    validateVariableGetOptions,
    validateVariableDeleteOptions,
    validateUserActivityBucketsCPName,
} from '../../../lib/util/qseow/assert-options.js';

// ---------------------------------------------------------------------------
// validateMasterItemImportOptions
// ---------------------------------------------------------------------------

describe('validateMasterItemImportOptions', () => {
    test('returns valid when colRefBy is present', () => {
        expect(validateMasterItemImportOptions({ colRefBy: 'name' })).toEqual({ valid: true });
    });

    test('returns invalid when colRefBy is undefined', () => {
        const result = validateMasterItemImportOptions({});
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--col-ref-by');
    });

    test('returns invalid when colRefBy is empty string (falsy)', () => {
        const result = validateMasterItemImportOptions({ colRefBy: '' });
        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateMasterItemMeasureDeleteOptions
// ---------------------------------------------------------------------------

describe('validateMasterItemMeasureDeleteOptions', () => {
    test('returns valid when deleteAll is specified', () => {
        expect(validateMasterItemMeasureDeleteOptions({ deleteAll: true })).toEqual({ valid: true });
    });

    test('returns valid when both idType and masterItem are specified', () => {
        expect(validateMasterItemMeasureDeleteOptions({ idType: 'name', masterItem: ['My Measure'] })).toEqual({ valid: true });
    });

    test('returns invalid when all three are undefined', () => {
        const result = validateMasterItemMeasureDeleteOptions({});
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--delete-all');
    });

    test('returns invalid when idType is missing but masterItem present', () => {
        const result = validateMasterItemMeasureDeleteOptions({ masterItem: ['x'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--id-type');
    });

    test('returns invalid when masterItem is missing but idType present', () => {
        const result = validateMasterItemMeasureDeleteOptions({ idType: 'name' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--master-item');
    });

    test('returns invalid when all three are specified (conflict)', () => {
        const result = validateMasterItemMeasureDeleteOptions({ deleteAll: true, idType: 'name', masterItem: ['x'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--delete-all');
    });
});

// ---------------------------------------------------------------------------
// validateMasterItemDimDeleteOptions
// ---------------------------------------------------------------------------

describe('validateMasterItemDimDeleteOptions', () => {
    test('returns valid when deleteAll is specified', () => {
        expect(validateMasterItemDimDeleteOptions({ deleteAll: true })).toEqual({ valid: true });
    });

    test('returns valid when both idType and masterItem are specified', () => {
        expect(validateMasterItemDimDeleteOptions({ idType: 'name', masterItem: ['My Dim'] })).toEqual({ valid: true });
    });

    test('returns invalid when all three are undefined', () => {
        const result = validateMasterItemDimDeleteOptions({});
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--delete-all');
    });

    test('returns invalid when idType is missing but masterItem present', () => {
        const result = validateMasterItemDimDeleteOptions({ masterItem: ['x'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--id-type');
    });

    test('returns invalid when masterItem is missing but idType present', () => {
        const result = validateMasterItemDimDeleteOptions({ idType: 'name' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--master-item');
    });

    test('returns invalid when all three are specified (conflict)', () => {
        const result = validateMasterItemDimDeleteOptions({ deleteAll: true, idType: 'name', masterItem: ['x'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--delete-all');
    });
});

// ---------------------------------------------------------------------------
// validateTaskImportOptions
// ---------------------------------------------------------------------------

describe('validateTaskImportOptions', () => {
    test('returns valid for basic csv import without app import', () => {
        expect(validateTaskImportOptions({ fileType: 'csv' })).toEqual({ valid: true });
    });

    test('returns valid for excel import with sheet name, no app import', () => {
        expect(validateTaskImportOptions({ fileType: 'excel', sheetName: 'Sheet1' })).toEqual({ valid: true });
    });

    test('returns valid for excel import with importApp, sheetName, and importAppSheetName', () => {
        expect(
            validateTaskImportOptions({
                fileType: 'excel',
                sheetName: 'Tasks',
                importApp: true,
                importAppSheetName: 'Apps',
            })
        ).toEqual({ valid: true });
    });

    test('returns invalid when importApp is set but fileType is not excel', () => {
        const result = validateTaskImportOptions({ fileType: 'csv', importApp: true, importAppSheetName: 'Apps' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('excel');
    });

    test('returns invalid when importApp is set but importAppSheetName is missing', () => {
        const result = validateTaskImportOptions({ fileType: 'excel', sheetName: 'Sheet1', importApp: true });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--import-app-sheet-name');
    });

    test('returns invalid when importApp is set and importAppSheetName is empty string', () => {
        const result = validateTaskImportOptions({ fileType: 'excel', sheetName: 'Sheet1', importApp: true, importAppSheetName: '' });
        expect(result.valid).toBe(false);
    });

    test('returns invalid when fileType is excel but sheetName is missing', () => {
        const result = validateTaskImportOptions({ fileType: 'excel' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--sheet-name');
    });
});

// ---------------------------------------------------------------------------
// validateVariableGetOptions
// ---------------------------------------------------------------------------

describe('validateVariableGetOptions', () => {
    test('returns valid when appId is present', () => {
        expect(validateVariableGetOptions({ appId: ['abc-123'] })).toEqual({ valid: true });
    });

    test('returns valid when appTag is present', () => {
        expect(validateVariableGetOptions({ appTag: ['production'] })).toEqual({ valid: true });
    });

    test('returns valid when both appId and appTag are present', () => {
        expect(validateVariableGetOptions({ appId: ['abc'], appTag: ['prod'] })).toEqual({ valid: true });
    });

    test('returns invalid when both appId and appTag are undefined', () => {
        const result = validateVariableGetOptions({});
        expect(result.valid).toBe(false);
        expect(result.error).toContain('app');
    });
});

// ---------------------------------------------------------------------------
// validateVariableDeleteOptions
// ---------------------------------------------------------------------------

describe('validateVariableDeleteOptions', () => {
    test('returns valid when appId and deleteAll are specified', () => {
        expect(validateVariableDeleteOptions({ appId: ['abc'], deleteAll: true })).toEqual({ valid: true });
    });

    test('returns valid when appTag and idType+variable are specified', () => {
        expect(validateVariableDeleteOptions({ appTag: ['prod'], idType: 'name', variable: ['myVar'] })).toEqual({ valid: true });
    });

    test('returns invalid when both appId and appTag are undefined', () => {
        const result = validateVariableDeleteOptions({ deleteAll: true });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('app');
    });

    test('returns invalid when appId present but all delete options missing', () => {
        const result = validateVariableDeleteOptions({ appId: ['abc'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--delete-all');
    });

    test('returns invalid when appId present, deleteAll undefined, idType missing', () => {
        const result = validateVariableDeleteOptions({ appId: ['abc'], variable: ['v'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--id-type');
    });

    test('returns invalid when appId present, deleteAll undefined, variable missing', () => {
        const result = validateVariableDeleteOptions({ appId: ['abc'], idType: 'name' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--variable');
    });

    test('returns invalid when deleteAll, idType, and variable are all specified (conflict)', () => {
        const result = validateVariableDeleteOptions({ appId: ['abc'], deleteAll: true, idType: 'name', variable: ['v'] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('--delete-all');
    });
});

// ---------------------------------------------------------------------------
// validateUserActivityBucketsCPName
// ---------------------------------------------------------------------------

describe('validateUserActivityBucketsCPName', () => {
    test('returns valid for simple alphanumeric name', () => {
        expect(validateUserActivityBucketsCPName({ customPropertyName: 'UserActivity' })).toEqual({ valid: true });
    });

    test('returns valid for name with underscores', () => {
        expect(validateUserActivityBucketsCPName({ customPropertyName: 'user_activity_cp' })).toEqual({ valid: true });
    });

    test('returns valid for name with numbers', () => {
        expect(validateUserActivityBucketsCPName({ customPropertyName: 'ActivityBucket2024' })).toEqual({ valid: true });
    });

    test('returns valid for underscore-only name', () => {
        expect(validateUserActivityBucketsCPName({ customPropertyName: '_' })).toEqual({ valid: true });
    });

    test('returns invalid for name with hyphen', () => {
        const result = validateUserActivityBucketsCPName({ customPropertyName: 'user-activity' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('user-activity');
    });

    test('returns invalid for name with spaces', () => {
        const result = validateUserActivityBucketsCPName({ customPropertyName: 'user activity' });
        expect(result.valid).toBe(false);
    });

    test('returns invalid for name with special characters', () => {
        const result = validateUserActivityBucketsCPName({ customPropertyName: 'name@domain' });
        expect(result.valid).toBe(false);
    });

    test('returns invalid for name with dots', () => {
        const result = validateUserActivityBucketsCPName({ customPropertyName: 'user.activity' });
        expect(result.valid).toBe(false);
    });

    test('returns invalid for empty string', () => {
        const result = validateUserActivityBucketsCPName({ customPropertyName: '' });
        expect(result.valid).toBe(false);
    });
});
