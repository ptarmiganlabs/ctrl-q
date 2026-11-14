import { sweepConcurrency, bucketPeaks, chooseBucketMs } from '../shared/sweep.js';
import { isTerminalStatus } from '../model/status.js';
import { MAX_CONCURRENCY_BUCKETS, MIN_CONCURRENCY_BUCKET_MS } from '../defaults.js';

/**
 * Should the execution count against the schedulers' "max concurrent reloads"? Reload tasks do. Records of tasks no
 * longer in QRS have no known type; they count if they belong to an app, as only reload tasks have one.
 *
 * @param {object} rec - Execution record.
 * @returns {boolean} True if the execution uses an engine reload slot.
 */
export function countsTowardsCapacity(rec) {
    return rec.taskType === 0 || ((rec.taskType === null || rec.taskType === undefined) && Boolean(rec.appId));
}

/**
 * Split an execution into its queued and running intervals.
 *
 * @param {object} rec - Execution record.
 * @param {number} now - Current time; ongoing intervals end here.
 * @returns {Array<{start: number, end: number, kind: string}>} Intervals.
 */
export function executionIntervals(rec, now) {
    const out = [];
    // The engine frees the slot at finishedAt, slightly before QRS sets stoppedAt
    const end = rec.finishedAt ?? rec.stoppedAt ?? now;
    if (rec.queuedAt !== null && rec.queuedAt !== undefined) {
        const queueEnd = rec.startedAt ?? (isTerminalStatus(rec.status) ? end : now);
        out.push({ start: rec.queuedAt, end: queueEnd, kind: 'queue' });
    }
    if (rec.startedAt !== null && rec.startedAt !== undefined) {
        out.push({ start: rec.startedAt, end, kind: 'run' });
    }
    return out;
}

/**
 * Compute running/queued reload counts over time, per node and in total.
 *
 * @param {Array<object>} records - Execution records.
 * @param {object} param - Parameters.
 * @param {number} param.now - Current time.
 * @param {number} param.from - Window start.
 * @param {number} param.to - Window end.
 * @returns {{bucketMs: number, total: Array, nodes: Array<{name: string, steps: Array}>, points: Map<string, Array>}}
 *   Bucketed peak series for the chart, plus the exact change points per node (for episode detection).
 */
export function computeConcurrency(records, { now, from, to }) {
    const byNode = new Map();
    const all = [];
    for (const rec of records) {
        if (!countsTowardsCapacity(rec)) continue;
        const intervals = executionIntervals(rec, now);
        all.push(...intervals);
        const node = rec.nodeName || '';
        if (!byNode.has(node)) byNode.set(node, []);
        byNode.get(node).push(...intervals);
    }

    const bucketMs = chooseBucketMs(to - from, MAX_CONCURRENCY_BUCKETS, MIN_CONCURRENCY_BUCKET_MS);
    const points = new Map();
    const nodes = [];
    for (const [name, intervals] of [...byNode.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const p = sweepConcurrency(intervals);
        points.set(name, p);
        nodes.push({ name, steps: bucketPeaks(p, from, to, bucketMs) });
    }
    const total = bucketPeaks(sweepConcurrency(all), from, to, bucketMs);
    return { bucketMs, total, nodes, points };
}
