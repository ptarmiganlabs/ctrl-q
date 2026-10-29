import { validate as uuidValidate } from 'uuid';

import { qrsRequestJson } from '../../util/qseow/qrs-json.js';
import { fromExecutionResult, normalizeNodeName, parseExecutionDetails } from '../normalize/qrs.js';
import { STATUS } from '../model/status.js';

// SchedulerServiceTypeEnum: 0 Master, 1 Slave, 2 MasterAndSlave. Only schedulers that run reloads have capacity.
const RELOADING_SCHEDULER_TYPES = new Set([1, 2]);
// Reading all tasks or all execution results can take minutes on a large site, far longer than the default 60 s
const BULK_TIMEOUT_MS = 5 * 60 * 1000;
// The details of one execution, for the page's details panel, which waits for them
const DETAILS_TIMEOUT_MS = 10 * 1000;

/**
 * Map a task from GET /qrs/task/full to the task-gantt task model.
 *
 * @param {object} t - QRS task (any task type).
 * @returns {object} { id, name, taskType, enabled, appId, appName, stream, tags }.
 */
export function toTaskInfo(t) {
    return {
        id: t.id,
        name: t.name,
        taskType: t.taskType,
        enabled: t.enabled !== false,
        appId: t.app?.id ?? null,
        appName: t.app?.name ?? null,
        stream: t.app?.stream?.name ?? null,
        tags: (t.tags || []).map((tag) => tag.name),
    };
}

/**
 * Map schedulers from GET /qrs/schedulerservice/full to the nodes that run reloads, with their capacity.
 *
 * @param {Array<object>} schedulers - QRS scheduler services.
 * @returns {Array<{nodeName: string, type: number, maxConcurrentEngines: number}>} Reloading scheduler nodes.
 */
export function toSchedulerNodes(schedulers) {
    return (schedulers || [])
        .filter((s) => RELOADING_SCHEDULER_TYPES.has(s.settings?.schedulerServiceType))
        .map((s) => ({
            nodeName: normalizeNodeName(s.serverNodeConfiguration?.hostName),
            type: s.settings.schedulerServiceType,
            maxConcurrentEngines: s.settings.maxConcurrentEngines,
        }));
}

/**
 * Create the QRS history source. QRS is always available and has full detail, but keeps only the last few executions
 * per task (MinNumberOfExecutionResultsToKeepPerTask, default 3 + the current one).
 *
 * @param {object} param - Parameters.
 * @param {object} param.options - Ctrl-Q options (host, auth...).
 * @param {object} param.logger - Winston-style logger.
 * @param {Function} [param.request] - QRS request function, injectable for tests. Defaults to qrsRequestJson.
 * @returns {object} The source.
 */
