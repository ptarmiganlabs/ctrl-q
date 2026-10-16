import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { HISTORY_READ_MARGIN_MS, SOURCE, SOURCE_BIT } from '../defaults.js';
import { recordKey } from '../model/execution-record.js';
import { mergeIntervals } from '../shared/sweep.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Daily files: 2026-10-06.ndjson, or 2026-10-06.<cluster>.ndjson when a same-day file belongs to another cluster
const FILE_RE = /^(\d{4}-\d{2}-\d{2})(?:\.([a-z0-9-]+))?\.ndjson$/;
const LOCK_FILE = '.lock';

/**
 * Turn a host name into a safe directory name.
 *
 * @param {string} host - Sense host name.
 * @returns {string} Directory name.
 */
export function hostSlug(host) {
    return (
        String(host || 'unknown')
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, '_')
            .replace(/^\.+/, '_') || 'unknown'
    );
}

/**
 * UTC calendar day of a time, e.g. '2026-10-06'.
 *
 * @param {number} ms - Epoch milliseconds.
 * @returns {string} Day.
 */
export function utcDay(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Convert an execution record to a compact history line.
 *
 * @param {object} rec - Execution record.
 * @returns {object} Line object.
 */
export function recordToLine(rec) {
    return {
        t: 'r',
        r: rec.resultId,
        x: rec.executionId,
        task: rec.taskId,
        tt: rec.taskType,
        app: rec.appId,
        n: rec.nodeName,
        s: rec.status,
        tr: rec.triggeredAt,
        q: rec.queuedAt,
        st: rec.startedAt,
        sp: rec.stoppedAt,
        fi: rec.finishedAt,
        fr: rec.failureReason,
    };
}

/**
 * Convert a history line back to an execution record.
 *
 * @param {object} line - Line object with t === 'r'.
 * @returns {object|null} Execution record, or null if the line is incomplete.
 */
export function lineToRecord(line) {
    if (!line || !line.task || typeof line.s !== 'number') {
        return null;
    }
    const rec = {
        resultId: line.r ?? null,
        executionId: line.x ?? null,
        taskId: line.task,
        taskType: line.tt ?? null,
        appId: line.app ?? null,
        nodeName: line.n ?? '',
        status: line.s,
        triggeredAt: line.tr ?? null,
        queuedAt: line.q ?? null,
        startedAt: line.st ?? null,
        stoppedAt: line.sp ?? null,
        finishedAt: line.fi ?? null,
        failureReason: line.fr ?? null,
        src: SOURCE_BIT[SOURCE.HISTORY],
        confidence: 'exact',
        modifiedAt: null,
    };
    rec.key = recordKey(rec);
    return rec;
}

/**
 * Signature of a record as stored: a record is written again only when its signature changes.
 *
 * @param {object} rec - Execution record.
 * @returns {string} Signature.
 */
export function recordSignature(rec) {
    return `${rec.status}:${rec.stoppedAt}`;
}

const isProcessAlive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        // EPERM: the process exists but belongs to someone else
        return err.code === 'EPERM';
    }
};

/**
 * Create the local history store: append-only daily NDJSON files under <dir>/<host>/YYYY-MM-DD.ndjson.
 *
 * Every file starts with a header line { v, host, clusterId }. Other lines are:
 * - { t: 'r', ... } an execution record (in the file of its trigger day; the last line per execution wins),
 * - { t: 'task', id, name, tt, app, appName } task names, so lanes of deleted tasks can still be labelled,
 * - { t: 'covs', to, tasks: { <taskId>: <from>, ... } } for each task, a range in which all its executions are known
 *   (written once per start, from the QRS snapshot),
 * - { t: 'obs', from, to } a range in which Ctrl-Q watched all tasks live.
 *
 * Coverage is merged when read, so loading stays fast however often Ctrl-Q is started. Only one Ctrl-Q instance
 * writes per host directory; others open the store read-only.
 *
 * @param {object} param - Parameters.
 * @param {string} param.dir - Base directory, e.g. ~/.ctrl-q/task-history.
 * @param {string} param.host - Sense host; becomes a sub directory.
 * @param {string|null} param.clusterId - Sense service cluster id. Files from another cluster are ignored.
 * @param {number} param.retentionDays - Daily files older than this are deleted when the store is opened.
 * @param {object} param.logger - Winston-style logger.
 * @param {Function} [param.now] - Clock, for tests.
 * @param {Function} [param.pidAlive] - (pid) => boolean, for tests.
 * @param {number} [param.pid] - Process id written to the lock file, for tests.
 * @returns {object} The history store.
 */
