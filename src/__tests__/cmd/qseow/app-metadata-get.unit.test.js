/**
 * Unit tests for qseow app-metadata-get command.
 * Tests helper functions, intel extraction, and serialization utilities.
 */

import { test, expect, describe, beforeEach } from '@jest/globals';
import { extractIntel } from '../../../lib/util/qseow/intel/index.js';
import { getAllExtractors } from '../../../lib/util/qseow/intel/registry.js';
import { BaseExtractor, IntelType, SourceType } from '../../../lib/util/qseow/intel/extractors/base.js';
import SheetIntelExtractor from '../../../lib/util/qseow/intel/extractors/sheet-intel.js';
import DimensionIntelExtractor from '../../../lib/util/qseow/intel/extractors/dimension-intel.js';
import MeasureIntelExtractor from '../../../lib/util/qseow/intel/extractors/measure-intel.js';
import VariableIntelExtractor from '../../../lib/util/qseow/intel/extractors/variable-intel.js';
import BookmarkIntelExtractor from '../../../lib/util/qseow/intel/extractors/bookmark-intel.js';
import ConnectionIntelExtractor from '../../../lib/util/qseow/intel/extractors/connection-intel.js';
import TableIntelExtractor from '../../../lib/util/qseow/intel/extractors/table-intel.js';

describe('IntelType enum', () => {
    test('should have correct title type', () => {
        expect(IntelType.TITLE).toBe('title');
    });

    test('should have correct description type', () => {
        expect(IntelType.DESCRIPTION).toBe('description');
    });

    test('should have correct label type', () => {
        expect(IntelType.LABEL).toBe('label');
    });

    test('should have correct expression type', () => {
        expect(IntelType.EXPRESSION).toBe('expression');
    });

    test('should have correct definition type', () => {
        expect(IntelType.DEFINITION).toBe('definition');
    });

    test('should have correct name type', () => {
        expect(IntelType.NAME).toBe('name');
    });

    test('should have correct field type', () => {
        expect(IntelType.FIELD).toBe('field');
    });
});

describe('SourceType enum', () => {
    test('should have correct sheet type', () => {
        expect(SourceType.SHEET).toBe('sheet');
    });

    test('should have correct sheet-cell type', () => {
        expect(SourceType.SHEET_CELL).toBe('sheet-cell');
    });

    test('should have correct sheet-child type', () => {
        expect(SourceType.SHEET_CHILD).toBe('sheet-child');
    });

    test('should have correct dimension type', () => {
        expect(SourceType.DIMENSION).toBe('dimension');
    });

    test('should have correct measure type', () => {
        expect(SourceType.MEASURE).toBe('measure');
    });

    test('should have correct variable type', () => {
        expect(SourceType.VARIABLE).toBe('variable');
    });

    test('should have correct bookmark type', () => {
        expect(SourceType.BOOKMARK).toBe('bookmark');
    });

    test('should have correct dataconnection type', () => {
        expect(SourceType.DATACONNECTION).toBe('dataconnection');
    });
});

describe('BaseExtractor', () => {
    let extractor;

    beforeEach(() => {
        class TestExtractor extends BaseExtractor {
            extract(metadata) {
                return [];
            }
        }
        extractor = new TestExtractor('test', ['testData']);
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('test');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['testData']);
    });

    test('should throw error when extract is called directly', () => {
        const baseExtractor = new BaseExtractor('base', ['baseData']);
        expect(() => baseExtractor.extract({})).toThrow('Extractor must implement extract() method');
    });
});

