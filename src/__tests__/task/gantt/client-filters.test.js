import { test, expect, describe } from '@jest/globals';

import {
    createClientStore,
    parseSearch,
    defaultFilters,
    encodeFilterHash,
    decodeFilterHash,
    filtersActive,
    lanesInEpisodes,
    episodesWithLanes,
    rowBegin,
    RUN_STATES,
    TASK_STATES,
    SORTS,
    MAX_SEARCH_LENGTH,
} from '../../../static/task-gantt/store.js';
import { FLAG_STALE, PROBLEM_BUCKETS, statusInfo } from '../../../static/task-gantt/format.js';

// The lane filters of the task Gantt page: the search syntax, the tag picker, run and task states, "Only tasks in
// congestion", the episode list and the location hash. All of it is in store.js, which runs in Node as it is.

const COLS = ['key', 'lane', 'status', 'triggeredAt', 'queuedAt', 'startedAt', 'stoppedAt', 'node', 'src', 'flags'];
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Window 06:00-07:00 UTC; "now" is the end of the window
const T0 = Date.UTC(2026, 9, 6, 6, 0, 0);
const FROM = T0;
const TO = T0 + HOUR;
const NOW = TO;
const at = (min) => T0 + min * MIN;
const NODES = ['sense-node1.example.com', 'sense-node2.example.com'];

const toCols = (rows) => Object.fromEntries(COLS.map((c) => [c, rows.map((r) => r[c] ?? null)]));

const lane = (idx, name, extra = {}) => ({
    idx,
    id: `task-${idx}`,
    name,
    taskType: 0,
    enabled: true,
    appId: `app-${idx}`,
    appName: null,
    stream: null,
    tags: [],
    deleted: false,
    coverage: [],
    ...extra,
});

const LANES = [
    lane(0, 'Finance daily load', { appName: 'Finance mart', stream: 'Finance', tags: ['Nightly', 'Finance dept'] }),
    lane(1, 'Finance test load', { appName: 'Finance mart (test)', stream: 'Test', tags: ['Nightly', 'Test'] }),
    lane(2, 'Sales hourly', { appName: 'Sales dashboard', stream: 'Sales', tags: ['Hourly'] }),
    // Only its stream says Finance. Disabled in Sense. A tag with characters that need care in a URL.
    lane(3, 'HR monthly', { appName: 'HR analytics', stream: 'Finance', tags: ['Monthly', 'A,B & C=D'], enabled: false }),
    // Deleted in Sense, so also not enabled; no app, stream or tags any more (tags null must not break anything)
    lane(4, 'Old extract', { appId: null, tags: null, deleted: true, enabled: false }),
    // A colon in the name, and a tag that differs from "Nightly" only in case
    lane(5, 'Reload: QVD extract', { appName: 'QVD generator', stream: 'Everyone', tags: ['nightly'] }),
    // These two ran only before the window
    lane(6, 'Monitor apps', { appName: 'Monitoring', stream: 'Monitoring apps', enabled: false }),
    lane(7, 'Weekly archive', { appName: 'Archive', stream: 'Everyone', tags: ['Weekly'] }),
];

const r = (key, laneIdx, status, triggeredAt, queuedAt, startedAt, stoppedAt, node, flags = 0) => ({
    key,
    lane: laneIdx,
    status,
    triggeredAt,
    queuedAt,
    startedAt,
    stoppedAt,
    node,
    src: 1,
    flags,
});

const ROWS = [
    r('f0a', 0, 7, at(5), null, at(5), at(10), 0), // success
    r('f0b', 0, 8, at(30), null, at(30), at(35), 0), // failed: the latest run of lane 0
    r('t1a', 1, 8, at(2), null, at(2), at(4), 0), // failed, then
    r('t1b', 1, 7, at(40), null, at(40), at(45), 0), // succeeded
    r('s2a', 2, 7, at(10), at(10), at(12), at(20), 1), // waited 2 min in the queue, then succeeded
    r('s2b', 2, 2, at(50), null, at(50), null, 1), // running now
    r('h3a', 3, 9, at(15), null, null, at(15), 0), // skipped
    r('d4a', 4, 2, T0 - 26 * HOUR, null, T0 - 26 * HOUR, null, 0, FLAG_STALE), // "running" for 27 h: state unknown
    r('q5a', 5, 7, at(-60), null, at(-60), at(-50), 0), // success, before the window
    r('q5b', 5, 6, at(20), null, at(20), at(25), 1), // aborted: the latest run of lane 5
    r('m6a', 6, 7, at(-120), null, at(-120), at(-110), 0), // success, before the window
    r('w7a', 7, 8, at(-180), null, at(-180), at(-170), 0), // failed, before the window
];

const task = (laneIdx, taskId = `task-${laneIdx}`) => ({ taskId, lane: laneIdx, overlapMs: MIN, waitMs: 0, runs: 1 });
const episode = (from, to, tasks, node = NODES[0]) => ({ from, to, node, capacity: 2, peakRunning: 2, peakQueued: 1, waitMs: MIN, tasks });

// A task without a lane on the page (lane: null) takes part in the first one
const EPISODES = [episode(at(10), at(20), [task(2), task(0), task(null, 'hidden-task')], NODES[1]), episode(at(40), at(45), [task(1)])];

