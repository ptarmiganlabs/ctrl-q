/**
 * Unit tests for extParseSchemaEvents() from src/lib/task/parse_schema_events.js
 *
 * The function has no live Qlik API calls — it only uses lookup maps and mutates
 * the `_` context object (taskNetwork + qlikSenseSchemaEvents). All tests run
 * fully offline.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { extParseSchemaEvents } from '../../lib/task/parse_schema_events.js';
import { mapEventType, mapDaylightSavingTime, mapIncrementOption } from '../../lib/util/qseow/lookups.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext() {
    return {
        taskNetwork: { nodes: [], edges: [] },
        qlikSenseSchemaEvents: { addSchemaEvent: jest.fn() },
    };
}

function makeLogger() {
    return {
        verbose: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
    };
}

/**
 * Minimal column-header positions used across tests.
 * Mirrors the shape produced by getTaskColumnPosFromHeaderRow().
 */
const colHeaders = {
    eventType: { pos: 0 },
    eventEnabled: { pos: 1 },
    eventName: { pos: 2 },
    daylightSavingsTime: { pos: 3 },
    schemaTimeZone: { pos: 4 },
    schemaStart: { pos: 5 },
    scheamExpiration: { pos: 6 }, // intentional typo – matches source
    schemaFilterDescription: { pos: 7 },
    schemaIncrementDescription: { pos: 8 },
    schemaIncrementOption: { pos: 9 },
};

/**
 * Returns a task row that represents one schema event.
 */
function makeSchemaRow({ eventType = 'Schema', enabled = true, name = 'Every day', tz = 'Europe/Stockholm' } = {}) {
    const row = [];
    row[colHeaders.eventType.pos] = eventType;
    row[colHeaders.eventEnabled.pos] = enabled;
    row[colHeaders.eventName.pos] = name;
    row[colHeaders.daylightSavingsTime.pos] = 'ObserveDaylightSavingTime';
    row[colHeaders.schemaTimeZone.pos] = tz;
    row[colHeaders.schemaStart.pos] = '2024-01-01T00:00:00.000Z';
    row[colHeaders.scheamExpiration.pos] = '2099-12-31T00:00:00.000Z';
    row[colHeaders.schemaFilterDescription.pos] = '* * - * * * * *';
    row[colHeaders.schemaIncrementDescription.pos] = '0 0 1 0 0';
    row[colHeaders.schemaIncrementOption.pos] = 'daily';
    return row;
}

const baseParam = {
    taskCounter: 1,
    currentTask: { name: 'Test Reload Task' },
    fakeTaskId: 'reload-task-fake-uuid-1234',
    nodesWithEvents: new Set(),
    taskFileColumnHeaders: colHeaders,
    options: {},
};

// ---------------------------------------------------------------------------
// 1. No schema events
// ---------------------------------------------------------------------------

describe('extParseSchemaEvents — no schema rows', () => {
    test('returns empty array when taskRows has no schema event row', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: [], taskType: 'reload' }, logger);
        expect(result).toEqual([]);
    });

    test('returns empty array when taskRows only contains non-schema rows', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const nonSchemaRow = makeSchemaRow({ eventType: 'Composite' });
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: [nonSchemaRow], taskType: 'reload' }, logger);
        expect(result).toEqual([]);
    });

    test('logs verbose message when no schema events found', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: [], taskType: 'reload' }, logger);
        expect(logger.verbose).toHaveBeenCalledWith(expect.stringContaining('No schema events'));
    });

    test('does not mutate taskNetwork when no schema events', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: [], taskType: 'reload' }, logger);
        expect(ctx.taskNetwork.nodes).toHaveLength(0);
        expect(ctx.taskNetwork.edges).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 2. Single schema event — reload task
// ---------------------------------------------------------------------------

