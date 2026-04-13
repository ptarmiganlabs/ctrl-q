/**
 * Unit tests for src/lib/util/qseow/intel/extractors/sheet-intel.js
 *
 * Tests the SheetIntelExtractor which extracts labels, titles, descriptions,
 * and expressions from sheets, cells, and child objects.
 */

import { jest, test, expect, describe, beforeEach } from '@jest/globals';
import SheetIntelExtractor from '../../../../lib/util/qseow/intel/extractors/sheet-intel.js';
import { IntelType, SourceType } from '../../../../lib/util/qseow/intel/extractors/base.js';

beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSheet = (overrides = {}) => ({
    qProperty: {
        qInfo: { qId: 'sheet-1' },
        qMetaDef: { title: 'My Sheet', description: 'Sheet desc' },
        cells: [],
        ...overrides.qProperty,
    },
    qChildren: overrides.qChildren || [],
});

const makeChild = (overrides = {}) => ({
    qProperty: {
        qInfo: { qId: 'child-1', qType: 'barchart' },
        title: 'Child Title',
        ...overrides,
    },
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - constructor', () => {
    test('should have correct name and dataTypes', () => {
        const extractor = new SheetIntelExtractor();
        expect(extractor.name).toBe('sheet');
        expect(extractor.dataTypes).toEqual(['sheets']);
    });
});

// ---------------------------------------------------------------------------
// extract() — edge cases
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - extract() edge cases', () => {
    test('should return empty array for empty metadata', () => {
        const extractor = new SheetIntelExtractor();
        expect(extractor.extract({})).toEqual([]);
    });

    test('should return empty array for empty sheets array', () => {
        const extractor = new SheetIntelExtractor();
        expect(extractor.extract({ sheets: [] })).toEqual([]);
    });

    test('should skip null sheet wrapper', () => {
        const extractor = new SheetIntelExtractor();
        const result = extractor.extract({ sheets: [null] });
        expect(result).toEqual([]);
    });

    test('should skip sheet wrapper without qProperty', () => {
        const extractor = new SheetIntelExtractor();
        const result = extractor.extract({ sheets: [{}] });
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// extract() — sheet-level title and description
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - sheet title and description', () => {
    test('should extract sheet title', () => {
        const extractor = new SheetIntelExtractor();
        const result = extractor.extract({ sheets: [makeSheet()] });
        const titles = result.filter((i) => i.type === IntelType.TITLE && i.sourceType === SourceType.SHEET);
        expect(titles).toHaveLength(1);
        expect(titles[0].value).toBe('My Sheet');
        expect(titles[0].sourceId).toBe('sheet-1');
    });

    test('should extract sheet description', () => {
        const extractor = new SheetIntelExtractor();
        const result = extractor.extract({ sheets: [makeSheet()] });
        const descs = result.filter((i) => i.type === IntelType.DESCRIPTION && i.sourceType === SourceType.SHEET);
        expect(descs).toHaveLength(1);
        expect(descs[0].value).toBe('Sheet desc');
    });

    test('should not push null title when title is empty string', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({
            qProperty: { qInfo: { qId: 's1' }, qMetaDef: { title: '', description: 'desc' } },
        });
        const result = extractor.extract({ sheets: [sheet] });
        const titles = result.filter((i) => i.type === IntelType.TITLE && i.sourceType === SourceType.SHEET);
        expect(titles).toHaveLength(0);
    });

    test('should not push null description when description is missing', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({
            qProperty: { qInfo: { qId: 's1' }, qMetaDef: { title: 'T' } },
        });
        const result = extractor.extract({ sheets: [sheet] });
        const descs = result.filter((i) => i.type === IntelType.DESCRIPTION && i.sourceType === SourceType.SHEET);
        expect(descs).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extractCellIntel()
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - extractCellIntel()', () => {
    test('should extract cell name from cells array', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({
            qProperty: {
                qInfo: { qId: 's1' },
                qMetaDef: { title: 'Sheet', description: '' },
                cells: [{ name: 'vis-id-1', type: 'barchart' }],
            },
        });
        const result = extractor.extract({ sheets: [sheet] });
        const names = result.filter((i) => i.type === IntelType.NAME && i.sourceType === SourceType.SHEET_CELL);
        expect(names).toHaveLength(1);
        expect(names[0].value).toBe('vis-id-1');
        expect(names[0].sourceName).toBe('barchart');
    });

    test('should skip cell with empty name', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({
            qProperty: {
                qInfo: { qId: 's1' },
                qMetaDef: { title: 'T', description: '' },
                cells: [{ name: '', type: 'barchart' }],
            },
        });
        const result = extractor.extract({ sheets: [sheet] });
        const names = result.filter((i) => i.sourceType === SourceType.SHEET_CELL);
        expect(names).toHaveLength(0);
    });

    test('path includes correct sheet and cell indices', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({
            qProperty: {
                qInfo: { qId: 's1' },
                qMetaDef: { title: 'T', description: '' },
                cells: [{ name: 'c1', type: 'kpi' }],
            },
        });
        const result = extractor.extract({ sheets: [sheet] });
        const nameItem = result.find((i) => i.sourceType === SourceType.SHEET_CELL);
        expect(nameItem.path).toBe('sheets[0].qProperty.cells[0].name');
    });
});