const makeSnapshot = () => ({
    rev: 10,
    generatedAt: NOW,
    live: null,
    window: { from: FROM, to: TO },
    nodes: [...NODES],
    lanes: LANES.map((l) => ({ ...l })),
    cols: toCols(ROWS),
    sources: [],
    capacity: { nodes: NODES.map((name) => ({ name, maxConcurrentEngines: 2 })) },
    analytics: { bucketMs: 60000, concurrency: { total: [], nodes: [] }, episodes: structuredClone(EPISODES), taskStats: [] },
});

const loadedStore = () => {
    const store = createClientStore();
    store.load(makeSnapshot());
    return store;
};

const viewOf = (store, opts = {}) => store.view({ from: FROM, to: TO, now: NOW, ...opts });
// The lanes shown, as a set: these tests are about which lanes, not their order
const shown = (opts, store = loadedStore()) => [...viewOf(store, opts).order].sort((a, b) => a - b);
const keysOf = (rows) => rows.map((x) => x.key).sort();
const WITH_RUNS = [0, 1, 2, 3, 4, 5];

describe('parseSearch', () => {
    const word = (text, field = null, exclude = false) => ({ field, text, exclude });

    test.each([
        ['', []],
        ['   ', []],
        ['finance', [word('finance')]],
        ['Finance  DAILY', [word('finance'), word('daily')]],
        ['finance -test tag:nightly', [word('finance'), word('test', null, true), word('nightly', 'tag')]],
        ['"two words" other', [word('two words'), word('other')]],
        ['-"two words"', [word('two words', null, true)]],
        ['tag:"Finance dept"', [word('finance dept', 'tag')]],
        ['-tag:"finance dept" app:mart', [word('finance dept', 'tag', true), word('mart', 'app')]],
        [
            'TAG:Nightly App:Mart STREAM:fin Name:Load',
            [word('nightly', 'tag'), word('mart', 'app'), word('fin', 'stream'), word('load', 'name')],
        ],
        // A phrase still being typed runs to the end
        ['"unterminated phrase', [word('unterminated phrase')]],
        // Any other prefix is part of an ordinary word, like a colon in a task name
        ['reload: qvd', [word('reload:'), word('qvd')]],
        ['owner:me', [word('owner:me')]],
        // Quotes make a prefix literal, and a dash too
        ['"tag:x"', [word('tag:x')]],
        ['"-x"', [word('-x')]],
        // Only the first dash excludes
        ['--x', [word('-x', null, true)]],
        // Empty terms are dropped
        ['- tag: "" -"" "   " -tag:', []],
        // A phrase ends at its closing quote; a quote inside a word is an ordinary character
        ['"ab"cd', [word('ab'), word('cd')]],
        ['ab"cd', [word('ab"cd')]],
        ['  "  padded  "  ', [word('padded')]],
        // Any white space separates words; control characters count as spaces
        ['tab\tseparated\nwords', [word('tab'), word('separated'), word('words')]],
        ['non breaking', [word('non'), word('breaking')]],
        ['ctrl\u0000char', [word('ctrl'), word('char')]],
        ['"a\u0000b"', [word('a b')]],
        ['Försäljning ÅÄÖ', [word('försäljning'), word('åäö')]],
    ])('%j', (text, terms) => {
        expect(parseSearch(text)).toEqual(terms);
    });

    test('takes null and undefined as no text', () => {
        expect(parseSearch(null)).toEqual([]);
        expect(parseSearch(undefined)).toEqual([]);
    });

    test(`reads at most ${MAX_SEARCH_LENGTH} characters`, () => {
        // 333 times "ab " is 999 characters, then the "a" of the next "ab"
        const terms = parseSearch('ab '.repeat(1000));
        expect(terms).toHaveLength(334);
        expect(terms.at(-1)).toEqual(word('a'));
    });
});

describe('view(): search', () => {
    test.each([
        // A word without a prefix matches the task name, app name, stream or a tag
        ['finance', [0, 1, 3]],
        ['FINANCE', [0, 1, 3]],
        ['generator', [5]], // app name only
        ['everyone', [5]], // stream only (lane 7 has no runs in the window)
        ['dept', [0]], // tag only
        // All words must match, in any order
        ['load finance', [0, 1]],
        ['finance hourly', []],
        // -word excludes
        ['finance -test', [0, 3]],
        ['finance -test tag:nightly', [0]],
        ['sales -sales', []],
        ['extract -tag:nightly', [4]], // a lane without tags never matches a tag: term
        // A prefix narrows a word to that field
        ['name:finance', [0, 1]],
        ['app:finance', [0, 1]],
        ['stream:finance', [0, 3]],
        ['tag:nightly', [0, 1, 5]], // a substring of the tag, ignoring case
        ['tag:night', [0, 1, 5]],
        ['-tag:nightly', [2, 3, 4]],
        ['app:"(test)"', [1]],
        // A phrase must match as it is, within one field
        ['"finance dept"', [0]],
        ['"mart (test)"', [1]],
        ['"load finance"', []],
        ['tag:"a,b & c=d"', [3]],
        // An unknown prefix is part of the word
        ['reload:', [5]],
        // Terms left empty do not filter
        ['-', WITH_RUNS],
        ['tag:', WITH_RUNS],
        ['""', WITH_RUNS],
    ])('%j', (search, lanes) => {
        expect(shown({ search })).toEqual(lanes);
    });

    test('a phrase never matches across two fields', () => {
        // Lane 0: the name "Finance daily load" is followed by the app "Finance mart", the stream "Finance" by the tag
        // "Nightly"
        expect(shown({ search: '"load finance"' })).toEqual([]);
        expect(shown({ search: '"finance nightly"' })).toEqual([]);
        expect(shown({ search: '"daily load"' })).toEqual([0]);
    });

    test('search text from a delta is searched; nothing is kept from the old lane', () => {
        const store = loadedStore();
        store.applyDelta({ rev: 11, lanes: [lane(2, 'Sales nightly', { appName: 'Sales dashboard', tags: ['Critical'] })] });

        expect(shown({ search: 'hourly' }, store)).toEqual([]);
        expect(shown({ search: 'tag:critical sales nightly' }, store)).toEqual([2]);
    });

    test('the search only chooses lanes: their rows are all drawn', () => {
        expect(keysOf(viewOf(loadedStore(), { search: 'sales' }).rows)).toEqual(['s2a', 's2b']);
    });
});