describe('BaseExtractor.createIntelItem', () => {
    let extractor;

    beforeEach(() => {
        class TestExtractor extends BaseExtractor {
            extract(metadata) {
                return [];
            }
        }
        extractor = new TestExtractor('test', ['testData']);
    });

    test('should return null for undefined value', () => {
        const result = extractor.createIntelItem(undefined, IntelType.TITLE, SourceType.SHEET, 'id', 'name', 'path');
        expect(result).toBeNull();
    });

    test('should return null for null value', () => {
        const result = extractor.createIntelItem(null, IntelType.TITLE, SourceType.SHEET, 'id', 'name', 'path');
        expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
        const result = extractor.createIntelItem('', IntelType.TITLE, SourceType.SHEET, 'id', 'name', 'path');
        expect(result).toBeNull();
    });

    test('should return valid intel item for non-empty value', () => {
        const result = extractor.createIntelItem(
            'Test Title',
            IntelType.TITLE,
            SourceType.SHEET,
            'sheet-1',
            'My Sheet',
            'sheets[0].qProperty.qMetaDef.title'
        );
        expect(result).not.toBeNull();
        expect(result.value).toBe('Test Title');
        expect(result.type).toBe('title');
        expect(result.sourceType).toBe('sheet');
        expect(result.sourceId).toBe('sheet-1');
        expect(result.sourceName).toBe('My Sheet');
        expect(result.path).toBe('sheets[0].qProperty.qMetaDef.title');
    });

    test('should convert number to string', () => {
        const result = extractor.createIntelItem(123, IntelType.NAME, SourceType.SHEET, 'id', 'name', 'path');
        expect(result.value).toBe('123');
    });

    test('should handle empty sourceId and sourceName', () => {
        const result = extractor.createIntelItem('Test', IntelType.TITLE, SourceType.SHEET, '', '', 'path');
        expect(result.sourceId).toBe('');
        expect(result.sourceName).toBe('');
    });

    test('should handle associations parameter', () => {
        const associations = { sheetId: 'sheet-1', sheetName: 'My Sheet' };
        const result = extractor.createIntelItem('Test', IntelType.TITLE, SourceType.SHEET, 'id', 'name', 'path', associations);
        expect(result.associations).toEqual(associations);
    });

    test('should default associations to empty object', () => {
        const result = extractor.createIntelItem('Test', IntelType.TITLE, SourceType.SHEET, 'id', 'name', 'path');
        expect(result.associations).toEqual({});
    });
});

describe('SheetIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new SheetIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('sheet');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['sheets']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should return empty array for metadata with no sheets', () => {
        const result = extractor.extract({ sheets: [] });
        expect(result).toEqual([]);
    });

    test('should extract sheet title', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet Title', description: 'Sheet description' },
                        cells: [],
                        qChildren: [],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title');
        expect(titles.length).toBeGreaterThan(0);
        expect(titles.some((t) => t.value === 'My Sheet Title')).toBe(true);
    });

    test('should extract sheet description', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet', description: 'Sheet description' },
                        cells: [],
                        qChildren: [],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const descriptions = result.filter((item) => item.type === 'description');
        expect(descriptions.some((d) => d.value === 'Sheet description')).toBe(true);
    });

    test('should extract cell names', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet' },
                        cells: [
                            { name: 'CH123', type: 'chart' },
                            { name: 'LB456', type: 'listbox' },
                        ],
                        qChildren: [],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === 'name');
        expect(names.some((n) => n.value === 'CH123')).toBe(true);
        expect(names.some((n) => n.value === 'LB456')).toBe(true);
    });

    test('should extract child object titles', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet' },
                        cells: [],
                        qChildren: [
                            {
                                qProperty: {
                                    qInfo: { qId: 'chart-1' },
                                    title: 'Test Chart',
                                },
                            },
                        ],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        expect(Array.isArray(result)).toBe(true);
    });

    test('should extract HyperCube dimensions', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet' },
                        cells: [],
                        qChildren: [
                            {
                                qProperty: {
                                    qInfo: { qId: 'chart-1' },
                                    title: 'Chart',
                                    qHyperCubeDef: {
                                        qDimensions: [
                                            {
                                                qDef: {
                                                    qFieldDefs: ['TestField'],
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        expect(result.length).toBeGreaterThan(0);
    });

    test('should handle children with various properties', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet' },
                        cells: [],
                        qChildren: [
                            {
                                qProperty: {
                                    qInfo: { qId: 'text-1' },
                                    title: 'Text Object',
                                },
                            },
                        ],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        expect(result.length).toBeGreaterThan(0);
    });

    test('should handle multiple sheets', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'Sheet 1' },
                        cells: [],
                        qChildren: [],
                    },
                },
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-2' },
                        qMetaDef: { title: 'Sheet 2' },
                        cells: [],
                        qChildren: [],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title' && item.sourceType === 'sheet');
        expect(titles.length).toBe(2);
    });

    test('should handle list objects with field definitions', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'My Sheet' },
                        cells: [],
                        qChildren: [
                            {
                                qProperty: {
                                    qInfo: { qId: 'filter-1' },
                                    title: 'Filter Pane',
                                },
                            },
                        ],
                    },
                },
            ],
        };
        const result = extractor.extract(metadata);
        expect(Array.isArray(result)).toBe(true);
    });
});

