import { test, expect, describe } from '@jest/globals';
import fs from 'node:fs';

import { rowsFromCols, rowBegin, rowWait, createClientStore, liveCoverage, laneGaps } from '../../../static/task-gantt/store.js';
import {
    STATUS,
    TERMINAL,
    PROBLEM_BUCKETS,
    FLAG_STALE,
    FLAG_DERIVED,
    statusInfo,
    fmtDuration,
    fmtTime,
    fmtCount,
    csvCell,
} from '../../../static/task-gantt/format.js';
import {
    buildSnapshot,
    createNodeTable,
    FLAG_STALE as SERVER_FLAG_STALE,
    FLAG_DERIVED as SERVER_FLAG_DERIVED,
} from '../../../lib/task-gantt/api/snapshot.js';
import { statusBucket, isTerminalStatus } from '../../../lib/task-gantt/model/status.js';
import { createLaneRegistry } from '../../../lib/task-gantt/model/lanes.js';
import { createCoverage } from '../../../lib/task-gantt/store/coverage.js';
import { fromExecutionResult } from '../../../lib/task-gantt/normalize/qrs.js';

// The browser modules of the task Gantt page are plain ES modules without DOM access (except el/setChildren/cssVar in
// format.js, which are not used here), so they run in Node as they are.

const COLS = ['key', 'lane', 'status', 'triggeredAt', 'queuedAt', 'startedAt', 'stoppedAt', 'node', 'src', 'flags'];
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

// Window 06:00-07:00 UTC; "now" is the end of the window.
const T0 = Date.UTC(2026, 9, 6, 6, 0, 0);
const FROM = T0;
const TO = T0 + HOUR;
const NOW = TO;
const NODES = ['sense-node1.example.com', 'sense-node2.example.com'];

/**
 * Encode row objects column-wise, as buildSnapshot()/encodeRecords() in src/lib/task-gantt/api/snapshot.js do.
 *
 * @param {Array<object>} rows - Rows with some or all of COLS.
 * @returns {object} Columns.
 */
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
    lane(0, 'Reload Content Monitor', { appName: 'Content Monitor', stream: 'Monitoring apps', tags: ['Ops'] }),
    lane(1, 'Reload Operations Monitor', { appName: 'Operations Monitor', stream: 'Monitoring apps' }),
    lane(2, 'Sales daily', { appName: 'Revenue dashboard', stream: 'Finance', tags: ['Nightly', 'Critical'] }),
    // A task without an app: appName, stream null; tags null must not break the text search either.
    lane(3, 'User sync AD', { taskType: 2, appId: null, appName: null, stream: null, tags: null }),
    // Has executions only outside the window.
    lane(4, 'Archive (idle)', { appName: 'Archive', stream: 'Everyone', tags: ['Weekly'] }),
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

// Content Monitor and Operations Monitor are triggered at the same time and queue ~46 / ~49 s (like the lab run).
const ROWS = [
    r('a1', 0, 8, T0 + 5 * MIN, T0 + 5 * MIN + 400, T0 + 5 * MIN + 46 * SEC, T0 + 7 * MIN, 0), // failed
    r('b1', 1, 7, T0 + 5 * MIN, T0 + 5 * MIN + 400, T0 + 5 * MIN + 49 * SEC, T0 + 8 * MIN, 0), // success
    r('c1', 2, 7, T0 + 1 * MIN, null, T0 + 1 * MIN + 500, T0 + 30 * MIN, 1), // success
    r('c2', 2, 2, T0 + 50 * MIN, null, T0 + 50 * MIN, null, 1), // running
    r('c3', 2, 6, T0 + 35 * MIN, null, T0 + 35 * MIN + 200, T0 + 36 * MIN, 1), // aborted
    r('d1', 3, 2, T0 - 26 * HOUR, null, T0 - 26 * HOUR, null, 0, FLAG_STALE), // "running" for 27 h: stale
    r('e1', 2, 11, T0 - 3 * HOUR, null, T0 - 3 * HOUR, T0 - 2 * HOUR, 1), // error, ended before the window
    r('f1', 4, 7, T0 - 5 * HOUR, null, T0 - 5 * HOUR, T0 - 5 * HOUR + 10 * MIN, 0), // before the window
];

const makeSnapshot = (over = {}) => ({
    rev: 10,
    generatedAt: NOW,
    live: true,
    window: { from: FROM, to: TO },
    nodes: [...NODES],
    lanes: LANES.map((l) => ({ ...l })),
    cols: toCols(ROWS),
    sources: [],
    capacity: { nodes: [{ name: NODES[0], maxConcurrentEngines: 4 }] },
    analytics: { bucketMs: 60000, concurrency: { total: [], nodes: {} }, episodes: [], taskStats: [] },
    ...over,
});

const loadedStore = (over) => {
    const store = createClientStore();
    store.load(makeSnapshot(over));
    return store;
};

const viewOf = (store, opts = {}) => store.view({ from: FROM, to: TO, now: NOW, ...opts });
const keysOf = (rows) => rows.map((x) => x.key).sort();