describe('view(): tags', () => {
    test.each([
        [{ tagsInclude: ['Nightly'] }, [0, 1]], // the exact tag: "nightly" on lane 5 is another one
        [{ tagsInclude: ['nightly'] }, [5]],
        [{ tagsInclude: ['Nightly', 'Hourly'] }, [0, 1, 2]], // any included tag
        [{ tagsExclude: ['Test'] }, [0, 2, 3, 4, 5]], // lanes without tags have none of the excluded ones
        [{ tagsExclude: ['Nightly', 'nightly'] }, [2, 3, 4]],
        [{ tagsInclude: ['Nightly'], tagsExclude: ['Test'] }, [0]],
        [{ tagsInclude: ['A,B & C=D'] }, [3]],
        [{ tagsInclude: ['No such tag'] }, []],
        [{ tagsExclude: ['No such tag'] }, WITH_RUNS],
        [{ tagsInclude: ['Weekly'] }, []], // its lane has no runs in the window
        [{ tagsInclude: ['Weekly'], onlyWithRuns: false }, [7]],
        [{ tagsInclude: ['Nightly'], search: 'test' }, [1]],
    ])('%j', (opts, lanes) => {
        expect(shown(opts)).toEqual(lanes);
    });

    test('tags only choose lanes: their rows are all drawn', () => {
        expect(keysOf(viewOf(loadedStore(), { tagsInclude: ['Hourly'] }).rows)).toEqual(['s2a', 's2b']);
    });

    test('tags() lists every tag of every lane, with its lane count, by name ignoring case', () => {
        expect(loadedStore().tags()).toEqual([
            { name: 'A,B & C=D', count: 1 },
            { name: 'Finance dept', count: 1 },
            { name: 'Hourly', count: 1 },
            { name: 'Monthly', count: 1 },
            { name: 'Nightly', count: 2 },
            { name: 'nightly', count: 1 },
            { name: 'Test', count: 1 },
            { name: 'Weekly', count: 1 }, // a lane without runs in the window counts too
        ]);
    });

    test('tags() is worked out again only after lanes changed', () => {
        const store = loadedStore();
        const before = store.tags();
        viewOf(store, { search: 'finance', tagsInclude: ['Nightly'] });
        store.applyDelta({ rev: 11, cols: toCols([r('s2c', 2, 7, at(55), null, at(55), at(56), 1)]) });
        expect(store.tags()).toBe(before);

        store.applyDelta({
            rev: 12,
            lanes: [lane(2, 'Sales hourly', { tags: ['Hourly', 'Critical'] }), lane(8, 'New task', { tags: ['Nightly'] })],
        });
        const after = store.tags();
        expect(after).not.toBe(before);
        expect(after.find((t) => t.name === 'Critical')).toEqual({ name: 'Critical', count: 1 });
        expect(after.find((t) => t.name === 'Hourly')).toEqual({ name: 'Hourly', count: 1 });
        expect(after.find((t) => t.name === 'Nightly')).toEqual({ name: 'Nightly', count: 3 });

        store.load({ ...makeSnapshot(), lanes: [lane(0, 'Only lane', { tags: ['Solo'] })] });
        expect(store.tags()).toEqual([{ name: 'Solo', count: 1 }]);
    });

    test('a store without lanes has no tags', () => {
        expect(createClientStore().tags()).toEqual([]);
    });
});