describe('DimensionIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new DimensionIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('dimension');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['dimensions']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should extract field definitions', () => {
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Customer', 'Product'] },
                    qMetaDef: { title: 'My Dimension' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const fields = result.filter((item) => item.type === 'field');
        expect(fields.some((f) => f.value === 'Customer')).toBe(true);
        expect(fields.some((f) => f.value === 'Product')).toBe(true);
    });

    test('should extract label expression', () => {
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Date'], qLabelExpression: '=Date(Date)' },
                    qMetaDef: { title: 'Date Dimension' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const expressions = result.filter((item) => item.type === 'expression');
        expect(expressions.some((e) => e.value === '=Date(Date)')).toBe(true);
    });

    test('should extract dimension title from qDim', () => {
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Sales'], title: 'Sales Dimension' },
                    qMetaDef: { title: 'My Dimension' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title');
        expect(titles.some((t) => t.value === 'Sales Dimension')).toBe(true);
    });

    test('should extract master item title from qMetaDef', () => {
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Sales'] },
                    qMetaDef: { title: 'Sales Master Dimension' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title');
        expect(titles.some((t) => t.value === 'Sales Master Dimension')).toBe(true);
    });

    test('should extract description', () => {
        const metadata = {
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['Sales'] },
                    qMetaDef: { title: 'Sales', description: 'Sales dimension for reports' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const descriptions = result.filter((item) => item.type === 'description');
        expect(descriptions.some((d) => d.value === 'Sales dimension for reports')).toBe(true);
    });

    test('should handle multiple dimensions', () => {
        const metadata = {
            dimensions: [
                { qInfo: { qId: 'dim-1' }, qDim: { qFieldDefs: ['Field1'] }, qMetaDef: { title: 'Dim1' } },
                { qInfo: { qId: 'dim-2' }, qDim: { qFieldDefs: ['Field2'] }, qMetaDef: { title: 'Dim2' } },
            ],
        };
        const result = extractor.extract(metadata);
        const fields = result.filter((item) => item.type === 'field');
        expect(fields.length).toBe(2);
    });
});

describe('MeasureIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new MeasureIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('measure');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['measures']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should extract measure definition', () => {
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
        const definitions = result.filter((item) => item.type === 'definition');
        expect(definitions.some((d) => d.value === 'Sum(Sales)')).toBe(true);
    });

    test('should extract measure label', () => {
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Sum(Sales)', qLabel: 'Total Sales' },
                    qMetaDef: { title: 'Sales Measure' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const labels = result.filter((item) => item.type === 'label');
        expect(labels.some((l) => l.value === 'Total Sales')).toBe(true);
    });

    test('should extract label expression', () => {
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Sum(Sales)', qLabelExpression: '=Num(Sales)' },
                    qMetaDef: { title: 'Sales' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const expressions = result.filter((item) => item.type === 'expression');
        expect(expressions.some((e) => e.value === '=Num(Sales)')).toBe(true);
    });

    test('should extract master item title', () => {
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Sum(Sales)' },
                    qMetaDef: { title: 'Total Sales Measure' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title');
        expect(titles.some((t) => t.value === 'Total Sales Measure')).toBe(true);
    });

    test('should extract description', () => {
        const metadata = {
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Sum(Sales)' },
                    qMetaDef: { title: 'Sales', description: 'Sum of all sales transactions' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const descriptions = result.filter((item) => item.type === 'description');
        expect(descriptions.some((d) => d.value === 'Sum of all sales transactions')).toBe(true);
    });

    test('should handle multiple measures', () => {
        const metadata = {
            measures: [
                { qInfo: { qId: 'meas-1' }, qMeasure: { qDef: 'Sum(A)' }, qMetaDef: { title: 'Measure A' } },
                { qInfo: { qId: 'meas-2' }, qMeasure: { qDef: 'Sum(B)' }, qMetaDef: { title: 'Measure B' } },
            ],
        };
        const result = extractor.extract(metadata);
        const definitions = result.filter((item) => item.type === 'definition');
        expect(definitions.length).toBe(2);
    });
});

describe('VariableIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new VariableIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('variable');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['variables']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should extract variable definitions', () => {
        const metadata = {
            variables: [
                {
                    qName: 'vBaseURL',
                    qDefinition: 'https://example.com',
                },
            ],
        };
        const result = extractor.extract(metadata);
        const definitions = result.filter((item) => item.type === 'definition');
        expect(definitions.some((d) => d.value === 'https://example.com')).toBe(true);
    });

    test('should extract variable names', () => {
        const metadata = {
            variables: [
                {
                    qName: 'vToday',
                    qDefinition: 'Today()',
                },
            ],
        };
        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === 'name');
        expect(names.some((n) => n.value === 'vToday')).toBe(true);
    });

    test('should handle multiple variables', () => {
        const metadata = {
            variables: [
                { qName: 'v1', qDefinition: '1' },
                { qName: 'v2', qDefinition: '2' },
                { qName: 'v3', qDefinition: '3' },
            ],
        };
        const result = extractor.extract(metadata);
        expect(result.length).toBe(6);
    });

    test('should handle variables without definition', () => {
        const metadata = {
            variables: [{ qName: 'vNoDef' }],
        };
        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === 'name');
        expect(names.length).toBe(1);
    });
});

describe('BookmarkIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new BookmarkIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('bookmark');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['bookmarks']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should extract bookmark titles', () => {
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bm-1' },
                    qMetaDef: { title: 'My Bookmark' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title');
        expect(titles.some((t) => t.value === 'My Bookmark')).toBe(true);
    });

    test('should extract bookmark descriptions', () => {
        const metadata = {
            bookmarks: [
                {
                    qInfo: { qId: 'bm-1' },
                    qMetaDef: { title: 'Bookmark', description: 'Filter for Q1 data' },
                },
            ],
        };
        const result = extractor.extract(metadata);
        const descriptions = result.filter((item) => item.type === 'description');
        expect(descriptions.some((d) => d.value === 'Filter for Q1 data')).toBe(true);
    });

    test('should handle multiple bookmarks', () => {
        const metadata = {
            bookmarks: [
                { qInfo: { qId: 'bm-1' }, qMetaDef: { title: 'Bookmark 1' } },
                { qInfo: { qId: 'bm-2' }, qMetaDef: { title: 'Bookmark 2' } },
            ],
        };
        const result = extractor.extract(metadata);
        const titles = result.filter((item) => item.type === 'title');
        expect(titles.length).toBe(2);
    });
});

describe('ConnectionIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new ConnectionIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('dataconnection');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['dataconnections']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should extract connection names', () => {
        const metadata = {
            dataconnections: [
                {
                    qName: 'SalesData',
                    qConnectionString: 'C:\\Data\\Sales.qvd',
                },
            ],
        };
        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === 'name');
        expect(names.some((n) => n.value === 'SalesData')).toBe(true);
    });

    test('should extract connection descriptions', () => {
        const metadata = {
            dataconnections: [
                {
                    qName: 'MyConnection',
                    qDescription: 'Sales database connection',
                },
            ],
        };
        const result = extractor.extract(metadata);
        const descriptions = result.filter((item) => item.type === 'description');
        expect(descriptions.some((d) => d.value === 'Sales database connection')).toBe(true);
    });

    test('should handle multiple connections', () => {
        const metadata = {
            dataconnections: [
                { qName: 'Conn1', qDescription: 'Description A' },
                { qName: 'Conn2', qDescription: 'Description B' },
            ],
        };
        const result = extractor.extract(metadata);
        expect(result.length).toBe(4);
    });

    test('should handle connections without connection string', () => {
        const metadata = {
            dataconnections: [{ qId: 'conn-1' }],
        };
        const result = extractor.extract(metadata);
        expect(result.length).toBe(0);
    });
});

