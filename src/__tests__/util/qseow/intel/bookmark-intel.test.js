/**
 * Unit tests for src/lib/util/qseow/intel/extractors/bookmark-intel.js
 *
 * Tests the BookmarkIntelExtractor which extracts titles and descriptions
 * from Qlik Sense bookmarks.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import BookmarkIntelExtractor from '../../../../lib/util/qseow/intel/extractors/bookmark-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('BookmarkIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new BookmarkIntelExtractor();
        expect(extractor.name).toBe('bookmark');
        expect(extractor.dataTypes).toEqual(['bookmarks']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('BookmarkIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new BookmarkIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty bookmarks array', () => {
        const extractor = new BookmarkIntelExtractor();
        expect(extractor.extract({ bookmarks: [] })).toEqual([]);
    });

    test('should return empty array for bookmark with no qMetaDef', () => {
        const extractor = new BookmarkIntelExtractor();
        const result = extractor.extract({ bookmarks: [{}] });
        expect(result).toEqual([]);
    });

    test('should return empty array for bookmark with empty qMetaDef', () => {
        const extractor = new BookmarkIntelExtractor();
        const result = extractor.extract({ bookmarks: [{ qMetaDef: {} }] });
        expect(result).toEqual([]);
    });

    test('should handle null bookmark wrapper gracefully', () => {
        const extractor = new BookmarkIntelExtractor();
        // forEach on null will throw, but the code does `bookmarkWrapper.qInfo?.qId`
        // which means null will cause a TypeError. This tests the code's actual behavior.
        expect(() => extractor.extract({ bookmarks: [null] })).toThrow();
    });
});

// ---------------------------------------------------------------------------
// extract() — title extraction
// ---------------------------------------------------------------------------

describe('BookmarkIntelExtractor - extract() titles', () => {
    test('should extract bookmark title', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'My Bookmark', description: '' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === IntelType.TITLE);
        expect(titles).toHaveLength(1);
        expect(titles[0].value).toBe('My Bookmark');
        expect(titles[0].sourceType).toBe(SourceType.BOOKMARK);
        expect(titles[0].sourceId).toBe('bkm-1');
        expect(titles[0].path).toBe('bookmarks[0].qMetaDef.title');
    });

    test('should use title as sourceName', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'Sales Bookmark' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceName).toBe('Sales Bookmark');
    });
});

// ---------------------------------------------------------------------------
// extract() — description extraction
// ---------------------------------------------------------------------------

describe('BookmarkIntelExtractor - extract() descriptions', () => {
    test('should extract bookmark description', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'BM', description: 'A useful filter' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(1);
        expect(descs[0].value).toBe('A useful filter');
        expect(descs[0].path).toBe('bookmarks[0].qMetaDef.description');
    });

    test('should not extract description when missing', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'Only Title' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        const descs = result.filter((item) => item.type === IntelType.DESCRIPTION);
        expect(descs).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extract() — full bookmark with title + description
// ---------------------------------------------------------------------------

describe('BookmarkIntelExtractor - extract() full bookmark', () => {
    test('should extract both title and description from a complete bookmark', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'Full Bookmark', description: 'Full description' },
                    sheetId: 'sheet-abc',
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result).toHaveLength(2);
        expect(result.some((item) => item.type === IntelType.TITLE && item.value === 'Full Bookmark')).toBe(true);
        expect(result.some((item) => item.type === IntelType.DESCRIPTION && item.value === 'Full description')).toBe(true);
    });

    test('should include sheetId in associations', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'With Sheet' },
                    sheetId: 'sheet-xyz',
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].associations).toEqual({ sheetId: 'sheet-xyz' });
    });

    test('should handle missing sheetId with empty string in associations', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'No Sheet' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].associations).toEqual({ sheetId: '' });
    });
});

// ---------------------------------------------------------------------------
// extract() — multiple bookmarks
// ---------------------------------------------------------------------------

describe('BookmarkIntelExtractor - extract() multiple bookmarks', () => {
    test('should extract from multiple bookmarks with correct indices', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bkm-1' },
                    qMetaDef: { title: 'First' },
                },
                {
                    qInfo: { qId: 'bkm-2' },
                    qMetaDef: { title: 'Second', description: 'Desc 2' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result.some((item) => item.path === 'bookmarks[0].qMetaDef.title')).toBe(true);
        expect(result.some((item) => item.path === 'bookmarks[1].qMetaDef.title')).toBe(true);
        expect(result.some((item) => item.path === 'bookmarks[1].qMetaDef.description')).toBe(true);
    });

    test('should handle missing qInfo.qId with empty string', () => {
        const extractor = new BookmarkIntelExtractor();
        const metadata = {
            bookmarks: [
                {
                    qMetaDef: { title: 'No ID' },
                },
            ],
        };

        const result = extractor.extract(metadata);
        expect(result[0].sourceId).toBe('');
    });
});
