/**
 * Unit tests for extParseReloadTask() from src/lib/task/parse_reload_task.js
 *
 * getAppById is mocked (requires live Qlik API).
 * getTagIdByName and getCustomPropertyIdByName are pure local lookups — not mocked.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock getAppById before importing the module under test (ESM hoisting)
jest.unstable_mockModule('../../lib/util/qseow/app.js', () => ({
    getAppById: jest.fn(),
    getAppByName: jest.fn(),
    appExistById: jest.fn(),
}));

const { extParseReloadTask } = await import('../../lib/task/parse_reload_task.js');
const { getAppById } = await import('../../lib/util/qseow/app.js');

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const tagsExisting = [
    { id: 'tag-prod', name: 'Production' },
    { id: 'tag-dev', name: 'Development' },
];

const cpExisting = [
    { id: 'cp-env-id', name: 'Environment', objectTypes: ['ReloadTask', 'ExternalProgramTask'] },
    { id: 'cp-ext-only-id', name: 'ExtOnly', objectTypes: ['ExternalProgramTask'] },
];

/** A real, RFC-4122-valid UUID for tests */
const VALID_APP_UUID = '550e8400-e29b-41d4-a716-446655440000';

const colHeaders = {
    taskCounter: { pos: 0 },
    taskType: { pos: 1 },
    taskId: { pos: 2 },
    taskName: { pos: 3 },
    taskEnabled: { pos: 4 },
    taskSessionTimeout: { pos: 5 },
    taskMaxRetries: { pos: 6 },
    isManuallyTriggered: { pos: 7 },
    isPartialReload: { pos: 8 },
    taskTags: { pos: 9 },
    taskCustomProperties: { pos: 10 },
    appId: { pos: 11 },
    importOptions: { pos: 12 },
    eventType: { pos: 13 },
    eventEnabled: { pos: 14 },
    eventName: { pos: 15 },
    eventCounter: { pos: 16 },
    ruleCounter: { pos: 17 },
    ruleTaskId: { pos: 18 },
    ruleState: { pos: 19 },
    timeConstraintDays: { pos: 20 },
    timeConstraintHours: { pos: 21 },
    timeConstraintMinutes: { pos: 22 },
    timeConstraintSeconds: { pos: 23 },
    daylightSavingsTime: { pos: 24 },
    schemaTimeZone: { pos: 25 },
    schemaStart: { pos: 26 },
    scheamExpiration: { pos: 27 },
    schemaFilterDescription: { pos: 28 },
    schemaIncrementDescription: { pos: 29 },
    schemaIncrementOption: { pos: 30 },
};

function makeTaskRow({
    taskId = 'task-uuid-001',
    taskName = 'My Reload Task',
    taskType = 'Reload',
    enabled = true,
    sessionTimeout = 1440,
    maxRetries = 0,
    isManuallyTriggered = false,
    isPartialReload = false,
    tags = '',
    customProperties = '',
    appId = VALID_APP_UUID,
    importOptions = 'if-exists-update-existing',
} = {}) {
    const row = [];
    row[colHeaders.taskId.pos] = taskId;
    row[colHeaders.taskName.pos] = taskName;
    row[colHeaders.taskType.pos] = taskType;
    row[colHeaders.taskEnabled.pos] = enabled;
    row[colHeaders.taskSessionTimeout.pos] = sessionTimeout;
    row[colHeaders.taskMaxRetries.pos] = maxRetries;
    row[colHeaders.isManuallyTriggered.pos] = isManuallyTriggered;
    row[colHeaders.isPartialReload.pos] = isPartialReload;
    row[colHeaders.taskTags.pos] = tags;
    row[colHeaders.taskCustomProperties.pos] = customProperties;
    row[colHeaders.appId.pos] = appId;
    row[colHeaders.importOptions.pos] = importOptions;
    return row;
}