describe('view(): run states', () => {
    test.each([
        // Failed, aborted and error, plus a stale "running" (state unknown), as the old "problems" status filter
        [['problems'], ['d4a', 'f0b', 'q5b', 't1a'], [0, 1, 4, 5]],
        [['waited'], ['s2a'], [2]],
        [['running'], ['s2b'], [2]], // not the stale d4a
        [['success'], ['f0a', 's2a', 't1b'], [0, 1, 2]],
        [['skipped'], ['h3a'], [3]],
        // Several states: runs in any of them
        [
            ['waited', 'skipped'],
            ['h3a', 's2a'],
            [2, 3],
        ],
        [
            ['problems', 'success'],
            ['d4a', 'f0a', 'f0b', 'q5b', 's2a', 't1a', 't1b'],
            [0, 1, 2, 4, 5],
        ],
        [RUN_STATES, ['d4a', 'f0a', 'f0b', 'h3a', 'q5b', 's2a', 's2b', 't1a', 't1b'], WITH_RUNS],
        // Unknown states are ignored
        [['nope'], ['d4a', 'f0a', 'f0b', 'h3a', 'q5b', 's2a', 's2b', 't1a', 't1b'], WITH_RUNS],
    ])('%j draws the runs %j in the lanes %j', (runStates, rows, lanes) => {
        const v = viewOf(loadedStore(), { runStates });

        expect(keysOf(v.rows)).toEqual(rows);
        expect([...v.order].sort((a, b) => a - b)).toEqual(lanes);
    });

    test('lanes without a matching run stay hidden, also with "Only tasks with runs" off', () => {
        expect(shown({ runStates: ['skipped'], onlyWithRuns: false })).toEqual([3]);
    });

    test('the per-lane statistics, and so the sort order, cover the runs drawn', () => {
        const v = viewOf(loadedStore(), { runStates: ['problems'] });

        expect(v.perLane.get(0)).toEqual({ first: at(30), wait: 0, fails: 1, runtime: 5 * MIN, runs: 1 });
        expect(v.order).toEqual([4, 1, 5, 0]);
    });
});

describe('view(): task states', () => {
    test.each([
        [['disabled'], [3]], // lane 6 has no runs in the window; lane 4 is deleted, not disabled
        [['deleted'], [4]],
        // The latest run the page holds failed, was aborted or has an unknown state; lane 1 succeeded after a failure,
        // lane 2 is running and lane 3 was skipped
        [['last-failed'], [0, 4, 5]],
        // Several states: lanes in any of them
        [
            ['disabled', 'deleted'],
            [3, 4],
        ],
        [TASK_STATES, [0, 3, 4, 5]],
        [['nope'], WITH_RUNS],
    ])('%j', (taskStates, lanes) => {
        expect(shown({ taskStates })).toEqual(lanes);
    });

    test('with "Only tasks with runs" off they also show lanes without runs in the window', () => {
        expect(shown({ taskStates: ['disabled'], onlyWithRuns: false })).toEqual([3, 6]);
        // Lane 7's latest run failed before the window
        expect(shown({ taskStates: ['last-failed'], onlyWithRuns: false })).toEqual([0, 4, 5, 7]);
    });

    test('they choose lanes only: every run of a lane shown is drawn', () => {
        expect(keysOf(viewOf(loadedStore(), { taskStates: ['last-failed'] }).rows)).toEqual(['d4a', 'f0a', 'f0b', 'q5b']);
    });

    test('combine with run states with AND', () => {
        // Lanes 0, 1 and 2 have a successful run; of those only lane 0's latest run failed
        const v = viewOf(loadedStore(), { runStates: ['success'], taskStates: ['last-failed'] });
        expect(v.order).toEqual([0]);
        expect(keysOf(v.rows)).toEqual(['f0a']);

        expect(shown({ runStates: ['problems'], taskStates: ['last-failed'] })).toEqual([0, 4, 5]);
        expect(shown({ runStates: ['problems'], taskStates: ['disabled'] })).toEqual([]);
        expect(shown({ runStates: ['skipped', 'waited'], taskStates: ['disabled', 'deleted'] })).toEqual([3]);
    });

    test('"last run failed" follows new and removed runs', () => {
        const store = loadedStore();
        expect(shown({ taskStates: ['last-failed'] }, store)).toEqual([0, 4, 5]);

        store.applyDelta({ rev: 11, cols: toCols([r('f0c', 0, 7, at(55), null, at(55), at(57), 0)]) });
        expect(shown({ taskStates: ['last-failed'] }, store)).toEqual([4, 5]);

        store.applyDelta({ rev: 12, removed: ['f0c'] });
        expect(shown({ taskStates: ['last-failed'] }, store)).toEqual([0, 4, 5]);

        // A run that changes its status in place, here the running one in lane 2 failing
        store.applyDelta({ rev: 13, cols: toCols([{ ...ROWS[5], status: 8, stoppedAt: at(58) }]) });
        expect(shown({ taskStates: ['last-failed'] }, store)).toEqual([0, 2, 4, 5]);
    });

    test('"last run failed" follows a running execution that turns stale, and back', () => {
        const store = loadedStore();
        store.applyLive({ from: T0, coveredTo: NOW, staleKeys: ['s2b', 'd4a'] });
        expect(shown({ taskStates: ['last-failed'] }, store)).toEqual([0, 2, 4, 5]);

        store.applyLive({ from: T0, coveredTo: NOW, staleKeys: [] });
        expect(shown({ taskStates: ['last-failed'] }, store)).toEqual([0, 5]);
    });
});

