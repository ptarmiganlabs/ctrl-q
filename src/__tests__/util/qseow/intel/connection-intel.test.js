/**
 * Unit tests for src/lib/util/qseow/intel/extractors/connection-intel.js
 *
 * Tests the ConnectionIntelExtractor which extracts names and descriptions
 * from Qlik Sense data connections.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import ConnectionIntelExtractor from '../../../../lib/util/qseow/intel/extractors/connection-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('ConnectionIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new ConnectionIntelExtractor();
        expect(extractor.name).toBe('dataconnection');
        expect(extractor.dataTypes).toEqual(['dataconnections']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('ConnectionIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new ConnectionIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty dataconnections array', () => {
        const extractor = new ConnectionIntelExtractor();
        expect(extractor.extract({ dataconnections: [] })).toEqual([]);
    });

    test('should return empty array for connection with no properties', () => {
        const extractor = new ConnectionIntelExtractor();
        const result = extractor.extract({ dataconnections: [{}] });
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// extract() — name extraction
// ---------------------------------------------------------------------------

describe('ConnectionIntelExtractor - extract() names', () => {
    test('should extract connection name', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [
                {
                    qId: 'conn-1',
                    qName: 'My Data Connection',
                },
            ],
        };

        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === IntelType.NAME);
        expect(names).toHaveLength(1);
        expect(names[0].value).toBe('My Data Connection');
        expect(names[0].sourceType).toBe(SourceType.DATACONNECTION);
        expect(names[0].sourceId).toBe('conn-1');
        expect(names[0].sourceName).toBe('My Data Connection');
        expect(names[0].path).toBe('dataconnections[0].qName');
    });

    test('should handle connection with special characters in name', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [
                {
                    qId: 'conn-1',
                    qName: 'SQL Server (prod) – lib://data',
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].value).toBe('SQL Server (prod) – lib://data');
    });
});

// ---------------------------------------------------------------------------
// extract() — description extraction
// ---------------------------------------------------------------------------

describe('ConnectionIntelExtractor - extract() descriptions', () => {
    test('should extract connection description', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [
                {
                    qId: 'conn-1',
                    qName: 'Conn',
                    qDescription: 'Production database connection',
                },
            ],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(1);
        expect(descs[0].value).toBe('Production database connection');
        expect(descs[0].path).toBe('dataconnections[0].qDescription');
    });

    test('should not extract description when missing', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [{ qId: 'conn-1', qName: 'Only Name' }],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — full connection
// ---------------------------------------------------------------------------

describe('ConnectionIntelExtractor - extract() complete connection', () => {
    test('should extract both name and description', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [
                {
                    qId: 'conn-1',
                    qName: 'Full Connection',
                    qDescription: 'Full description',
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result).toHaveLength(2);
        expect(result.some((item) => item.type === IntelType.NAME)).toBe(true);
        expect(result.some((item) => item.type === IntelType.DESCRIPTION)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// extract() — multiple connections
// ---------------------------------------------------------------------------

describe('ConnectionIntelExtractor - extract() multiple connections', () => {
    test('should extract from multiple connections with correct indices', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [
                { qId: 'c1', qName: 'First' },
                { qId: 'c2', qName: 'Second', qDescription: 'Desc' },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result.some((item) => item.path === 'dataconnections[0].qName')).toBe(true);
        expect(result.some((item) => item.path === 'dataconnections[1].qName')).toBe(true);
        expect(result.some((item) => item.path === 'dataconnections[1].qDescription')).toBe(true);
    });

    test('should handle missing qId with empty string', () => {
        const extractor = new ConnectionIntelExtractor();
        const metadata = {
            dataconnections: [{ qName: 'No ID' }],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceId).toBe('');
    });
});