describe('rowsFromCols', () => {
    test('turns column-wise data into one object per row with every column', () => {
        const rows = rowsFromCols(toCols([ROWS[0], ROWS[3]]));

        expect(rows).toEqual([ROWS[0], ROWS[3]]);
        expect(Object.keys(rows[0]).sort()).toEqual([...COLS].sort());
    });

    test('columns that are missing become null', () => {
        const rows = rowsFromCols({ key: ['k1', 'k2'], lane: [3, 4], status: [7, 8] });

        expect(rows).toHaveLength(2);
        expect(rows[1]).toEqual({
            key: 'k2',
            lane: 4,
            status: 8,
            triggeredAt: null,
            queuedAt: null,
            startedAt: null,
            stoppedAt: null,
            node: null,
            src: null,
            flags: null,
        });
    });

    test('the key column decides the number of rows; empty or absent input gives no rows', () => {
        expect(rowsFromCols({ key: ['k1'], lane: [0, 1, 2] })).toHaveLength(1);
        expect(rowsFromCols(toCols([]))).toEqual([]);
        expect(rowsFromCols({})).toEqual([]);
        expect(rowsFromCols(undefined)).toEqual([]);
        expect(rowsFromCols(null)).toEqual([]);
    });
});

describe('rowBegin / rowWait', () => {
    test('rowBegin prefers the trigger time and falls back to the start time', () => {
        expect(rowBegin({ triggeredAt: 100, startedAt: 200 })).toBe(100);
        expect(rowBegin({ triggeredAt: null, startedAt: 200 })).toBe(200);
        expect(rowBegin({ triggeredAt: 0, startedAt: 200 })).toBe(0);
        expect(rowBegin({ triggeredAt: null, startedAt: null })).toBeNull();
    });

    test('rowWait is the time between trigger and start', () => {
        expect(rowWait(ROWS[0])).toBe(46 * SEC);
        expect(rowWait({ triggeredAt: 1000, startedAt: 1000 })).toBe(0);
    });

    test('rowWait is 0 when a time is unknown or the start is before the trigger (clock skew)', () => {
        expect(rowWait({ triggeredAt: 1000, startedAt: null })).toBe(0);
        expect(rowWait({ triggeredAt: null, startedAt: 1000 })).toBe(0);
        expect(rowWait({ triggeredAt: 2000, startedAt: 1500 })).toBe(0);
    });
});

describe('createClientStore load()', () => {
    test('starts empty', () => {
        const store = createClientStore();

        expect(store.size()).toBe(0);
        expect(store.lanes()).toEqual([]);
        expect(store.nodes()).toEqual([]);
        expect(store.snapshot()).toBeNull();
        expect(viewOf(store)).toEqual({ order: [], rows: [], perLane: new Map() });
    });

    test('indexes rows by key and lanes by lane number', () => {
        const snap = makeSnapshot();
        const store = createClientStore();
        store.load(snap);

        expect(store.size()).toBe(ROWS.length);
        expect(store.row('a1')).toEqual(ROWS[0]);
        expect(store.row('nope')).toBeUndefined();
        expect(store.lane(2).name).toBe('Sales daily');
        expect(store.lane(99)).toBeUndefined();
        expect(store.lanes().map((l) => l.idx)).toEqual([0, 1, 2, 3, 4]);
        expect(store.nodes()).toEqual(NODES);
        expect(store.snapshot()).toBe(snap);
    });

    test('a second load replaces everything from the first one', () => {
        const store = loadedStore();
        store.load(
            makeSnapshot({
                rev: 20,
                nodes: undefined,
                lanes: [lane(7, 'Only lane')],
                cols: toCols([r('z1', 7, 7, T0, null, T0, T0 + MIN, 0)]),
            })
        );

        expect(store.size()).toBe(1);
        expect(store.row('a1')).toBeUndefined();
        expect(store.row('z1').lane).toBe(7);
        expect(store.lanes().map((l) => l.idx)).toEqual([7]);
        // A snapshot without a node table gives an empty one.
        expect(store.nodes()).toEqual([]);
        expect(store.snapshot().rev).toBe(20);
    });
});