describe('view(): only tasks in congestion', () => {
    test.each([
        ['the whole window', { from: FROM, to: TO }, [0, 1, 2]], // the task without a lane is left out
        ['the second episode only', { from: at(30), to: at(60) }, [1]],
        ['touching both episodes, overlapping neither', { from: at(20), to: at(40) }, []],
        ['overlapping both by a minute', { from: at(19), to: at(41) }, [0, 1, 2]],
        ['no episode', { from: at(50), to: at(60) }, []],
    ])('in %s', (_, visible, lanes) => {
        expect(shown({ congestionOnly: true, episodes: EPISODES, visible })).toEqual(lanes);
    });

    test('without a visible range, the window counts', () => {
        expect(shown({ congestionOnly: true, episodes: EPISODES })).toEqual([0, 1, 2]);
    });

    test('off, or without episodes', () => {
        expect(shown({ congestionOnly: false, episodes: EPISODES, visible: { from: at(50), to: at(60) } })).toEqual(WITH_RUNS);
        expect(shown({ congestionOnly: true, episodes: [] })).toEqual([]);
        expect(shown({ congestionOnly: true })).toEqual([]);
    });

    test('combines with the other filters with AND, and chooses lanes only', () => {
        expect(shown({ congestionOnly: true, episodes: EPISODES, tagsInclude: ['Nightly'] })).toEqual([0, 1]);
        expect(shown({ congestionOnly: true, episodes: EPISODES, runStates: ['problems'] })).toEqual([0, 1]);
        // s2b ran after the episode, and is drawn
        expect(keysOf(viewOf(loadedStore(), { congestionOnly: true, episodes: EPISODES, search: 'sales' }).rows)).toEqual(['s2a', 's2b']);
    });

    test('filters never change the analytics', () => {
        const store = loadedStore();
        const analytics = structuredClone(store.snapshot().analytics);
        viewOf(store, {
            search: 'finance -test',
            tagsInclude: ['Nightly'],
            runStates: ['problems'],
            taskStates: ['last-failed'],
            congestionOnly: true,
            episodes: store.snapshot().analytics.episodes,
            node: NODES[0],
        });

        expect(store.snapshot().analytics).toEqual(analytics);
        expect(store.snapshot().analytics.episodes).toEqual(EPISODES);
    });
});

describe('lanesInEpisodes / episodesWithLanes', () => {
    test('lanesInEpisodes collects the lanes of the episodes overlapping a range', () => {
        expect(lanesInEpisodes(EPISODES, FROM, TO)).toEqual(new Set([2, 0, 1]));
        expect(lanesInEpisodes(EPISODES, at(44), at(46))).toEqual(new Set([1]));
        expect(lanesInEpisodes(EPISODES, at(45), at(46))).toEqual(new Set());
        expect(lanesInEpisodes([{ from: at(1), to: at(2) }], FROM, TO)).toEqual(new Set());
        expect(lanesInEpisodes(undefined, FROM, TO)).toEqual(new Set());
    });

    test('episodesWithLanes keeps the episodes involving one of the lanes, in their order', () => {
        expect(episodesWithLanes(EPISODES, new Set([1, 2]))).toEqual(EPISODES);
        expect(episodesWithLanes(EPISODES, new Set([0]))).toEqual([EPISODES[0]]);
        expect(episodesWithLanes(EPISODES, new Set([1]))).toEqual([EPISODES[1]]);
        // A task without a lane is never shown
        expect(episodesWithLanes([episode(at(1), at(2), [task(null, 'hidden-task')])], new Set(WITH_RUNS))).toEqual([]);
        expect(episodesWithLanes(EPISODES, new Set())).toEqual([]);
        expect(episodesWithLanes([{ from: 1, to: 2 }], new Set([1]))).toEqual([]);
        expect(episodesWithLanes(undefined, new Set([1]))).toEqual([]);
    });

    test('with the lanes a filter shows, as the page does for "Only episodes with shown tasks"', () => {
        const order = viewOf(loadedStore(), { search: 'test' }).order;
        expect(order).toEqual([1]);
        expect(episodesWithLanes(EPISODES, new Set(order))).toEqual([EPISODES[1]]);
    });
});

describe('filtersActive', () => {
    test('the defaults, sorting and "Only tasks with runs" are not filters', () => {
        expect(filtersActive(defaultFilters())).toBe(false);
        expect(filtersActive({ ...defaultFilters(), sort: 'name', onlyWithRuns: false, episodesShownOnly: true })).toBe(false);
        // Search text without a term filters nothing
        expect(filtersActive({ ...defaultFilters(), search: ' - tag: "" ' })).toBe(false);
    });

    test.each([
        { search: 'finance' },
        { tagsInclude: ['Nightly'] },
        { tagsExclude: ['Test'] },
        { runStates: ['waited'] },
        { taskStates: ['deleted'] },
        { congestionOnly: true },
        { node: NODES[0] },
    ])('%j is a filter', (over) => {
        expect(filtersActive({ ...defaultFilters(), ...over })).toBe(true);
    });
});

