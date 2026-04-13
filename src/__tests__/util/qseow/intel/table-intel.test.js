/**
 * Unit tests for src/lib/util/qseow/intel/extractors/table-intel.js
 *
 * Tests the TableIntelExtractor which extracts table names, tags,
 * and key information from the app data model.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import TableIntelExtractor from '../../../../lib/util/qseow/intel/extractors/table-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new TableIntelExtractor();
        expect(extractor.name).toBe('table');
        expect(extractor.dataTypes).toEqual(['tables']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new TableIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty tables object', () => {
        const extractor = new TableIntelExtractor();
        expect(extractor.extract({ tables: {} })).toEqual([]);
    });

    test('should return empty array for tables with empty qtr and qk', () => {
        const extractor = new TableIntelExtractor();
        expect(extractor.extract({ tables: { qtr: [], qk: [] } })).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// extract() — table names (qtr)
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - extract() table names', () => {
    test('should extract table name', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [{ qName: 'Sales' }],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === IntelType.NAME);
        expect(names).toHaveLength(1);
        expect(names[0].value).toBe('Sales');
        expect(names[0].sourceType).toBe(SourceType.TABLE);
        expect(names[0].sourceId).toBe('Sales');
        expect(names[0].path).toBe('tables.qtr[0].qName');
    });

    test('should handle table with no name', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [{ qTags: ['$table'] }],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === IntelType.NAME);
        expect(names).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — table tags (qTags)
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - extract() table qTags', () => {
    test('should extract table qTags', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [
                    {
                        qName: 'Sales',
                        qTags: ['$table', '$synth'],
                    },
                ],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        const tags = result.filter((item) => item.type === IntelType.FIELD && item.path.includes('qTags'));
        expect(tags).toHaveLength(2);
        expect(tags[0].value).toBe('$table');
        expect(tags[1].value).toBe('$synth');
    });

    test('should handle empty qTags array', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [{ qName: 'Sales', qTags: [] }],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        const tags = result.filter((item) => item.path.includes('qTags') && !item.path.includes('qTableTags'));
        expect(tags).toHaveLength(0);
    });

    test('should handle missing qTags', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [{ qName: 'Sales' }],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        const tags = result.filter((item) => item.path.includes('qTags') && !item.path.includes('qTableTags'));
        expect(tags).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — table tags (qTableTags)
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - extract() qTableTags', () => {
    test('should extract qTableTags', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [
                    {
                        qName: 'Orders',
                        qTableTags: ['$resident'],
                    },
                ],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        const tableTags = result.filter((item) => item.path.includes('qTableTags'));
        expect(tableTags).toHaveLength(1);
        expect(tableTags[0].value).toBe('$resident');
    });
});

// ---------------------------------------------------------------------------
// extract() — keys (qk)
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - extract() keys', () => {
    test('should extract key tables', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [],
                qk: [
                    {
                        qKeyFields: ['CustomerId'],
                        qTables: ['Sales', 'Customers'],
                    },
                ],
            },
        };

        const result = extractor.extract(metadata);
        const keyTables = result.filter((item) => item.sourceType === SourceType.TABLE_KEY && item.path.includes('qTables'));
        expect(keyTables).toHaveLength(2);
        expect(keyTables[0].value).toBe('Sales');
        expect(keyTables[1].value).toBe('Customers');
    });

    test('should extract key fields', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [],
                qk: [
                    {
                        qKeyFields: ['OrderId', 'ProductId'],
                        qTables: ['Orders'],
                    },
                ],
            },
        };

        const result = extractor.extract(metadata);
        const keyFields = result.filter((item) => item.path.includes('qKeyFields'));
        expect(keyFields).toHaveLength(2);
        expect(keyFields[0].value).toBe('OrderId');
        expect(keyFields[1].value).toBe('ProductId');
    });

    test('should use joined key fields as key ID', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [],
                qk: [
                    {
                        qKeyFields: ['A', 'B'],
                        qTables: ['T1'],
                    },
                ],
            },
        };

        const result = extractor.extract(metadata);
        const keyItems = result.filter((item) => item.sourceType === SourceType.TABLE_KEY);
        keyItems.forEach((item) => {
            expect(item.sourceId).toBe('A_B');
        });
    });

    test('should use joined key fields in sourceName', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [],
                qk: [
                    {
                        qKeyFields: ['OrderId', 'LineId'],
                        qTables: ['Sales'],
                    },
                ],
            },
        };

        const result = extractor.extract(metadata);
        const keyItem = result.find((item) => item.sourceType === SourceType.TABLE_KEY);
        expect(keyItem.sourceName).toBe('Key: OrderId, LineId');
    });

    test('should handle key with missing qKeyFields', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [],
                qk: [{ qTables: ['T1'] }],
            },
        };

        const result = extractor.extract(metadata);
        const keyTables = result.filter((item) => item.path.includes('qTables'));
        expect(keyTables).toHaveLength(1);
        // sourceId should use fallback
        expect(keyTables[0].sourceId).toBe('key-0');
    });

    test('should handle key with missing qTables', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [],
                qk: [{ qKeyFields: ['Id'] }],
            },
        };

        const result = extractor.extract(metadata);
        const keyFields = result.filter((item) => item.path.includes('qKeyFields'));
        expect(keyFields).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// extract() — full table+key combination
// ---------------------------------------------------------------------------

describe('TableIntelExtractor - extract() complete data model', () => {
    test('should extract from both tables and keys', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [
                    { qName: 'Sales', qTags: ['$table'], qTableTags: [] },
                    { qName: 'Customers', qTags: ['$table'] },
                ],
                qk: [
                    {
                        qKeyFields: ['CustomerId'],
                        qTables: ['Sales', 'Customers'],
                    },
                ],
            },
        };

        const result = extractor.extract(metadata);
        // 2 names + 2 qTags + 2 key tables + 1 key field = 7
        expect(result).toHaveLength(7);
    });

    test('should index tables correctly with multiple entries', () => {
        const extractor = new TableIntelExtractor();
        const metadata = {
            tables: {
                qtr: [{ qName: 'A' }, { qName: 'B' }],
                qk: [],
            },
        };

        const result = extractor.extract(metadata);
        expect(result.some((item) => item.path === 'tables.qtr[0].qName')).toBe(true);
        expect(result.some((item) => item.path === 'tables.qtr[1].qName')).toBe(true);
    });
});
