import { computeConcurrency } from '../analytics/concurrency.js';
import { findEpisodes } from '../analytics/episodes.js';
import { computeTaskStats } from '../analytics/task-stats.js';
import { STALE_RUNNING_MS, SOURCE_BIT, SOURCE } from '../defaults.js';

// Bits in cols.flags
export const FLAG_STALE = 1; // still "running" long after it was triggered, and no running session: state unknown
export const FLAG_DERIVED = 2; // not from an exact source (e.g. Operations Monitor) - times may be approximate

const COLS = ['key', 'lane', 'status', 'triggeredAt', 'queuedAt', 'startedAt', 'stoppedAt', 'node', 'src', 'flags'];

const overlapsWindow = (rec, from, to, now) => {
    const begin = rec.triggeredAt ?? rec.startedAt;
    const end = rec.stoppedAt ?? now;
    return begin !== null && begin !== undefined && end >= from && begin <= to;
};

const clipRanges = (ranges, from, to) =>
    ranges.filter(([a, b]) => b > from && a < to).map(([a, b]) => [Math.max(a, from), Math.min(b, to)]);

/**
 * Is a record that looks like it is still running really running? Only if QRS lists a running session for it, or it
 * was triggered recently. A run only the history file (or another source) has as running, and QRS no longer holds, has
 * an unknown outcome.
 *
 * @param {object} rec - Execution record.
 * @param {Set<string>} runningResultIds - Result ids with a live QRS execution session.
 * @param {number} now - Current time.
 * @returns {boolean} True if the record should be shown as "unknown (stale)".
 */
export function isStale(rec, runningResultIds, now) {
    if (rec.stoppedAt !== null && rec.stoppedAt !== undefined) return false;
    if (!(rec.src & SOURCE_BIT[SOURCE.QRS])) return true;
    if (rec.resultId && runningResultIds.has(rec.resultId)) return false;
    const begin = rec.triggeredAt ?? rec.startedAt ?? now;
    return now - begin > STALE_RUNNING_MS;
}

/**
 * Encode lanes for the page.
 *
 * @param {Array<object>} lanes - Lanes.
 * @param {object} coverage - Coverage tracker.
 * @param {number} from - Window start.
 * @param {number} to - Window end.
 * @returns {Array<object>} Lanes for the page.
 */
export function encodeLanes(lanes, coverage, from, to) {
    return lanes.map((l) => ({
        idx: l.idx,
        id: l.id,
        name: l.name,
        taskType: l.taskType,
        enabled: l.enabled,
        appId: l.appId,
        appName: l.appName,
        stream: l.stream,
        tags: l.tags,
        deleted: l.deleted,
        coverage: clipRanges(coverage.forTask(l.id), from, to),
    }));
}

/**
 * Encode execution records column-wise, for records of visible lanes that have not ended before the window start.
 * Records that begin after the window end are included: the window ends at Ctrl-Q's estimate of the Sense clock, which
 * can be a little behind the times in QRS, and a record a live delta leaves out would never reach the page.
 *
 * @param {Array<object>} records - Records.
 * @param {object} ctx - { laneByTask: Map, nodeIdx: Function, runningResultIds: Set, from, now }.
 * @returns {object} Columns.
 */
export function encodeRecords(records, { laneByTask, nodeIdx, runningResultIds, from, now }) {
    const cols = Object.fromEntries(COLS.map((c) => [c, []]));
    for (const rec of records) {
        if (!overlapsWindow(rec, from, Infinity, now)) continue;
        const lane = laneByTask.get(rec.taskId);
        if (lane === undefined) continue;
        cols.key.push(rec.key);
        cols.lane.push(lane);
        cols.status.push(rec.status);
        cols.triggeredAt.push(rec.triggeredAt);
        cols.queuedAt.push(rec.queuedAt);
        cols.startedAt.push(rec.startedAt);
        cols.stoppedAt.push(rec.stoppedAt);
        cols.node.push(nodeIdx(rec.nodeName || ''));
        cols.src.push(rec.src);
        let flags = 0;
        if (isStale(rec, runningResultIds, now)) flags |= FLAG_STALE;
        if (!(rec.src & SOURCE_BIT[SOURCE.QRS]) && rec.confidence !== 'exact') flags |= FLAG_DERIVED;
        cols.flags.push(flags);
    }
    return cols;
}

