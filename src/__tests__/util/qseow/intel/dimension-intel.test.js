/**
 * Unit tests for src/lib/util/qseow/intel/extractors/dimension-intel.js
 *
 * Tests the DimensionIntelExtractor which extracts field definitions,
 * label expressions, titles, and descriptions from master dimensions.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import DimensionIntelExtractor from '../../../../lib/util/qseow/intel/extractors/dimension-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new DimensionIntelExtractor();
        expect(extractor.name).toBe('dimension');
        expect(extractor.dataTypes).toEqual(['dimensions']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new DimensionIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty dimensions array', () => {
        const extractor = new DimensionIntelExtractor();
        expect(extractor.extract({ dimensions: [] })).toEqual([]);
    });

    test('should return empty array for dimension with no qDim/qMetaDef', () => {
        const extractor = new DimensionIntelExtractor();
        const result = extractor.extract({ dimensions: [{}] });
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// extract() — field definitions
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() field definitions', () => {
    test('should extract single field definition', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Country'] },
                    qMetaDef: { title: 'Country Dim' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const fields = result.filter((item) => item.type === IntelType.FIELD);
        expect(fields).toHaveLength(1);
        expect(fields[0].value).toBe('Country');
        expect(fields[0].sourceType).toBe(SourceType.DIMENSION);
        expect(fields[0].path).toBe('dimensions[0].qDim.qFieldDefs[0]');
    });

    test('should extract multiple field definitions', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Country', 'Region', 'City'] },
                    qMetaDef: { title: 'Geo Dim' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const fields = result.filter((item) => item.type === IntelType.FIELD);
        expect(fields).toHaveLength(3);
        expect(fields[0].path).toBe('dimensions[0].qDim.qFieldDefs[0]');
        expect(fields[1].path).toBe('dimensions[0].qDim.qFieldDefs[1]');
        expect(fields[2].path).toBe('dimensions[0].qDim.qFieldDefs[2]');
    });

    test('should handle empty qFieldDefs array', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: [] },
                    qMetaDef: { title: 'Empty Fields' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const fields = result.filter((item) => item.type === IntelType.FIELD);
        expect(fields).toHaveLength(0);
    });

    test('should handle missing qFieldDefs', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: {},
                    qMetaDef: { title: 'No Fields' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const fields = result.filter((item) => item.type === IntelType.FIELD);
        expect(fields).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — label expression
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() label expression', () => {
    test('should extract label expression', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qLabelExpression: '=Count(Country)' },
                    qMetaDef: { title: 'Dynamic Label' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const exprs = result.filter((item) => item.type === IntelType.EXPRESSION);
        expect(exprs).toHaveLength(1);
        expect(exprs[0].value).toBe('=Count(Country)');
        expect(exprs[0].path).toBe('dimensions[0].qDim.qLabelExpression');
    });
});

// ---------------------------------------------------------------------------
// extract() — titles (both qDim.title and qMetaDef.title)
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() titles', () => {
    test('should extract qDim.title', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { title: 'Dim Title' },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === IntelType.TITLE);
        expect(titles).toHaveLength(1);
        expect(titles[0].value).toBe('Dim Title');
        expect(titles[0].path).toBe('dimensions[0].qDim.title');
    });

    test('should extract qMetaDef.title', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: {},
                    qMetaDef: { title: 'Master Title' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === IntelType.TITLE);
        expect(titles).toHaveLength(1);
        expect(titles[0].path).toBe('dimensions[0].qMetaDef.title');
    });

    test('should extract both titles when both exist', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { title: 'Dim Title' },
                    qMetaDef: { title: 'Master Title' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === IntelType.TITLE);
        expect(titles).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// extract() — description
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() descriptions', () => {
    test('should extract qMetaDef.description', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: {},
                    qMetaDef: { title: 'Dim', description: 'A geography dimension' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(1);
        expect(descs[0].value).toBe('A geography dimension');
        expect(descs[0].path).toBe('dimensions[0].qMetaDef.description');
    });
});

// ---------------------------------------------------------------------------
// extract() — full dimension with all properties
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() complete dimension', () => {
    test('should extract all items from complete dimension', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: {
                        qFieldDefs: ['Country'],
                        qLabelExpression: '=Label()',
                        title: 'Dim Title',
                    },
                    qMetaDef: {
                        title: 'Master Title',
                        description: 'Full dimension',
                    },
                },
            ],
        };

        const result = extractor.extract(metadata);
        // 1 field + 1 expression + 2 titles + 1 description = 5
        expect(result).toHaveLength(5);
    });

    test('should use correct sourceId from qInfo.qId', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-abc-123' },
                    qDim: { qFieldDefs: ['Sales'] },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceId).toBe('dim-abc-123');
    });

    test('should handle missing qInfo.qId with empty string', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qDim: { qFieldDefs: ['Sales'] },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceId).toBe('');
    });
});

// ---------------------------------------------------------------------------
// extract() — multiple dimensions
// ---------------------------------------------------------------------------

describe('DimensionIntelExtractor - extract() multiple dimensions', () => {
    test('should index dimensions correctly', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'd1' },
                    qDim: { qFieldDefs: ['A'] },
                    qMetaDef: {},
                },
                {
                    qInfo: { qId: 'd2' },
                    qDim: { qFieldDefs: ['B'] },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result.some((item) => item.path === 'dimensions[0].qDim.qFieldDefs[0]')).toBe(true);
        expect(result.some((item) => item.path === 'dimensions[1].qDim.qFieldDefs[0]')).toBe(true);
    });
});
