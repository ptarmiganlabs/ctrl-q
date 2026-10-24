import { CONFLICT_THRESHOLD_MS, MATCH_TOLERANCE_MS, MAX_RECORDS, SOURCE_BIT, SOURCE_RANK } from '../defaults.js';
import { isTerminalStatus } from '../model/status.js';
import { recordKey } from '../model/execution-record.js';

const CONFIDENCE_RANK = { approx: 0, derived: 1, exact: 2 };
const FIELDS = [
    'resultId',
    'executionId',
    'taskType',
    'appId',
    'nodeName',
    'triggeredAt',
    'queuedAt',
    'startedAt',
    'stoppedAt',
    'finishedAt',
    'failureReason',
];

// Rank of the best source that contributed to a record
function bestRank(srcBits) {
    let best = 0;
    for (const [source, bit] of Object.entries(SOURCE_BIT)) {
        if (srcBits & bit) {
            best = Math.max(best, SOURCE_RANK[source]);
        }
    }
    return best;
}

const isEmpty = (v) => v === null || v === undefined || v === '';

/**
 * Merge an incoming record into an existing one describing the same execution.
 *
 * Rules:
 * - Same top-ranked source (e.g. two QRS versions of one result): the newer version replaces the older one; an older
 *   version (lower modifiedAt) is ignored.
 * - Higher-ranked source: its values win, gaps are filled from the existing record.
 * - Lower-ranked source: it only fills gaps, and may finish an execution the existing record still has as running.
 *
 * @param {object} existing - Existing record.
 * @param {object} incoming - Incoming record.
 * @param {string} sourceId - Source of the incoming record.
 * @returns {{merged: object, changed: boolean, conflict: boolean}} Result.
 */
export function mergeRecords(existing, incoming, sourceId) {
    const existingRank = bestRank(existing.src);
    const incomingRank = SOURCE_RANK[sourceId] ?? 0;
    const merged = { ...existing };
    let conflict = false;

    for (const f of ['triggeredAt', 'stoppedAt']) {
        if (!isEmpty(existing[f]) && !isEmpty(incoming[f]) && Math.abs(existing[f] - incoming[f]) > CONFLICT_THRESHOLD_MS) {
            conflict = true;
        }
    }

    if (incomingRank === existingRank && existing.src & SOURCE_BIT[sourceId]) {
        // New version from the same source
        if (!isEmpty(existing.modifiedAt) && !isEmpty(incoming.modifiedAt) && incoming.modifiedAt < existing.modifiedAt) {
            return { merged: existing, changed: false, conflict: false };
        }
        for (const f of FIELDS) {
            merged[f] = isEmpty(incoming[f]) && f !== 'stoppedAt' && f !== 'finishedAt' ? existing[f] : incoming[f];
        }
        merged.status = incoming.status;
        merged.modifiedAt = incoming.modifiedAt ?? existing.modifiedAt;
    } else if (incomingRank > existingRank) {
        for (const f of FIELDS) {
            merged[f] = isEmpty(incoming[f]) ? existing[f] : incoming[f];
        }
        // A finished execution stays finished, even if the better source has not seen the end yet
        if (!isTerminalStatus(incoming.status) && isTerminalStatus(existing.status)) {
            merged.status = existing.status;
            merged.stoppedAt = existing.stoppedAt;
            merged.finishedAt = existing.finishedAt;
        } else {
            merged.status = incoming.status;
        }
        merged.modifiedAt = incoming.modifiedAt ?? existing.modifiedAt;
    } else {
        for (const f of FIELDS) {
            if (isEmpty(existing[f]) && !isEmpty(incoming[f])) {
                merged[f] = incoming[f];
            }
        }
        if (!isTerminalStatus(existing.status) && isTerminalStatus(incoming.status)) {
            merged.status = incoming.status;
            merged.stoppedAt = incoming.stoppedAt ?? existing.stoppedAt;
            merged.finishedAt = incoming.finishedAt ?? existing.finishedAt;
        }
    }

    merged.src = existing.src | incoming.src;
    merged.confidence =
        (CONFIDENCE_RANK[incoming.confidence] ?? 0) > (CONFIDENCE_RANK[existing.confidence] ?? 0)
            ? incoming.confidence
            : existing.confidence;

    const changed = merged.src !== existing.src || [...FIELDS, 'status', 'confidence'].some((f) => merged[f] !== existing[f]);
    return { merged, changed, conflict };
}