export function createQrsSource({ options, logger, request = qrsRequestJson }) {
    const get = (path, query, timeoutMs) => request(options, { method: 'get', path, query, ...(timeoutMs ? { timeoutMs } : {}) });
    let taskTypes = new Map();

    /**
     * Load tasks, scheduler capacity and the cluster id.
     *
     * @returns {Promise<{tasks: Array<object>, schedulers: Array<object>, clusterId: string|null}>} Metadata.
     */
    const loadMetadata = async () => {
        const [tasks, schedulers, clusters] = await Promise.all([
            get('/qrs/task/full', undefined, BULK_TIMEOUT_MS),
            get('/qrs/schedulerservice/full', undefined, BULK_TIMEOUT_MS),
            get('/qrs/servicecluster/full', undefined, BULK_TIMEOUT_MS),
        ]);
        const taskInfos = (tasks.data || []).map(toTaskInfo);
        taskTypes = new Map(taskInfos.map((t) => [t.id, t.taskType]));
        return {
            tasks: taskInfos,
            schedulers: toSchedulerNodes(schedulers.data),
            clusterId: clusters.data?.[0]?.id ?? null,
        };
    };

    /**
     * Read all execution results QRS still holds, plus the running execution sessions.
     *
     * @returns {Promise<{records: Array<object>, runningResultIds: Set<string>, serverTime: number, maxModified: number|null, oldestByTask: Map<string, number>}>}
     *   Normalised records, ids of results with a live session, the server's clock, the newest modifiedDate seen
     *   (cursor for polling) and the oldest retained trigger time per task (QRS coverage starts there).
     */
    const snapshot = async () => {
        const [results, sessions] = await Promise.all([
            get('/qrs/executionresult/full', { filter: 'status ne NeverStarted' }, BULK_TIMEOUT_MS),
            get('/qrs/executionsession/full', undefined, BULK_TIMEOUT_MS),
        ]);
        const records = [];
        const oldestByTask = new Map();
        let maxModified = null;
        for (const row of results.data || []) {
            const rec = fromExecutionResult(row, taskTypes);
            if (!rec) continue;
            records.push(rec);
            if (rec.modifiedAt !== null && (maxModified === null || rec.modifiedAt > maxModified)) maxModified = rec.modifiedAt;
            const begin = rec.triggeredAt ?? rec.startedAt;
            if (begin !== null && (!oldestByTask.has(rec.taskId) || begin < oldestByTask.get(rec.taskId))) {
                oldestByTask.set(rec.taskId, begin);
            }
        }
        const runningResultIds = new Set((sessions.data || []).map((s) => s.executionResult?.id).filter(Boolean));
        logger.verbose(`QRS: ${records.length} execution results, ${runningResultIds.size} running sessions`);
        return { records, runningResultIds, serverTime: results.serverDate ?? Date.now(), maxModified, oldestByTask };
    };

    /**
     * Read execution results changed since a cursor (QRS modifiedDate). A small overlap guards against clock skew;
     * the store ignores versions it already has.
     *
     * @param {number} cursor - Epoch ms; results modified after this are returned.
     * @param {number} [overlapMs] - Overlap subtracted from the cursor.
     * @returns {Promise<{records: Array<object>, cursor: number}>} Changed records and the new cursor.
     */
    const changesSince = async (cursor, overlapMs = 5000) => {
        const since = new Date(cursor - overlapMs).toISOString();
        const res = await get('/qrs/executionresult/full', { filter: `modifiedDate gt '${since}'` });
        let next = cursor;
        const records = [];
        for (const row of res.data || []) {
            const rec = fromExecutionResult(row, taskTypes);
            if (!rec) continue;
            records.push(rec);
            if (rec.modifiedAt !== null && rec.modifiedAt > next) next = rec.modifiedAt;
        }
        return { records, cursor: next };
    };

    /**
     * Ids of the execution results that have a running execution session.
     *
     * @returns {Promise<Set<string>>} Result ids.
     */
    const runningResultIds = async () => {
        const res = await get('/qrs/executionsession/full');
        return new Set((res.data || []).map((s) => s.executionResult?.id).filter(Boolean));
    };

    /**
     * Full details (state changes, messages) of one execution result, for the page's details panel.
     *
     * @param {string} resultId - ExecutionResult id.
     * @returns {Promise<{details: Array<object>, scriptLogAvailable: boolean}|null>} Details, or null if not found.
     */
    const executionDetails = async (resultId) => {
        if (!uuidValidate(resultId)) {
            throw new Error('invalid execution result id');
        }
        const res = await get('/qrs/executionresult/full', { filter: `id eq ${resultId}` }, DETAILS_TIMEOUT_MS);
        const row = (res.data || [])[0];
        if (!row) return null;
        return { details: parseExecutionDetails(row.details), scriptLogAvailable: Boolean(row.scriptLogAvailable) };
    };

    return {
        loadMetadata,
        snapshot,
        changesSince,
        runningResultIds,
        executionDetails,
        taskTypes: () => taskTypes,
        isRunningStatus: (status) => status === STATUS.STARTED || status === STATUS.QUEUED || status === STATUS.TRIGGERED,
    };
}
