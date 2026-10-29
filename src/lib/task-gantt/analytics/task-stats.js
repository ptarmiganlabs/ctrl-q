import { isTerminalStatus, STATUS } from '../model/status.js';

// Nearest-rank percentile: the smallest value that at least p % of the values are not above
const percentile = (sorted, p) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] : null;

/**
 * Per-task statistics for the executions overlapping a window: run counts, failures, run-time percentiles and time
 * spent waiting to start. Input for sorting lanes and, later, for recommendations.
 *
 * @param {Array<object>} records - Execution records.
 * @param {object} param - Parameters.
 * @param {number} param.now - Current time.
 * @param {number} param.from - Window start.
 * @param {number} param.to - Window end.
 * @returns {Map<string, object>} taskId -> { runs, fails, p50Ms, p95Ms, totalWaitMs, totalRunMs, firstAt, lastStatus }.
 */
export function computeTaskStats(records, { now, from, to }) {
    const acc = new Map();
    for (const rec of records) {
        const begin = rec.triggeredAt ?? rec.startedAt;
        const end = rec.stoppedAt ?? now;
        if (begin === null || begin === undefined || end < from || begin > to) continue;

        const s = acc.get(rec.taskId) || {
            runs: 0,
            fails: 0,
            durations: [],
            totalWaitMs: 0,
            totalRunMs: 0,
            firstAt: begin,
            lastAt: begin,
            lastStatus: rec.status,
        };
        s.runs += 1;
        if ([STATUS.FINISHED_FAIL, STATUS.ERROR, STATUS.ABORTED].includes(rec.status) || rec.status === 12) s.fails += 1;
        if (rec.startedAt !== null && rec.startedAt !== undefined) {
            if (rec.triggeredAt !== null && rec.triggeredAt !== undefined) s.totalWaitMs += Math.max(0, rec.startedAt - rec.triggeredAt);
            s.totalRunMs += Math.max(0, end - rec.startedAt);
            if (isTerminalStatus(rec.status) && rec.stoppedAt !== null) s.durations.push(rec.stoppedAt - rec.startedAt);
        }
        s.firstAt = Math.min(s.firstAt, begin);
        if (begin >= s.lastAt) {
            s.lastAt = begin;
            s.lastStatus = rec.status;
        }
        acc.set(rec.taskId, s);
    }

    const out = new Map();
    for (const [taskId, s] of acc) {
        const sorted = s.durations.sort((a, b) => a - b);
        out.set(taskId, {
            runs: s.runs,
            fails: s.fails,
            p50Ms: percentile(sorted, 50),
            p95Ms: percentile(sorted, 95),
            totalWaitMs: s.totalWaitMs,
            totalRunMs: s.totalRunMs,
            firstAt: s.firstAt,
            lastStatus: s.lastStatus,
        });
    }
    return out;
}