describe('createClientStore applyDelta()', () => {
    test('updates existing rows in place and records the new revision', () => {
        const store = loadedStore();
        store.applyDelta({
            rev: 11,
            prevRev: 10,
            cols: toCols([{ ...ROWS[3], status: 7, stoppedAt: T0 + 55 * MIN }]),
            removed: [],
            lanes: [],
        });

        expect(store.size()).toBe(ROWS.length);
        expect(store.row('c2')).toMatchObject({ status: 7, stoppedAt: T0 + 55 * MIN });
        expect(store.snapshot().rev).toBe(11);
    });

    test('removes rows by key and ignores unknown keys', () => {
        const store = loadedStore();
        store.applyDelta({ rev: 11, cols: toCols([]), removed: ['c1', 'no-such-key'], lanes: [] });

        expect(store.row('c1')).toBeUndefined();
        expect(store.size()).toBe(ROWS.length - 1);
        expect(keysOf(viewOf(store).rows)).toEqual(['a1', 'b1', 'c2', 'c3', 'd1']);
    });

    test('a key removed and sent again in the same delta ends up present (removals are applied first)', () => {
        const store = loadedStore();
        store.applyDelta({ rev: 11, cols: toCols([{ ...ROWS[0], status: 7 }]), removed: ['a1'], lanes: [] });

        expect(store.row('a1').status).toBe(7);
        expect(store.size()).toBe(ROWS.length);
    });

    test('adds new lanes, new nodes and their rows, so the node filter finds them', () => {
        const store = loadedStore();
        const nodes = [...NODES, 'sense-node3.example.com'];
        store.applyDelta({
            rev: 12,
            cols: toCols([r('g1', 5, 3, T0 + 58 * MIN, T0 + 58 * MIN, null, null, 2)]),
            removed: [],
            lanes: [lane(5, 'New task', { appName: 'New app' })],
            nodes,
        });

        expect(store.lane(5).name).toBe('New task');
        expect(store.nodes()).toEqual(nodes);
        const v = viewOf(store, { node: 'sense-node3.example.com' });
        expect(v.order).toEqual([5]);
        expect(keysOf(v.rows)).toEqual(['g1']);
    });

    test('changed lanes replace the old lane, and the text search sees the new name', () => {
        const store = loadedStore();
        store.applyDelta({ rev: 11, cols: toCols([]), removed: [], lanes: [lane(0, 'Renamed reload', { appName: 'Content Monitor' })] });

        expect(store.lane(0).name).toBe('Renamed reload');
        expect(store.lanes()).toHaveLength(LANES.length);
        expect(viewOf(store, { search: 'renamed' }).order).toEqual([0]);
    });

    test('keeps the node table when the delta has none, and tolerates missing parts', () => {
        const store = loadedStore();
        store.applyDelta({ rev: 13 });

        expect(store.nodes()).toEqual(NODES);
        expect(store.size()).toBe(ROWS.length);
        expect(store.lanes()).toHaveLength(LANES.length);
        expect(store.snapshot().rev).toBe(13);
    });

    test('works before any snapshot is loaded, without inventing one', () => {
        const store = createClientStore();
        store.applyDelta({ rev: 3, cols: toCols([ROWS[0]]), lanes: [LANES[0]], nodes: NODES });

        expect(store.snapshot()).toBeNull();
        expect(store.row('a1')).toEqual(ROWS[0]);
        expect(viewOf(store).order).toEqual([0]);
    });

    test('rows of a lane the page does not know are kept but never returned by view()', () => {
        const store = loadedStore();
        store.applyDelta({ rev: 11, cols: toCols([r('x1', 99, 7, T0 + 10 * MIN, null, T0 + 10 * MIN, T0 + 11 * MIN, 0)]), lanes: [] });

        expect(store.row('x1')).toBeDefined();
        const v = viewOf(store);
        expect(v.order).not.toContain(99);
        expect(v.rows.map((x) => x.key)).not.toContain('x1');
    });
});

describe('live coverage and lane gaps', () => {
    // Snapshot made at 06:30 while live: lanes are covered up to then; polls every 15 s since
    const live = (over = {}) => ({
        from: T0 + 10 * MIN,
        coveredTo: T0 + 30 * MIN,
        pollIntervalMs: 15 * SEC,
        qrs: { state: 'ok' },
        ...over,
    });
    const win = { from: FROM, to: TO };

    test('while polling works, coverage runs to the last good poll plus two poll intervals, capped at the window end', () => {
        expect(liveCoverage(live(), true, TO)).toEqual([[T0 + 10 * MIN, T0 + 30 * MIN + 30 * SEC]]);
        expect(liveCoverage(live({ coveredTo: TO - 5 * SEC }), true, TO)).toEqual([[T0 + 10 * MIN, TO]]);
    });

    test('after Ctrl-Q stopped polling (e.g. HTTP 401) or while it retries, coverage ends at the last good poll', () => {
        expect(liveCoverage(live({ qrs: { state: 'error' } }), true, TO)).toEqual([[T0 + 10 * MIN, T0 + 30 * MIN]]);
        expect(liveCoverage(live({ qrs: { state: 'degraded' } }), true, TO)).toEqual([[T0 + 10 * MIN, T0 + 30 * MIN]]);
    });

    test('without a connection to Ctrl-Q, nothing is assumed after the last poll the page heard of', () => {
        expect(liveCoverage(live(), false, TO)).toEqual([[T0 + 10 * MIN, T0 + 30 * MIN]]);
    });

    test('no live updates, or no live range yet: no live coverage', () => {
        expect(liveCoverage(null, true, TO)).toEqual([]);
        expect(liveCoverage(live({ from: null }), true, TO)).toEqual([]);
        expect(liveCoverage(live({ coveredTo: T0 + 10 * MIN }), false, TO)).toEqual([]);
    });

    test('lane gaps: lane coverage plus the live range; the time after the last good poll is a gap once polling stopped', () => {
        const lanes = new Map([
            [0, { coverage: [[FROM, T0 + 20 * MIN]] }],
            [1, { coverage: [] }],
        ]);
        const gapsFor = (l, connected) => laneGaps({ order: [0, 1, 7], laneOf: (idx) => lanes.get(idx), window: win, live: l, connected });

        // Healthy and quiet: the snapshot's coverage continues while polls arrive; no growing hatch at the right edge
        expect(gapsFor(live({ coveredTo: TO - 10 * SEC }), true)).toEqual([
            [1, [[FROM, T0 + 10 * MIN]]],
            [7, [[FROM, T0 + 10 * MIN]]],
        ]);

        // HTTP 401 at 06:30: from then on every lane is hatched
        expect(gapsFor(live({ qrs: { state: 'error' } }), true)).toEqual([
            [0, [[T0 + 30 * MIN, TO]]],
            [
                1,
                [
                    [FROM, T0 + 10 * MIN],
                    [T0 + 30 * MIN, TO],
                ],
            ],
            [
                7,
                [
                    [FROM, T0 + 10 * MIN],
                    [T0 + 30 * MIN, TO],
                ],
            ],
        ]);
    });

    test('lane gaps without live updates come from the lane coverage alone', () => {
        const gaps = laneGaps({
            order: [0],
            laneOf: () => ({ coverage: [[FROM + 5 * MIN, TO]] }),
            window: win,
            live: null,
            connected: false,
        });
        expect(gaps).toEqual([[0, [[FROM, FROM + 5 * MIN]]]]);
    });
});

