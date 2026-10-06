import { test, expect, describe } from '@jest/globals';

import { TASK_TYPE_CODES, isTaskVisible, createLaneRegistry } from '../../../lib/task-gantt/model/lanes.js';

// Ids taken from the anonymised lab fixture (src/__tests__/testdata/task-gantt/qrs-executionresult-full.json)
const CONTENT_MONITOR_APP = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
const OPERATIONS_MONITOR_APP = '0419086f-a935-4358-a356-da2f79069e78';

const RELOAD = TASK_TYPE_CODES.reload;
const EXT_PROGRAM = TASK_TYPE_CODES['ext-program'];
const USER_SYNC = TASK_TYPE_CODES['user-sync'];

const reloadTask = (overrides = {}) => ({
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    name: 'Reload Content Monitor',
    taskType: RELOAD,
    enabled: true,
    appId: CONTENT_MONITOR_APP,
    appName: 'Content Monitor',
    stream: 'Monitoring apps',
    tags: ['Nightly'],
    ...overrides,
});

const extProgramTask = (overrides = {}) => ({
    id: 'bbbbbbbb-1111-2222-3333-444444444444',
    name: 'Run external script',
    taskType: EXT_PROGRAM,
    enabled: true,
    appId: null,
    appName: null,
    stream: null,
    tags: ['Infra'],
    ...overrides,
});

describe('TASK_TYPE_CODES', () => {
    test('maps --task-type names to QRS TaskTypeEnum codes', () => {
        expect(TASK_TYPE_CODES).toEqual({ reload: 0, 'ext-program': 1, 'user-sync': 2, distribute: 3, preload: 4 });
    });

    test('codes are unique', () => {
        const codes = Object.values(TASK_TYPE_CODES);
        expect(new Set(codes).size).toBe(codes.length);
    });
});

