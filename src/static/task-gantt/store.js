// Client-side data store of the task Gantt page: the snapshot from /api/snapshot, live deltas, and the filtering and
// sorting that decide which lanes are drawn in which order. No DOM access, so it can be unit tested.
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

/**
 * Create the client store.
 *
 * @returns {object} The store.
 */
export function createClientStore() {
    let snapshot = null;
    const rows = new Map();
    const lanes = new Map();
    let nodes = [];

    /**
     * Replace everything with a snapshot from /api/snapshot.
     *
     * @param {object} snap - Snapshot.
     */
    const load = (snap) => {
        snapshot = snap;
        rows.clear();
        lanes.clear();
        for (const lane of snap.lanes) lanes.set(lane.idx, lane);
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
        for (const lane of delta.lanes || []) lanes.set(lane.idx, lane);
        for (const key of delta.removed || []) rows.delete(key);
        for (const row of rowsFromCols(delta.cols)) rows.set(row.key, row);
        if (snapshot) snapshot.rev = delta.rev;
    };

    /**
     * Apply a 'live' event: the live coverage, the QRS source state, and which running executions are stale now.
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

    /**
     * Which lanes to draw, in which order.
     *
     * @param {object} view - { search, statusFilter, sort, onlyWithRuns, node, from, to, now }.
     * @returns {{order: number[], rows: Array<object>}} Lane numbers in display order, and the rows to draw.
     */
    const view = ({ search = '', statusFilter = 'all', sort = 'first', onlyWithRuns = true, node = '', from, to, now }) => {
        const q = search.trim().toLowerCase();
        // A node without executions has no index (-1), which no row matches
        const nodeIdx = node ? nodes.indexOf(node) : -1;
        const matchesRow = (r) => {
            if (node && r.node !== nodeIdx) return false;
            const bucket = statusInfo(r.status).bucket;
            if (statusFilter === 'problems') return PROBLEM_BUCKETS.has(bucket) || Boolean(r.flags & FLAG_STALE);
            if (statusFilter === 'waited') return r.queuedAt !== null && r.queuedAt !== undefined;
            if (statusFilter === 'running') return r.stoppedAt === null && !(r.flags & FLAG_STALE);
            return true;
        };
        const shown = rowsIn(from, to, now).filter(matchesRow);

        const perLane = new Map();
        for (const r of shown) {
            const s = perLane.get(r.lane) || { first: Infinity, wait: 0, fails: 0, runtime: 0, runs: 0 };
            s.first = Math.min(s.first, rowBegin(r));
            s.wait += rowWait(r);
            if (PROBLEM_BUCKETS.has(statusInfo(r.status).bucket)) s.fails += 1;
            if (r.startedAt !== null) s.runtime += (r.stoppedAt ?? now) - r.startedAt;
            s.runs += 1;
            perLane.set(r.lane, s);
        }

        const textMatch = (lane) =>
            !q ||
            lane.name.toLowerCase().includes(q) ||
            (lane.appName || '').toLowerCase().includes(q) ||
            (lane.stream || '').toLowerCase().includes(q) ||
            (lane.tags || []).some((t) => t.toLowerCase().includes(q));

        const filtersRows = statusFilter !== 'all' || Boolean(node);
        const order = [...lanes.values()]
            .filter((lane) => textMatch(lane) && (perLane.has(lane.idx) || (!onlyWithRuns && !filtersRows)))
            .sort((a, b) => {
                const sa = perLane.get(a.idx);
                const sb = perLane.get(b.idx);
                const byName = a.name.localeCompare(b.name);
                if (sort === 'name') return byName;
                if (!sa || !sb) return (sa ? -1 : 0) + (sb ? 1 : 0) || byName;
                if (sort === 'wait') return sb.wait - sa.wait || byName;
                if (sort === 'fails') return sb.fails - sa.fails || byName;
                if (sort === 'runtime') return sb.runtime - sa.runtime || byName;
                return sa.first - sb.first || byName;
            })
            .map((lane) => lane.idx);

        const visible = new Set(order);
        return { order, rows: shown.filter((r) => visible.has(r.lane)), perLane };
    };

    return {
        load,
        applyDelta,
        applyLive,
        view,
        rowsIn,
        lane: (idx) => lanes.get(idx),
        lanes: () => [...lanes.values()],
        row: (key) => rows.get(key),
        size: () => rows.size,
        nodes: () => nodes,
        snapshot: () => snapshot,
    };
}
