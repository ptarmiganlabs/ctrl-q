// Client-side data store of the task Gantt page: the snapshot from /api/snapshot, live deltas, and the filtering and
// sorting that decide which lanes are drawn in which order. No DOM access, so it can be unit tested.
//
// The filters are here rather than in a module of their own because every module the page loads is also a route of
// the Ctrl-Q web server (src/lib/task-gantt/page-routes.js) and an asset of the binary (sea-config.json).
import { statusInfo, PROBLEM_BUCKETS, FLAG_STALE } from './format.js';
import { gapsIn, mergeIntervals } from './lib/sweep.js';

const COLS = ['key', 'lane', 'status', 'triggeredAt', 'queuedAt', 'startedAt', 'stoppedAt', 'node', 'src', 'flags'];

/**
 * Turn the column-wise execution data of a snapshot or delta into row objects.
 *
 * @param {object} cols - Columns, each an array of equal length.
 * @returns {Array<object>} Rows.
 */
export function rowsFromCols(cols) {
    const n = cols?.key?.length ?? 0;
    const rows = new Array(n);
    for (let i = 0; i < n; i += 1) {
        const row = {};
        for (const c of COLS) row[c] = cols[c] ? cols[c][i] : null;
        rows[i] = row;
    }
    return rows;
}

/**
 * Earliest known time of an execution.
 *
 * @param {object} row - Execution row.
 * @returns {number|null} Time.
 */
export const rowBegin = (row) => row.triggeredAt ?? row.startedAt;

/**
 * Time an execution waited before it started (queue wait), in ms.
 *
 * @param {object} row - Execution row.
 * @returns {number} Wait in ms, 0 if unknown.
 */
export const rowWait = (row) => (row.startedAt !== null && row.triggeredAt !== null ? Math.max(0, row.startedAt - row.triggeredAt) : 0);

/**
 * End of the time the page has complete data for. The snapshot's lane coverage ends when the snapshot was made; while
 * Ctrl-Q keeps polling QRS successfully and the page receives live updates, coverage continues to the latest successful
 * poll, plus two poll intervals while the next poll is due. Otherwise everything after the last successful poll is
 * unknown.
 *
 * @param {object|null} live - Live state: { from, coveredTo, pollIntervalMs, qrs: { state } }, or null.
 * @param {boolean} connected - True while the page receives live updates.
 * @param {number} to - Window end.
 * @returns {Array<[number, number]>} The live coverage range, or none.
 */
export function liveCoverage(live, connected, to) {
    if (!live || typeof live.from !== 'number' || typeof live.coveredTo !== 'number') return [];
    const growing = connected && live.qrs?.state === 'ok';
    const end = growing ? Math.min(to, live.coveredTo + 2 * (live.pollIntervalMs || 0)) : live.coveredTo;
    return end > live.from ? [[live.from, end]] : [];
}

/**
 * Time without data in each lane, drawn hatched ("unknown", never "nothing ran").
 *
 * @param {object} p - Parameters.
 * @param {number[]} p.order - Lanes in display order.
 * @param {Function} p.laneOf - (laneIdx) => lane, with its coverage ranges.
 * @param {{from: number, to: number}} p.window - Time window.
 * @param {object|null} p.live - Live state, see liveCoverage().
 * @param {boolean} p.connected - True while the page receives live updates.
 * @returns {Array<[number, Array<[number, number]>]>} [laneIdx, gaps] for each lane with gaps.
 */
