import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
    HISTORY_HEARTBEAT_MS,
    HISTORY_LOCK_STALE_MS,
    HISTORY_MAX_PENDING_LINES,
    HISTORY_READ_MARGIN_MS,
    SOURCE,
    SOURCE_BIT,
} from '../defaults.js';
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
 * The writer holds the lock file .lock: { pid, host, token, since }, its process, its computer and a random token that
 * tells its lock from any other, also from one with the same process id in another container. The writer refreshes the
 * lock's modification time every HISTORY_HEARTBEAT_MS. A lock is stale, and taken over, when it comes from this
 * computer and its process no longer runs, or when it has not been refreshed for HISTORY_LOCK_STALE_MS, whatever its
 * process id: a writer on another computer sharing the directory, or a process id reused after a crash. When opening,
 * a lock with this computer's name and this very process id is stale too, see isStale(). A store without the lock,
 * opened read-only or taken over since, tries to take it on every heartbeat, and once it has, writes (onWritable).
 *
 * Lines that cannot be written stay queued for the next flush. Once a write has failed, up to maxPendingLines more are
 * queued until one succeeds; past that the store stops writing until it is opened again, rather than drop some lines:
 * a coverage line written later would claim the time of executions that were dropped. Lines queued while writing
 * works are always written, however many, e.g. at the first start on a large site.
 *
 * @param {object} param - Parameters.
 * @param {string} param.dir - Base directory, e.g. ~/.ctrl-q/task-history.
 * @param {string} param.host - Sense host; becomes a sub directory.
 * @param {string|null} param.clusterId - Sense service cluster id. Files from another cluster are ignored.
 * @param {number} param.retentionDays - Daily files older than this are deleted when the store is opened.
 * @param {object} param.logger - Winston-style logger.
 * @param {Function} [param.now] - Clock, for tests. Also the clock of the lock's heartbeat.
 * @param {Function} [param.pidAlive] - (pid) => boolean, for tests.
 * @param {number} [param.pid] - Process id written to the lock file, for tests.
 * @param {string} [param.hostname] - Name of this computer written to the lock file, for tests.
 * @param {number} [param.maxPendingLines] - Most lines queued while writes fail, for tests.
 * @param {Function} [param.onWritable] - Called when a store without the lock has taken it over from an instance that
 *   stopped: it writes from then on.
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
    hostname: ownHost = os.hostname(),
    maxPendingLines = HISTORY_MAX_PENDING_LINES,
    onWritable = () => {},
}) {
    const hostDir = path.join(dir, hostSlug(host));
    const lockPath = path.join(hostDir, LOCK_FILE);
    let mode = 'closed';
    let message = '';
    let pending = [];
    // Flushes run one at a time; close() waits for the last one
    let flushChain = Promise.resolve(0);
    // The write lock is this store's to release, whatever became of the mode since it was taken
    let ownsLock = false;
    const token = crypto.randomBytes(8).toString('hex');
    let heartbeat = null;
    // A heartbeat under way, which close() waits for
    let beating = null;
    // An open() under way, which close() waits for: it may be about to take the lock
    let opening = null;
    let lastWriteError = '';
    // Lines queued since a write failed, or null while writes succeed: the backlog maxPendingLines limits
    let backlog = null;
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
        const t = new Date(now());
        await fs.writeFile(tmp, JSON.stringify({ pid: ownPid, host: ownHost, token, since: t.toISOString() }));
        try {
            // The first heartbeat, on the clock of later ones
            await fs.utimes(tmp, t, t);
            await fs.link(tmp, lockPath);
            return true;
        } catch (err) {
            if (err.code === 'EEXIST') return false;
            throw err;
        } finally {
            await fs.rm(tmp, { force: true });
        }
    };

    // A lock's holder, and when it last refreshed the lock. Null if there is no lock.
    const readLock = async (file) => {
        let raw;
        let stat;
        try {
            raw = await fs.readFile(file, 'utf8');
            stat = await fs.stat(file);
        } catch (err) {
            if (err.code === 'ENOENT') return null;
            throw err;
        }
        let holder = null;
        try {
            holder = JSON.parse(raw);
        } catch {
            // Not a lock written by Ctrl-Q: only its heartbeat tells whether its writer still runs
        }
        return { raw, pid: holder?.pid, host: holder?.host, token: holder?.token, heartbeatAt: stat.mtimeMs };
    };

    // When opening, a lock with this computer's name and this process id, but not this store's token, is from a crashed
    // earlier run: one process holds at most one lock. That is how a container restarted at once finds the lock it left
    // (same host name, process 1). Not later on: by then such a lock can only be another instance with the same name and
    // process id (two such containers), and taking it back at every heartbeat would make the two take turns writing.
    const isStale = (lock, { opening = false } = {}) =>
        now() - lock.heartbeatAt > HISTORY_LOCK_STALE_MS ||
        (lock.host === ownHost &&
            ((opening && lock.pid === ownPid && lock.token !== token) ||
                !(Number.isInteger(lock.pid) && lock.pid > 0 && pidAlive(lock.pid))));

    // Take the lock. Returns { taken }, the lock that is in the way if not, and the stale lock it replaced, if any.
    const acquireLock = async ({ opening = false } = {}) => {
        if (await tryCreateLock()) return { taken: true };
        const held = await readLock(lockPath);
        if (!held) return { taken: await tryCreateLock() };
        if (!isStale(held, { opening })) return { taken: false, holder: held };

        // A stale lock. Move it aside under a unique name, so that of several instances taking it over at the same time
        // only one succeeds; the others then find the new lock.
        const aside = path.join(hostDir, `.lock-stale-${ownPid}-${crypto.randomBytes(4).toString('hex')}`);
        try {
            await fs.rename(lockPath, aside);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            return { taken: await tryCreateLock() };
        }
        const moved = await readLock(aside);
        if (moved && moved.raw !== held.raw && !isStale(moved)) {
            // Another instance took the stale lock over first, and this one moved its new lock aside: put it back
            await fs.link(aside, lockPath).catch(() => {});
            await fs.rm(aside, { force: true });
            return { taken: false, holder: moved };
        }
        await fs.rm(aside, { force: true });
        return { taken: await tryCreateLock(), stale: held };
    };

    // Delete the lock if it is still this store's: another instance may have taken it over (see beat()). Done once per
    // open(); later calls wait for the same release.
    let releasing = null;
    const releaseLock = () => {
        releasing ??= (async () => {
            clearInterval(heartbeat);
            await beating;
            if (!ownsLock) return;
            ownsLock = false;
            const lock = await readLock(lockPath).catch(() => null);
            if (lock?.token === token) await fs.rm(lockPath, { force: true });
        })();
        return releasing;
    };

    // " (process 1234 on some-host)", or nothing for a lock that does not say
    const holderName = (lock) => (lock?.host ? ` (process ${lock.pid} on ${lock.host})` : '');
    // The instance whose lock kept this store read-only, as last seen
    let lastHolder = null;

    // Take the lock over once the instance holding it has stopped (its lock is gone or stale): this store writes from
    // then on. The files may have changed meanwhile, also their last line, so they are looked at again before writing.
    const takeOver = async () => {
        // While that instance runs, only read its lock: taking it would write a temporary file every heartbeat
        const held = await readLock(lockPath);
        if (held && !isStale(held)) {
            lastHolder = held;
            return;
        }
        const { taken, holder, stale } = await acquireLock();
        if (!taken) {
            lastHolder = holder ?? lastHolder;
            return;
        }
        ownsLock = true;
        mode = 'readwrite';
        backlog = null;
        lastWriteError = '';
        fileState.clear();
        message = `the Ctrl-Q instance that was writing this history${holderName(stale ?? lastHolder)} has stopped; this one writes it from now on`;
        logger.info(`History file: ${message}`);
        onWritable();
    };

    // Refresh the lock, and notice when another instance has taken it over. That can happen after this process was
    // paused for longer than HISTORY_LOCK_STALE_MS, e.g. on a sleeping laptop: the other instance took the lock for
    // stale, and writes from then on. Without the lock, try to take it over instead.
    const beat = async () => {
        if (!ownsLock) {
            if (mode === 'readonly') await takeOver();
            return;
        }
        const lock = await readLock(lockPath);
        if (!ownsLock) return;
        if (lock?.token === token) {
            const t = new Date(now());
            await fs.utimes(lockPath, t, t);
            return;
        }
        // Deleted by hand while this instance runs: take it again
        if (!lock && (await tryCreateLock())) return;
        ownsLock = false;
        lastHolder = lock;
        if (mode === 'readwrite') {
            mode = 'readonly';
            pending = [];
            backlog = null;
            message = `another Ctrl-Q instance took over writing this history while this one was not responding (see ${lockPath}); read-only from now on`;
            logger.warn(`History file: ${message}`);
        }
    };

    /**
     * Refresh the lock now, or try to take it over, see beat(). The store does this every HISTORY_HEARTBEAT_MS by itself.
     *
     * @returns {Promise<void>} Resolves when done.
     */
    const heartbeatNow = () => {
        if (!beating) {
            beating = beat()
                .catch((err) => logger.verbose(`History file: could not refresh ${lockPath}: ${err.message}`))
                .finally(() => {
                    beating = null;
                });
        }
        return beating;
    };

    // Why the store opened read-only, and what to do about a lock left behind
    const readOnlyMessage = (holder) => {
        const minutes = Math.round(HISTORY_LOCK_STALE_MS / 60000);
        return (
            `another Ctrl-Q instance is writing this history${holderName(holder)}; opened read-only. Delete ${lockPath} if that ` +
            `instance is no longer running; Ctrl-Q also takes over a lock that has not been refreshed for ${minutes} minutes.`
        );
    };

    // Oldest day kept: files of earlier days are deleted, and records of earlier days are not written
    const retentionCutoffDay = () => utcDay(now() - retentionDays * DAY_MS);
    const retentionCutoffMs = () => Date.parse(`${retentionCutoffDay()}T00:00:00.000Z`);

    // Cutoff day of the last expiry run that deleted every expired file
    let expiredBefore = null;
    // Expired files that could not be deleted: warned about once, and tried again at every prune
    const undeletable = new Set();

    const deleteExpired = async () => {
        const cutoff = retentionCutoffDay();
        let deleted = 0;
        for (const name of await fs.readdir(hostDir)) {
            const m = FILE_RE.exec(name);
            if (!m || m[1] >= cutoff) continue;
            try {
                await fs.rm(path.join(hostDir, name), { force: true });
                fileState.delete(name);
                undeletable.delete(name);
                deleted += 1;
            } catch (err) {
                // E.g. EBUSY or EPERM on Windows, while a virus scanner, the search indexer or OneDrive has it open
                if (!undeletable.has(name)) logger.warn(`History file: cannot delete expired ${name} (${err.message}), trying again later`);
                undeletable.add(name);
            }
        }
        expiredBefore = undeletable.size ? null : cutoff;
        return deleted;
    };

    /**
     * Delete expired daily files again once the retention cutoff has moved on to a new day, for instances that keep
     * running for days, or when a file could not be deleted last time.
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
    const open = () => {
        // A store opened again releases the lock it takes now, not the one of the previous open()
        releasing = null;
        opening = (async () => {
            try {
                await fs.mkdir(hostDir, { recursive: true });
                const { taken, holder } = await acquireLock({ opening: true });
                if (taken) {
                    ownsLock = true;
                    mode = 'readwrite';
                } else {
                    mode = 'readonly';
                    lastHolder = holder ?? (await readLock(lockPath).catch(() => null));
                    message = readOnlyMessage(lastHolder);
                }
                // Keeps the lock alive, or takes it over once its holder has stopped, see beat()
                clearInterval(heartbeat);
                heartbeat = setInterval(heartbeatNow, HISTORY_HEARTBEAT_MS);
                heartbeat.unref?.();
                if (taken) {
                    const deleted = await deleteExpired();
                    message = deleted ? `deleted ${deleted} expired daily file(s)` : '';
                }
            } catch (err) {
                mode = 'error';
                message = `cannot use history directory ${hostDir}: ${err.message}`;
                await releaseLock().catch(() => {});
            }
            return { mode, message };
        })();
        return opening;
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
     * @returns {Promise<object>} { records, signatures, tasks: Map, coverage: { global: [[from, to]], tasks: Map<taskId,
     *   [[from, to]]> }, skippedLines, ignoredFiles }. Records are those overlapping the range; signatures (key ->
     *   signature, see recordSignature()) cover every record read, also those of the days read before the range.
     *   Coverage ranges are merged and clipped to what the files can actually hold.
     */
    const load = async (from, to) => {
        const result = {
            records: [],
            signatures: new Map(),
            tasks: new Map(),
            coverage: { global: [], tasks: new Map() },
            skippedLines: 0,
            ignoredFiles: 0,
        };
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
        for (const [key, rec] of byKey) result.signatures.set(key, recordSignature(rec));
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
        if (mode !== 'readwrite') return;
        if (backlog !== null) {
            if (backlog >= maxPendingLines) {
                mode = 'error';
                const reason = lastWriteError ? ` (${lastWriteError})` : '';
                message = `stopped writing to ${hostDir} until Ctrl-Q is restarted: ${pending.length} lines could not be written${reason}`;
                pending = [];
                backlog = null;
                logger.warn(`History file: ${message}`);
                // Another instance may write instead
                releaseLock().catch(() => {});
                return;
            }
            backlog += 1;
        }
        pending.push({ day, line: JSON.stringify(obj) });
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

    // Coverage lines start at the retention cutoff at the latest. Executions before it are not written (see
    // appendRecords), so a line claiming that time would, once --history-retention-days is raised, make the time of
    // those executions look covered and idle.
    const coveredFrom = (from) => Math.max(from, retentionCutoffMs());

    /**
     * Queue the coverage ranges of a QRS snapshot: for each task, all its executions from `from` until `to` are known.
     * Written as one line, however many tasks there are. Ranges start at the retention cutoff at the latest.
     *
     * @param {Map<string, number>|Array<[string, number]>} fromByTask - Task id -> start of its known range.
     * @param {number} to - End of all ranges, e.g. the snapshot time.
     */
    const appendCoverage = (fromByTask, to) => {
        const tasks = {};
        for (const [taskId, from] of fromByTask) {
            if (to > coveredFrom(from)) tasks[taskId] = coveredFrom(from);
        }
        if (Object.keys(tasks).length) queue(utcDay(to), { t: 'covs', to, tasks });
    };

    /**
     * Queue a range in which Ctrl-Q watched all tasks. It starts at the retention cutoff at the latest.
     *
     * @param {number} from - Start.
     * @param {number} to - End.
     */
    const appendObservation = (from, to) => {
        if (to > coveredFrom(from)) queue(utcDay(to), { t: 'obs', from: coveredFrom(from), to });
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
        let first = null;
        try {
            first = content ? JSON.parse(content.slice(0, content.indexOf('\n') >= 0 ? content.indexOf('\n') : undefined)) : null;
        } catch {
            // No readable header; append anyway
        }
        if (first?.v !== undefined && clusterId && first.clusterId && first.clusterId !== clusterId) {
            fileState.set(name, 'foreign');
            return prepareFile(day);
        }
        if (!content?.includes('\n')) {
            // A new file, or one without a single complete line: that is this store's own header, torn by an append
            // that failed part-way (a full disk). Start the file again. Ready only once emptied: if that fails, the next
            // flush must look again, or it would append without a header.
            if (content) await fs.truncate(file, 0);
            fileState.set(name, 'own-ready');
            return { name, prefix: `${header()}\n` };
        }
        fileState.set(name, 'own-ready');
        // A crash, or an append that failed part-way, may have left a torn last line; start ours on a new line so it is
        // not glued onto it
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
        let appending = null;
        try {
            for (const [day, lines] of byDay) {
                const { name, prefix } = await prepareFile(day);
                appending = name;
                await fs.appendFile(path.join(hostDir, name), `${prefix}${lines.join('\n')}\n`, 'utf8');
                appending = null;
                done.add(day);
            }
        } catch (err) {
            // The append may have written part of its lines: look at the file's tail again before the next one
            if (appending) fileState.delete(appending);
            // Keep what was not written, in order, for the next flush (unless the store has stopped writing meanwhile).
            // From now on until a write succeeds, the lines queued count towards the limit.
            if (mode === 'readwrite') {
                pending = [...batch.filter((b) => !done.has(b.day)), ...pending];
                backlog ??= 0;
            }
            lastWriteError = err.message;
            throw err;
        }
        backlog = null;
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
     * Flush and release the write lock, unless another instance has taken it over meanwhile. Also releases a lock that
     * an open() still under way is taking, e.g. when Ctrl-C arrives during start-up.
     *
     * @returns {Promise<void>}
     */
    const close = async () => {
        await opening;
        try {
            await flush();
        } finally {
            await releaseLock();
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
        heartbeat: heartbeatNow,
        mode: () => mode,
        message: () => message,
        pending: () => pending.length,
        dir: hostDir,
    };
}