describe('location hash', () => {
    const ALL = {
        search: 'finance -test tag:nightly "two words"',
        tagsInclude: ['Nightly', 'Finance dept'],
        tagsExclude: ['Test'],
        runStates: ['problems', 'waited'],
        taskStates: ['last-failed', 'deleted'],
        congestionOnly: true,
        onlyWithRuns: false,
        node: 'sense-node2.example.com',
        sort: 'wait',
        episodesShownOnly: true,
    };

    test('the defaults have no hash, and no hash gives the defaults', () => {
        expect(encodeFilterHash(defaultFilters())).toBe('');
        for (const hash of ['', '#', undefined, null]) expect(decodeFilterHash(hash)).toEqual(defaultFilters());
    });

    test('every setting survives the round trip', () => {
        expect(decodeFilterHash(encodeFilterHash(ALL))).toEqual(ALL);
    });

    test.each([
        ...RUN_STATES.map((s) => ({ runStates: [s] })),
        ...TASK_STATES.map((s) => ({ taskStates: [s] })),
        ...SORTS.map((s) => ({ sort: s })),
        { congestionOnly: true },
        { onlyWithRuns: false },
        { episodesShownOnly: true },
        { node: 'sense-node1.example.com' },
        { search: 'x' },
        { tagsInclude: ['a'] },
        { tagsExclude: ['b'] },
    ])('%j survives the round trip on its own', (over) => {
        const f = { ...defaultFilters(), ...over };
        expect(decodeFilterHash(encodeFilterHash(f))).toEqual(f);
    });

    test('a typical hash is readable', () => {
        expect(
            encodeFilterHash({
                ...defaultFilters(),
                search: 'finance -test tag:nightly',
                tagsInclude: ['Nightly'],
                runStates: ['problems'],
            })
        ).toBe('#q=finance+-test+tag:nightly&tag=Nightly&run=problems');
        expect(encodeFilterHash(ALL)).toBe(
            '#q=finance+-test+tag:nightly+%22two+words%22&tag=Nightly&tag=Finance+dept&notag=Test&run=problems&run=waited' +
                '&task=last-failed&task=deleted&congestion=1&withruns=0&node=sense-node2.example.com&sort=wait&episodes=shown'
        );
    });

    test('tag names, search text and node names with any character survive', () => {
        const odd = ['A,B & C=D', 'x=1&y=2', '100%', 'C++', 'a+b', '#hash', 'ques?tion', 'a/b\\c', '"quoted"', "it's", ' spaced '];
        const intl = ['Försäljning', 'Ünïcödé', '日本語', '😀 emoji', 'tab\there'];
        const f = {
            ...defaultFilters(),
            search: 'C++ & "50%" #1 a=b ?x %41',
            tagsInclude: odd,
            tagsExclude: intl,
            node: 'node #2 & co',
        };
        const hash = encodeFilterHash(f);

        expect(decodeFilterHash(hash)).toEqual(f);
        // One # only, and nothing that would end the hash or split a value
        expect(hash.indexOf('#', 1)).toBe(-1);
        expect(hash).not.toMatch(/\s/);
    });

    test('states come out in a fixed order, once each', () => {
        const f = { ...defaultFilters(), runStates: ['waited', 'problems', 'waited'], taskStates: ['deleted', 'last-failed'] };

        expect(encodeFilterHash(f)).toBe('#run=problems&run=waited&task=last-failed&task=deleted');
        expect(decodeFilterHash('#run=waited&run=problems&run=waited').runStates).toEqual(['problems', 'waited']);
    });

    test('the search is trimmed, and blank search text is left out', () => {
        expect(encodeFilterHash({ ...defaultFilters(), search: '  finance  ' })).toBe('#q=finance');
        expect(encodeFilterHash({ ...defaultFilters(), search: '   ' })).toBe('');
        expect(decodeFilterHash('#q=++finance++').search).toBe('finance');
    });

    test('only filter and view settings are encoded', () => {
        expect(encodeFilterHash({ ...defaultFilters(), utc: true, followLive: false, statusFilter: 'problems' })).toBe('');
    });

    test('unknown parameters and values are ignored', () => {
        expect(
            decodeFilterHash('#foo=bar&run=bogus&run=waited&task=nope&sort=sideways&congestion=yes&withruns=maybe&episodes=all')
        ).toEqual({ ...defaultFilters(), runStates: ['waited'] });
        expect(decodeFilterHash('#sort=NAME&congestion=true&withruns=false').sort).toBe('first');
    });

    test('a contradiction or a repetition is ignored', () => {
        expect(decodeFilterHash('#tag=A&notag=A&tag=B&tag=B&notag=C&notag=C')).toEqual({
            ...defaultFilters(),
            tagsInclude: ['B'],
            tagsExclude: ['C'],
        });
    });

    test('empty values are ignored', () => {
        expect(decodeFilterHash('#q=&tag=&notag=&run=&task=&node=&sort=')).toEqual(defaultFilters());
    });

    test('a damaged or foreign hash gives the defaults, and does not throw', () => {
        expect(decodeFilterHash('#section-2')).toEqual(defaultFilters());
        expect(decodeFilterHash('#%')).toEqual(defaultFilters());
        expect(decodeFilterHash('#&&&==&')).toEqual(defaultFilters());
        // Broken percent-encoding: what can be decoded is used
        const f = decodeFilterHash('#q=%E0%A4%A&tag=%zz&run=waited');
        expect(f.runStates).toEqual(['waited']);
        expect(f.tagsInclude).toEqual(['%zz']);
        expect(typeof f.search).toBe('string');
    });

    test('works with or without the leading #', () => {
        expect(decodeFilterHash('q=finance&tag=Nightly')).toEqual(decodeFilterHash('#q=finance&tag=Nightly'));
    });

    test(`a search longer than ${MAX_SEARCH_LENGTH} characters is cut`, () => {
        expect(decodeFilterHash(`#q=${'x'.repeat(5000)}`).search).toHaveLength(MAX_SEARCH_LENGTH);
    });

    test('defaultFilters() gives new arrays each time', () => {
        const a = defaultFilters();
        a.tagsInclude.push('x');
        a.runStates.push('waited');
        expect(defaultFilters()).toEqual({ ...a, tagsInclude: [], runStates: [] });
    });
});