// ---------------------------------------------------------------------------
// extractChildIntel() — title, label, labelExpression, subtitle, footnote
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - extractChildIntel() basic fields', () => {
    test('should extract child title', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [makeChild()] });
        const result = extractor.extract({ sheets: [sheet] });
        const titles = result.filter((i) => i.type === IntelType.TITLE && i.sourceType === SourceType.SHEET_CHILD);
        expect(titles).toHaveLength(1);
        expect(titles[0].value).toBe('Child Title');
        expect(titles[0].sourceId).toBe('child-1');
    });

    test('should extract qLabel', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [makeChild({ qLabel: 'My Label' })] });
        const result = extractor.extract({ sheets: [sheet] });
        const labels = result.filter((i) => i.type === IntelType.LABEL && i.sourceType === SourceType.SHEET_CHILD);
        expect(labels).toHaveLength(1);
        expect(labels[0].value).toBe('My Label');
    });

    test('should extract qLabelExpression', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [makeChild({ qLabelExpression: '=Sum(Sales)' })] });
        const result = extractor.extract({ sheets: [sheet] });
        const exprs = result.filter((i) => i.type === IntelType.EXPRESSION && i.sourceType === SourceType.SHEET_CHILD);
        expect(exprs.some((e) => e.value === '=Sum(Sales)')).toBe(true);
    });

    test('should extract subtitle as description', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [makeChild({ subtitle: 'A subtitle' })] });
        const result = extractor.extract({ sheets: [sheet] });
        const descs = result.filter((i) => i.type === IntelType.DESCRIPTION && i.sourceType === SourceType.SHEET_CHILD);
        expect(descs.some((d) => d.value === 'A subtitle')).toBe(true);
    });

    test('should extract footnote as description', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [makeChild({ footnote: 'Source: internal' })] });
        const result = extractor.extract({ sheets: [sheet] });
        const descs = result.filter((i) => i.type === IntelType.DESCRIPTION && i.sourceType === SourceType.SHEET_CHILD);
        expect(descs.some((d) => d.value === 'Source: internal')).toBe(true);
    });

    test('should skip child without qProperty', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [{ noProperty: true }] });
        const result = extractor.extract({ sheets: [sheet] });
        const childItems = result.filter((i) => i.sourceType === SourceType.SHEET_CHILD);
        expect(childItems).toHaveLength(0);
    });

    test('should use fallback empty string for missing title in label path', () => {
        const extractor = new SheetIntelExtractor();
        const child = { qProperty: { qInfo: { qId: 'c1', qType: 'text' }, qLabel: 'lbl' } };
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const label = result.find((i) => i.type === IntelType.LABEL && i.sourceType === SourceType.SHEET_CHILD);
        expect(label).toBeDefined();
        expect(label.sourceName).toBe('');
    });
});