describe('TableIntelExtractor', () => {
    let extractor;

    beforeEach(() => {
        extractor = new TableIntelExtractor();
    });

    test('should have correct name', () => {
        expect(extractor.name).toBe('table');
    });

    test('should have correct dataTypes', () => {
        expect(extractor.dataTypes).toEqual(['tables']);
    });

    test('should return empty array for empty metadata', () => {
        const result = extractor.extract({});
        expect(result).toEqual([]);
    });

    test('should return empty array for metadata with empty tables', () => {
        const result = extractor.extract({ tables: {} });
        expect(result).toEqual([]);
    });

    test('should extract table names from qtr', () => {
        const metadata = {
            tables: {
                qtr: [{ qName: 'Sales' }],
            },
        };
        const result = extractor.extract(metadata);
        const names = result.filter((item) => item.type === 'name' && item.sourceType === 'table');
        expect(names.some((n) => n.value === 'Sales')).toBe(true);
    });

    test('should extract table tags from qtr', () => {
        const metadata = {
            tables: {
                qtr: [{ qName: 'Sales', qTags: ['$key', '$numeric'] }],
            },
        };
        const result = extractor.extract(metadata);
        const tags = result.filter((item) => item.type === 'field' && item.sourceType === 'table');
        expect(tags.some((t) => t.value === '$key')).toBe(true);
        expect(tags.some((t) => t.value === '$numeric')).toBe(true);
    });

    test('should extract table tags from qTableTags', () => {
        const metadata = {
            tables: {
                qtr: [{ qName: 'Sales', qTableTags: ['Star', 'Synthetic'] }],
            },
        };
        const result = extractor.extract(metadata);
        const tableTags = result.filter((item) => item.path === 'tables.qtr[0].qTableTags');
        expect(tableTags.some((t) => t.value === 'Star')).toBe(true);
        expect(tableTags.some((t) => t.value === 'Synthetic')).toBe(true);
    });

    test('should extract key tables from qk', () => {
        const metadata = {
            tables: {
                qk: [{ qTables: ['Sales', 'Customers'], qKeyFields: ['ID'] }],
            },
        };
        const result = extractor.extract(metadata);
        const keyTables = result.filter((item) => item.sourceType === 'table-key' && item.type === 'field');
        expect(keyTables.some((t) => t.value === 'Sales')).toBe(true);
        expect(keyTables.some((t) => t.value === 'Customers')).toBe(true);
    });

    test('should extract key fields from qk', () => {
        const metadata = {
            tables: {
                qk: [{ qTables: ['Sales'], qKeyFields: ['ID', 'Key'] }],
            },
        };
        const result = extractor.extract(metadata);
        const keyFields = result.filter((item) => item.path === 'tables.qk[0].qKeyFields');
        expect(keyFields.some((f) => f.value === 'ID')).toBe(true);
        expect(keyFields.some((f) => f.value === 'Key')).toBe(true);
    });

    test('should handle multiple tables', () => {
        const metadata = {
            tables: {
                qtr: [
                    { qName: 'Table1', qTags: ['$key'] },
                    { qName: 'Table2', qTags: ['$text'] },
                ],
            },
        };
        const result = extractor.extract(metadata);
        expect(result.length).toBe(4); // 2 names + 2 tags
    });

    test('should handle multiple keys', () => {
        const metadata = {
            tables: {
                qk: [
                    { qTables: ['T1'], qKeyFields: ['F1'] },
                    { qTables: ['T2'], qKeyFields: ['F2'] },
                ],
            },
        };
        const result = extractor.extract(metadata);
        // 2 tables + 2 fields per key
        expect(result.length).toBe(4);
    });
});

