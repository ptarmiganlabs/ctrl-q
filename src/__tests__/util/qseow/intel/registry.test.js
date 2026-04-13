/**
 * Unit tests for src/lib/util/qseow/intel/registry.js
 *
 * Tests the extractor registry which manages registration and retrieval
 * of intel extractor classes for different data types.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import { EXTRACTOR_REGISTRY, getExtractor, getAllExtractors } from '../../../../lib/util/qseow/intel/registry.js';
import { BaseExtractor } from '../../../../lib/util/qseow/intel/extractors/base.js';
import SheetIntelExtractor from '../../../../lib/util/qseow/intel/extractors/sheet-intel.js';
import DimensionIntelExtractor from '../../../../lib/util/qseow/intel/extractors/dimension-intel.js';
import MeasureIntelExtractor from '../../../../lib/util/qseow/intel/extractors/measure-intel.js';
import VariableIntelExtractor from '../../../../lib/util/qseow/intel/extractors/variable-intel.js';
import BookmarkIntelExtractor from '../../../../lib/util/qseow/intel/extractors/bookmark-intel.js';
import ConnectionIntelExtractor from '../../../../lib/util/qseow/intel/extractors/connection-intel.js';
import TableIntelExtractor from '../../../../lib/util/qseow/intel/extractors/table-intel.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// EXTRACTOR_REGISTRY
// ---------------------------------------------------------------------------

describe('EXTRACTOR_REGISTRY', () => {
    test('should have 7 registered extractors', () => {
        expect(Object.keys(EXTRACTOR_REGISTRY)).toHaveLength(7);
    });

    test('should contain all expected data types', () => {
        const types = Object.keys(EXTRACTOR_REGISTRY);
        expect(types).toContain('sheet');
        expect(types).toContain('dimension');
        expect(types).toContain('measure');
        expect(types).toContain('variable');
        expect(types).toContain('bookmark');
        expect(types).toContain('dataconnection');
        expect(types).toContain('table');
    });

    test('should map sheet to SheetIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.sheet).toBe(SheetIntelExtractor);
    });

    test('should map dimension to DimensionIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.dimension).toBe(DimensionIntelExtractor);
    });

    test('should map measure to MeasureIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.measure).toBe(MeasureIntelExtractor);
    });

    test('should map variable to VariableIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.variable).toBe(VariableIntelExtractor);
    });

    test('should map bookmark to BookmarkIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.bookmark).toBe(BookmarkIntelExtractor);
    });

    test('should map dataconnection to ConnectionIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.dataconnection).toBe(ConnectionIntelExtractor);
    });

    test('should map table to TableIntelExtractor', () => {
        expect(EXTRACTOR_REGISTRY.table).toBe(TableIntelExtractor);
    });
});

// ---------------------------------------------------------------------------
// getExtractor()
// ---------------------------------------------------------------------------

describe('getExtractor', () => {
    test('should return a SheetIntelExtractor for "sheet"', () => {
        const ext = getExtractor('sheet');
        expect(ext).toBeInstanceOf(SheetIntelExtractor);
        expect(ext).toBeInstanceOf(BaseExtractor);
    });

    test('should return a DimensionIntelExtractor for "dimension"', () => {
        const ext = getExtractor('dimension');
        expect(ext).toBeInstanceOf(DimensionIntelExtractor);
    });

    test('should return a MeasureIntelExtractor for "measure"', () => {
        const ext = getExtractor('measure');
        expect(ext).toBeInstanceOf(MeasureIntelExtractor);
    });

    test('should return a VariableIntelExtractor for "variable"', () => {
        const ext = getExtractor('variable');
        expect(ext).toBeInstanceOf(VariableIntelExtractor);
    });

    test('should return a BookmarkIntelExtractor for "bookmark"', () => {
        const ext = getExtractor('bookmark');
        expect(ext).toBeInstanceOf(BookmarkIntelExtractor);
    });

    test('should return a ConnectionIntelExtractor for "dataconnection"', () => {
        const ext = getExtractor('dataconnection');
        expect(ext).toBeInstanceOf(ConnectionIntelExtractor);
    });

    test('should return a TableIntelExtractor for "table"', () => {
        const ext = getExtractor('table');
        expect(ext).toBeInstanceOf(TableIntelExtractor);
    });

    test('should throw for unknown data type', () => {
        expect(() => getExtractor('unknown')).toThrow('No extractor registered for data type: unknown');
    });

    test('should throw for empty string data type', () => {
        expect(() => getExtractor('')).toThrow('No extractor registered for data type: ');
    });

    test('should throw for undefined data type', () => {
        expect(() => getExtractor(undefined)).toThrow();
    });

    test('should return a new instance each time', () => {
        const ext1 = getExtractor('sheet');
        const ext2 = getExtractor('sheet');
        expect(ext1).not.toBe(ext2);
    });
});

// ---------------------------------------------------------------------------
// getAllExtractors()
// ---------------------------------------------------------------------------

describe('getAllExtractors', () => {
    test('should return array of 7 extractors', () => {
        const extractors = getAllExtractors();
        expect(extractors).toHaveLength(7);
    });

    test('should return instances of BaseExtractor', () => {
        const extractors = getAllExtractors();
        extractors.forEach((ext) => {
            expect(ext).toBeInstanceOf(BaseExtractor);
        });
    });

    test('should include one extractor for each registered type', () => {
        const extractors = getAllExtractors();
        const names = extractors.map((ext) => ext.name);
        expect(names).toContain('sheet');
        expect(names).toContain('dimension');
        expect(names).toContain('measure');
        expect(names).toContain('variable');
        expect(names).toContain('bookmark');
        expect(names).toContain('dataconnection');
        expect(names).toContain('table');
    });

    test('should return new instances on each call', () => {
        const first = getAllExtractors();
        const second = getAllExtractors();
        first.forEach((ext, i) => {
            expect(ext).not.toBe(second[i]);
        });
    });

    test('each extractor should have an extract method', () => {
        const extractors = getAllExtractors();
        extractors.forEach((ext) => {
            expect(typeof ext.extract).toBe('function');
        });
    });
});