describe('createClientStore applyLive()', () => {
    test('marks running executions stale or not as the server says, and leaves finished ones alone', () => {
        const store = loadedStore({ live: { from: T0, coveredTo: T0 + 30 * MIN, pollIntervalMs: 15000, qrs: { state: 'ok' } } });

        // c2 is running; d1 is running but stale since the snapshot; a1 has finished
        expect(store.applyLive({ from: T0, coveredTo: T0 + 31 * MIN, staleKeys: ['c2', 'a1'] })).toBe(true);
        expect(store.row('c2').flags & FLAG_STALE).toBe(FLAG_STALE);
        expect(store.row('d1').flags & FLAG_STALE).toBe(0);
        expect(store.row('a1').flags & FLAG_STALE).toBe(0);
        expect(store.snapshot().live).toMatchObject({ coveredTo: T0 + 31 * MIN, pollIntervalMs: 15000 });

        expect(store.applyLive({ from: T0, coveredTo: T0 + 32 * MIN, staleKeys: ['c2'] })).toBe(false);
    });

    test("updates the QRS source badge's state from the live event", () => {
        const store = loadedStore({ sources: [{ id: 'qrs', state: 'ok', message: '', records: 8 }] });

        store.applyLive({
            from: T0,
            coveredTo: T0,
            qrs: { state: 'error', message: 'Sense refused the request (HTTP 401)', lastOkAt: T0 },
        });
        expect(store.snapshot().sources[0]).toEqual({
            id: 'qrs',
            state: 'error',
            message: 'Sense refused the request (HTTP 401)',
            lastOkAt: T0,
            records: 8,
        });
    });

    test('does nothing before a snapshot is loaded', () => {
        expect(createClientStore().applyLive({ staleKeys: ['x'] })).toBe(false);
    });
});

describe('createClientStore rowsIn()', () => {
    test('returns rows overlapping the window; running rows end now', () => {
        const store = loadedStore();

        expect(keysOf(store.rowsIn(FROM, TO, NOW))).toEqual(['a1', 'b1', 'c1', 'c2', 'c3', 'd1']);
        // Only the two running rows (one of them stale) are still going in the last minute.
        expect(keysOf(store.rowsIn(NOW - MIN, NOW, NOW))).toEqual(['c2', 'd1']);
        // A window after "now": running rows have ended at now, so they are outside it.
        expect(store.rowsIn(NOW + MIN, NOW + 2 * MIN, NOW)).toEqual([]);
    });

    test('includes rows touching the window edges and excludes those just outside', () => {
        const store = createClientStore();
        store.load(
            makeSnapshot({
                cols: toCols([
                    r('endsAtFrom', 0, 7, FROM - MIN, null, FROM - MIN, FROM, 0),
                    r('endsBeforeFrom', 0, 7, FROM - MIN, null, FROM - MIN, FROM - 1, 0),
                    r('beginsAtTo', 1, 7, TO, null, TO, TO + MIN, 0),
                    r('beginsAfterTo', 1, 7, TO + 1, null, TO + 1, TO + MIN, 0),
                ]),
            })
        );

        expect(keysOf(store.rowsIn(FROM, TO, NOW))).toEqual(['beginsAtTo', 'endsAtFrom']);
    });

    test('uses the start time when the trigger time is unknown, and skips rows with neither', () => {
        const store = createClientStore();
        store.load(
            makeSnapshot({
                cols: toCols([
                    r('startOnly', 0, 7, null, null, T0 + 10 * MIN, T0 + 11 * MIN, 0),
                    r('startOnlyBefore', 0, 7, null, null, T0 - 2 * HOUR, T0 - HOUR, 0),
                    r('noTimes', 0, 0, null, null, null, null, 0),
                ]),
            })
        );

        expect(keysOf(store.rowsIn(FROM, TO, NOW))).toEqual(['startOnly']);
    });
});