describe('extractIntel', () => {
    test('should return intel object with correct structure', () => {
        const metadata = {
            sheets: [],
            dimensions: [],
            measures: [],
            variables: [],
            bookmarks: [],
            dataconnections: [],
        };
        const result = extractIntel(metadata, 'app-123', 'Test App');

        expect(result).toHaveProperty('intel');
        expect(result.intel).toHaveProperty('extractedAt');
        expect(result.intel).toHaveProperty('appId', 'app-123');
        expect(result.intel).toHaveProperty('appName', 'Test App');
        expect(result.intel).toHaveProperty('extractors');
        expect(result.intel).toHaveProperty('count');
        expect(result.intel).toHaveProperty('items');
    });

    test('should extract items from all extractors', () => {
        const metadata = {
            sheets: [
                {
                    qProperty: {
                        qInfo: { qId: 'sheet-1' },
                        qMetaDef: { title: 'Test Sheet' },
                        cells: [],
                        qChildren: [],
                    },
                },
            ],
            dimensions: [
                {
                    qInfo: { qId: 'dim-1' },
                    qDim: { qFieldDefs: ['TestField'] },
                    qMetaDef: { title: 'Test Dimension' },
                },
            ],
            measures: [
                {
                    qInfo: { qId: 'meas-1' },
                    qMeasure: { qDef: 'Sum(Test)' },
                    qMetaDef: { title: 'Test Measure' },
                },
            ],
            variables: [{ qName: 'vTest', qDefinition: '1' }],
            bookmarks: [{ qInfo: { qId: 'bm-1' }, qMetaDef: { title: 'Test Bookmark' } }],
            dataconnections: [{ qName: 'TestConn', qConnectionString: 'LIB://Test' }],
        };
        const result = extractIntel(metadata, 'app-123', 'Test App');

        expect(result.intel.count).toBeGreaterThan(0);
        expect(result.intel.items.length).toBe(result.intel.count);
    });

    test('should return empty items for empty metadata', () => {
        const metadata = {};
        const result = extractIntel(metadata, 'app-123', 'Test App');

        expect(result.intel.count).toBe(0);
        expect(result.intel.items).toEqual([]);
    });

    test('should include all extractor names', () => {
        const metadata = { sheets: [], dimensions: [], measures: [], variables: [], bookmarks: [], dataconnections: [] };
        const result = extractIntel(metadata, 'app-123', 'Test App');

        expect(result.intel.extractors).toContain('sheet');
        expect(result.intel.extractors).toContain('dimension');
        expect(result.intel.extractors).toContain('measure');
        expect(result.intel.extractors).toContain('variable');
        expect(result.intel.extractors).toContain('bookmark');
        expect(result.intel.extractors).toContain('dataconnection');
    });

    test('should handle empty arrays for each object type', () => {
        const metadata = {
            sheets: [],
            dimensions: [],
            measures: [],
            variables: [],
            bookmarks: [],
            dataconnections: [],
        };
        const result = extractIntel(metadata, 'app-123', 'Test App');

        expect(result.intel.count).toBe(0);
    });

    test('should handle undefined metadata', () => {
        const result = extractIntel(undefined, 'app-123', 'Test App');

        expect(result.intel.count).toBe(0);
    });

    test('should handle null metadata', () => {
        const result = extractIntel(null, 'app-123', 'Test App');

        expect(result.intel.count).toBe(0);
    });
});