export function laneGaps({ order, laneOf, window, live, connected }) {
    const tail = liveCoverage(live, connected, window.to);
    const out = [];
    for (const idx of order) {
        const covered = mergeIntervals([...(laneOf(idx)?.coverage || []), ...tail].map((r) => [...r]));
        const gaps = gapsIn(covered, window.from, window.to);
        if (gaps.length) out.push([idx, gaps]);
    }
    return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Filters. They only choose which lanes and executions are drawn: the congestion analytics always cover all tasks.

/** Run states, the "Runs in view" group: they choose the executions drawn, and hide lanes without one. */
export const RUN_STATES = ['problems', 'waited', 'running', 'success', 'skipped'];

/** Task states, the "Task" group: they choose lanes only. */
export const TASK_STATES = ['last-failed', 'disabled', 'deleted'];

/** Lane orders. */
export const SORTS = ['first', 'wait', 'fails', 'runtime', 'name'];

/** Longest search text the page takes, so that no search text can make every filter slow. */
export const MAX_SEARCH_LENGTH = 1000;

/**
 * The filter and view settings the page starts with. An empty location hash stands for these.
 *
 * @returns {object} { search, tagsInclude, tagsExclude, runStates, taskStates, congestionOnly, onlyWithRuns, node, sort,
 *   episodesShownOnly }, a new object (with new arrays) each time.
 */
export function defaultFilters() {
    return {
        search: '',
        tagsInclude: [],
        tagsExclude: [],
        runStates: [],
        taskStates: [],
        congestionOnly: false,
        onlyWithRuns: true,
        node: '',
        sort: 'first',
        episodesShownOnly: false,
    };
}

// Failed, aborted or error, or still "running" so long after it was triggered that its state is unknown (stale)
const isProblem = (row, bucket = statusInfo(row.status).bucket) => PROBLEM_BUCKETS.has(bucket) || Boolean(row.flags & FLAG_STALE);

const RUN_STATE_TESTS = {
    problems: (row, bucket) => isProblem(row, bucket),
    waited: (row) => row.queuedAt !== null && row.queuedAt !== undefined,
    running: (row) => row.stoppedAt === null && !(row.flags & FLAG_STALE),
    success: (row, bucket) => bucket === 'success',
    skipped: (row, bucket) => bucket === 'skipped',
};

// latest: the lane's latest execution the page holds, see latestRunByLane()
const TASK_STATE_TESTS = {
    'last-failed': (lane, latest) => latest !== undefined && isProblem(latest),
    // A deleted task is not in Sense at all, so it is not "disabled in Sense" either
    disabled: (lane) => !lane.enabled && !lane.deleted,
    deleted: (lane) => Boolean(lane.deleted),
};

const SEARCH_FIELD = /^(tag|app|stream|name):/i;
// Control characters cannot be typed into the search box. They are blanked in both the search text and the lanes'
// text, so the character that separates the fields in a lane's text can never be part of a search word.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const FIELD_SEPARATOR = '\u0000';

const searchable = (value) =>
    String(value ?? '')
        .replace(CONTROL_CHARS, ' ')
        .toLowerCase();

/**
 * Parse the text of the search box. Words are separated by spaces, and all of them must match. "Quoted phrases" keep
 * their spaces. -word excludes the lanes that match the word. tag:, app:, stream: or name: in front of a word or phrase
 * looks for it in that field only; a word with any other prefix, such as "Reload:", is an ordinary word. Terms left
 * empty (a lone -, tag: or "") are dropped. Matching ignores case, so the terms are lower-cased.
 *
 * @param {string} text - Search box text.
 * @returns {Array<{field: string|null, text: string, exclude: boolean}>} Terms. A term without a field matches the
 *   task name, the app name, the stream or any of the tags.
 */
export function parseSearch(text) {
    const s = String(text ?? '')
        .slice(0, MAX_SEARCH_LENGTH)
        .replace(CONTROL_CHARS, ' ');
    const terms = [];
    let i = 0;
    while (i < s.length) {
        if (/\s/.test(s[i])) {
            i += 1;
            continue;
        }
        const exclude = s[i] === '-';
        if (exclude) i += 1;
        const prefix = SEARCH_FIELD.exec(s.slice(i, i + 'stream:'.length));
        if (prefix) i += prefix[0].length;
        let value;
        if (s[i] === '"') {
            // A phrase runs to the next quote, or to the end of the text while it is being typed
            const close = s.indexOf('"', i + 1);
            const end = close === -1 ? s.length : close;
            value = s.slice(i + 1, end);
            i = end + 1;
        } else {
            const start = i;
            while (i < s.length && !/\s/.test(s[i])) i += 1;
            value = s.slice(start, i);
        }
        value = value.trim().toLowerCase();
        if (value) terms.push({ field: prefix ? prefix[1].toLowerCase() : null, text: value, exclude });
    }
    return terms;
}

/**
 * What the filters need of a lane, worked out once when the lane arrives rather than on every keystroke.
 *
 * @param {object} lane - Lane from the snapshot or a delta.
 * @returns {object} { name, app, stream, tags, text, tagSet }: the fields lower-cased, all of them in one text, and the
 *   lane's tags as they are.
 */
function filterInfo(lane) {
    const name = searchable(lane.name);
    const app = searchable(lane.appName);
    const stream = searchable(lane.stream);
    const tags = (lane.tags || []).map(searchable);
    return { name, app, stream, tags, text: [name, app, stream, ...tags].join(FIELD_SEPARATOR), tagSet: new Set(lane.tags || []) };
}

const termMatches = (info, { field, text }) => {
    if (field === null) return info.text.includes(text);
    if (field === 'tag') return info.tags.some((t) => t.includes(text));
    return info[field].includes(text);
};

// A term matches unless it excludes; an excluding term must not match
const searchMatches = (info, terms) => terms.every((term) => termMatches(info, term) !== term.exclude);

// At least one included tag (if any tag is included), and none of the excluded ones
const tagsMatch = (tagSet, include, exclude) => {
    let included = include.size === 0;
    for (const tag of tagSet) {
        if (exclude.has(tag)) return false;
        if (include.has(tag)) included = true;
    }
    return included;
};

/**
 * Lanes involved in a congestion episode that overlaps a time range.
 *
 * @param {Array<object>} episodes - Episodes from the analytics. Each lists its tasks, with their lane number (null for
 *   a task without a lane on the page).
 * @param {number} from - Range start.
 * @param {number} to - Range end.
 * @returns {Set<number>} Lane numbers.
 */
export function lanesInEpisodes(episodes, from, to) {
    const out = new Set();
    for (const ep of episodes || []) {
        if (!(ep.from < to && ep.to > from)) continue;
        for (const t of ep.tasks || []) if (t.lane !== null && t.lane !== undefined) out.add(t.lane);
    }
    return out;
}

/**
 * Episodes that involve at least one of the given lanes.
 *
 * @param {Array<object>} episodes - Episodes from the analytics.
 * @param {Set<number>} lanes - Lane numbers, e.g. those drawn.
 * @returns {Array<object>} Those episodes, in the same order.
 */
export function episodesWithLanes(episodes, lanes) {
    return (episodes || []).filter((ep) => (ep.tasks || []).some((t) => lanes.has(t.lane)));
}

/**
 * Whether any filter hides lanes, for "Showing 37 of 2,140 tasks". "Only tasks with runs" is the page's default view
 * rather than a filter, and sorting hides nothing.
 *
 * @param {object} f - Settings, see defaultFilters().
 * @returns {boolean} True if a filter is active.
 */
export function filtersActive(f) {
    return (
        parseSearch(f.search).length > 0 ||
        f.tagsInclude.length > 0 ||
        f.tagsExclude.length > 0 ||
        f.runStates.length > 0 ||
        f.taskStates.length > 0 ||
        Boolean(f.congestionOnly) ||
        Boolean(f.node)
    );
}

// A location hash may hold these characters as they are (RFC 3986), which keeps links with tag:x or a,b readable.
// Spaces become + as in a query string; & = + # % and the rest are percent-encoded.
const hashValue = (value) =>
    encodeURIComponent(value)
        .replace(/%20/g, '+')
        .replace(/%(3A|2C|2F|40)/gi, (m) => decodeURIComponent(m));

/**
 * Encode the filter and view settings for the location hash. They never go in the query string: that may hold the
 * page's access token, and the server gets it with every request. Settings at their default are left out, so the
 * default view has no hash at all. Tag names may contain any character, so every value is a parameter of its own
 * (tag=a&tag=b).
 *
 * @param {object} f - Settings, see defaultFilters().
 * @returns {string} '#...', or '' when every setting is at its default.
 */
export function encodeFilterHash(f) {
    const parts = [];
    const add = (key, value) => parts.push(`${key}=${hashValue(value)}`);
    const search = String(f.search ?? '').trim();
    if (search) add('q', search);
    for (const tag of new Set(f.tagsInclude)) add('tag', tag);
    for (const tag of new Set(f.tagsExclude)) add('notag', tag);
    for (const state of RUN_STATES) if (f.runStates.includes(state)) add('run', state);
    for (const state of TASK_STATES) if (f.taskStates.includes(state)) add('task', state);
    if (f.congestionOnly) add('congestion', '1');
    if (f.onlyWithRuns === false) add('withruns', '0');
    if (f.node) add('node', f.node);
    if (f.sort !== 'first' && SORTS.includes(f.sort)) add('sort', f.sort);
    if (f.episodesShownOnly) add('episodes', 'shown');
    return parts.length ? `#${parts.join('&')}` : '';
}

/**
 * Decode the settings in a location hash, see encodeFilterHash(). Unknown parameters and values, and contradictions
 * (a tag both included and excluded), are ignored, so a damaged or foreign hash leaves those settings at their defaults.
 *
 * @param {string} hash - location.hash, with or without the leading #.
 * @returns {object} Complete settings, see defaultFilters().
 */
export function decodeFilterHash(hash) {
    const f = defaultFilters();
    const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
    const values = (key) => new Set(p.getAll(key).filter(Boolean));
    f.search = (p.get('q') ?? '').slice(0, MAX_SEARCH_LENGTH).trim();
    const include = values('tag');
    const exclude = values('notag');
    f.tagsInclude = [...include].filter((tag) => !exclude.has(tag));
    f.tagsExclude = [...exclude].filter((tag) => !include.has(tag));
    const runs = values('run');
    f.runStates = RUN_STATES.filter((state) => runs.has(state));
    const tasks = values('task');
    f.taskStates = TASK_STATES.filter((state) => tasks.has(state));
    f.congestionOnly = p.get('congestion') === '1';
    f.onlyWithRuns = p.get('withruns') !== '0';
    f.node = p.get('node') ?? '';
    if (SORTS.includes(p.get('sort'))) f.sort = p.get('sort');
    f.episodesShownOnly = p.get('episodes') === 'shown';
    return f;
}

const tagCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

// ---------------------------------------------------------------------------------------------------------------
// Store

/**
 * Create the client store.
 *
 * @returns {object} The store.
 */
export function createClientStore() {
    let snapshot = null;
    const rows = new Map();
    const lanes = new Map();
    // What the filters need of each lane (see filterInfo()), kept up to date as lanes arrive
    const laneInfo = new Map();
    let nodes = [];
    // Worked out when first needed after the lanes or the executions changed, rather than on every call of view()
    let nameRanks = null;
    let tagList = null;
    let latestRuns = null;
    let lastSearch = null;
    let lastTerms = [];

    const setLane = (lane) => {
        lanes.set(lane.idx, lane);
        laneInfo.set(lane.idx, filterInfo(lane));
        nameRanks = null;
        tagList = null;
    };

    /**
     * Replace everything with a snapshot from /api/snapshot.
     *
     * @param {object} snap - Snapshot.
     */
    const load = (snap) => {
        snapshot = snap;
        rows.clear();
        lanes.clear();
        laneInfo.clear();
        nameRanks = null;
        tagList = null;
        latestRuns = null;
        for (const lane of snap.lanes) setLane(lane);
        for (const row of rowsFromCols(snap.cols)) rows.set(row.key, row);
        nodes = snap.nodes || [];
    };

    /**
     * Apply a live delta: changed/new executions, removed keys and changed lanes.
     *
     * @param {object} delta - { rev, cols, removed, lanes, nodes }.
     */
    const applyDelta = (delta) => {
        if (delta.nodes) nodes = delta.nodes;
        for (const lane of delta.lanes || []) setLane(lane);
        for (const key of delta.removed || []) rows.delete(key);
        for (const row of rowsFromCols(delta.cols)) rows.set(row.key, row);
        if (delta.removed?.length || delta.cols?.key?.length) latestRuns = null;
        if (snapshot) snapshot.rev = delta.rev;
    };

    /**
     * Apply a 'live' event: the live coverage, the QRS source state, and which running executions are stale now.
     * Rows change in place here, so the latest run of each lane (latestRunByLane()) stays the same row.
     *
     * @param {object} live - { from, coveredTo, qrs: { state, message, lastOkAt }, staleKeys }.
     * @returns {boolean} True if any execution changed.
     */
    const applyLive = (live) => {
        if (!snapshot) return false;
        snapshot.live = { ...snapshot.live, ...live };
        const qrs = (snapshot.sources || []).find((s) => s.id === 'qrs');
        if (qrs && live.qrs) Object.assign(qrs, live.qrs);
        const stale = new Set(live.staleKeys || []);
        let changed = false;
        for (const row of rows.values()) {
            if (row.stoppedAt !== null && row.stoppedAt !== undefined) continue;
            const flags = stale.has(row.key) ? row.flags | FLAG_STALE : row.flags & ~FLAG_STALE;
            if (flags !== row.flags) {
                row.flags = flags;
                changed = true;
            }
        }
        return changed;
    };

    /**
     * Rows within a time range.
     *
     * @param {number} from - Range start.
     * @param {number} to - Range end.
     * @param {number} now - Current time; running executions end here.
     * @returns {Array<object>} Rows overlapping the range.
     */
    const rowsIn = (from, to, now) =>
        [...rows.values()].filter((r) => {
            const b = rowBegin(r);
            const e = r.stoppedAt ?? now;
            return b !== null && b !== undefined && e >= from && b <= to;
        });

    // Each lane's place in name order, for sorting by name without comparing strings on every call of view()
    const ranks = () => {
        if (!nameRanks) {
            const sorted = [...lanes.values()].sort((a, b) => a.name.localeCompare(b.name));
            nameRanks = new Map(sorted.map((lane, i) => [lane.idx, i]));
        }
        return nameRanks;
    };

    /**
     * The latest execution the page holds for each lane, in or before the window: the one triggered (or started) last.
     *
     * @returns {Map<number, object>} Lane number -> row.
     */
    const latestRunByLane = () => {
        if (!latestRuns) {
            latestRuns = new Map();
            for (const r of rows.values()) {
                const b = rowBegin(r);
                if (b === null || b === undefined) continue;
                const latest = latestRuns.get(r.lane);
                if (latest === undefined || b > rowBegin(latest)) latestRuns.set(r.lane, r);
            }
        }
        return latestRuns;
    };

    /**
     * Every tag the lanes have, with the number of lanes that have it, ordered by name. Do not change the result.
     *
     * @returns {Array<{name: string, count: number}>} Tags.
     */
    const tags = () => {
        if (!tagList) {
            const counts = new Map();
            for (const info of laneInfo.values()) for (const tag of info.tagSet) counts.set(tag, (counts.get(tag) || 0) + 1);
            tagList = [...counts]
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => tagCollator.compare(a.name, b.name) || (a.name < b.name ? -1 : 1));
        }
        return tagList;
    };

    /**
     * Which lanes to draw, in which order, and which of their executions. The filters of one kind combine with OR (any
     * included tag, any run state, any task state), different kinds with AND.
     *
     * @param {object} p - Settings (see defaultFilters()) and the time window.
     * @param {string} [p.search] - Search box text, see parseSearch().
     * @param {string[]} [p.tagsInclude] - Show only lanes with at least one of these tags; none: no restriction.
     * @param {string[]} [p.tagsExclude] - Hide lanes with any of these tags.
     * @param {string[]} [p.runStates] - Draw only executions in one of these RUN_STATES, and only lanes with one.
     * @param {string[]} [p.taskStates] - Show only lanes in one of these TASK_STATES.
     * @param {boolean} [p.congestionOnly] - Show only lanes involved in an episode that overlaps p.visible.
     * @param {Array<object>} [p.episodes] - The congestion episodes shown, for congestionOnly.
     * @param {{from: number, to: number}} [p.visible] - The time range on screen (the zoomed part of the window), for
     *   congestionOnly. Defaults to the window.
     * @param {string} [p.sort] - One of SORTS.
     * @param {boolean} [p.onlyWithRuns] - Hide lanes without executions in the window.
     * @param {string} [p.node] - Draw only executions on this node.
     * @param {number} p.from - Window start.
     * @param {number} p.to - Window end.
     * @param {number} p.now - Current time; running executions end here.
     * @returns {{order: number[], rows: Array<object>, perLane: Map<number, object>}} Lane numbers in display order, the
     *   rows to draw, and the statistics of the rows drawn in each lane.
     */
    const view = ({
        search = '',
        tagsInclude = [],
        tagsExclude = [],
        runStates = [],
        taskStates = [],
        congestionOnly = false,
        episodes = [],
        visible = null,
        sort = 'first',
        onlyWithRuns = true,
        node = '',
        from,
        to,
        now,
    }) => {
        if (search !== lastSearch) {
            lastTerms = parseSearch(search);
            lastSearch = search;
        }
        const terms = lastTerms;
        const include = new Set(tagsInclude);
        const exclude = new Set(tagsExclude);
        const laneTests = taskStates.map((s) => TASK_STATE_TESTS[s]).filter(Boolean);
        const latest = taskStates.includes('last-failed') ? latestRunByLane() : null;
        const congested = congestionOnly ? lanesInEpisodes(episodes, visible?.from ?? from, visible?.to ?? to) : null;

        // Filters on the lane itself first: they do not depend on executions, and rows of hidden lanes are skipped
        const lanesOk = new Set();
        for (const lane of lanes.values()) {
            const info = laneInfo.get(lane.idx);
            if (terms.length && !searchMatches(info, terms)) continue;
            if (!tagsMatch(info.tagSet, include, exclude)) continue;
            if (laneTests.length && !laneTests.some((test) => test(lane, latest?.get(lane.idx)))) continue;
            if (congested && !congested.has(lane.idx)) continue;
            lanesOk.add(lane.idx);
        }

        // Then the executions in the window, by node and run state. A node without executions has no index (-1),
        // which no row matches.
        const nodeIdx = node ? nodes.indexOf(node) : -1;
        const rowTests = runStates.map((s) => RUN_STATE_TESTS[s]).filter(Boolean);
        const shown = [];
        const perLane = new Map();
        for (const r of rows.values()) {
            if (!lanesOk.has(r.lane)) continue;
            const b = rowBegin(r);
            const e = r.stoppedAt ?? now;
            if (b === null || b === undefined || e < from || b > to) continue;
            if (node && r.node !== nodeIdx) continue;
            const bucket = statusInfo(r.status).bucket;
            if (rowTests.length && !rowTests.some((test) => test(r, bucket))) continue;
            shown.push(r);
            let s = perLane.get(r.lane);
            if (!s) {
                s = { first: Infinity, wait: 0, fails: 0, runtime: 0, runs: 0 };
                perLane.set(r.lane, s);
            }
            s.first = Math.min(s.first, b);
            s.wait += rowWait(r);
            if (PROBLEM_BUCKETS.has(bucket)) s.fails += 1;
            if (r.startedAt !== null) s.runtime += e - r.startedAt;
            s.runs += 1;
        }

        // Filters on executions hide the lanes without a matching one, also when lanes without runs are wanted
        const filtersRows = rowTests.length > 0 || Boolean(node);
        const rank = ranks();
        const byName = (a, b) => rank.get(a) - rank.get(b);
        const order = [...lanesOk]
            .filter((idx) => perLane.has(idx) || (!onlyWithRuns && !filtersRows))
            .sort((a, b) => {
                if (sort === 'name') return byName(a, b);
                const sa = perLane.get(a);
                const sb = perLane.get(b);
                if (!sa || !sb) return (sa ? -1 : 0) + (sb ? 1 : 0) || byName(a, b);
                if (sort === 'wait') return sb.wait - sa.wait || byName(a, b);
                if (sort === 'fails') return sb.fails - sa.fails || byName(a, b);
                if (sort === 'runtime') return sb.runtime - sa.runtime || byName(a, b);
                return sa.first - sb.first || byName(a, b);
            });

        // Every row shown belongs to a lane in the order: its lane passed the lane filters and has a row
        return { order, rows: shown, perLane };
    };

    return {
        load,
        applyDelta,
        applyLive,
        view,
        rowsIn,
        tags,
        lane: (idx) => lanes.get(idx),
        lanes: () => [...lanes.values()],
        row: (key) => rows.get(key),
        size: () => rows.size,
        nodes: () => nodes,
        snapshot: () => snapshot,
    };
}