describe('isTaskVisible', () => {
    test('every task is visible when no filters are set', () => {
        expect(isTaskVisible(reloadTask(), {})).toBe(true);
        expect(isTaskVisible(extProgramTask(), {})).toBe(true);
        expect(isTaskVisible({ id: 'x', taskType: null, appId: null }, {})).toBe(true);
    });

    test('empty filter lists and an empty app tag set count as no filter', () => {
        const filters = { taskTypes: [], taskIds: [], taskTags: [], appIds: [], appIdsFromTags: new Set() };

        expect(isTaskVisible(reloadTask(), filters)).toBe(true);
        expect(isTaskVisible(extProgramTask(), filters)).toBe(true);
    });

    describe('task type restriction', () => {
        test('hides tasks of types that were not selected', () => {
            const filters = { taskTypes: [RELOAD] };

            expect(isTaskVisible(reloadTask(), filters)).toBe(true);
            expect(isTaskVisible(extProgramTask(), filters)).toBe(false);
        });

        test('accepts several selected types', () => {
            const filters = { taskTypes: [RELOAD, EXT_PROGRAM] };

            expect(isTaskVisible(reloadTask(), filters)).toBe(true);
            expect(isTaskVisible(extProgramTask(), filters)).toBe(true);
            expect(isTaskVisible(reloadTask({ taskType: USER_SYNC }), filters)).toBe(false);
        });

        test('type code 0 (reload) is not mistaken for a missing type', () => {
            expect(isTaskVisible(reloadTask({ taskType: 0 }), { taskTypes: [EXT_PROGRAM] })).toBe(false);
        });

        test('tasks with unknown type (null or undefined) pass the type filter', () => {
            const filters = { taskTypes: [EXT_PROGRAM] };

            expect(isTaskVisible(reloadTask({ taskType: null }), filters)).toBe(true);
            expect(isTaskVisible(reloadTask({ taskType: undefined }), filters)).toBe(true);
        });

        test('type restriction applies on top of matching id/tag/app filters', () => {
            const task = extProgramTask();
            const filters = { taskTypes: [RELOAD], taskIds: [task.id], taskTags: ['Infra'] };

            expect(isTaskVisible(task, filters)).toBe(false);
        });

        test('unknown-type task still has to match the id/tag/app filters', () => {
            const filters = { taskTypes: [RELOAD], taskIds: ['some-other-task'] };

            expect(isTaskVisible(reloadTask({ taskType: null }), filters)).toBe(false);
            expect(isTaskVisible(reloadTask({ taskType: null, id: 'some-other-task' }), filters)).toBe(true);
        });
    });

    describe('id, tag and app filters', () => {
        test('task id filter shows only the listed tasks', () => {
            const filters = { taskIds: [reloadTask().id] };

            expect(isTaskVisible(reloadTask(), filters)).toBe(true);
            expect(isTaskVisible(extProgramTask(), filters)).toBe(false);
        });

        test('task tag filter matches any of the task tags', () => {
            const filters = { taskTags: ['Infra', 'Hourly'] };

            expect(isTaskVisible(extProgramTask(), filters)).toBe(true);
            expect(isTaskVisible(reloadTask({ tags: ['Weekly', 'Hourly'] }), filters)).toBe(true);
            expect(isTaskVisible(reloadTask({ tags: ['Nightly'] }), filters)).toBe(false);
        });

        test('task tag matching is exact (case-sensitive, no substrings)', () => {
            expect(isTaskVisible(reloadTask({ tags: ['nightly'] }), { taskTags: ['Nightly'] })).toBe(false);
            expect(isTaskVisible(reloadTask({ tags: ['Nightly run'] }), { taskTags: ['Nightly'] })).toBe(false);
        });

        test('tasks without tags do not match a tag filter and do not throw', () => {
            expect(isTaskVisible(reloadTask({ tags: undefined }), { taskTags: ['Nightly'] })).toBe(false);
            expect(isTaskVisible(reloadTask({ tags: [] }), { taskTags: ['Nightly'] })).toBe(false);
        });

        test('app id filter matches the task app', () => {
            const filters = { appIds: [CONTENT_MONITOR_APP] };

            expect(isTaskVisible(reloadTask(), filters)).toBe(true);
            expect(isTaskVisible(reloadTask({ appId: OPERATIONS_MONITOR_APP }), filters)).toBe(false);
        });

        test('app ids resolved from app tags match the task app', () => {
            const filters = { appIdsFromTags: new Set([OPERATIONS_MONITOR_APP]) };

            expect(isTaskVisible(reloadTask({ appId: OPERATIONS_MONITOR_APP }), filters)).toBe(true);
            expect(isTaskVisible(reloadTask(), filters)).toBe(false);
        });

        test('an empty resolved app id set without any app tags requested is not a filter', () => {
            expect(isTaskVisible(reloadTask(), { appIdsFromTags: new Set() })).toBe(true);
        });

        // BUG: app.js passes { ...config.filters, appIdsFromTags } where config.filters.appTags holds the --app-tag
        // values. When no app carries the requested tag, appIdsFromTags is empty and isTaskVisible() ignores appTags,
        // so the "filter" is treated as absent and every task gets a visible lane instead of none.
        test('--app-tag that matches no app hides tasks instead of showing all of them', () => {
            const filters = { taskTypes: [], taskIds: [], taskTags: [], appIds: [], appTags: ['NoSuchTag'], appIdsFromTags: new Set() };

            expect(isTaskVisible(reloadTask(), filters)).toBe(false);
            expect(isTaskVisible(extProgramTask(), filters)).toBe(false);
        });

        test('tasks without an app never match app filters', () => {
            expect(isTaskVisible(extProgramTask(), { appIds: [CONTENT_MONITOR_APP] })).toBe(false);
            expect(isTaskVisible(extProgramTask(), { appIdsFromTags: new Set([CONTENT_MONITOR_APP]) })).toBe(false);
            expect(isTaskVisible(extProgramTask({ appId: undefined }), { appIds: [CONTENT_MONITOR_APP] })).toBe(false);
        });

        test('a null in the app filters does not match tasks without an app', () => {
            expect(isTaskVisible(extProgramTask(), { appIds: [null] })).toBe(false);
            expect(isTaskVisible(extProgramTask(), { appIdsFromTags: new Set([null]) })).toBe(false);
        });

        test('task without an app can still match on id or tag', () => {
            const task = extProgramTask();

            expect(isTaskVisible(task, { appIds: [CONTENT_MONITOR_APP], taskIds: [task.id] })).toBe(true);
            expect(isTaskVisible(task, { appIds: [CONTENT_MONITOR_APP], taskTags: ['Infra'] })).toBe(true);
        });

        test('filters are additive (OR): matching any one filter is enough', () => {
            const filters = {
                taskIds: ['id-only-task'],
                taskTags: ['TagOnly'],
                appIds: [CONTENT_MONITOR_APP],
                appIdsFromTags: new Set([OPERATIONS_MONITOR_APP]),
            };
            const base = { taskType: RELOAD, tags: [], appId: 'unrelated-app' };

            expect(isTaskVisible({ ...base, id: 'id-only-task' }, filters)).toBe(true);
            expect(isTaskVisible({ ...base, id: 't2', tags: ['TagOnly'] }, filters)).toBe(true);
            expect(isTaskVisible({ ...base, id: 't3', appId: CONTENT_MONITOR_APP }, filters)).toBe(true);
            expect(isTaskVisible({ ...base, id: 't4', appId: OPERATIONS_MONITOR_APP }, filters)).toBe(true);
            expect(isTaskVisible({ ...base, id: 't5' }, filters)).toBe(false);
        });
    });
});