function makeContext(overrides = {}) {
    return {
        importedApps: null,
        parseSchemaEvents: jest.fn().mockReturnValue([]),
        parseCompositeEvents: jest.fn().mockResolvedValue([]),
        ...overrides,
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
        fakeTaskId: 'reload-task-fake-uuid',
        nodesWithEvents: new Set(),
        taskFileColumnHeaders: colHeaders,
        options: {},
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// 1. App ID — valid UUID (happy path)
// ---------------------------------------------------------------------------

describe('extParseReloadTask — valid UUID appId', () => {
    beforeEach(() => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID, name: 'My App' });
    });

    test('resolves and returns currentTask with correct app id', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ appId: VALID_APP_UUID });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.app.id).toBe(VALID_APP_UUID);
    });

    test('returns task with correct name', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ taskName: 'Sales Reload' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.name).toBe('Sales Reload');
    });

    test('returns task with schemaPath = ReloadTask', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.schemaPath).toBe('ReloadTask');
    });

    test('returns task with correct enabled flag', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ enabled: false });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.enabled).toBe(false);
    });

    test('returns correct taskCreationOption from file', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ importOptions: 'if-exists-add-another' });
        const { taskCreationOption } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(taskCreationOption).toBe('if-exists-add-another');
    });

    test('calls getAppById with the UUID from the row', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ appId: VALID_APP_UUID });
        await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(getAppById).toHaveBeenCalledWith(VALID_APP_UUID, expect.anything());
    });
});

// ---------------------------------------------------------------------------
// 2. importOptions column handling
// ---------------------------------------------------------------------------

describe('extParseReloadTask — importOptions', () => {
    beforeEach(() => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID });
    });

    test('uses file value when column present', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ importOptions: 'if-exists-update-existing' });
        const { taskCreationOption } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(taskCreationOption).toBe('if-exists-update-existing');
    });

    test('defaults to if-exists-update-existing when importOptions pos is 999', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        const headersWithout = { ...colHeaders, importOptions: { pos: 999 } };
        const { taskCreationOption } = await extParseReloadTask(
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
        const { taskCreationOption } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(taskCreationOption).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 3. newapp- prefix handling
// ---------------------------------------------------------------------------

describe('extParseReloadTask — newapp- prefix appId', () => {
    test('resolves app ID from importedApps.appIdMap when newapp- prefix present', async () => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID });
        const ctx = makeContext({
            importedApps: {
                appIdMap: new Map([['newapp-1', VALID_APP_UUID]]),
            },
        });
        const logger = makeLogger();
        const row = makeTaskRow({ appId: 'newapp-1' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.app.id).toBe(VALID_APP_UUID);
    });

    test('is case-insensitive for newapp- prefix lookup', async () => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID });
        const ctx = makeContext({
            importedApps: {
                appIdMap: new Map([['newapp-2', VALID_APP_UUID]]),
            },
        });
        const logger = makeLogger();
        const row = makeTaskRow({ appId: 'NEWAPP-2' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.app.id).toBe(VALID_APP_UUID);
    });
});

// ---------------------------------------------------------------------------
// 4. Tag extraction
// ---------------------------------------------------------------------------

describe('extParseReloadTask — tag extraction', () => {
    beforeEach(() => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID });
    });

    test('adds single tag when one tag name matches', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: 'Production' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(1);
        expect(currentTask.tags[0]).toEqual({ id: 'tag-prod', name: 'Production' });
    });

    test('adds multiple tags from slash-separated list', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: 'Production/Development' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(2);
    });

    test('handles empty tag field', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ tags: '' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.tags).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 5. Custom property extraction
// ---------------------------------------------------------------------------

describe('extParseReloadTask — custom property extraction', () => {
    beforeEach(() => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID });
    });

    test('adds single CP with valid name=value format', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: 'Environment=Production' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(1);
        expect(currentTask.customProperties[0]).toEqual({
            definition: { id: 'cp-env-id', name: 'Environment' },
            value: 'Production',
        });
    });

    test('skips CP not valid for ReloadTask object type', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: 'ExtOnly=someValue' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(0);
    });

    test('handles empty CP field', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow({ customProperties: '' });
        const { currentTask } = await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(currentTask.customProperties).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 6. Delegates to parse event methods
// ---------------------------------------------------------------------------

describe('extParseReloadTask — delegates to parse event methods', () => {
    beforeEach(() => {
        getAppById.mockResolvedValue({ id: VALID_APP_UUID });
    });

    test('calls _.parseSchemaEvents once with taskType=reload', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(ctx.parseSchemaEvents).toHaveBeenCalledTimes(1);
        expect(ctx.parseSchemaEvents.mock.calls[0][0]).toMatchObject({ taskType: 'reload' });
    });

    test('calls _.parseCompositeEvents once with taskType=reload', async () => {
        const ctx = makeContext();
        const logger = makeLogger();
        const row = makeTaskRow();
        await extParseReloadTask(ctx, { ...makeBaseParam(), taskRows: [row] }, logger);
        expect(ctx.parseCompositeEvents).toHaveBeenCalledTimes(1);
        expect(ctx.parseCompositeEvents.mock.calls[0][0]).toMatchObject({ taskType: 'reload' });
    });
});