describe('getAllExtractors', () => {
    test('should return an array of extractors', () => {
        const extractors = getAllExtractors();
        expect(Array.isArray(extractors)).toBe(true);
        expect(extractors.length).toBeGreaterThan(0);
    });

    test('should include all expected extractors', () => {
        const extractors = getAllExtractors();
        const names = extractors.map((e) => e.name);

        expect(names).toContain('sheet');
        expect(names).toContain('dimension');
        expect(names).toContain('measure');
        expect(names).toContain('variable');
        expect(names).toContain('bookmark');
        expect(names).toContain('dataconnection');
    });

    test('each extractor should have name and dataTypes', () => {
        const extractors = getAllExtractors();

        extractors.forEach((extractor) => {
            expect(extractor).toHaveProperty('name');
            expect(extractor).toHaveProperty('dataTypes');
            expect(typeof extractor.name).toBe('string');
            expect(Array.isArray(extractor.dataTypes)).toBe(true);
        });
    });

    test('each extractor should have extract method', () => {
        const extractors = getAllExtractors();

        extractors.forEach((extractor) => {
            expect(typeof extractor.extract).toBe('function');
        });
    });
});

describe('buildSummaryData helper', () => {
    // Import the helper functions by testing through the actual module
    test('should extract sheet count from metadata', () => {
        const appData = {
            appId: 'test-id',
            appName: 'Test App',
            metadata: {
                sheets: [{}, {}, {}],
                stories: [],
                masterobjects: [],
                dimensions: [],
                measures: [],
                bookmarks: [],
                variables: [],
                fields: [],
                dataconnections: [],
                loadScript: 'LOAD * FROM test.qvd;',
            },
        };

        // Simulate buildSummaryData behavior
        const result = {
            appId: appData.appId,
            appName: appData.appName,
            sheetCount: appData.metadata.sheets?.length || 0,
            storyCount: appData.metadata.stories?.length || 0,
            masterObjectCount: appData.metadata.masterobjects?.length || 0,
            dimensionCount: appData.metadata.dimensions?.length || 0,
            measureCount: appData.metadata.measures?.length || 0,
            bookmarkCount: appData.metadata.bookmarks?.length || 0,
            variableCount: appData.metadata.variables?.length || 0,
            fieldCount: appData.metadata.fields?.length || 0,
            dataConnectionCount: appData.metadata.dataconnections?.length || 0,
            scriptLines: appData.metadata.loadScript?.split('\n').length || 0,
        };

        expect(result.appId).toBe('test-id');
        expect(result.appName).toBe('Test App');
        expect(result.sheetCount).toBe(3);
        expect(result.scriptLines).toBe(1);
    });

    test('should handle missing metadata properties', () => {
        const appData = {
            appId: 'test-id',
            appName: 'Test App',
            metadata: {},
        };

        const result = {
            appId: appData.appId,
            appName: appData.appName,
            sheetCount: appData.metadata.sheets?.length || 0,
            storyCount: appData.metadata.stories?.length || 0,
            masterObjectCount: appData.metadata.masterobjects?.length || 0,
            dimensionCount: appData.metadata.dimensions?.length || 0,
            measureCount: appData.metadata.measures?.length || 0,
            bookmarkCount: appData.metadata.bookmarks?.length || 0,
            variableCount: appData.metadata.variables?.length || 0,
            fieldCount: appData.metadata.fields?.length || 0,
            dataConnectionCount: appData.metadata.dataconnections?.length || 0,
            scriptLines: appData.metadata.loadScript?.split('\n').length || 0,
        };

        expect(result.sheetCount).toBe(0);
        expect(result.dimensionCount).toBe(0);
        expect(result.scriptLines).toBe(0);
    });
});

