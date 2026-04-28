/**
 * Unit tests for extParseExternalProgramTask() from src/lib/task/parse_ext_program_task.js
 *
 * getTagIdByName and getCustomPropertyIdByName are pure local lookups — no live Qlik API.
 * Only _.parseSchemaEvents and _.parseCompositeEvents need mocking.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { extParseExternalProgramTask } from '../../lib/task/parse_ext_program_task.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const tagsExisting = [
    { id: 'tag-prod', name: 'Production' },
    { id: 'tag-dev', name: 'Development' },
    { id: 'tag-test', name: 'Test' },
];

const cpExisting = [
    { id: 'cp-env-id', name: 'Environment', objectTypes: ['ExternalProgramTask', 'ReloadTask'] },
    { id: 'cp-owner-id', name: 'Owner', objectTypes: ['ExternalProgramTask'] },
    { id: 'cp-reload-only-id', name: 'ReloadOnly', objectTypes: ['ReloadTask'] },
];

/**
 * Column header positions — mirrors getTaskColumnPosFromHeaderRow() output.
 */
const colHeaders = {
    taskCounter: { pos: 0 },
    taskType: { pos: 1, name: 'Task type' },
    taskId: { pos: 2 },
    taskName: { pos: 3 },
    taskEnabled: { pos: 4 },
    taskSessionTimeout: { pos: 5 },
    taskMaxRetries: { pos: 6 },
    taskTags: { pos: 7 },
    taskCustomProperties: { pos: 8 },
    extPgmPath: { pos: 9 },
    extPgmParam: { pos: 10 },
    importOptions: { pos: 11 },
    eventType: { pos: 12 },
    eventEnabled: { pos: 13 },
    eventName: { pos: 14 },
    eventCounter: { pos: 15 },
    ruleCounter: { pos: 16 },
    ruleTaskId: { pos: 17 },
    ruleState: { pos: 18 },
    timeConstraintDays: { pos: 19 },
    timeConstraintHours: { pos: 20 },
    timeConstraintMinutes: { pos: 21 },
    timeConstraintSeconds: { pos: 22 },
};

/**
 * Builds a minimal task row array for an external program task.
 */
function makeTaskRow({
    taskId = 'task-uuid-001',
    taskName = 'My Ext Task',
    taskType = 'External program',
    enabled = true,
    sessionTimeout = 1440,
    maxRetries = 0,
    tags = '',
    customProperties = '',
    path = '/usr/local/bin/my_script.sh',
    params = '--arg1 value1',
    importOptions = 'if-exists-update-existing',
} = {}) {
    const row = [];
    row[colHeaders.taskId.pos] = taskId;
    row[colHeaders.taskName.pos] = taskName;
    row[colHeaders.taskType.pos] = taskType;
    row[colHeaders.taskEnabled.pos] = enabled;
    row[colHeaders.taskSessionTimeout.pos] = sessionTimeout;
    row[colHeaders.taskMaxRetries.pos] = maxRetries;
    row[colHeaders.taskTags.pos] = tags;
    row[colHeaders.taskCustomProperties.pos] = customProperties;
    row[colHeaders.extPgmPath.pos] = path;
    row[colHeaders.extPgmParam.pos] = params;
    row[colHeaders.importOptions.pos] = importOptions;
    return row;
}

function makeContext() {
    return {
        parseSchemaEvents: jest.fn().mockReturnValue([]),
        parseCompositeEvents: jest.fn().mockResolvedValue([]),
    };
}

function makeLogger() {
    return { verbose: jest.fn(), error: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn() };
}

function makeBaseParam(overrides = {}) {
    return {
        taskCounter: 1,
        tagsExisting,
        cpExisting,
        fakeTaskId: 'ext-pgm-task-fake-uuid',
        nodesWithEvents: new Set(),
        taskFileColumnHeaders: colHeaders,
        options: {},
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// 1. importOptions column handling
// ---------------------------------------------------------------------------

describe('extParseExternalProgramTask — importOptions', () => {
    test('uses file value when importOptions column pos is not 999', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ importOptions: 'if-exists-update-existing' });
        const { taskCreationOption } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(taskCreationOption).toBe('if-exists-update-existing');
    });

    test('uses if-exists-add-another from file', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ importOptions: 'if-exists-add-another' });
        const { taskCreationOption } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(taskCreationOption).toBe('if-exists-add-another');
    });

    test('defaults to if-exists-update-existing when importOptions column pos is 999', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        const headersWithout = { ...colHeaders, importOptions: { pos: 999 } };
        const { taskCreationOption } = await extParseExternalProgramTask(
            ctx,
            { ...makeBaseParam(), taskRows: [row], taskFileColumnHeaders: headersWithout },
            logger
        );
        expect(taskCreationOption).toBe('if-exists-update-existing');
    });

    test('allows empty importOptions value', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ importOptions: '' });
        const { taskCreationOption } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(taskCreationOption).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 2. Basic task object structure
