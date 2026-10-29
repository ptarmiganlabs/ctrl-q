import { QRS_NULL_DATE, SOURCE, SOURCE_BIT } from '../defaults.js';
import { isTerminalStatus, STATUS } from '../model/status.js';
import { recordKey } from '../model/execution-record.js';

const NULL_GUID = '00000000-0000-0000-0000-000000000000';
const MAX_FAILURE_REASON = 500;

// QRS execution detail messages, as seen on QSEoW May 2026:
//   "Changing task state to Triggered"
//   "Trying to start task. Sending task to worker scheduler <host>"
//   "Changing task state from Triggered to Queued"
//   "Changing task state from Queued to Started"
//   "Changing task state from Started to FinishedFail"
const RE_TRIGGERED = /^Changing task state to Triggered$/;
const RE_QUEUED = /^Changing task state from \w+ to Queued$/;
const RE_STARTED = /^Changing task state from \w+ to Started$/;
const RE_FINAL = /^Changing task state from \w+ to (FinishedSuccess|FinishedFail|Aborted|Error|Reset|Skipped)$/;
// Logged when the engine has finished the reload, which is when the scheduler frees the slot and may start a queued
// task. QRS sets the result's stop time a few hundred ms later.
const RE_SCRIPTLOG = /^Reference to scriptlog added$/;
const RE_WORKER = /Sending task to worker scheduler (\S+)/;
const RE_FAILURE_MESSAGE = /^Message from /;

/**
 * Parse a QRS date string. The QRS "no date" sentinel and invalid values become null.
 *
 * @param {string} value - ISO date string.
 * @returns {number|null} Epoch milliseconds, or null.
 */
export function parseQrsDate(value) {
    if (!value || value === QRS_NULL_DATE) {
        return null;
    }
    const ms = Date.parse(value);
    return Number.isNaN(ms) || ms <= Date.parse(QRS_NULL_DATE) ? null : ms;
}

/**
 * Sort and simplify the details of an execution result.
 *
 * @param {Array} details - ExecutionResult.details from QRS (unsorted).
 * @returns {Array<{t: number|null, type: number, message: string}>} Details sorted by time.
 */
export function parseExecutionDetails(details) {
    return (details || [])
        .map((d) => ({ t: parseQrsDate(d.detailCreatedDate), type: d.detailsType, message: String(d.message ?? '') }))
        .sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

/**
 * Normalise a host name for use as a node key.
 *
 * @param {string} host - Host name, e.g. 'Sense-Node1.example.com'.
 * @returns {string} Lower-case host name, '' if missing.
 */
export function normalizeNodeName(host) {
    return String(host || '')
        .trim()
        .toLowerCase();
}

/**
 * Convert a row from GET /qrs/executionresult/full into an ExecutionRecord.
 *
 * Note: ExecutionResult.startTime is when the task was TRIGGERED (verified on QSEoW May 2026), and duration includes
 * any time spent queued. The actual start comes from the "... to Started" detail.
 *
 * @param {object} row - ExecutionResult from QRS.
 * @param {Map<string, number>} [taskTypes] - Task id -> task type, from the task metadata.
 * @returns {import('../model/execution-record.js').ExecutionRecord|null} Record, or null for rows that never ran.
 */
export function fromExecutionResult(row, taskTypes = new Map()) {
    if (!row || !row.taskID || row.status === STATUS.NEVER_STARTED) {
        return null;
    }

    const details = parseExecutionDetails(row.details);
    const firstTime = (re) => details.find((d) => re.test(d.message))?.t ?? null;

    const triggeredAt = parseQrsDate(row.startTime) ?? firstTime(RE_TRIGGERED);
    const queuedAt = firstTime(RE_QUEUED);
    let startedAt = firstTime(RE_STARTED);
    let stoppedAt = parseQrsDate(row.stopTime);

    const terminal = isTerminalStatus(row.status);
    if (terminal && stoppedAt === null) {
        stoppedAt = parseQrsDate(row.modifiedDate) ?? triggeredAt;
    }
    // Older or trimmed details may lack the "Started" transition. A running or finished execution has started though.
    if (startedAt === null && (row.status === STATUS.STARTED || (terminal && row.status !== STATUS.SKIPPED && queuedAt === null))) {
        startedAt = triggeredAt;
    }

    let finishedAt = null;
    if (terminal) {
        const candidates = [firstTime(RE_SCRIPTLOG), firstTime(RE_FINAL), stoppedAt].filter((t) => t !== null);
        finishedAt = candidates.length ? Math.min(...candidates) : null;
    }

    let nodeName = normalizeNodeName(row.executingNodeName);
    if (!nodeName) {
        const worker = details.map((d) => RE_WORKER.exec(d.message)).find(Boolean);
        nodeName = worker ? normalizeNodeName(worker[1]) : '';
    }

    let failureReason = null;
    if (row.status === STATUS.FINISHED_FAIL || row.status === STATUS.ERROR || row.status === STATUS.ABORTED) {
        const failure = details.find((d) => d.type === 0) || details.find((d) => RE_FAILURE_MESSAGE.test(d.message));
        failureReason = failure ? failure.message.slice(0, MAX_FAILURE_REASON) : null;
    }

    const rec = {
        resultId: row.id || null,
        executionId: row.executionID && row.executionID !== NULL_GUID ? row.executionID : null,
        taskId: row.taskID,
        taskType: taskTypes.has(row.taskID) ? taskTypes.get(row.taskID) : null,
        appId: row.appID && row.appID !== NULL_GUID ? row.appID : null,
        nodeName,
        status: row.status,
        triggeredAt,
        queuedAt,
        startedAt,
        stoppedAt,
        finishedAt,
        failureReason,
        src: SOURCE_BIT[SOURCE.QRS],
        confidence: 'exact',
        modifiedAt: parseQrsDate(row.modifiedDate),
    };
    rec.key = recordKey(rec);
    return rec;
}