describe('extParseSchemaEvents — single schema event, reload task', () => {
    let ctx, logger, result, schemaRow;

    beforeEach(() => {
        ctx = makeContext();
        logger = makeLogger();
        schemaRow = makeSchemaRow({ name: 'Daily at midnight', tz: 'UTC' });
        result = extParseSchemaEvents(
            ctx,
            { ...baseParam, taskRows: [schemaRow], taskType: 'reload', nodesWithEvents: new Set() },
            logger
        );
    });

    test('returns array with one schema event', () => {
        expect(result).toHaveLength(1);
    });

    test('schema event has correct name', () => {
        expect(result[0].name).toBe('Daily at midnight');
    });

    test('schema event eventType is mapped to numeric value', () => {
        expect(result[0].eventType).toBe(mapEventType.get('Schema'));
    });

    test('schema event daylightSavingTime is mapped correctly', () => {
        expect(result[0].daylightSavingTime).toBe(mapDaylightSavingTime.get('ObserveDaylightSavingTime'));
    });

    test('schema event incrementOption is mapped to numeric value', () => {
        expect(result[0].incrementOption).toBe(mapIncrementOption.get('daily'));
    });

    test('schema event has correct timezone', () => {
        expect(result[0].timeZone).toBe('UTC');
    });

    test('schema event enabled flag is preserved', () => {
        expect(result[0].enabled).toBe(true);
    });

    test('schema event has schemaPath = SchemaEvent', () => {
        expect(result[0].schemaPath).toBe('SchemaEvent');
    });

    test('schema event filterDescription is wrapped in array', () => {
        expect(Array.isArray(result[0].schemaFilterDescription)).toBe(true);
        expect(result[0].schemaFilterDescription[0]).toBe('* * - * * * * *');
    });

    test('adds one node to taskNetwork (schedule meta-node)', () => {
        expect(ctx.taskNetwork.nodes).toHaveLength(1);
    });

    test('schedule node has metaNode = true', () => {
        expect(ctx.taskNetwork.nodes[0].metaNode).toBe(true);
    });

    test('schedule node has metaNodeType = schedule', () => {
        expect(ctx.taskNetwork.nodes[0].metaNodeType).toBe('schedule');
    });

    test('schedule node has isTopLevelNode = true', () => {
        expect(ctx.taskNetwork.nodes[0].isTopLevelNode).toBe(true);
    });

    test('adds one edge to taskNetwork pointing to the fake task', () => {
        expect(ctx.taskNetwork.edges).toHaveLength(1);
    });

    test('edge.to equals fakeTaskId', () => {
        expect(ctx.taskNetwork.edges[0].to).toBe(baseParam.fakeTaskId);
    });

    test('edge.from equals the schedule node id', () => {
        expect(ctx.taskNetwork.edges[0].from).toBe(ctx.taskNetwork.nodes[0].id);
    });

    test('calls qlikSenseSchemaEvents.addSchemaEvent once', () => {
        expect(ctx.qlikSenseSchemaEvents.addSchemaEvent).toHaveBeenCalledTimes(1);
    });

    test('nodesWithEvents includes the fakeTaskId', () => {
        const nodesWithEvents = new Set();
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: [schemaRow], taskType: 'reload', nodesWithEvents }, logger);
        expect(nodesWithEvents.has(baseParam.fakeTaskId)).toBe(true);
    });

    test('reloadTask property is deleted from schema event after processing', () => {
        expect(result[0].reloadTask).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. Single schema event — external program task
// ---------------------------------------------------------------------------

describe('extParseSchemaEvents — single schema event, external program task', () => {
    let ctx, logger, result;

    beforeEach(() => {
        ctx = makeContext();
        logger = makeLogger();
        const schemaRow = makeSchemaRow();
        result = extParseSchemaEvents(
            ctx,
            { ...baseParam, taskRows: [schemaRow], taskType: 'external program', nodesWithEvents: new Set() },
            logger
        );
    });

    test('returns array with one schema event', () => {
        expect(result).toHaveLength(1);
    });

    test('adds edge with to = fakeTaskId', () => {
        expect(ctx.taskNetwork.edges[0].to).toBe(baseParam.fakeTaskId);
    });

    test('externalProgramTask property is deleted from schema event after processing', () => {
        expect(result[0].externalProgramTask).toBeUndefined();
    });

    test('nodesWithEvents includes the fakeTaskId', () => {
        const nodesWithEvents = new Set();
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: [makeSchemaRow()], taskType: 'external program', nodesWithEvents }, logger);
        expect(nodesWithEvents.has(baseParam.fakeTaskId)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 4. Multiple schema events
// ---------------------------------------------------------------------------

describe('extParseSchemaEvents — multiple schema events', () => {
    test('returns one entry per schema row', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const rows = [makeSchemaRow({ name: 'Event A' }), makeSchemaRow({ name: 'Event B' }), makeSchemaRow({ name: 'Event C' })];
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: rows, taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result).toHaveLength(3);
    });

    test('adds one node per schema event to taskNetwork', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const rows = [makeSchemaRow({ name: 'Event A' }), makeSchemaRow({ name: 'Event B' })];
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: rows, taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(ctx.taskNetwork.nodes).toHaveLength(2);
    });

    test('adds one edge per schema event to taskNetwork', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const rows = [makeSchemaRow({ name: 'Event A' }), makeSchemaRow({ name: 'Event B' })];
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: rows, taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(ctx.taskNetwork.edges).toHaveLength(2);
    });

    test('each schema event has distinct name', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const rows = [makeSchemaRow({ name: 'Alpha' }), makeSchemaRow({ name: 'Beta' })];
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: rows, taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result[0].name).toBe('Alpha');
        expect(result[1].name).toBe('Beta');
    });

    test('filters out non-schema rows correctly', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const rows = [makeSchemaRow({ name: 'Valid' }), makeSchemaRow({ eventType: 'Composite' }), makeSchemaRow({ name: 'AlsoValid' })];
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: rows, taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result).toHaveLength(2);
        expect(result.map((r) => r.name)).toEqual(['Valid', 'AlsoValid']);
    });
});

// ---------------------------------------------------------------------------
// 5. Case-insensitive event type matching
// ---------------------------------------------------------------------------

describe('extParseSchemaEvents — case-insensitive row filtering', () => {
    test('matches schema rows with mixed case "Schema"', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeSchemaRow({ eventType: 'Schema' });
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: [row], taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result).toHaveLength(1);
    });

    test('matches schema rows with uppercase "SCHEMA"', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeSchemaRow({ eventType: 'SCHEMA' });
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: [row], taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result).toHaveLength(1);
    });

    test('matches schema rows with lowercase "schema"', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeSchemaRow({ eventType: 'schema' });
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: [row], taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 6. Disabled schema event
// ---------------------------------------------------------------------------

describe('extParseSchemaEvents — disabled event', () => {
    test('preserves enabled=false on schema event', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeSchemaRow({ enabled: false });
        const result = extParseSchemaEvents(ctx, { ...baseParam, taskRows: [row], taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(result[0].enabled).toBe(false);
    });

    test('preserves enabled=false on schedule node', () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeSchemaRow({ enabled: false });
        extParseSchemaEvents(ctx, { ...baseParam, taskRows: [row], taskType: 'reload', nodesWithEvents: new Set() }, logger);
        expect(ctx.taskNetwork.nodes[0].enabled).toBe(false);
    });
});