describe('createClientStore view()', () => {
    test('defaults: all statuses, lanes with runs only, sorted by first execution with a name tiebreak', () => {
        const v = viewOf(loadedStore());

        // d1 began 26 h before the window; Content and Operations Monitor were triggered at the same time.
        expect(v.order).toEqual([3, 2, 0, 1]);
        expect(keysOf(v.rows)).toEqual(['a1', 'b1', 'c1', 'c2', 'c3', 'd1']);
    });

    test('per-lane statistics cover the shown rows; running rows count runtime until now', () => {
        const { perLane } = viewOf(loadedStore());

        expect(perLane.get(0)).toEqual({ first: T0 + 5 * MIN, wait: 46 * SEC, fails: 1, runtime: 2 * MIN - 46 * SEC, runs: 1 });
        expect(perLane.get(2)).toEqual({
            first: T0 + MIN,
            wait: 700,
            fails: 1, // the aborted run; the error run e1 is outside the window
            runtime: 29 * MIN - 500 + 10 * MIN + MIN - 200,
            runs: 3,
        });
        // A stale "running" row is not a failure in the statistics, but counts runtime until now.
        expect(perLane.get(3)).toEqual({ first: T0 - 26 * HOUR, wait: 0, fails: 0, runtime: 27 * HOUR, runs: 1 });
        expect(perLane.has(4)).toBe(false);
    });

    test.each([
        ['first', [3, 2, 0, 1]],
        ['wait', [1, 0, 2, 3]], // 49 s, 46 s, 0.7 s, 0
        ['fails', [0, 2, 1, 3]], // 1, 1 (tie: by name), 0, 0 (tie: by name)
        ['runtime', [3, 2, 1, 0]], // 27 h, ~40 min, 131 s, 74 s
        ['name', [0, 1, 2, 3]],
    ])('sort %s', (sort, order) => {
        expect(viewOf(loadedStore(), { sort }).order).toEqual(order);
    });

    test('unknown sort keys fall back to first execution', () => {
        expect(viewOf(loadedStore(), { sort: 'whatever' }).order).toEqual([3, 2, 0, 1]);
    });

    test('equal statistics are ordered by name', () => {
        const store = createClientStore();
        store.load(
            makeSnapshot({
                lanes: [lane(0, 'Zulu'), lane(1, 'alpha'), lane(2, 'Mike')],
                cols: toCols([
                    r('z', 0, 7, T0, null, T0, T0 + MIN, 0),
                    r('a', 1, 7, T0, null, T0, T0 + MIN, 0),
                    r('m', 2, 7, T0, null, T0, T0 + MIN, 0),
                ]),
            })
        );

        for (const sort of ['first', 'wait', 'fails', 'runtime', 'name']) {
            expect(viewOf(store, { sort }).order).toEqual([1, 2, 0]);
        }
    });

    describe('onlyWithRuns', () => {
        test('false adds lanes without runs in the window, after those with runs', () => {
            const store = loadedStore();

            expect(viewOf(store, { onlyWithRuns: false }).order).toEqual([3, 2, 0, 1, 4]);
            expect(viewOf(store, { onlyWithRuns: false, sort: 'wait' }).order).toEqual([1, 0, 2, 3, 4]);
            // Sorting by name mixes them in.
            expect(viewOf(store, { onlyWithRuns: false, sort: 'name' }).order).toEqual([4, 0, 1, 2, 3]);
        });

        test('lanes without runs are sorted by name among themselves', () => {
            const store = loadedStore({ cols: toCols([]) });

            expect(viewOf(store, { onlyWithRuns: false }).order).toEqual([4, 0, 1, 2, 3]);
            expect(viewOf(store, { onlyWithRuns: true }).order).toEqual([]);
        });

        test('a lane without runs gets no rows, and rows outside the window stay out', () => {
            const v = viewOf(loadedStore(), { onlyWithRuns: false });

            expect(v.rows.map((x) => x.key)).not.toContain('f1');
            expect(v.rows.map((x) => x.key)).not.toContain('e1');
        });

        test('false does not bring back empty lanes while a status or node filter is active', () => {
            const store = loadedStore();

            expect(viewOf(store, { onlyWithRuns: false, runStates: ['waited'] }).order).toEqual([0, 1]);
            expect(viewOf(store, { onlyWithRuns: false, node: NODES[1] }).order).toEqual([2]);
        });
    });

    describe('text search', () => {
        test.each([
            ['monitor', [0, 1]], // task name
            ['  MONITOR  ', [0, 1]], // trimmed, case-insensitive
            ['revenue', [2]], // app name only
            ['FINANCE', [2]], // stream only
            ['critical', [2]], // tag only
            ['ops', [0]], // tag only, not a substring of anything else
            ['user sync', [3]], // a lane with null app name, stream and tags
            ['', [3, 2, 0, 1]],
            ['   ', [3, 2, 0, 1]],
            ['no such text', []],
        ])('%j', (search, order) => {
            expect(viewOf(loadedStore(), { search }).order).toEqual(order);
        });

        test('returns only the rows of matching lanes', () => {
            expect(keysOf(viewOf(loadedStore(), { search: 'monitor' }).rows)).toEqual(['a1', 'b1']);
            expect(viewOf(loadedStore(), { search: 'no such text' }).rows).toEqual([]);
        });

        test('finds lanes without runs only when onlyWithRuns is false', () => {
            expect(viewOf(loadedStore(), { search: 'weekly' }).order).toEqual([]);
            expect(viewOf(loadedStore(), { search: 'weekly', onlyWithRuns: false }).order).toEqual([4]);
        });
    });

    describe('status filter', () => {
        test('problems: failed, aborted and error rows, plus stale rows', () => {
            const v = viewOf(loadedStore(), { runStates: ['problems'] });

            expect(keysOf(v.rows)).toEqual(['a1', 'c3', 'd1']);
            // Statistics only cover the shown rows: lane 2 now starts with c3 at 06:35, after lane 0 at 06:05.
            expect(v.order).toEqual([3, 0, 2]);
            expect(v.perLane.get(2)).toMatchObject({ first: T0 + 35 * MIN, runs: 1, fails: 1 });
        });

        test('problems includes error-bucket rows (Error and Reset) in the window', () => {
            const store = loadedStore({
                cols: toCols([
                    r('err', 0, 11, T0 + MIN, null, T0 + MIN, T0 + 2 * MIN, 0),
                    r('reset', 1, 12, T0 + MIN, null, T0 + MIN, T0 + 2 * MIN, 0),
                    r('skipped', 2, 9, T0 + MIN, null, null, T0 + MIN, 0),
                    r('aborting', 3, 5, T0 + MIN, null, T0 + MIN, null, 0),
                ]),
            });

            expect(keysOf(viewOf(store, { runStates: ['problems'] }).rows)).toEqual(['err', 'reset']);
        });

        test('waited: rows that went through the scheduler queue', () => {
            const v = viewOf(loadedStore(), { runStates: ['waited'] });

            expect(keysOf(v.rows)).toEqual(['a1', 'b1']);
            expect(v.order).toEqual([0, 1]);
        });

        test('running: rows without a stop time that are not stale', () => {
            const v = viewOf(loadedStore(), { runStates: ['running'] });

            expect(keysOf(v.rows)).toEqual(['c2']);
            expect(v.order).toEqual([2]);
            expect(v.perLane.get(2)).toEqual({ first: T0 + 50 * MIN, wait: 0, fails: 0, runtime: 10 * MIN, runs: 1 });
        });

        test('combines with the text search and the node filter', () => {
            const store = loadedStore();

            expect(viewOf(store, { runStates: ['problems'], search: 'monitor' }).order).toEqual([0]);
            expect(keysOf(viewOf(store, { runStates: ['problems'], node: NODES[0] }).rows)).toEqual(['a1', 'd1']);
            expect(keysOf(viewOf(store, { runStates: ['problems'], node: NODES[1] }).rows)).toEqual(['c3']);
        });
    });

    describe('node filter', () => {
        test('shows only rows that ran on the node', () => {
            const store = loadedStore();

            const v1 = viewOf(store, { node: NODES[1] });
            expect(v1.order).toEqual([2]);
            expect(keysOf(v1.rows)).toEqual(['c1', 'c2', 'c3']);

            const v0 = viewOf(store, { node: NODES[0] });
            expect(v0.order).toEqual([3, 0, 1]);
            expect(keysOf(v0.rows)).toEqual(['a1', 'b1', 'd1']);
        });

        test('an empty node name means all nodes', () => {
            expect(viewOf(loadedStore(), { node: '' }).order).toEqual([3, 2, 0, 1]);
        });

        // BUG: main.js updateNodeFilter() offers every reloading scheduler from snapshot.capacity.nodes, but the node
        // table only holds nodes that have executions. Picking an idle scheduler gives nodes.indexOf(node) === -1 in
        // view(), which disables the node filter, so the page shows the executions of all the other nodes instead of none.
        test('a node without executions (an idle scheduler from capacity.nodes) shows nothing, not every node', () => {
            const idle = 'sense-node9.example.com';
            const store = loadedStore({ capacity: { nodes: [...NODES, idle].map((name) => ({ name, maxConcurrentEngines: 4 })) } });

            const v = viewOf(store, { node: idle });
            expect(v.rows).toEqual([]);
            expect(v.order).toEqual([]);
        });
    });

    test('does not change the store', () => {
        const store = loadedStore();
        viewOf(store, { runStates: ['problems'], search: 'monitor', node: NODES[0], sort: 'wait' });

        expect(store.size()).toBe(ROWS.length);
        expect(viewOf(store).order).toEqual([3, 2, 0, 1]);
    });
});

