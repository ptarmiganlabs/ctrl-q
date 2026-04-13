/**
 * Unit tests for src/lib/util/qseow/intel/extractors/variable-intel.js
 *
 * Tests the VariableIntelExtractor which extracts names, definitions,
 * and descriptions from Qlik Sense variables.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import VariableIntelExtractor from '../../../../lib/util/qseow/intel/extractors/variable-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new VariableIntelExtractor();
        expect(extractor.name).toBe('variable');
        expect(extractor.dataTypes).toEqual(['variables']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new VariableIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty variables array', () => {
        const extractor = new VariableIntelExtractor();
        expect(extractor.extract({ variables: [] })).toEqual([]);
    });

    test('should return empty array for variable with no properties', () => {
        const extractor = new VariableIntelExtractor();
        const result = extractor.extract({ variables: [{}] });
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// extract() — name extraction
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - extract() names', () => {
    test('should extract variable name', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [
                {
                    qInfo: { qId: 'var-1' },
                    qName: 'vCurrentYear',
                },
            ],
        };

        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === IntelType.NAME);
        expect(names).toHaveLength(1);
        expect(names[0].value).toBe('vCurrentYear');
        expect(names[0].sourceType).toBe(SourceType.VARIABLE);
        expect(names[0].sourceId).toBe('var-1');
        expect(names[0].sourceName).toBe('vCurrentYear');
        expect(names[0].path).toBe('variables[0].qName');
    });
});

// ---------------------------------------------------------------------------
// extract() — definition extraction
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - extract() definitions', () => {
    test('should extract variable definition', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [
                {
                    qInfo: { qId: 'var-1' },
                    qName: 'vYear',
                    qDefinition: '=Year(Today())',
                },
            ],
        };

        const result = extractor.extract(metadata);
        const defs = result.filter((item) => item.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(1);
        expect(defs[0].value).toBe('=Year(Today())');
        expect(defs[0].path).toBe('variables[0].qDefinition');
    });

    test('should not extract definition when missing', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [{ qInfo: { qId: 'var-1' }, qName: 'vEmpty' }],
        };

        const result = extractor.extract(metadata);
        const defs = result.filter((item) => item.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — description extraction
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - extract() descriptions', () => {
    test('should extract variable description', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [
                {
                    qInfo: { qId: 'var-1' },
                    qName: 'vYear',
                    qDescription: 'Current calendar year',
                },
            ],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(1);
        expect(descs[0].value).toBe('Current calendar year');
        expect(descs[0].path).toBe('variables[0].qDescription');
    });
});

// ---------------------------------------------------------------------------
// extract() — full variable with all properties
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - extract() complete variable', () => {
    test('should extract all three items from complete variable', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [
                {
                    qInfo: { qId: 'var-1' },
                    qName: 'vSales',
                    qDefinition: '=Sum(Sales)',
                    qDescription: 'Total sales amount',
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result).toHaveLength(3);
        expect(result.some((item) => item.type === IntelType.NAME)).toBe(true);
        expect(result.some((item) => item.type === IntelType.DEFINITION)).toBe(true);
        expect(result.some((item) => item.type === IntelType.DESCRIPTION)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// extract() — multiple variables
// ---------------------------------------------------------------------------

describe('VariableIntelExtractor - extract() multiple variables', () => {
    test('should extract from multiple variables with correct indices', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [
                { qInfo: { qId: 'v1' }, qName: 'vFirst' },
                { qInfo: { qId: 'v2' }, qName: 'vSecond', qDefinition: '42' },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result.some((item) => item.path === 'variables[0].qName')).toBe(true);
        expect(result.some((item) => item.path === 'variables[1].qName')).toBe(true);
        expect(result.some((item) => item.path === 'variables[1].qDefinition')).toBe(true);
    });

    test('should handle missing qInfo.qId with empty string', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [{ qName: 'vNoId' }],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceId).toBe('');
    });

    test('should handle missing qName with empty sourceName', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [{ qInfo: { qId: 'v1' }, qDefinition: '100' }],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceName).toBe('');
    });
});