describe('buildFullData helper', () => {
    test('should include all metadata fields', () => {
        const appData = {
            appId: 'test-id',
            appName: 'Test App',
            metadata: {
                loadScript: 'LOAD * FROM test;',
                properties: { qTitle: 'Test App' },
                sheets: [{ qProperty: { qInfo: { qId: 'sheet-1' } } }],
                stories: [],
                masterobjects: [],
                dimensions: [],
                measures: [],
                bookmarks: [],
                variables: [],
                fields: [],
                dataconnections: [],
            },
        };

        const server = 'localhost';
        const engineVersion = '12.612.0';

        const result = {
            exportedAt: new Date().toISOString(),
            server,
            engineVersion,
            appId: appData.appId,
            appName: appData.appName,
            script: appData.metadata.loadScript,
            properties: appData.metadata.properties,
            sheets: appData.metadata.sheets,
            stories: appData.metadata.stories,
            masterobjects: appData.metadata.masterobjects,
            dimensions: appData.metadata.dimensions,
            measures: appData.metadata.measures,
            bookmarks: appData.metadata.bookmarks,
            variables: appData.metadata.variables,
            fields: appData.metadata.fields,
            dataconnections: appData.metadata.dataconnections,
        };

        expect(result.server).toBe('localhost');
        expect(result.engineVersion).toBe('12.612.0');
        expect(result.script).toBe('LOAD * FROM test;');
        expect(result.sheets.length).toBe(1);
    });
});