describe('client store with a snapshot from the real buildSnapshot()', () => {
    // The lab run: 6 reload tasks triggered at 06:29:45 with maxConcurrentEngines = 4; Content Monitor and Operations
    // Monitor queued ~46 / ~49 s.
    const QRS_ROWS = JSON.parse(
        fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8')
    );
    const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
    const OPERATIONS_MONITOR = '0419086f-a935-4358-a356-da2f79069e78';
    const NAMES = new Map([
        [CONTENT_MONITOR, 'Reload Content Monitor'],
        [OPERATIONS_MONITOR, 'Reload Operations Monitor'],
        ['a87ae597-be31-4453-be04-5b4f67489d8d', 'Reload A'],
        ['8d2c5d0c-12e2-4dc8-9832-de1ae367a373', 'Reload B'],
        ['60f56836-b6e4-4690-8896-a2262c4ebb8c', 'Reload C'],
        ['5fee7b84-76f8-4cc1-ba4f-466d8eefa8be', 'Reload D'],
        ['0359bda0-22dc-4c46-983c-8724266eb4ef', 'Reload outside window'],
    ]);
    const W_FROM = Date.parse('2026-10-06T06:00:00.000Z');
    const W_TO = Date.parse('2026-10-06T07:00:00.000Z');

    const build = () => {
        const taskTypes = new Map([...NAMES.keys()].map((id) => [id, 0]));
        const records = QRS_ROWS.map((row) => fromExecutionResult(row, taskTypes)).filter(Boolean);
        const lanes = createLaneRegistry({});
        for (const [id, name] of NAMES) lanes.upsert({ id, name, taskType: 0, enabled: true, appName: `${name} app`, tags: [] });
        const snapshot = buildSnapshot({
            records,
            lanes,
            coverage: createCoverage(),
            sources: [],
            schedulers: [{ nodeName: 'sense-node1.example.com', maxConcurrentEngines: 4 }],
            runningResultIds: new Set(),
            window: { from: W_FROM, to: W_TO },
            now: W_TO,
            live: false,
            rev: 1,
            nodes: createNodeTable(),
        });
        // The page gets the snapshot as JSON.
        return { snapshot: JSON.parse(JSON.stringify(snapshot)), lanes };
    };

    test('loads every execution in the window and orders lanes by queue wait', () => {
        const { snapshot, lanes } = build();
        const store = createClientStore();
        store.load(snapshot);

        expect(store.size()).toBe(6);
        expect(store.nodes()).toEqual(['sense-node1.example.com']);

        const v = store.view({ sort: 'wait', from: W_FROM, to: W_TO, now: W_TO });
        expect(v.order).toHaveLength(6);
        expect(v.order.slice(0, 2)).toEqual([lanes.get(OPERATIONS_MONITOR).idx, lanes.get(CONTENT_MONITOR).idx]);
        expect(v.perLane.get(lanes.get(OPERATIONS_MONITOR).idx).wait).toBeGreaterThan(45 * SEC);
        expect(v.perLane.get(lanes.get(CONTENT_MONITOR).idx).wait).toBeGreaterThan(45 * SEC);
    });

    test('waited and problems filters pick the queued and the failed reloads', () => {
        const { snapshot, lanes } = build();
        const store = createClientStore();
        store.load(snapshot);
        const at = { from: W_FROM, to: W_TO, now: W_TO };

        const waited = store.view({ ...at, runStates: ['waited'], sort: 'name' });
        expect(waited.order).toEqual([lanes.get(CONTENT_MONITOR).idx, lanes.get(OPERATIONS_MONITOR).idx]);

        const problems = store.view({ ...at, runStates: ['problems'], sort: 'name' });
        expect(problems.order).toEqual([lanes.get('a87ae597-be31-4453-be04-5b4f67489d8d').idx, lanes.get(CONTENT_MONITOR).idx]);
        expect(problems.rows.every((x) => x.status === 8 && x.flags === 0)).toBe(true);

        const all = store.view({ ...at, onlyWithRuns: false, sort: 'first' });
        expect(all.order.at(-1)).toBe(lanes.get('0359bda0-22dc-4c46-983c-8724266eb4ef').idx);
    });

    test('client and server agree on the flag bits', () => {
        expect(FLAG_STALE).toBe(SERVER_FLAG_STALE);
        expect(FLAG_DERIVED).toBe(SERVER_FLAG_DERIVED);
        expect(FLAG_STALE & FLAG_DERIVED).toBe(0);
    });
});