export function createHistoryStore({
    dir,
    host,
    clusterId,
    retentionDays,
    logger,
    now = () => Date.now(),
    pidAlive = isProcessAlive,
    pid: ownPid = process.pid,
}) {
    const hostDir = path.join(dir, hostSlug(host));
    const lockPath = path.join(hostDir, LOCK_FILE);
    let mode = 'closed';
    let message = '';
    let pending = [];
    // Flushes run one at a time; close() waits for the last one
    let flushChain = Promise.resolve(0);
    // Daily file name -> 'own' (ours, ready for appending) or 'foreign' (belongs to another cluster)
    const fileState = new Map();
    const clusterSuffix = String(clusterId || 'unknown')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 8);

    const header = () => JSON.stringify({ v: 1, host, clusterId });

    // Create the lock file atomically with its content: write a temp file, then hard-link it to the lock name, which
    // fails if the lock already exists. Two instances starting at the same time can therefore not both win.
    const tryCreateLock = async () => {
        const tmp = path.join(hostDir, `.lock-${ownPid}-${crypto.randomBytes(4).toString('hex')}`);
        await fs.writeFile(tmp, String(ownPid));
        try {
            await fs.link(tmp, lockPath);
            return true;
        } catch (err) {
            if (err.code === 'EEXIST') return false;
            throw err;
        } finally {
            await fs.rm(tmp, { force: true });
        }
    };

    const readLockPid = async (file) => Number.parseInt(await fs.readFile(file, 'utf8').catch(() => ''), 10);
    // A lock holder that is running. Our own pid in a lock means a crashed earlier process that had the same pid.
    const isLiveHolder = (pid) => Number.isInteger(pid) && pid > 0 && pid !== ownPid && pidAlive(pid);

    const acquireLock = async () => {
        if (await tryCreateLock()) return true;
        const stalePid = await readLockPid(lockPath);
        if (isLiveHolder(stalePid)) return false;

        // Stale lock from a process that is gone. Move it aside under a unique name, so that of several instances
        // taking it over at the same time only one succeeds; the others then find the new lock.
        const aside = path.join(hostDir, `.lock-stale-${ownPid}-${crypto.randomBytes(4).toString('hex')}`);
        try {
            await fs.rename(lockPath, aside);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            return tryCreateLock();
        }
        const movedPid = await readLockPid(aside);
        if (movedPid !== stalePid && isLiveHolder(movedPid)) {
            // Another instance took the stale lock over first, and this one moved its new lock aside: put it back
            await fs.link(aside, lockPath).catch(() => {});
            await fs.rm(aside, { force: true });
            return false;
        }
        await fs.rm(aside, { force: true });
        return tryCreateLock();
    };

    // Oldest day kept: files of earlier days are deleted, and records of earlier days are not written
    const retentionCutoffDay = () => utcDay(now() - retentionDays * DAY_MS);
    const retentionCutoffMs = () => Date.parse(`${retentionCutoffDay()}T00:00:00.000Z`);

    // Cutoff day of the last expiry run
    let expiredBefore = null;

    const deleteExpired = async () => {
        const cutoff = retentionCutoffDay();
        expiredBefore = cutoff;
        let deleted = 0;
        for (const name of await fs.readdir(hostDir)) {
            const m = FILE_RE.exec(name);
            if (m && m[1] < cutoff) {
                await fs.rm(path.join(hostDir, name), { force: true });
                fileState.delete(name);
                deleted += 1;
            }
        }
        return deleted;
    };

    /**
     * Delete expired daily files again once the retention cutoff has moved on to a new day, for instances that keep
     * running for days.
     *
     * @returns {Promise<number>} Number of files deleted.
     */
    const pruneExpired = async () => {
        if (mode !== 'readwrite' || retentionCutoffDay() === expiredBefore) return 0;
        return deleteExpired();
    };

    /**
     * Open the store: create the directory, take the write lock and delete expired files.
     *
     * @returns {Promise<{mode: string, message: string}>} 'readwrite', 'readonly' (another instance writes) or 'error'.
     */
    const open = async () => {
        try {
            await fs.mkdir(hostDir, { recursive: true });
            if (await acquireLock()) {
                mode = 'readwrite';
                const deleted = await deleteExpired();
                message = deleted ? `deleted ${deleted} expired daily file(s)` : '';
            } else {
                mode = 'readonly';
                message = 'another Ctrl-Q instance is writing this history; opened read-only';
            }
        } catch (err) {
            mode = 'error';
            message = `cannot use history directory ${hostDir}: ${err.message}`;
        }
        return { mode, message };
    };

    const listFiles = async (firstDay, lastDay) =>
        (await fs.readdir(hostDir))
            .filter((n) => {
                const m = FILE_RE.exec(n);
                return m && m[1] >= firstDay && m[1] <= lastDay;
            })
            .sort();

    // Read one daily file. Calls onLine for each line of our cluster. Returns the other cluster's id if the file belongs
    // to another cluster (and then reads no lines), otherwise null.
    const readFile = async (name, onLine, counters) => {
        const lines = (await fs.readFile(path.join(hostDir, name), 'utf8')).split('\n');
        let headerChecked = false;
        for (const raw of lines) {
            if (!raw.trim()) continue;
            let line;
            try {
                line = JSON.parse(raw);
            } catch {
                // Torn line, e.g. after a crash during a write
                counters.skippedLines += 1;
                continue;
            }
            if (!headerChecked) {
                headerChecked = true;
                if (line.v !== undefined) {
                    if (clusterId && line.clusterId && line.clusterId !== clusterId) {
                        fileState.set(name, 'foreign');
                        return String(line.clusterId);
                    }
                    continue;
                }
            }
            onLine(line);
        }
        return null;
    };

    /**
     * Load everything recorded for a time range.
     *
     * @param {number} from - Range start.
     * @param {number} to - Range end.
     * @returns {Promise<object>} { records, tasks: Map, coverage: { global: [[from, to]], tasks: Map<taskId, [[from, to]]> },
     *   skippedLines, ignoredFiles }. Coverage ranges are merged and clipped to what the files can actually hold.
     */
    const load = async (from, to) => {
        const result = { records: [], tasks: new Map(), coverage: { global: [], tasks: new Map() }, skippedLines: 0, ignoredFiles: 0 };
        if (mode === 'error' || mode === 'closed') return result;

        const readFrom = from - HISTORY_READ_MARGIN_MS;
        const byKey = new Map();
        const global = [];
        const perTask = new Map();
        const addTaskRange = (taskId, a, b) => {
            if (!perTask.has(taskId)) perTask.set(taskId, []);
            perTask.get(taskId).push([a, b]);
        };

        for (const name of await listFiles(utcDay(readFrom), utcDay(to))) {
            const foreignCluster = await readFile(
                name,
                (line) => {
                    if (line.t === 'r') {
                        const rec = lineToRecord(line);
                        if (rec) byKey.set(rec.key, rec);
                        else result.skippedLines += 1;
                    } else if (line.t === 'task' && line.id) {
                        result.tasks.set(line.id, {
                            name: line.name,
                            taskType: line.tt ?? null,
                            appId: line.app ?? null,
                            appName: line.appName ?? null,
                        });
                    } else if (line.t === 'covs' && line.tasks && typeof line.to === 'number') {
                        for (const [taskId, a] of Object.entries(line.tasks)) addTaskRange(taskId, a, line.to);
                    } else if (line.t === 'cov' && line.task) {
                        addTaskRange(line.task, line.from, line.to);
                    } else if (line.t === 'obs') {
                        global.push([line.from, line.to]);
                    }
                },
                result
            );
            if (foreignCluster) {
                logger.warn(`History file ${name} belongs to another Sense cluster (${foreignCluster}), ignoring it`);
                result.ignoredFiles += 1;
            } else {
                fileState.set(name, 'own');
            }
        }

        // The files can only vouch for time after the retention cutoff, and only the read window matters
        const lo = Math.max(readFrom, retentionCutoffMs());
        const clip = (ranges) =>
            mergeIntervals(ranges.filter(([a, b]) => b > lo && a < to).map(([a, b]) => [Math.max(a, lo), Math.min(b, to)]));
        result.coverage.global = clip(global);
        for (const [taskId, ranges] of perTask) {
            const merged = clip(ranges);
            if (merged.length) result.coverage.tasks.set(taskId, merged);
        }

        result.records = [...byKey.values()].filter(
            (r) => (r.stoppedAt ?? r.triggeredAt ?? 0) >= from && (r.triggeredAt ?? r.startedAt ?? 0) <= to
        );
        return result;
    };

    /**
     * Signatures of the records stored in the files of some days, to avoid writing them again.
     *
     * @param {Iterable<string>} days - UTC days, e.g. '2026-09-09'.
     * @returns {Promise<Map<string, string>>} Record key -> signature.
     */
    const readSignatures = async (days) => {
        const sigs = new Map();
        if (mode === 'error' || mode === 'closed') return sigs;
        const wanted = new Set(days);
        const counters = { skippedLines: 0 };
        for (const name of (await fs.readdir(hostDir)).filter((n) => wanted.has(FILE_RE.exec(n)?.[1])).sort()) {
            await readFile(
                name,
                (line) => {
                    if (line.t !== 'r') return;
                    const rec = lineToRecord(line);
                    if (rec) sigs.set(rec.key, recordSignature(rec));
                },
                counters
            );
        }
        return sigs;
    };

    const queue = (day, obj) => {
        if (mode === 'readwrite') pending.push({ day, line: JSON.stringify(obj) });
    };

    /**
     * Queue execution records for writing. Records older than the retention period are skipped.
     *
     * @param {Array<object>} records - Execution records.
     */
    const appendRecords = (records) => {
        const cutoff = retentionCutoffDay();
        for (const rec of records) {
            const at = rec.triggeredAt ?? rec.startedAt ?? rec.stoppedAt;
            if (at === null || at === undefined) continue;
            const day = utcDay(at);
            // QRS can hold results older than the retention period; writing them would re-create expired files
            if (day >= cutoff) queue(day, recordToLine(rec));
        }
    };

    /**
     * Queue task names and types.
     *
     * @param {Array<{id: string, name: string, taskType: number, appId: string|null, appName: string|null}>} tasks - Tasks.
     */
    const appendTasks = (tasks) => {
        const day = utcDay(now());
        for (const t of tasks) queue(day, { t: 'task', id: t.id, name: t.name, tt: t.taskType, app: t.appId, appName: t.appName });
    };

    /**
     * Queue the coverage ranges of a QRS snapshot: for each task, all its executions from `from` until `to` are known.
     * Written as one line, however many tasks there are.
     *
     * @param {Map<string, number>|Array<[string, number]>} fromByTask - Task id -> start of its known range.
     * @param {number} to - End of all ranges, e.g. the snapshot time.
     */
    const appendCoverage = (fromByTask, to) => {
        const tasks = {};
        for (const [taskId, from] of fromByTask) {
            if (to > from) tasks[taskId] = from;
        }
        if (Object.keys(tasks).length) queue(utcDay(to), { t: 'covs', to, tasks });
    };

    /**
     * Queue a range in which Ctrl-Q watched all tasks.
     *
     * @param {number} from - Start.
     * @param {number} to - End.
     */
    const appendObservation = (from, to) => {
        if (to > from) queue(utcDay(to), { t: 'obs', from, to });
    };

    // Decide which file a day's lines go to: the day file, unless that belongs to another cluster. Returns the name and
    // what to write before the lines (a header for a new file, a newline after a torn last line).
    const prepareFile = async (day) => {
        let name = `${day}.ndjson`;
        if (fileState.get(name) === 'foreign') name = `${day}.${clusterSuffix}.ndjson`;
        if (fileState.get(name) === 'own-ready') return { name, prefix: '' };

        const file = path.join(hostDir, name);
        let content = null;
        try {
            content = await fs.readFile(file, 'utf8');
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        if (content === null || content.length === 0) {
            fileState.set(name, 'own-ready');
            return { name, prefix: `${header()}\n` };
        }
        let first = null;
        try {
            first = JSON.parse(content.slice(0, content.indexOf('\n') >= 0 ? content.indexOf('\n') : undefined));
        } catch {
            // No readable header; append anyway
        }
        if (first?.v !== undefined && clusterId && first.clusterId && first.clusterId !== clusterId) {
            fileState.set(name, 'foreign');
            return prepareFile(day);
        }
        fileState.set(name, 'own-ready');
        // A crash may have left a torn last line; start ours on a new line so it is not glued onto it
        return { name, prefix: content.endsWith('\n') ? '' : '\n' };
    };

    // Write queued lines to their daily files
    const flushNow = async () => {
        if (mode !== 'readwrite' || pending.length === 0) return 0;
        const batch = pending;
        pending = [];
        const byDay = new Map();
        for (const { day, line } of batch) {
            if (!byDay.has(day)) byDay.set(day, []);
            byDay.get(day).push(line);
        }
        const done = new Set();
        try {
            for (const [day, lines] of byDay) {
                const { name, prefix } = await prepareFile(day);
                await fs.appendFile(path.join(hostDir, name), `${prefix}${lines.join('\n')}\n`, 'utf8');
                done.add(day);
            }
        } catch (err) {
            // Keep what was not written, in order, for the next flush
            pending = [...batch.filter((b) => !done.has(b.day)), ...pending];
            throw err;
        }
        return batch.length;
    };

    /**
     * Write queued lines to their daily files. Calls are serialised, so lines are written in order. A failed write
     * keeps its lines queued for the next flush.
     *
     * @returns {Promise<number>} Number of lines written.
     */
    const flush = () => {
        flushChain = flushChain.catch(() => 0).then(flushNow);
        return flushChain;
    };

    /**
     * Flush and release the write lock.
     *
     * @returns {Promise<void>}
     */
    const close = async () => {
        try {
            await flush();
        } finally {
            if (mode === 'readwrite') await fs.rm(lockPath, { force: true });
            mode = 'closed';
        }
    };

    return {
        open,
        load,
        readSignatures,
        appendRecords,
        appendTasks,
        appendCoverage,
        appendObservation,
        pruneExpired,
        flush,
        close,
        mode: () => mode,
        message: () => message,
        pending: () => pending.length,
        dir: hostDir,
    };
}
