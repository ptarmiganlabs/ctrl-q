import { createExecutionStore } from './store/execution-store.js';
import { createCoverage } from './store/coverage.js';
import { createHistoryStore, recordSignature, utcDay } from './store/history-store.js';
import { createLaneRegistry } from './model/lanes.js';
import { createQrsSource } from './sources/qrs-source.js';
import { buildSnapshot, buildAnalytics, createNodeTable, encodeLanes, encodeRecords, isStale } from './api/snapshot.js';
import { SOURCE, SOURCE_BIT, HISTORY_READ_MARGIN_MS, MAX_RECORDS } from './defaults.js';
import { qrsRequestJson } from '../util/qseow/qrs-json.js';

// How often the history file records that Ctrl-Q was watching (an { t: 'obs' } line)
const OBSERVATION_WRITE_MS = 5 * 60 * 1000;
// How long a QRS response counts towards the estimate of the Sense clock
const CLOCK_SAMPLE_MS = 10 * 60 * 1000;
// Source states, least serious first
const SEVERITY = ['disabled', 'pending', 'loading', 'ok', 'degraded', 'timeout', 'error'];

/**
 * Create a source status object, shown as a badge on the page.
 *
 * @param {string} id - Source id.
 * @param {string} state - 'disabled', 'pending', 'loading', 'ok', 'degraded', 'error' or 'timeout'.
 * @returns {object} Status.
 */
export function newSourceStatus(id, state) {
    return { id, state, message: '', hint: '', lastOkAt: null, records: 0, coverage: null };
}

/**
 * Resolve --app-tag filters to app ids.
 *
 * @param {object} options - Ctrl-Q options.
 * @param {string[]} appTags - App tag names.
 * @param {Function} request - QRS request function.
 * @returns {Promise<Set<string>>} Ids of apps with any of the tags.
 */
async function appIdsWithTags(options, appTags, request) {
    if (!appTags?.length) return new Set();
    const filter = appTags.map((t) => `tags.name eq '${String(t).replace(/'/g, "''")}'`).join(' or ');
    const res = await request(options, { method: 'get', path: '/qrs/app', query: { filter } });
    return new Set((res.data || []).map((a) => a.id));
}

const taskSignature = (t) => JSON.stringify([t.name, t.taskType, t.appId, t.appName]);

/**
 * Create the task-gantt application state: the execution store, its sources and everything the web page asks for.
 *
 * @param {object} param - Parameters.
 * @param {object} param.config - Command configuration, see validateTaskGanttOptions().
 * @param {object} param.logger - Winston-style logger.
 * @param {Function} [param.now] - This computer's clock. The Sense clock is estimated from it and QRS responses.
 * @param {Function} [param.request] - QRS request function (for tests).
 * @param {number} [param.maxRecords] - Most executions kept in memory (for tests).
 * @returns {object} The app.
 */