describe('format: STATUS / statusInfo', () => {
    test.each([
        [0, 'Never started', 'unknown'],
        [1, 'Triggered', 'waiting'],
        [2, 'Started', 'running'],
        [3, 'Queued', 'queued'],
        [4, 'Abort initiated', 'aborting'],
        [5, 'Aborting', 'aborting'],
        [6, 'Aborted', 'aborted'],
        [7, 'Finished successfully', 'success'],
        [8, 'Failed', 'failed'],
        [9, 'Skipped', 'skipped'],
        [10, 'Retry', 'waiting'],
        [11, 'Error', 'error'],
        [12, 'Reset', 'error'],
        [13, 'Distribution queue', 'waiting'],
        [14, 'Distribution running', 'running'],
    ])('code %i is %s (%s)', (code, name, bucket) => {
        expect(STATUS[code]).toEqual({ name, bucket });
        expect(statusInfo(code)).toEqual({ name, bucket });
    });

    test('covers exactly the codes 0-14', () => {
        expect(Object.keys(STATUS).map(Number)).toEqual([...Array(15).keys()]);
    });

    test.each([15, -1, 99, undefined, null, 'x'])('unknown code %p falls back to an "Unknown" entry', (code) => {
        expect(statusInfo(code)).toEqual({ name: `Unknown (${code})`, bucket: 'unknown' });
    });

    test('buckets and terminal codes mirror the server model (null bucket shows as unknown)', () => {
        for (let code = 0; code <= 14; code += 1) {
            expect([code, statusInfo(code).bucket]).toEqual([code, statusBucket(code).bucket ?? 'unknown']);
            expect([code, TERMINAL.has(code)]).toEqual([code, isTerminalStatus(code)]);
        }
    });

    test('problem buckets are failed, aborted and error', () => {
        expect([...PROBLEM_BUCKETS].sort()).toEqual(['aborted', 'error', 'failed']);
    });
});