/**
 * Create the in-memory store of execution records. It merges records describing the same execution, whichever source
 * they come from, and keeps a revision number that increases with every effective change.
 *
 * @param {object} [param] - Parameters.
 * @param {number} [param.maxRecords] - Max records kept. Oldest finished records are evicted first.
 * @param {number} [param.matchToleranceMs] - Max trigger time difference for matching records without ids.
 * @returns {object} The store.
 */
export function createExecutionStore({ maxRecords = MAX_RECORDS, matchToleranceMs = MATCH_TOLERANCE_MS } = {}) {
    const records = new Map();
    const byResultId = new Map();
    const byExecutionId = new Map();
    // taskId -> Map(time bucket -> Set of keys). Buckets are matchToleranceMs wide, so any record within the tolerance
    // of a time is in that time's bucket or a neighbouring one.
    const byTaskBucket = new Map();
    // Keys of records that have not stopped yet
    const runningKeys = new Set();
    const conflicts = new Map();
    let rev = 0;
    let changedKeys = new Set();
    let removedKeys = new Set();
    // Latest stop time of an evicted record: before it, executions may be missing
    let evictedUntil = null;

    const anchorOf = (rec) => rec.triggeredAt ?? rec.startedAt ?? 0;
    const bucketOf = (t) => Math.floor(t / matchToleranceMs);

    const index = (rec) => {
        if (rec.resultId) byResultId.set(rec.resultId, rec.key);
        if (rec.executionId) {
            if (!byExecutionId.has(rec.executionId)) byExecutionId.set(rec.executionId, new Set());
            byExecutionId.get(rec.executionId).add(rec.key);
        }
        if (!byTaskBucket.has(rec.taskId)) byTaskBucket.set(rec.taskId, new Map());
        const buckets = byTaskBucket.get(rec.taskId);
        const b = bucketOf(anchorOf(rec));
        if (!buckets.has(b)) buckets.set(b, new Set());
        buckets.get(b).add(rec.key);
        if (rec.stoppedAt === null || rec.stoppedAt === undefined) runningKeys.add(rec.key);
        else runningKeys.delete(rec.key);
    };

    // Remove a record from all indexes, dropping index entries that become empty so memory does not grow
    const unindex = (rec) => {
        if (rec.resultId && byResultId.get(rec.resultId) === rec.key) byResultId.delete(rec.resultId);
        if (rec.executionId) {
            const keys = byExecutionId.get(rec.executionId);
            keys?.delete(rec.key);
            if (keys?.size === 0) byExecutionId.delete(rec.executionId);
        }
        const buckets = byTaskBucket.get(rec.taskId);
        if (buckets) {
            const b = bucketOf(anchorOf(rec));
            const keys = buckets.get(b);
            keys?.delete(rec.key);
            if (keys?.size === 0) buckets.delete(b);
            if (buckets.size === 0) byTaskBucket.delete(rec.taskId);
        }
        runningKeys.delete(rec.key);
    };

    const nearest = (keys, triggeredAt, filter) => {
        let best = null;
        let bestDiff = Infinity;
        for (const key of keys || []) {
            const rec = records.get(key);
            if (!rec || (filter && !filter(rec))) continue;
            const diff = Math.abs(anchorOf(rec) - (triggeredAt ?? 0));
            if (diff < bestDiff) {
                best = rec;
                bestDiff = diff;
            }
        }
        return { rec: best, diff: bestDiff };
    };

    // Keys of a task's records whose anchor time may be within the tolerance of a time
    const candidatesNear = (taskId, t) => {
        const buckets = byTaskBucket.get(taskId);
        if (!buckets) return [];
        const b = bucketOf(t);
        return [b - 1, b, b + 1].flatMap((x) => [...(buckets.get(x) || [])]);
    };

    // Find the stored record describing the same execution as the incoming one
    const findMatch = (incoming) => {
        if (incoming.resultId && byResultId.has(incoming.resultId)) {
            return records.get(byResultId.get(incoming.resultId));
        }
        if (incoming.executionId && byExecutionId.has(incoming.executionId)) {
            const { rec } = nearest(byExecutionId.get(incoming.executionId), incoming.triggeredAt ?? incoming.startedAt);
            if (rec && (!rec.resultId || !incoming.resultId)) return rec;
        }
        const anchor = incoming.triggeredAt ?? incoming.startedAt;
        if (anchor !== null && anchor !== undefined) {
            // Records with ids of their own only match an incoming record without ids, and vice versa
            const { rec, diff } = nearest(
                candidatesNear(incoming.taskId, anchor),
                anchor,
                (r) => !(r.resultId && incoming.resultId) && !(r.executionId && incoming.executionId)
            );
            if (rec && diff <= matchToleranceMs) return rec;
        }
        return null;
    };

    const store = (rec) => {
        records.set(rec.key, rec);
        index(rec);
        changedKeys.add(rec.key);
        removedKeys.delete(rec.key);
    };

    const remove = (key) => {
        const rec = records.get(key);
        if (!rec) return;
        unindex(rec);
        records.delete(key);
        changedKeys.delete(key);
        removedKeys.add(key);
    };

    // Evict down to 95 % of the cap in one go, so that a store at the cap does not sort all records on every update
    const evict = () => {
        if (records.size <= maxRecords) return;
        const target = maxRecords - Math.floor(maxRecords * 0.05);
        const finished = [...records.values()]
            .filter((r) => isTerminalStatus(r.status))
            .sort((a, b) => (a.stoppedAt ?? 0) - (b.stoppedAt ?? 0));
        for (const rec of finished.slice(0, records.size - target)) {
            evictedUntil = Math.max(evictedUntil ?? -Infinity, rec.stoppedAt ?? anchorOf(rec));
            remove(rec.key);
        }
    };

    /**
     * Add or update records from one source.
     *
     * @param {Array<object>} incoming - Normalised records.
     * @param {string} sourceId - Source id, see SOURCE in defaults.js.
     * @returns {number} Number of records that were added or changed.
     */
    const upsertMany = (incoming, sourceId) => {
        let changes = 0;
        for (const rec of incoming) {
            if (!rec || !rec.taskId) continue;
            const existing = findMatch(rec);
            if (!existing) {
                const fresh = { ...rec };
                fresh.key = recordKey(fresh);
                store(fresh);
                changes += 1;
                continue;
            }
            const { merged, changed, conflict } = mergeRecords(existing, rec, sourceId);
            if (conflict) conflicts.set(sourceId, (conflicts.get(sourceId) ?? 0) + 1);
            if (!changed) continue;

            // Keys follow the best id known, so ids learnt later re-key the record
            const newKey = recordKey(merged);
            if (newKey !== existing.key) {
                remove(existing.key);
                merged.key = newKey;
            } else {
                unindex(existing);
            }
            store(merged);
            changes += 1;
        }
        if (changes > 0) {
            evict();
            rev += 1;
        }
        return changes;
    };

    /**
     * Drop records that ended before a point in time, e.g. when the history window moves on.
     *
     * @param {number} before - Records with stoppedAt before this are removed.
     * @returns {number} Number of records removed.
     */
    const pruneBefore = (before) => {
        let n = 0;
        for (const rec of [...records.values()]) {
            if (rec.stoppedAt !== null && rec.stoppedAt !== undefined && rec.stoppedAt < before) {
                remove(rec.key);
                n += 1;
            }
        }
        if (n > 0) rev += 1;
        return n;
    };

    /**
     * Get and reset the keys changed and removed since the last call. Used for live updates.
     *
     * @returns {{rev: number, changed: string[], removed: string[]}} Changes.
     */
    const drainChanges = () => {
        const out = { rev, changed: [...changedKeys], removed: [...removedKeys] };
        changedKeys = new Set();
        removedKeys = new Set();
        return out;
    };

    return {
        upsertMany,
        pruneBefore,
        drainChanges,
        get: (key) => records.get(key),
        all: () => [...records.values()],
        // Records that have not stopped yet, without scanning all records
        running: () => [...runningKeys].map((k) => records.get(k)).filter(Boolean),
        size: () => records.size,
        rev: () => rev,
        conflicts: (sourceId) => conflicts.get(sourceId) ?? 0,
        // Executions that ended before this time may have been evicted (null: nothing evicted)
        evictedUntil: () => evictedUntil,
    };
}