describe('a large site: 2,000 lanes and 100,000 executions', () => {
    const LANE_COUNT = 2000;
    const RUN_COUNT = 100000;
    // Generous, so that a slow CI machine (and coverage) does not make this flaky. The page needs well under 50 ms.
    const LIMIT_MS = 250;
    const W_FROM = T0;
    const W_TO = T0 + 7 * DAY;
    const WHOLE = { from: W_FROM, to: W_TO };
    const BIG_NODES = ['node0', 'node1', 'node2'];

    // Deterministic pseudo-random numbers (mulberry32)
    let seed = 42;
    const rnd = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (list) => list[Math.floor(rnd() * list.length)];

    const DEPTS = ['Finance', 'Sales', 'HR', 'Supply chain', 'Marketing', 'IT', 'Test'];
    const KINDS = ['daily load', 'hourly extract', 'QVD layer', 'monthly close', 'test reload', 'nightly transform'];
    const TAG_POOL = ['Nightly', 'Hourly', 'Test', 'Critical', 'Finance dept', ...Array.from({ length: 55 }, (_, i) => `Team ${i + 1}`)];
    const bigLanes = Array.from({ length: LANE_COUNT }, (_, i) => {
        const dept = pick(DEPTS);
        return lane(i, `${dept} ${pick(KINDS)} ${i}`, {
            appName: `${dept} app ${i % 400}`,
            stream: `${pick(DEPTS)} stream ${i % 25}`,
            tags: [...new Set([pick(TAG_POOL), pick(TAG_POOL), pick(TAG_POOL)].slice(0, 1 + Math.floor(rnd() * 3)))],
            enabled: rnd() > 0.1,
            deleted: rnd() < 0.02,
        });
    });
    const bigRows = Array.from({ length: RUN_COUNT }, (_, i) => {
        // Some begin before the window
        const triggered = W_FROM - HOUR + Math.floor(rnd() * (W_TO - W_FROM));
        const queued = rnd() < 0.15;
        const started = triggered + (queued ? Math.floor(rnd() * 10 * MIN) : 500);
        const running = rnd() < 0.005;
        const stopped = running ? null : started + Math.floor(rnd() * 20 * MIN);
        const status = running ? 2 : pick([7, 7, 7, 7, 7, 7, 8, 6, 9, 11]);
        const flags = running && rnd() < 0.3 ? FLAG_STALE : 0;
        const laneIdx = Math.floor(rnd() * LANE_COUNT);
        return r(`k${i}`, laneIdx, status, triggered, queued ? triggered + 300 : null, started, stopped, i % 3, flags);
    });
    const bigEpisodes = Array.from({ length: 50 }, (_, i) => {
        const from = W_FROM + Math.floor(rnd() * (W_TO - W_FROM - HOUR));
        const tasks = Array.from({ length: 5 + Math.floor(rnd() * 15) }, () => task(rnd() < 0.05 ? null : Math.floor(rnd() * LANE_COUNT)));
        return episode(from, from + MIN + Math.floor(rnd() * HOUR), tasks, BIG_NODES[i % 3]);
    });

    const bigStore = () => {
        const store = createClientStore();
        store.load({
            ...makeSnapshot(),
            window: WHOLE,
            nodes: BIG_NODES,
            lanes: bigLanes,
            cols: toCols(bigRows),
            analytics: { bucketMs: 60000, concurrency: { total: [], nodes: [] }, episodes: bigEpisodes, taskStats: [] },
        });
        return store;
    };
    const bigView = (store, opts) => store.view({ from: W_FROM, to: W_TO, now: W_TO, episodes: bigEpisodes, ...opts });

    const COMBINED = {
        search: 'finance -test tag:team',
        tagsExclude: ['Team 3'],
        runStates: ['problems', 'waited'],
        taskStates: ['last-failed', 'disabled'],
        congestionOnly: true,
        visible: WHOLE,
        sort: 'wait',
    };
    const CASES = {
        'no filter': {},
        'no filter, by name': { sort: 'name' },
        'search finance -test tag:nightly': { search: 'finance -test tag:nightly' },
        'search, one letter': { search: 'e' },
        'tags: 2 included, 1 excluded': { tagsInclude: ['Nightly', 'Critical'], tagsExclude: ['Test'] },
        'run states: problems, waited': { runStates: ['problems', 'waited'] },
        'task states: last run failed, disabled': { taskStates: ['last-failed', 'disabled'] },
        'congestion only, last 24 h': { congestionOnly: true, visible: { from: W_TO - DAY, to: W_TO } },
        'node, and lanes without runs': { node: 'node1', onlyWithRuns: false },
        'everything combined': COMBINED,
    };

    test(`applying a filter takes less than ${LIMIT_MS} ms (the page needs well under 50 ms)`, () => {
        const store = bigStore();
        const median = (fn) => {
            const times = [];
            for (let i = 0; i < 5; i += 1) {
                const start = performance.now();
                fn();
                times.push(performance.now() - start);
            }
            return times.sort((a, b) => a - b)[2];
        };

        // The first view after a load also puts the lanes in name order, and finds each lane's latest run
        const firstStart = performance.now();
        bigView(store, { taskStates: ['last-failed'] });
        const timings = { 'first view after a load': performance.now() - firstStart };
        for (const [label, opts] of Object.entries(CASES)) timings[label] = median(() => bigView(store, opts));

        if (process.env.CTRLQ_PERF_LOG) {
            console.log(
                Object.entries(timings)
                    .map(([label, ms]) => `${ms.toFixed(1).padStart(6)} ms  ${label}`)
                    .join('\n')
            );
        }
        for (const [label, ms] of Object.entries(timings)) expect({ label, ms, ok: ms < LIMIT_MS }).toMatchObject({ label, ok: true });
    });

    // Every rule written out again, one lane and one execution at a time, without the store's precomputed text
    const reference = (opts) => {
        const f = { ...defaultFilters(), visible: WHOLE, ...opts };
        const terms = parseSearch(f.search);
        const fieldsOf = (l, field) => {
            if (field === 'name') return [l.name];
            if (field === 'app') return [l.appName ?? ''];
            if (field === 'stream') return [l.stream ?? ''];
            if (field === 'tag') return l.tags ?? [];
            return [l.name, l.appName ?? '', l.stream ?? '', ...(l.tags ?? [])];
        };
        const latest = new Map();
        for (const row of bigRows) {
            const prev = latest.get(row.lane);
            if (!prev || rowBegin(row) > rowBegin(prev)) latest.set(row.lane, row);
        }
        const bucket = (row) => statusInfo(row.status).bucket;
        const isProblem = (row) => PROBLEM_BUCKETS.has(bucket(row)) || Boolean(row.flags & FLAG_STALE);
        const RUN = {
            problems: isProblem,
            waited: (row) => row.queuedAt !== null,
            running: (row) => row.stoppedAt === null && !(row.flags & FLAG_STALE),
            success: (row) => bucket(row) === 'success',
            skipped: (row) => bucket(row) === 'skipped',
        };
        const TASK = {
            'last-failed': (l) => latest.has(l.idx) && isProblem(latest.get(l.idx)),
            disabled: (l) => !l.enabled && !l.deleted,
            deleted: (l) => l.deleted,
        };
        const congested = new Set(
            bigEpisodes
                .filter((ep) => ep.from < f.visible.to && ep.to > f.visible.from)
                .flatMap((ep) => ep.tasks.map((t) => t.lane))
                .filter((idx) => idx !== null)
        );
        const laneOk = (l) =>
            terms.every((t) => fieldsOf(l, t.field).some((value) => value.toLowerCase().includes(t.text)) !== t.exclude) &&
            (!f.tagsInclude.length || (l.tags ?? []).some((tag) => f.tagsInclude.includes(tag))) &&
            !(l.tags ?? []).some((tag) => f.tagsExclude.includes(tag)) &&
            (!f.taskStates.length || f.taskStates.some((s) => TASK[s](l))) &&
            (!f.congestionOnly || congested.has(l.idx));
        const okLanes = new Set(bigLanes.filter(laneOk).map((l) => l.idx));
        const rows = bigRows.filter(
            (row) =>
                okLanes.has(row.lane) &&
                (row.stoppedAt ?? W_TO) >= W_FROM &&
                rowBegin(row) <= W_TO &&
                (!f.node || BIG_NODES[row.node] === f.node) &&
                (!f.runStates.length || f.runStates.some((s) => RUN[s](row)))
        );
        const filtersRows = f.runStates.length > 0 || Boolean(f.node);
        const lanes = !f.onlyWithRuns && !filtersRows ? okLanes : new Set(rows.map((row) => row.lane));
        return { rows, lanes };
    };

    test.each([
        ['everything combined', COMBINED],
        [
            'included tags, a phrase, an excluded word, a node',
            {
                search: '-hr "daily load"',
                tagsInclude: ['Nightly', 'Critical', 'Team 7', 'Team 8'],
                runStates: ['success', 'skipped'],
                node: 'node1',
            },
        ],
        ['congestion in the last 24 h, by name', { congestionOnly: true, visible: { from: W_TO - DAY, to: W_TO }, sort: 'name' }],
        ['deleted tasks, also without runs', { taskStates: ['deleted'], onlyWithRuns: false, sort: 'name' }],
        ['running now, or last run failed', { runStates: ['running'], taskStates: ['last-failed'], sort: 'runtime' }],
    ])('the result is right for %s: checked against a plain re-implementation', (_, opts) => {
        const v = bigView(bigStore(), opts);
        const expected = reference(opts);

        expect(v.order.length).toBeGreaterThan(0);
        expect([...v.order].sort((a, b) => a - b)).toEqual([...expected.lanes].sort((a, b) => a - b));
        expect(keysOf(v.rows)).toEqual(keysOf(expected.rows));
        // In the order asked for
        if (opts.sort === 'name') {
            const names = v.order.map((idx) => bigLanes[idx].name);
            expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        } else {
            const key = opts.sort || 'first';
            const values = v.order.filter((idx) => v.perLane.has(idx)).map((idx) => v.perLane.get(idx)[key]);
            expect(values).toEqual([...values].sort((a, b) => (key === 'first' ? a - b : b - a)));
        }
    });
});