describe('format: fmtDuration', () => {
    test.each([
        [0, '0 s'],
        [499, '0 s'],
        [500, '1 s'],
        [45 * SEC, '45 s'],
        [59 * SEC, '59 s'],
        [59 * SEC + 499, '59 s'],
        [59 * SEC + 500, '1 min 00 s'], // rounds up into the next unit
        [60 * SEC, '1 min 00 s'],
        [12 * MIN + 5 * SEC, '12 min 05 s'],
        [59 * MIN + 59 * SEC, '59 min 59 s'],
        [HOUR, '1 h 00 min'],
        [3 * HOUR + 7 * MIN + 30 * SEC, '3 h 07 min'],
        [24 * HOUR, '24 h 00 min'],
        [47 * HOUR + 59 * MIN + 59 * SEC, '47 h 59 min'],
        [48 * HOUR, '2 d 0 h'],
        [52 * HOUR + 30 * MIN, '2 d 4 h'],
        [10 * 24 * HOUR + 23 * HOUR, '10 d 23 h'],
        [-5000, '0 s'],
    ])('%p ms -> %s', (ms, text) => {
        expect(fmtDuration(ms)).toBe(text);
    });

    test.each([null, undefined, Number.NaN])('%p -> dash', (ms) => {
        expect(fmtDuration(ms)).toBe('–');
    });
});

describe('format: fmtTime', () => {
    const EPOCH = Date.UTC(2026, 9, 6, 6, 29, 45, 239);

    // Independent oracle for local time: Intl in the process' own time zone.
    const localParts = (ms) => {
        const fmt = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        });
        return Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    };

    test('UTC with and without the date', () => {
        expect(fmtTime(EPOCH, true)).toBe('2026-10-06 06:29:45 UTC');
        expect(fmtTime(EPOCH, true, false)).toBe('06:29:45');
    });

    test('pads single-digit fields and handles the epoch itself', () => {
        expect(fmtTime(Date.UTC(2026, 0, 2, 3, 4, 5), true)).toBe('2026-01-02 03:04:05 UTC');
        expect(fmtTime(0, true)).toBe('1970-01-01 00:00:00 UTC');
        expect(fmtTime(Date.UTC(2026, 11, 31, 23, 59, 59, 999), true)).toBe('2026-12-31 23:59:59 UTC');
    });

    test('local time matches the process time zone and has no UTC suffix', () => {
        for (const ms of [EPOCH, 0, Date.UTC(2026, 2, 29, 1, 30, 0), Date.UTC(2026, 6, 1, 22, 15, 1)]) {
            const p = localParts(ms);
            expect(fmtTime(ms, false)).toBe(`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`);
            expect(fmtTime(ms, false, false)).toBe(`${p.hour}:${p.minute}:${p.second}`);
        }
        expect(fmtTime(EPOCH, false)).not.toMatch(/UTC/);
    });

    test.each([null, undefined])('%p -> dash', (ms) => {
        expect(fmtTime(ms, true)).toBe('–');
        expect(fmtTime(ms, false)).toBe('–');
    });
});

describe('format: fmtCount', () => {
    test.each([
        [0, '0'],
        [7, '7'],
        [999, '999'],
        [2140, '2,140'],
        [100000, '100,000'],
        [1234567, '1,234,567'],
    ])('%p -> %s', (n, text) => {
        expect(fmtCount(n)).toBe(text);
    });
});

describe('format: csvCell', () => {
    test.each([
        ['plain', 'plain'],
        ['with space', 'with space'],
        [42, '42'],
        [0, '0'],
        [false, 'false'],
        [null, ''],
        [undefined, ''],
        ['', ''],
        ['a,b', '"a,b"'],
        ['a;b', '"a;b"'],
        ['line1\nline2', '"line1\nline2"'],
        ['line1\r\nline2', '"line1\r\nline2"'],
        ['say "hi"', '"say ""hi"""'],
        ['a"b', '"a""b"'],
        ['"', '""""'],
    ])('%j -> %j', (value, cell) => {
        expect(csvCell(value)).toBe(cell);
    });

    test.each([
        ['=SUM(A1:A2)', "'=SUM(A1:A2)"],
        ['+1', "'+1"],
        ['-1+2', "'-1+2"],
        ['@cmd', "'@cmd"],
        ['\tcmd', "'\tcmd"],
        ['\rcmd', '"\'\rcmd"'],
        ['=HYPERLINK("http://x","y")', '"\'=HYPERLINK(""http://x"",""y"")"'],
        ['=1;2', '"\'=1;2"'],
    ])('neutralises the formula %j -> %j', (value, cell) => {
        expect(csvCell(value)).toBe(cell);
    });

    test('formula characters that are not first are left alone', () => {
        expect(csvCell('a=b')).toBe('a=b');
        expect(csvCell('x-1')).toBe('x-1');
        expect(csvCell('mail@example.com')).toBe('mail@example.com');
    });
});
