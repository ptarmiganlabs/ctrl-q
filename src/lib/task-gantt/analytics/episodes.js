import { EPISODE_MERGE_GAP_MS, MAX_EPISODES } from '../defaults.js';
import { countsTowardsCapacity } from './concurrency.js';

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Find congestion episodes: periods when a node's scheduler had reloads waiting in its queue, or ran as many reloads
 * as it is allowed to (maxConcurrentEngines). Each episode lists the tasks involved.
 *
 * This is the "where is the congestion and which tasks are involved" answer, and the input for future
 * recommendations.
 *
 * @param {Map<string, Array<[number, number, number]>>} pointsByNode - Change points per node, from computeConcurrency().
 * @param {Map<string, number>} capacityByNode - maxConcurrentEngines per node name. Unknown nodes only count queueing.
 * @param {Array<object>} records - Execution records.
 * @param {object} param - Parameters.
 * @param {number} param.now - Current time.
 * @param {number} param.from - Window start; episodes are clipped to the window.
 * @param {number} param.to - Window end.
 * @param {number} [param.mergeGapMs] - Episodes closer than this are merged.
 * @param {number} [param.maxEpisodes] - Max episodes returned, most waiting first.
 * @returns {Array<object>} Episodes: { from, to, node, capacity, peakRunning, peakQueued, waitMs,
 *   tasks: [{ taskId, overlapMs, waitMs, runs }] }.
 */
export function findEpisodes(
    pointsByNode,
    capacityByNode,
    records,
    { now, from, to, mergeGapMs = EPISODE_MERGE_GAP_MS, maxEpisodes = MAX_EPISODES }
) {
    const episodes = [];

    // Records that use a reload slot, grouped by node once (not once per episode)
    const recordsByNode = new Map();
    for (const rec of records) {
        if (!countsTowardsCapacity(rec)) continue;
        const node = rec.nodeName || '';
        if (!recordsByNode.has(node)) recordsByNode.set(node, []);
        recordsByNode.get(node).push(rec);
    }

    for (const [node, points] of pointsByNode) {
        const capacity = capacityByNode.get(node);
        const saturated = (running, queued) => queued > 0 || (capacity > 0 && running >= capacity);

        // Raw saturated intervals from the step function
        const raw = [];
        for (let i = 0; i < points.length; i += 1) {
            const [t, running, queued] = points[i];
            const tEnd = i + 1 < points.length ? points[i + 1][0] : t;
            if (tEnd > t && saturated(running, queued)) {
                const last = raw[raw.length - 1];
                if (last && t - last.to <= mergeGapMs) {
                    last.to = tEnd;
                    last.peakRunning = Math.max(last.peakRunning, running);
                    last.peakQueued = Math.max(last.peakQueued, queued);
                } else {
                    raw.push({ from: t, to: tEnd, peakRunning: running, peakQueued: queued });
                }
            }
        }

        // Episodes clipped to the window. They come from a time-ordered step function, so they are disjoint and sorted.
        const eps = raw
            .map((ep) => ({ ...ep, from: Math.max(ep.from, from), to: Math.min(ep.to, to), byTask: new Map() }))
            .filter((ep) => ep.to > ep.from);
        if (!eps.length) continue;

        // For each record, find the episodes it overlaps by binary search: the first episode ending after the record
        // begins, then onwards while episodes start before the record ends
        for (const rec of recordsByNode.get(node) || []) {
            const begin = rec.queuedAt ?? rec.startedAt;
            if (begin === null || begin === undefined) continue;
            const end = rec.stoppedAt ?? now;
            let lo = 0;
            let hi = eps.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (eps[mid].to <= begin) lo = mid + 1;
                else hi = mid;
            }
            for (let i = lo; i < eps.length && eps[i].from < end; i += 1) {
                const ep = eps[i];
                const ov = overlap(begin, end, ep.from, ep.to);
                if (ov <= 0) continue;
                const waitEnd = rec.startedAt ?? end;
                const wait = rec.queuedAt !== null && rec.queuedAt !== undefined ? overlap(rec.queuedAt, waitEnd, ep.from, ep.to) : 0;
                const entry = ep.byTask.get(rec.taskId) || { taskId: rec.taskId, overlapMs: 0, waitMs: 0, runs: 0 };
                entry.overlapMs += ov;
                entry.waitMs += wait;
                entry.runs += 1;
                ep.byTask.set(rec.taskId, entry);
            }
        }

        for (const ep of eps) {
            const tasks = [...ep.byTask.values()].sort((a, b) => b.waitMs - a.waitMs || b.overlapMs - a.overlapMs);
            episodes.push({
                from: ep.from,
                to: ep.to,
                node,
                capacity: capacity ?? null,
                peakRunning: ep.peakRunning,
                peakQueued: ep.peakQueued,
                waitMs: tasks.reduce((sum, t) => sum + t.waitMs, 0),
                tasks,
            });
        }
    }

    return episodes.sort((a, b) => b.waitMs - a.waitMs || b.to - b.from - (a.to - a.from) || a.from - b.from).slice(0, maxEpisodes);
}