/**
 * Congestion analytics over all records in the window, also those of tasks without a visible lane, because every
 * reload uses a scheduler slot. Time before `completeFrom` (executions evicted from memory) is left out.
 *
 * @param {object} param - Parameters, see buildSnapshot().
 * @returns {object} { bucketMs, concurrency: { total, nodes }, episodes, taskStats }.
 */
export function buildAnalytics({ records, lanes, schedulers, runningResultIds, window, now, completeFrom = null }) {
    const from = completeFrom === null ? window.from : Math.min(window.to, Math.max(window.from, completeFrom));
    const { to } = window;
    const laneByTask = new Map(lanes.visible().map((l) => [l.id, l.idx]));
    const forAnalytics = records.filter((r) => overlapsWindow(r, from, to, now) && !isStale(r, runningResultIds, now));
    const capacityByNode = new Map((schedulers || []).map((s) => [s.nodeName, s.maxConcurrentEngines]));
    const concurrency = computeConcurrency(forAnalytics, { now, from, to });
    const episodes = findEpisodes(concurrency.points, capacityByNode, forAnalytics, { now, from, to }).map((ep) => ({
        ...ep,
        tasks: ep.tasks.map((t) => ({ ...t, lane: laneByTask.get(t.taskId) ?? null, name: lanes.get(t.taskId)?.name ?? null })),
    }));
    const stats = computeTaskStats(forAnalytics, { now, from, to });
    return {
        bucketMs: concurrency.bucketMs,
        concurrency: { total: concurrency.total, nodes: concurrency.nodes },
        episodes,
        taskStats: lanes
            .visible()
            .filter((l) => stats.has(l.id))
            .map((l) => ({ lane: l.idx, ...stats.get(l.id) })),
    };
}

/**
 * Node name table: execution records refer to nodes by index, to keep the payload small.
 *
 * @param {Array<string>} [initial] - Known node names.
 * @returns {{names: string[], idx: Function}} Table.
 */
export function createNodeTable(initial = []) {
    const names = [...initial];
    const index = new Map(names.map((n, i) => [n, i]));
    return {
        names,
        idx: (name) => {
            if (!index.has(name)) {
                index.set(name, names.length);
                names.push(name);
            }
            return index.get(name);
        },
    };
}

/**
 * Build the JSON snapshot the page loads.
 *
 * @param {object} param - Parameters.
 * @param {Array<object>} param.records - All execution records.
 * @param {object} param.lanes - Lane registry.
 * @param {object} param.coverage - Coverage tracker.
 * @param {Array<object>} param.sources - Source statuses.
 * @param {Array<object>} param.schedulers - Reloading scheduler nodes { nodeName, maxConcurrentEngines }.
 * @param {Set<string>} param.runningResultIds - Result ids with a live execution session.
 * @param {{from: number, to: number}} param.window - Time window.
 * @param {number} param.now - Current time.
 * @param {number|null} [param.completeFrom] - Data before this time is incomplete (evicted), see buildAnalytics().
 * @param {object|null} param.live - Live update state (see app.liveStatus()) plus pollIntervalMs, or null without live
 *   updates.
 * @param {number} param.rev - Store revision.
 * @param {object} [param.nodes] - Node table, shared with live deltas.
 * @returns {object} Snapshot.
 */
export function buildSnapshot(param) {
    const { records, lanes, coverage, sources, schedulers, runningResultIds, window, now, live, rev } = param;
    const { from, to } = window;
    const nodes = param.nodes || createNodeTable();
    const visibleLanes = lanes.visible();
    const laneByTask = new Map(visibleLanes.map((l) => [l.id, l.idx]));
    const cols = encodeRecords(records, { laneByTask, nodeIdx: nodes.idx, runningResultIds, from, now });

    return {
        rev,
        generatedAt: now,
        live,
        window: { from, to },
        nodes: [...nodes.names],
        lanes: encodeLanes(visibleLanes, coverage, from, to),
        cols,
        sources,
        capacity: { nodes: (schedulers || []).map((s) => ({ name: s.nodeName, maxConcurrentEngines: s.maxConcurrentEngines })) },
        analytics: buildAnalytics(param),
    };
}