describe('createLaneRegistry', () => {
    test('starts empty', () => {
        const lanes = createLaneRegistry({});

        expect(lanes.all()).toEqual([]);
        expect(lanes.visible()).toEqual([]);
        expect(lanes.get('missing')).toBeUndefined();
    });

    test('a new task gets a lane with the next index and is reported as added and changed', () => {
        const lanes = createLaneRegistry({});

        const first = lanes.upsert(reloadTask());
        const second = lanes.upsert(extProgramTask());

        expect(first.added).toBe(true);
        expect(first.changed).toBe(true);
        expect(first.lane).toEqual({
            idx: 0,
            id: 'aaaaaaaa-1111-2222-3333-444444444444',
            name: 'Reload Content Monitor',
            taskType: RELOAD,
            enabled: true,
            appId: CONTENT_MONITOR_APP,
            appName: 'Content Monitor',
            stream: 'Monitoring apps',
            tags: ['Nightly'],
            deleted: false,
            visible: true,
        });
        expect(second.added).toBe(true);
        expect(second.lane.idx).toBe(1);
        expect(lanes.all().map((l) => l.idx)).toEqual([0, 1]);
    });

    test('lane indexes stay stable and increase in first-seen order', () => {
        const lanes = createLaneRegistry({});
        const ids = ['t-a', 't-b', 't-c', 't-d'];
        for (const id of ids) lanes.upsert({ id, name: id });

        // Update tasks in a different order, and add a new one in between
        lanes.upsert({ id: 't-c', name: 'C renamed' });
        lanes.upsert({ id: 't-e', name: 't-e' });
        lanes.upsert({ id: 't-a', name: 'A renamed' });

        expect(lanes.all().map((l) => [l.id, l.idx])).toEqual([
            ['t-a', 0],
            ['t-b', 1],
            ['t-c', 2],
            ['t-d', 3],
            ['t-e', 4],
        ]);
        expect(lanes.get('t-c').name).toBe('C renamed');
    });

    test('upserting the same task again is neither added nor changed', () => {
        const lanes = createLaneRegistry({});
        lanes.upsert(reloadTask());

        const again = lanes.upsert(reloadTask());

        expect(again.added).toBe(false);
        expect(again.changed).toBe(false);
        expect(lanes.all()).toHaveLength(1);
    });

    test('an update keeps the lane object and index and reports changed', () => {
        const lanes = createLaneRegistry({});
        const { lane } = lanes.upsert(reloadTask());
        lanes.upsert(extProgramTask());

        const res = lanes.upsert(reloadTask({ name: 'Reload Content Monitor (v2)', enabled: false }));

        expect(res.added).toBe(false);
        expect(res.changed).toBe(true);
        expect(res.lane).toBe(lane);
        expect(lane.idx).toBe(0);
        expect(lane.name).toBe('Reload Content Monitor (v2)');
        expect(lane.enabled).toBe(false);
        expect(lanes.get(lane.id)).toBe(lane);
        expect(lanes.all()).toHaveLength(2);
    });

    test('a partial update merges with the fields already known', () => {
        const lanes = createLaneRegistry({});
        lanes.upsert(reloadTask());

        const res = lanes.upsert({ id: reloadTask().id, appName: 'Content Monitor (renamed)' });

        expect(res.changed).toBe(true);
        expect(res.lane).toMatchObject({
            idx: 0,
            name: 'Reload Content Monitor',
            taskType: RELOAD,
            enabled: true,
            appId: CONTENT_MONITOR_APP,
            appName: 'Content Monitor (renamed)',
            stream: 'Monitoring apps',
            tags: ['Nightly'],
        });
    });

    test('a partial update carrying only known values is not a change', () => {
        const lanes = createLaneRegistry({});
        lanes.upsert(reloadTask());

        const res = lanes.upsert({ id: reloadTask().id, name: 'Reload Content Monitor' });

        expect(res.changed).toBe(false);
    });

    test('explicit false / empty values replace earlier ones instead of falling back to them', () => {
        const lanes = createLaneRegistry({});
        lanes.upsert(reloadTask());

        const res = lanes.upsert({ id: reloadTask().id, enabled: false, tags: [], name: '' });

        expect(res.changed).toBe(true);
        expect(res.lane.enabled).toBe(false);
        expect(res.lane.tags).toEqual([]);
        expect(res.lane.name).toBe('');
    });

    test('tag changes are detected by value, including order', () => {
        const lanes = createLaneRegistry({});
        lanes.upsert(reloadTask({ tags: ['A', 'B'] }));

        expect(lanes.upsert(reloadTask({ tags: ['A', 'B'] })).changed).toBe(false);
        expect(lanes.upsert(reloadTask({ tags: ['A', 'B', 'C'] })).changed).toBe(true);
        expect(lanes.upsert(reloadTask({ tags: ['C', 'B', 'A'] })).changed).toBe(true);
    });

    test('defaults for a task known only by id', () => {
        const lanes = createLaneRegistry({});

        const { lane } = lanes.upsert({ id: 'cccccccc-1111-2222-3333-444444444444' });

        expect(lane).toEqual({
            idx: 0,
            id: 'cccccccc-1111-2222-3333-444444444444',
            name: 'Deleted task cccccccc',
            taskType: null,
            enabled: false,
            appId: null,
            appName: null,
            stream: null,
            tags: [],
            deleted: false,
            visible: true,
        });
    });

    test('deleted task without a name is named after the first 8 characters of its id', () => {
        const lanes = createLaneRegistry({});

        const { lane } = lanes.upsert({
            id: '7f3e2a10-dead-beef-0000-123456789abc',
            taskType: RELOAD,
            appId: OPERATIONS_MONITOR_APP,
            deleted: true,
        });

        expect(lane.name).toBe('Deleted task 7f3e2a10');
        expect(lane.deleted).toBe(true);
        expect(lane.appId).toBe(OPERATIONS_MONITOR_APP);
    });

    test('deleted task with a short or non-string id still gets a default name', () => {
        const lanes = createLaneRegistry({});

        expect(lanes.upsert({ id: 'abc', deleted: true }).lane.name).toBe('Deleted task abc');
        expect(lanes.upsert({ id: 12345678901, deleted: true }).lane.name).toBe('Deleted task 12345678');
    });

    test('deleted task keeps the name it had while known', () => {
        const lanes = createLaneRegistry({});
        lanes.upsert(reloadTask());

        const res = lanes.upsert({ id: reloadTask().id, deleted: true });

        expect(res.changed).toBe(true);
        expect(res.lane.name).toBe('Reload Content Monitor');
        expect(res.lane.deleted).toBe(true);
    });

    test('a deleted lane is replaced by a real name once the task is known', () => {
        const lanes = createLaneRegistry({});
        const id = 'dddddddd-1111-2222-3333-444444444444';
        lanes.upsert({ id, taskType: RELOAD, deleted: true });

        const res = lanes.upsert({ id, name: 'Reload Operations Monitor', taskType: RELOAD, appId: OPERATIONS_MONITOR_APP });

        expect(res.added).toBe(false);
        expect(res.changed).toBe(true);
        expect(res.lane).toMatchObject({ idx: 0, name: 'Reload Operations Monitor', deleted: false, appId: OPERATIONS_MONITOR_APP });
    });

    test('deleted is taken from each upsert, not merged', () => {
        const lanes = createLaneRegistry({});
        const id = 'eeeeeeee-1111-2222-3333-444444444444';
        lanes.upsert({ id, deleted: true });

        expect(lanes.upsert({ id }).lane.deleted).toBe(false);
        expect(lanes.upsert({ id, deleted: 1 }).lane.deleted).toBe(true);
    });

    test('lane visibility follows the registry filters', () => {
        const lanes = createLaneRegistry({ taskTypes: [RELOAD] });

        const reload = lanes.upsert(reloadTask()).lane;
        const ext = lanes.upsert(extProgramTask()).lane;

        expect(reload.visible).toBe(true);
        expect(ext.visible).toBe(false);
        expect(lanes.all()).toEqual([reload, ext]);
        expect(lanes.visible()).toEqual([reload]);
    });

    test('visibility is computed on the merged task, not only the incoming fields', () => {
        const lanes = createLaneRegistry({ appIds: [CONTENT_MONITOR_APP] });
        lanes.upsert(reloadTask());

        // Incoming update has no appId; the lane keeps the known app and so stays visible
        const res = lanes.upsert({ id: reloadTask().id, name: 'Renamed' });

        expect(res.lane.appId).toBe(CONTENT_MONITOR_APP);
        expect(res.lane.visible).toBe(true);
    });

    test('visible flag is recomputed on update and a flip counts as a change', () => {
        const lanes = createLaneRegistry({ taskTypes: [RELOAD] });
        const id = 'ffffffff-1111-2222-3333-444444444444';

        // Unknown type: passes the type filter
        const first = lanes.upsert({ id, deleted: true });
        expect(first.lane.visible).toBe(true);
        expect(lanes.visible()).toHaveLength(1);

        // Type becomes known and is not selected: lane hides
        const second = lanes.upsert({ id, taskType: EXT_PROGRAM, deleted: true });
        expect(second.changed).toBe(true);
        expect(second.lane.visible).toBe(false);
        expect(second.lane.idx).toBe(0);
        expect(lanes.visible()).toEqual([]);
        expect(lanes.all()).toHaveLength(1);
    });

    test('tag filter visibility changes when task tags change', () => {
        const lanes = createLaneRegistry({ taskTags: ['Nightly'] });
        lanes.upsert(reloadTask({ tags: [] }));
        expect(lanes.visible()).toEqual([]);

        const res = lanes.upsert(reloadTask({ tags: ['Nightly'] }));

        expect(res.changed).toBe(true);
        expect(res.lane.visible).toBe(true);
        expect(lanes.visible().map((l) => l.id)).toEqual([reloadTask().id]);
    });

    test('lanes from app tag filters: only tasks of tagged apps are visible', () => {
        const lanes = createLaneRegistry({ appIdsFromTags: new Set([CONTENT_MONITOR_APP]) });
        lanes.upsert(reloadTask());
        lanes.upsert(reloadTask({ id: 'op-monitor-task', name: 'Reload Operations Monitor', appId: OPERATIONS_MONITOR_APP }));
        lanes.upsert(extProgramTask());

        expect(lanes.visible().map((l) => l.id)).toEqual([reloadTask().id]);
        expect(lanes.all().map((l) => l.idx)).toEqual([0, 1, 2]);
    });

    test('all() and visible() reflect later updates to existing lanes', () => {
        const lanes = createLaneRegistry({ taskTypes: [RELOAD] });
        lanes.upsert(reloadTask());

        lanes.upsert(reloadTask({ name: 'Renamed' }));

        expect(lanes.all()[0].name).toBe('Renamed');
        expect(lanes.visible()[0].name).toBe('Renamed');
    });

    test('separate registries do not share lanes or indexes', () => {
        const a = createLaneRegistry({});
        const b = createLaneRegistry({});
        a.upsert(reloadTask());
        a.upsert(extProgramTask());

        const res = b.upsert(extProgramTask());

        expect(res.added).toBe(true);
        expect(res.lane.idx).toBe(0);
        expect(b.get(reloadTask().id)).toBeUndefined();
        expect(a.all()).toHaveLength(2);
        expect(b.all()).toHaveLength(1);
    });
});