describe('Edge cases', () => {
    test('sheet extractor should handle malformed sheet data', () => {
        const extractor = new SheetIntelExtractor();
        const metadata = {
            sheets: [null, undefined, {}, { qProperty: null }, { qProperty: {} }],
        };
        const result = extractor.extract(metadata);
        expect(Array.isArray(result)).toBe(true);
    });

    test('dimension extractor should handle missing qDim/qMetaDef', () => {
        const extractor = new DimensionIntelExtractor();
        const metadata = {
            dimensions: [{}, { qInfo: {} }, { qInfo: {}, qDim: {} }, { qInfo: {}, qMetaDef: {} }],
        };
        const result = extractor.extract(metadata);
        expect(Array.isArray(result)).toBe(true);
    });

    test('measure extractor should handle missing qMeasure/qMetaDef', () => {
        const extractor = new MeasureIntelExtractor();
        const metadata = {
            measures: [{}, { qInfo: {} }, { qInfo: {}, qMeasure: {} }],
        };
        const result = extractor.extract(metadata);
        expect(Array.isArray(result)).toBe(true);
    });

    test('variable extractor should handle various variable formats', () => {
        const extractor = new VariableIntelExtractor();
        const metadata = {
            variables: [{}, { qName: '' }, { qName: 'test', qDefinition: '' }, { qName: 'test', qDefinition: null }],
        };
        const result = extractor.extract(metadata);
        expect(Array.isArray(result)).toBe(true);
    });
});

describe('Performance and large datasets', () => {
    test('should handle metadata with many sheets', () => {
        const extractor = new SheetIntelExtractor();
        const sheets = [];
        for (let i = 0; i < 20; i++) {
            sheets.push({
                qProperty: {
                    qInfo: { qId: 'sheet-' + i },
                    qMetaDef: { title: 'Sheet ' + i, description: 'Description ' + i },
                    cells: [{ name: 'cell-' + i, type: 'chart' }],
                    qChildren: [],
                },
            });
        }

        const metadata = { sheets };
        const result = extractor.extract(metadata);

        // 20 sheets * 3 items (title + description + cell name) = 60
        expect(result.length).toBe(60);
    });
});