// ---------------------------------------------------------------------------
// extractChildIntel() — qListObjectDef
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - extractChildIntel() qListObjectDef', () => {
    test('should extract qFieldDefs from qListObjectDef', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qListObjectDef: { qDef: { qFieldDefs: ['Field1', 'Field2'], qFieldLabels: [] } },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const fields = result.filter((i) => i.type === IntelType.FIELD);
        expect(fields).toHaveLength(2);
        expect(fields[0].value).toBe('Field1');
        expect(fields[1].value).toBe('Field2');
    });

    test('should extract qFieldLabels from qListObjectDef', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qListObjectDef: { qDef: { qFieldDefs: [], qFieldLabels: ['Label A', 'Label B'] } },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const labels = result.filter((i) => i.type === IntelType.LABEL && i.sourceType === SourceType.SHEET_CHILD);
        expect(labels).toHaveLength(2);
        expect(labels[0].value).toBe('Label A');
    });

    test('should skip qListObjectDef when qDef is absent', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({ qListObjectDef: {} });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const fields = result.filter((i) => i.type === IntelType.FIELD);
        expect(fields).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// extractChildIntel() — qHyperCubeDef dimensions
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - extractChildIntel() qHyperCubeDef dimensions', () => {
    test('should extract dimension qFieldDefs', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [{ qDef: { qFieldDefs: ['DimField'], qLabel: '', qLabelExpression: '' } }],
                qMeasures: [],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const fields = result.filter((i) => i.type === IntelType.FIELD);
        expect(fields).toHaveLength(1);
        expect(fields[0].value).toBe('DimField');
    });

    test('should extract dimension qLabel', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [{ qDef: { qFieldDefs: [], qLabel: 'Dim Label' } }],
                qMeasures: [],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const labels = result.filter((i) => i.type === IntelType.LABEL && i.sourceType === SourceType.SHEET_CHILD);
        expect(labels).toHaveLength(1);
        expect(labels[0].value).toBe('Dim Label');
    });

    test('should extract dimension qLabelExpression', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [{ qDef: { qFieldDefs: [], qLabelExpression: '=DimExpr' } }],
                qMeasures: [],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const exprs = result.filter((i) => i.type === IntelType.EXPRESSION && i.sourceType === SourceType.SHEET_CHILD);
        expect(exprs.some((e) => e.value === '=DimExpr')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// extractChildIntel() — qHyperCubeDef measures
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - extractChildIntel() qHyperCubeDef measures', () => {
    test('should extract measure definition via qDef.qDef', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [{ qDef: { qDef: 'Sum(Sales)' } }],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const defs = result.filter((i) => i.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(1);
        expect(defs[0].value).toBe('Sum(Sales)');
    });

    test('should fall back to qDef when qDef.qDef is absent', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [{ qDef: 'Count(Orders)' }],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const defs = result.filter((i) => i.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(1);
        expect(defs[0].value).toBe('Count(Orders)');
    });

    test('should extract measure qLabel', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [{ qDef: { qDef: 'Sum(Sales)' }, qLabel: 'Revenue' }],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const labels = result.filter((i) => i.type === IntelType.LABEL && i.sourceType === SourceType.SHEET_CHILD);
        expect(labels).toHaveLength(1);
        expect(labels[0].value).toBe('Revenue');
    });

    test('should extract measure qLabelExpression', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [{ qDef: { qDef: 'Sum(Sales)' }, qLabelExpression: '=MeasureExpr' }],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const exprs = result.filter((i) => i.type === IntelType.EXPRESSION && i.sourceType === SourceType.SHEET_CHILD);
        expect(exprs.some((e) => e.value === '=MeasureExpr')).toBe(true);
    });

    test('should skip measure with no qDef value', () => {
        const extractor = new SheetIntelExtractor();
        const child = makeChild({
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [{ qDef: undefined }],
            },
        });
        const sheet = makeSheet({ qChildren: [child] });
        const result = extractor.extract({ sheets: [sheet] });
        const defs = result.filter((i) => i.type === IntelType.DEFINITION);
        expect(defs).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Multiple sheets
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - multiple sheets', () => {
    test('should process multiple sheets independently', () => {
        const extractor = new SheetIntelExtractor();
        const sheet1 = makeSheet({ qProperty: { qInfo: { qId: 's1' }, qMetaDef: { title: 'Sheet 1', description: '' }, cells: [] } });
        const sheet2 = makeSheet({ qProperty: { qInfo: { qId: 's2' }, qMetaDef: { title: 'Sheet 2', description: '' }, cells: [] } });
        const result = extractor.extract({ sheets: [sheet1, sheet2] });
        const titles = result.filter((i) => i.type === IntelType.TITLE && i.sourceType === SourceType.SHEET);
        expect(titles).toHaveLength(2);
        expect(titles[0].value).toBe('Sheet 1');
        expect(titles[1].value).toBe('Sheet 2');
    });
});

// ---------------------------------------------------------------------------
// Path format verification
// ---------------------------------------------------------------------------

describe('SheetIntelExtractor - path formats', () => {
    test('child title path includes correct indices', () => {
        const extractor = new SheetIntelExtractor();
        const sheet = makeSheet({ qChildren: [makeChild()] });
        const result = extractor.extract({ sheets: [sheet] });
        const titleItem = result.find((i) => i.type === IntelType.TITLE && i.sourceType === SourceType.SHEET_CHILD);
        expect(titleItem.path).toBe('sheets[0].qChildren[0].qProperty.title');
    });

    test('sheet title path includes correct index', () => {
        const extractor = new SheetIntelExtractor();
        const result = extractor.extract({ sheets: [makeSheet()] });
        const titleItem = result.find((i) => i.type === IntelType.TITLE && i.sourceType === SourceType.SHEET);
        expect(titleItem.path).toBe('sheets[0].qProperty.qMetaDef.title');
    });
});
