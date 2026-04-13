/**
 * Unit tests for src/lib/util/qseow/intel/extractors/measure-intel.js
 *
 * Tests the MeasureIntelExtractor which extracts definitions, labels,
 * label expressions, titles, and descriptions from master measures.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import MeasureIntelExtractor from '../../../../lib/util/qseow/intel/extractors/measure-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new MeasureIntelExtractor();
        expect(extractor.name).toBe('measure');
        expect(extractor.dataTypes).toEqual(['measures']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new MeasureIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty measures array', () => {
        const extractor = new MeasureIntelExtractor();
        expect(extractor.extract({ measures: [] })).toEqual([]);
    });

    test('should return empty array for measure with no qMeasure/qMetaDef', () => {
        const extractor = new MeasureIntelExtractor();
        const result = extractor.extract({ measures: [{}] });
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// extract() — definition
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() definitions', () => {
    test('should extract measure definition expression', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Sum(Sales)' },
                    qMetaDef: { title: 'Total Sales' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const defs = result.filter((item) => item.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(1);
        expect(defs[0].value).toBe('Sum(Sales)');
        expect(defs[0].sourceType).toBe(SourceType.MEASURE);
        expect(defs[0].path).toBe('measures[0].qMeasure.qDef');
    });

    test('should not extract definition when qDef is missing', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: {},
                    qMetaDef: { title: 'No Def' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const defs = result.filter((item) => item.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — label
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() labels', () => {
    test('should extract measure label', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qLabel: 'Sales Total' },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        const labels = result.filter((item) => item.type === IntelType.LABEL);
        expect(labels).toHaveLength(1);
        expect(labels[0].value).toBe('Sales Total');
        expect(labels[0].path).toBe('measures[0].qMeasure.qLabel');
    });
});

// ---------------------------------------------------------------------------
// extract() — label expression
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() label expressions', () => {
    test('should extract dynamic label expression', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qLabelExpression: '=\'Sales: \' & Num(Sum(Sales))' },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        const exprs = result.filter((item) => item.type === IntelType.EXPRESSION);
        expect(exprs).toHaveLength(1);
        expect(exprs[0].value).toBe('=\'Sales: \' & Num(Sum(Sales))');
        expect(exprs[0].path).toBe('measures[0].qMeasure.qLabelExpression');
    });
});

// ---------------------------------------------------------------------------
// extract() — title and description
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() titles and descriptions', () => {
    test('should extract qMetaDef.title', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: {},
                    qMetaDef: { title: 'Revenue' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === IntelType.TITLE);
        expect(titles).toHaveLength(1);
        expect(titles[0].value).toBe('Revenue');
        expect(titles[0].path).toBe('measures[0].qMetaDef.title');
    });

    test('should extract qMetaDef.description', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: {},
                    qMetaDef: { title: 'Revenue', description: 'Total revenue measure' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(1);
        expect(descs[0].value).toBe('Total revenue measure');
    });
});

// ---------------------------------------------------------------------------
// extract() — full measure with all properties
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() complete measure', () => {
    test('should extract all five items from complete measure', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: {
                        qDef: 'Sum(Sales)',
                        qLabel: 'Total Sales',
                        qLabelExpression: '=DynLabel()',
                    },
                    qMetaDef: {
                        title: 'Sales Measure',
                        description: 'All sales combined',
                    },
                },
            ],
        };

        const result = extractor.extract(metadata);
        // 1 def + 1 label + 1 expression + 1 title + 1 description = 5
        expect(result).toHaveLength(5);
    });

    test('should use qMetaDef.title as sourceName for non-title items', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Count(OrderId)' },
                    qMetaDef: { title: 'Order Count' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const def = result.find((item) => item.type === IntelType.DEFINITION);
        expect(def.sourceName).toBe('Order Count');
    });
});

// ---------------------------------------------------------------------------
// extract() — multiple measures
// ---------------------------------------------------------------------------

describe('MeasureIntelExtractor - extract() multiple measures', () => {
    test('should index measures correctly', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'm1' },
                    qMeasure: { qDef: 'Sum(A)' },
                    qMetaDef: {},
                },
                {
                    qInfo: { qId: 'm2' },
                    qMeasure: { qDef: 'Avg(B)' },
                    qMetaDef: {},
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result.some((item) => item.path === 'measures[0].qMeasure.qDef')).toBe(true);
        expect(result.some((item) => item.path === 'measures[1].qMeasure.qDef')).toBe(true);
    });

    test('should handle missing qInfo.qId with empty string', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [{ qMeasure: { qDef: 'Sum(X)' }, qMetaDef: {} }],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceId).toBe('');
    });
});