export function createGanttApp({ config, logger, now = () => Date.now(), request = qrsRequestJson, maxRecords = MAX_RECORDS }) {
    // Execution times come from the Sense clock, so coverage, the time window and the page's clock use it too. Each QRS
    // response's Date header gives a lower bound for the Sense clock minus this computer's clock: the header has whole
    // seconds and was written before the response arrived. The highest bound of the last few minutes is the estimate,
    // so one slow response does not drag it down, and a clock adjusted on either side is picked up.
    //
    // The header was also written after the request was sent, which gives an upper bound: the lower one plus the
    // header's second plus the round trip. When even that is below the estimate, a clock has been stepped (this
    // computer's forward, or the Sense clock back), and the bounds kept from before the step are void: they would keep
    // coverage and the page's clock ahead of the polls by the step, for minutes. A slow response cannot pass for a step,
    // as its round trip widens its bounds by as much as it lowers the lower one.
    const clockSamples = [];
    let clockOffset = 0;
    const qrsRequest = async (options, req) => {
        const sent = now();
        const res = await request(options, req);
        if (typeof res?.serverDate === 'number') {
            const t = now();
            if (res.serverDate + 1000 - sent < clockOffset) clockSamples.length = 0;
            clockSamples.push([t, res.serverDate - t]);
            while (t - clockSamples[0][0] > CLOCK_SAMPLE_MS) clockSamples.shift();
            clockOffset = Math.max(...clockSamples.map(([, offset]) => offset));
        }
        return res;
    };
    const toServerTime = (t) => t + clockOffset;
    const serverNow = () => toServerTime(now());

    const store = createExecutionStore({ maxRecords });
    const coverage = createCoverage();
    const qrs = createQrsSource({ options: config.qseow, logger, request: qrsRequest });
    const statuses = new Map();
    const nodes = createNodeTable();
    const changedLanes = new Set();
    // Number of lane changes so far, to tell whether a metadata refresh changed any
    let laneChanges = 0;
    // Lanes the pages show, as of the last delta, see drainDelta()
    let shownLanes = new Set();
    // Tasks of live executions that the task metadata does not know yet, e.g. created after start-up: task id -> one
    // of its records. Their lanes wait for an early metadata refresh to tell their name, type and tags.
    const unknownTasks = new Map();
    let lanes = null;
    let filters = null;
    let schedulers = [];
    let runningResultIds = new Set();
    let history = null;
    let clusterId = null;
    let lastRev = 0;
    // Number of node names the page already knows (from the snapshot or earlier deltas)
    let sentNodeCount = 0;
    let liveFrom = null;
    // End of the current live coverage: the time of the latest successful poll
    let liveTo = null;
    let lastObservationWrite = 0;
    // Start and end of the observation lines written for the current live range. They start where the live range does,
    // unless this instance began to write the history file later on, see resumeHistory().
    let observedFrom = null;
    let observedTo = null;
    // Set when the oldest executions had to be evicted from memory; data before it is incomplete
    let incompleteBefore = null;
    // What the history file already holds: record key -> "status:stoppedAt", and task id -> task signature. Used to
    // avoid appending the same lines again on every start.
    const persisted = new Map();
    let persistedTasks = new Map();
    // The tasks of the latest metadata load, and what the history status says about the lines read
    let metaTasks = [];
    let historyNote = '';

    // Problems shown on a source's badge on top of its own state, e.g. failing history writes: source id -> Map(topic ->
    // { state, message, hint }). Kept apart from the state, so that a source resetting its state (the poller, once QRS
    // answers again) cannot erase them, and an issue never hides a more serious state. An issue without a state only
    // adds its message.
    const issues = new Map();
    // True while this instance writes the history file
    let writingHistory = false;
    // True once init() has succeeded. Until then the history store taking its lock over only sets tookOverAtStart.
    let started = false;
    let tookOverAtStart = false;
    let closed = false;

    for (const id of [SOURCE.QRS, SOURCE.HISTORY]) {
        statuses.set(id, newSourceStatus(id, config.sources.includes(id) ? 'pending' : 'disabled'));
        issues.set(id, new Map());
    }

    const setStatus = (id, patch) => {
        Object.assign(statuses.get(id), patch);
    };

    /**
     * Set or clear an issue of a source, see `issues`.
     *
     * @param {string} id - Source id.
     * @param {string} topic - What the issue is about, e.g. 'write'.
     * @param {{state?: string, message: string, hint?: string}|null} issue - The issue, or null when it is over.
     */
    const setIssue = (id, topic, issue) => {
        if (issue) issues.get(id).set(topic, issue);
        else issues.get(id).delete(topic);
    };

    // A source's status as the page shows it: its own state and message, with its issues on top
    const visibleStatus = (status) => {
        const list = [...issues.get(status.id).values()];
        if (!list.length) return status;
        const state = list.reduce((s, i) => (SEVERITY.indexOf(i.state) > SEVERITY.indexOf(s) ? i.state : s), status.state);
        const message = [status.message, ...list.map((i) => i.message)].filter(Boolean).join('; ');
        const hint = [...new Set([status.hint, ...list.map((i) => i.hint)].filter(Boolean))].join(' ');
        return { ...status, state, message, hint };
    };
    const visibleStatuses = () => [...statuses.values()].map(visibleStatus);

    const windowAt = (t) => ({ from: t - config.lookbackMs, to: t });
    const windowNow = () => windowAt(serverNow());

    const upsertLane = (task) => {
        const { lane, changed } = lanes.upsert(task);
        if (changed) {
            changedLanes.add(lane.id);
            laneChanges += 1;
        }
        return lane;
    };

    // Give every task that has executions a lane, also tasks QRS no longer knows (deleted ones)
    const ensureLanesForRecords = (records, historyTasks = new Map()) => {
        for (const rec of records) {
            if (lanes.get(rec.taskId)) continue;
            const known = historyTasks.get(rec.taskId);
            upsertLane({
                id: rec.taskId,
                name: known?.name,
                taskType: rec.taskType ?? known?.taskType,
                appId: rec.appId,
                appName: known?.appName,
                deleted: true,
            });
        }
    };

    // Write executions QRS has seen to the history file, unless already stored unchanged. Executions still running
    // are written too (a later line with the final state replaces them), so the file never claims to cover a period
    // while missing an execution in it.
    const persist = (records) => {
        if (!writingHistory || history.mode() !== 'readwrite') return;
        const fresh = [];
        for (const r of records) {
            const stored = store.get(r.key) ?? r;
            if (!(stored.src & SOURCE_BIT[SOURCE.QRS])) continue;
            const sig = recordSignature(stored);
            if (persisted.get(stored.key) === sig) continue;
            persisted.set(stored.key, sig);
            fresh.push(stored);
        }
        history.appendRecords(fresh);
    };

    // Evicting the oldest executions (memory cap) makes the time before them incomplete: show it as unknown
    const checkEviction = () => {
        const until = store.evictedUntil();
        if (until === null || until === incompleteBefore) return;
        incompleteBefore = until;
        coverage.setCompleteFrom(until);
        // Pages must get the lanes' coverage again, now starting later, or the evicted time looks covered and idle
        for (const lane of lanes.all()) changedLanes.add(lane.id);
        const message = `Too many executions to keep in memory; executions before ${new Date(until).toISOString()} are incomplete. Use a shorter --lookback.`;
        // An issue, so that it neither hides a more serious state nor is reset with the source's own. On the QRS badge
        // only as a message: the page reads the QRS state as the state of live updates, which are fine.
        if (config.sources.includes(SOURCE.HISTORY)) setIssue(SOURCE.HISTORY, 'memory', { state: 'degraded', message });
        else setIssue(SOURCE.QRS, 'memory', { message });
        logger.warn(message);
    };

    const persistTasks = (tasks) => {
        if (!writingHistory || history.mode() !== 'readwrite') return;
        const fresh = tasks.filter((t) => persistedTasks.get(t.id) !== taskSignature(t));
        for (const t of fresh) persistedTasks.set(t.id, taskSignature(t));
        history.appendTasks(fresh);
    };

    // Write the queued history lines. A failing write shows on the history badge until a later one succeeds, and its
    // lines stay queued for it. Once the history store stops writing the badge says so: for good when too many lines
    // were waiting, and until it takes the lock back (resumeHistory()) when another instance took it over. Never
    // rejects: the history file is not essential.
    const flushHistory = async () => {
        if (!writingHistory) return;
        try {
            await history.flush();
            // A flush that succeeds while the store still writes has written the lines that had failed, or one before
            // it has. Not when the store has stopped writing meanwhile: its flushes then resolve without writing.
            if (issues.get(SOURCE.HISTORY).has('write') && history.mode() === 'readwrite') {
                setIssue(SOURCE.HISTORY, 'write', null);
                logger.info('History file: writing again');
            }
        } catch (err) {
            const wasFailing = issues.get(SOURCE.HISTORY).has('write');
            setIssue(SOURCE.HISTORY, 'write', {
                state: 'error',
                message: `cannot write to the history file: ${err.message}`,
                hint: 'Check --history-dir.',
            });
            if (!wasFailing) logger.warn(`History file: ${err.message}. The lines are kept and written once the file works again.`);
        }
        // Not after close(), which ends the writing too
        if (writingHistory && history.mode() !== 'readwrite') {
            writingHistory = false;
            const state = history.mode() === 'readonly' ? 'degraded' : 'error';
            setIssue(SOURCE.HISTORY, 'write', { state, message: history.message(), hint: 'Check --history-dir.' });
        }
    };

    // The history store took the lock over: the instance that wrote the file has stopped. That may be one that had
    // taken it from this one, also before flushHistory() noticed. Write from now on, and what this instance has seen
    // that the file may lack. Observation lines claim only the time from the latest poll on, because the file need not
    // hold every execution of the time before, e.g. the lines dropped when the store lost the lock. For the same reason
    // running executions are written again: the new range includes them.
    const resumeHistory = () => {
        if (closed || history.mode() !== 'readwrite') return;
        writingHistory = true;
        setIssue(SOURCE.HISTORY, 'write', null);
        setStatus(SOURCE.HISTORY, { state: 'ok', message: [history.message(), historyNote].filter(Boolean).join('; '), hint: '' });
        persistTasks(metaTasks);
        for (const rec of store.running()) persisted.delete(rec.key);
        persist(store.all());
        if (liveFrom !== null) {
            observedFrom = liveTo;
            observedTo = null;
        }
        flushHistory();
    };

    // The history file cannot be read. Without knowing what it holds nothing is written to it either, so the store is
    // closed (which releases its lock); the command carries on with QRS alone and what was read before, if anything.
    const historyUnreadable = async (err, state) => {
        writingHistory = false;
        setStatus(SOURCE.HISTORY, {
            state,
            message: `cannot read the history file, so it is not updated: ${err.message}`,
            hint: 'Check --history-dir.',
        });
        logger.warn(`History file: cannot read it, so it is not updated: ${err.message}`);
        await history.close().catch(() => {});
    };

    // Open the history file and load what it holds for the window
    const loadHistory = async (from, to) => {
        setStatus(SOURCE.HISTORY, { state: 'loading' });
        const opened = await history.open();
        if (opened.mode === 'error') {
            setStatus(SOURCE.HISTORY, { state: 'error', message: opened.message, hint: 'Check --history-dir.' });
            logger.warn(`History file: ${opened.message}`);
            return;
        }
        let loaded;
        try {
            loaded = await history.load(from, to);
        } catch (err) {
            await historyUnreadable(err, 'error');
            return;
        }
        // Everything read, also the records of the days before the window: QRS may hold some of those still
        for (const [key, sig] of loaded.signatures) persisted.set(key, sig);
        persistedTasks = new Map([...loaded.tasks].map(([id, t]) => [id, taskSignature({ ...t, id })]));
        store.upsertMany(loaded.records, SOURCE.HISTORY);
        ensureLanesForRecords(loaded.records, loaded.tasks);
        for (const [a, b] of loaded.coverage.global) coverage.addGlobal(a, b);
        for (const [taskId, ranges] of loaded.coverage.tasks) for (const [a, b] of ranges) coverage.addTask(taskId, a, b);
        // Overall span of the history's coverage, for the source badge (a loop: there can be many ranges)
        let covFrom = Infinity;
        let covTo = -Infinity;
        for (const ranges of [loaded.coverage.global, ...loaded.coverage.tasks.values()]) {
            for (const [a, b] of ranges) {
                covFrom = Math.min(covFrom, a);
                covTo = Math.max(covTo, b);
            }
        }
        historyNote = loaded.skippedLines ? `${loaded.skippedLines} unreadable line(s) skipped` : '';
        setStatus(SOURCE.HISTORY, {
            state: opened.mode === 'readonly' ? 'degraded' : 'ok',
            message: [opened.message, historyNote].filter(Boolean).join('; '),
            records: loaded.records.length,
            lastOkAt: serverNow(),
            coverage: covTo > covFrom ? { fromMs: covFrom, toMs: covTo } : null,
        });
        writingHistory = opened.mode === 'readwrite';
        logger.info(`History file: ${loaded.records.length} executions loaded from ${history.dir}`);
    };

    // Write what the QRS snapshot added to the history file
    const persistSnapshot = async (snap, meta, from) => {
        // QRS may still hold results older than the window read above. Learn which of those the file already has,
        // reading only the daily files those results belong to.
        const readFrom = from - HISTORY_READ_MARGIN_MS;
        const olderDays = new Set();
        for (const rec of snap.records) {
            const at = rec.triggeredAt ?? rec.startedAt ?? rec.stoppedAt;
            if (at !== null && at < readFrom && !persisted.has(rec.key)) olderDays.add(utcDay(at));
        }
        if (olderDays.size) {
            try {
                for (const [key, sig] of await history.readSignatures(olderDays)) persisted.set(key, sig);
            } catch (err) {
                // What was loaded for the window is still shown
                await historyUnreadable(err, 'degraded');
                return;
            }
        }
        persistTasks(meta.tasks);
        persist(snap.records);
        history.appendCoverage(snap.oldestByTask, snap.serverTime);
        await flushHistory();
    };

    /**
     * Load metadata, history and the QRS snapshot. Only the QRS metadata and the QRS snapshot are essential; history
     * file errors degrade that source. If init() fails, it releases the history file's lock before it rejects.
     *
     * @returns {Promise<void>}
     */
    const init = async () => {
        // 1. QRS metadata. Without it there is nothing to show.
        setStatus(SOURCE.QRS, { state: 'loading' });
        const meta = await qrs.loadMetadata();
        metaTasks = meta.tasks;
        schedulers = meta.schedulers;
        clusterId = meta.clusterId;
        if (!clusterId) {
            logger.warn(
                'Could not read the Sense cluster id, so history files of another Sense site with the same host name are not detected.'
            );
        }
        filters = { ...config.filters, appIdsFromTags: await appIdsWithTags(config.qseow, config.filters.appTags, qrsRequest) };
        lanes = createLaneRegistry(filters);
        for (const t of meta.tasks) upsertLane(t);
        for (const s of schedulers) nodes.idx(s.nodeName);
        logger.info(`Found ${meta.tasks.length} tasks and ${schedulers.length} reloading scheduler(s)`);

        const { from, to } = windowNow();

        // Not after close(), e.g. on Ctrl-C while the metadata loaded: the lock would never be released
        if (config.sources.includes(SOURCE.HISTORY) && !closed) {
            history = createHistoryStore({
                dir: config.historyDir,
                host: config.qseow.host,
                clusterId,
                retentionDays: config.historyRetentionDays,
                logger,
                now,
                onWritable: () => {
                    if (started) resumeHistory();
                    else tookOverAtStart = true;
                },
            });
        }
        try {
            // 2. Local history file
            if (history) await loadHistory(from, to);

            // 3. QRS execution results
            const snap = await qrs.snapshot();
            runningResultIds = snap.runningResultIds;
            store.upsertMany(snap.records, SOURCE.QRS);
            ensureLanesForRecords(snap.records);
            let oldestQrs = Infinity;
            for (const [taskId, oldest] of snap.oldestByTask) {
                coverage.addTask(taskId, oldest, snap.serverTime);
                oldestQrs = Math.min(oldestQrs, oldest);
            }
            setStatus(SOURCE.QRS, {
                state: 'ok',
                records: snap.records.length,
                lastOkAt: serverNow(),
                coverage: Number.isFinite(oldestQrs) ? { fromMs: oldestQrs, toMs: snap.serverTime } : null,
                message: 'QRS keeps only the last few executions of each task',
            });
            app.cursor = snap.maxModified ?? snap.serverTime;

            if (writingHistory) await persistSnapshot(snap, meta, from);
            checkEviction();

            // Everything so far is in the first snapshot; live deltas start from here
            store.drainChanges();
            changedLanes.clear();
            shownLanes = new Set(lanes.visible().map((l) => l.id));
            lastRev = store.rev();
            sentNodeCount = nodes.names.length;
            if (config.pollIntervalMs > 0) {
                liveFrom = snap.serverTime;
                liveTo = snap.serverTime;
                observedFrom = liveFrom;
            }
            started = true;
            // The store took the lock over while start-up waited for QRS
            if (tookOverAtStart) resumeHistory();
        } catch (err) {
            // The command does not start: let the next one write the history
            await history?.close().catch(() => {});
            throw err;
        }
    };

    /**
     * Apply execution results changed in QRS (from the live poller).
     *
     * @param {Array<object>} records - Normalised QRS records.
     * @returns {number} Number of records added or changed.
     */
    const applyQrsChanges = (records) => {
        if (!records.length) return 0;
        const changes = store.upsertMany(records, SOURCE.QRS);
        // A task the metadata does not know is most likely new, not deleted: wait for its name, type and tags rather
        // than show a "deleted" lane that would also pass --task-type
        for (const rec of records) {
            if (!lanes.get(rec.taskId) && !unknownTasks.has(rec.taskId)) unknownTasks.set(rec.taskId, rec);
        }
        persist(records);
        checkEviction();
        return changes;
    };

    /**
     * Reload task metadata, --app-tag apps and scheduler capacity, e.g. to pick up new, renamed, re-tagged or deleted
     * tasks.
     *
     * @returns {Promise<boolean>} True if any lane or capacity changed.
     */
    const refreshMetadata = async () => {
        // Tasks first seen while the requests are under way wait for the next refresh, unless the answer lists them
        const asked = [...unknownTasks];
        const [meta, appIdsFromTags] = await Promise.all([
            qrs.loadMetadata(),
            appIdsWithTags(config.qseow, config.filters.appTags, qrsRequest),
        ]);
        metaTasks = meta.tasks;
        const lanesBefore = laneChanges;
        const before = JSON.stringify(schedulers);
        schedulers = meta.schedulers;
        for (const s of schedulers) nodes.idx(s.nodeName);
        // Apps tagged or untagged since the last refresh change the lanes --app-tag shows
        filters.appIdsFromTags = appIdsFromTags;
        for (const t of meta.tasks) upsertLane(t);
        // Tasks QRS no longer lists were deleted while Ctrl-Q runs. With the loop above, this also applies the new app tags
        // to every lane.
        const known = new Set(meta.tasks.map((t) => t.id));
        for (const lane of lanes.all()) {
            if (!known.has(lane.id)) upsertLane({ ...lane, deleted: true });
        }
        // Tasks of live executions that QRS does not know either: lanes as for deleted tasks
        for (const [taskId, rec] of asked) {
            unknownTasks.delete(taskId);
            ensureLanesForRecords([rec]);
        }
        for (const taskId of unknownTasks.keys()) {
            if (lanes.get(taskId)) unknownTasks.delete(taskId);
        }
        persistTasks(meta.tasks);
        // Keep memory bounded when Ctrl-Q runs for a long time
        store.pruneBefore(windowNow().from - HISTORY_READ_MARGIN_MS);
        for (const key of persisted.keys()) {
            if (!store.get(key)) persisted.delete(key);
        }
        await history?.pruneExpired().catch((err) => logger.warn(`History file: ${err.message}`));
        return laneChanges > lanesBefore || before !== JSON.stringify(schedulers);
    };

    // Write the current live range to the history file, if it grew since the last line. It ends at the latest successful
    // poll: what happened after that was not seen, e.g. during an outage or after live updates stopped.
    const writeObservation = () => {
        if (!writingHistory || observedFrom === null || liveTo <= (observedTo ?? observedFrom)) return;
        history.appendObservation(observedFrom, liveTo);
        observedTo = liveTo;
    };

    /**
     * Record that Ctrl-Q has been watching QRS without interruption until a poll.
     *
     * @param {number} t - When the latest successful poll asked QRS, on this computer's clock.
     */
    const markLive = (t) => {
        if (liveFrom === null) return;
        // On the Sense clock, and never backwards: its estimate can move a little
        liveTo = Math.max(liveTo, toServerTime(t));
        coverage.setLive(liveFrom, liveTo);
        setStatus(SOURCE.QRS, { lastOkAt: liveTo });
        if (liveTo - lastObservationWrite >= OBSERVATION_WRITE_MS) {
            writeObservation();
            lastObservationWrite = liveTo;
        }
        flushHistory();
    };

    /**
     * End the current live coverage range at the last successful poll, after an outage, and start a new one.
     *
     * @param {number} t - When the poll that ended the outage asked QRS, on this computer's clock.
     */
    const breakLiveCoverage = (t) => {
        if (liveFrom === null) return;
        coverage.addGlobal(liveFrom, liveTo);
        writeObservation();
        coverage.setLive(null);
        liveFrom = Math.max(liveTo, toServerTime(t));
        liveTo = liveFrom;
        observedFrom = liveFrom;
        observedTo = null;
    };

    /**
     * State of live updates, sent to the page after every poll. The page adds the range from `from` to `coveredTo` to the
     * coverage of every lane and treats time after it as unknown. It reloads its snapshot when `from` changes (coverage
     * was split by an outage, or executions evicted from memory reach into it) or `rev` is ahead of it (missed deltas).
     * Times are on the Sense clock; the page sets its own clock from `now`.
     *
     * @returns {object} { rev, now, from, coveredTo, qrs: { state, message, lastOkAt }, staleKeys }.
     */
    const liveStatus = () => {
        const t = serverNow();
        const { state, message, lastOkAt } = visibleStatus(statuses.get(SOURCE.QRS));
        // Runs that turned stale since they were sent, e.g. their engine session vanished
        const staleKeys = [];
        for (const r of store.running()) {
            if (lanes?.get(r.taskId)?.visible && isStale(r, runningResultIds, t)) staleKeys.push(r.key);
        }
        // Time before the executions kept in memory is unknown, also within the live range (see checkEviction()). The
        // history file holds those executions, so its observation lines keep the whole range.
        const completeFrom = coverage.completeFrom();
        const from = liveFrom === null || completeFrom === null ? liveFrom : Math.max(liveFrom, completeFrom);
        return { rev: store.rev(), now: t, from, coveredTo: liveTo, qrs: { state, message, lastOkAt }, staleKeys };
    };

    const visibleLaneMap = () => new Map(lanes.visible().map((l) => [l.id, l.idx]));

    /**
     * Changes since the previous call, for the live update stream. A lane that turned visible comes with all its
     * executions, which earlier deltas left out while it was hidden or unknown.
     *
     * A lane that turned hidden cannot be taken off the pages: a delta only adds or updates lanes. The pages load a fresh
     * snapshot instead, because such a delta skips a revision: its prevRev is ahead of every page's revision, which
     * pages take for missed deltas.
     *
     * @returns {object} { rev, prevRev, cols, removed, lanes, nodes } where lanes holds new/changed visible lanes.
     */
    const drainDelta = () => {
        const laneList = [...changedLanes].map((id) => lanes.get(id)).filter(Boolean);
        changedLanes.clear();
        const shown = new Set(laneList.filter((l) => l.visible && !shownLanes.has(l.id)).map((l) => l.id));
        const resync = laneList.some((l) => !l.visible && shownLanes.has(l.id));
        for (const l of laneList) {
            if (l.visible) shownLanes.add(l.id);
            else shownLanes.delete(l.id);
        }
        // A revision no page has seen, see above
        const prevRev = resync ? store.bumpRev() : lastRev;
        if (resync) store.bumpRev();

        const { rev, changed, removed } = store.drainChanges();
        const t = serverNow();
        const { from, to } = windowAt(t);
        const keys = new Set(changed);
        if (shown.size) {
            for (const r of store.all()) if (shown.has(r.taskId)) keys.add(r.key);
        }
        const records = [...keys].map((k) => store.get(k)).filter(Boolean);
        const cols = encodeRecords(records, { laneByTask: visibleLaneMap(), nodeIdx: nodes.idx, runningResultIds, from, now: t });
        const visibleChanged = laneList.filter((l) => l.visible);
        const delta = {
            rev,
            prevRev,
            cols,
            removed,
            lanes: encodeLanes(visibleChanged, coverage, from, to),
            nodes: nodes.names.length !== sentNodeCount ? [...nodes.names] : undefined,
        };
        lastRev = rev;
        sentNodeCount = nodes.names.length;
        return delta;
    };

    const analyticsParams = () => {
        const t = serverNow();
        return {
            records: store.all(),
            lanes,
            schedulers,
            runningResultIds,
            window: windowAt(t),
            now: t,
            completeFrom: coverage.completeFrom(),
        };
    };

    /**
     * Analytics and source statuses for the live update stream.
     *
     * @returns {object} { rev, window, analytics, sources, capacity }.
     */
    const analyticsPayload = () => {
        const params = analyticsParams();
        return {
            rev: store.rev(),
            window: params.window,
            analytics: buildAnalytics(params),
            sources: visibleStatuses(),
            capacity: { nodes: schedulers.map((s) => ({ name: s.nodeName, maxConcurrentEngines: s.maxConcurrentEngines })) },
        };
    };

    /**
     * Build the page snapshot for the current window.
     *
     * @returns {object} Snapshot.
     */
    const snapshot = () =>
        buildSnapshot({
            ...analyticsParams(),
            coverage,
            sources: visibleStatuses(),
            live: config.pollIntervalMs > 0 ? { ...liveStatus(), pollIntervalMs: config.pollIntervalMs } : null,
            rev: store.rev(),
            nodes,
        });

    /**
     * Details for one execution: the stored record, plus the QRS state changes and messages if it came from QRS. If QRS
     * cannot give those, the record is still returned, with qrs null and the reason in qrsError.
     *
     * @param {string} key - Record key.
     * @returns {Promise<object|null>} { record, task, qrs, qrsError? }, or null if the key is unknown.
     */
    const executionDetails = async (key) => {
        const rec = store.get(key);
        if (!rec) return null;
        const lane = lanes.get(rec.taskId);
        let qrsDetails = null;
        let qrsError = null;
        if (rec.resultId && rec.src & SOURCE_BIT[SOURCE.QRS]) {
            try {
                qrsDetails = await qrs.executionDetails(rec.resultId);
            } catch (err) {
                qrsError = `The details of this execution could not be read from QRS: ${err.reason ?? err.message}`;
                logger.warn(`Execution details: ${err.message}`);
            }
        }
        return {
            record: rec,
            task: lane ? { id: lane.id, name: lane.name, appName: lane.appName, stream: lane.stream } : null,
            qrs: qrsDetails,
            ...(qrsError ? { qrsError } : {}),
        };
    };

    /**
     * Record the final observation range (up to the last successful poll), flush the history file and release its lock.
     *
     * @returns {Promise<void>}
     */
    const close = async () => {
        writeObservation();
        closed = true;
        writingHistory = false;
        if (history) await history.close();
    };

    const app = {
        init,
        snapshot,
        analyticsPayload,
        drainDelta,
        executionDetails,
        applyQrsChanges,
        refreshMetadata,
        markLive,
        breakLiveCoverage,
        liveStatus,
        close,
        store,
        coverage,
        qrs,
        cursor: null,
        lanes: () => lanes,
        statuses: visibleStatuses,
        setStatus,
        setIssue,
        // True while live executions wait for the task metadata to know their task (see applyQrsChanges())
        metadataWanted: () => unknownTasks.size > 0,
        history: () => history,
        hasRunning: () => store.running().some((r) => !isStale(r, runningResultIds, serverNow())),
        setRunningResultIds: (ids) => {
            runningResultIds = ids;
        },
    };
    return app;
}