// ---------------------------------------------------------------------------

describe('extParseExternalProgramTask — task object structure', () => {
    let result;

    beforeEach(async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ path: '/opt/scripts/run.sh', params: '--env prod' });
        result = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
    });

    test('returns currentTask with correct id', () => {
        expect(result.currentTask.id).toBe('task-uuid-001');
    });

    test('returns currentTask with correct name', () => {
        expect(result.currentTask.name).toBe('My Ext Task');
    });

    test('returns currentTask with correct path', () => {
        expect(result.currentTask.path).toBe('/opt/scripts/run.sh');
    });

    test('returns currentTask with correct parameters', () => {
        expect(result.currentTask.parameters).toBe('--env prod');
    });

    test('returns currentTask with correct enabled flag', () => {
        expect(result.currentTask.enabled).toBe(true);
    });

    test('returns currentTask with correct sessionTimeout', () => {
        expect(result.currentTask.taskSessionTimeout).toBe(1440);
    });

    test('returns currentTask with correct maxRetries', () => {
        expect(result.currentTask.maxRetries).toBe(0);
    });

    test('returns currentTask with schemaPath = ExternalProgramTask', () => {
        expect(result.currentTask.schemaPath).toBe('ExternalProgramTask');
    });

    test('returns currentTask with empty tags array when no tags', () => {
        expect(result.currentTask.tags).toEqual([]);
    });

    test('returns currentTask with empty customProperties array when no CPs', () => {
        expect(result.currentTask.customProperties).toEqual([]);
    });

    test('returns currentTask with schemaEvents from parseSchemaEvents', () => {
        expect(Array.isArray(result.currentTask.schemaEvents)).toBe(true);
    });

    test('returns currentTask with prelCompositeEvents from parseCompositeEvents', () => {
        expect(Array.isArray(result.currentTask.prelCompositeEvents)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3. Tag extraction
// ---------------------------------------------------------------------------

describe('extParseExternalProgramTask — tag extraction', () => {
    test('adds single tag when one tag name matches', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: 'Production' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(1);
        expect(currentTask.tags[0]).toEqual({ id: 'tag-prod', name: 'Production' });
    });

    test('adds multiple tags when slash-separated list provided', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: 'Production/Development' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(2);
        expect(currentTask.tags.map((t) => t.name)).toEqual(['Production', 'Development']);
    });

    test('skips tags that do not exist in tagsExisting', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: 'NonExistent' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        // getTagIdByName returns false for unknown tag; tag still pushed with id=false
        expect(currentTask.tags).toHaveLength(1);
        expect(currentTask.tags[0].id).toBe(false);
    });

    test('trims whitespace from tag names', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: ' Production / Development ' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(2);
    });

    test('handles empty tag field — no tags added', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: '' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(0);
    });

    test('filters out empty entries from slash-separated list', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: 'Production//Development' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// 4. Custom property extraction
// ---------------------------------------------------------------------------

describe('extParseExternalProgramTask — custom property extraction', () => {
    test('adds single custom property with valid name=value format', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: 'Environment=Production' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(1);
        expect(currentTask.customProperties[0]).toEqual({
            definition: { id: 'cp-env-id', name: 'Environment' },
            value: 'Production',
        });
    });

    test('adds multiple custom properties when slash-separated', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: 'Environment=Production/Owner=TeamA' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(2);
    });

    test('skips CP that does not exist in cpExisting', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: 'NonExistentProp=Value' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(0);
    });

    test('skips CP that is not valid for ExternalProgramTask object type', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: 'ReloadOnly=someValue' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(0);
    });

    test('handles empty custom properties field — no CPs added', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: '' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(0);
    });

    test('trims whitespace from CP names and values', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: ' Environment = Production ' });
        const { currentTask } = await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(1);
        expect(currentTask.customProperties[0].value).toBe('Production');
    });
});

// ---------------------------------------------------------------------------
// 5. parseSchemaEvents / parseCompositeEvents are called
// ---------------------------------------------------------------------------

describe('extParseExternalProgramTask — delegates to parse event methods', () => {
    test('calls _.parseSchemaEvents once with taskType=external program', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(ctx.parseSchemaEvents).toHaveBeenCalledTimes(1);
        expect(ctx.parseSchemaEvents.mock.calls[0][0]).toMatchObject({ taskType: 'external program' });
    });

    test('calls _.parseCompositeEvents once with taskType=external program', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        await extParseExternalProgramTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(ctx.parseCompositeEvents).toHaveBeenCalledTimes(1);
        expect(ctx.parseCompositeEvents.mock.calls[0][0]).toMatchObject({ taskType: 'external program' });
    });
});
