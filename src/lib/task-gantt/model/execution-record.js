/**
 * One execution of a task, normalised from any history source. All times are UTC epoch milliseconds.
 *
 * @typedef {object} ExecutionRecord
 * @property {string} key - Unique key: 'r:<resultId>', 'x:<executionId>' or 'f:<taskId>:<triggeredAt>'.
 * @property {string|null} resultId - QRS ExecutionResult id.
 * @property {string|null} executionId - QRS execution id (shared by the result and the scheduler logs).
 * @property {string} taskId - Task id.
 * @property {number|null} taskType - TaskTypeEnum: 0 reload, 1 external program, 2 user sync, 3 distribute, 4 preload.
 * @property {string|null} appId - App id, null for tasks without an app.
 * @property {string} nodeName - Executing node host name, lower case, '' if unknown.
 * @property {number} status - TaskExecutionStatus code, 0-14.
 * @property {number|null} triggeredAt - When the task was triggered.
 * @property {number|null} queuedAt - When the task entered the scheduler queue (null if it never queued).
 * @property {number|null} startedAt - When the reload actually started (after any queueing).
 * @property {number|null} stoppedAt - When the execution ended, null while running.
 * @property {number|null} finishedAt - When the reload itself ended in the engine, which frees the scheduler slot. QRS
 *   sets stoppedAt a little later, after its retry handling. Used for concurrency; null if unknown.
 * @property {string|null} failureReason - Short failure text, if any.
 * @property {number} src - Bit mask of the sources that contributed (see SOURCE_BIT).
 * @property {string} confidence - 'exact', 'derived' or 'approx'.
 * @property {number|null} modifiedAt - QRS modifiedDate, used to discard stale updates.
 */

/**
 * Build the unique key of an execution record.
 *
 * @param {{resultId?: string|null, executionId?: string|null, taskId?: string, triggeredAt?: number|null}} rec - Record.
 * @returns {string} Key.
 */
export function recordKey(rec) {
    if (rec.resultId) {
        return `r:${rec.resultId}`;
    }
    if (rec.executionId) {
        return `x:${rec.executionId}`;
    }
    return `f:${rec.taskId}:${rec.triggeredAt}`;
}

/**
 * When did the execution end, for drawing and overlap computations? Running executions end "now".
 *
 * @param {ExecutionRecord} rec - Record.
 * @param {number} now - Current time.
 * @returns {number} End time.
 */
export function effectiveEnd(rec, now) {
    return rec.stoppedAt ?? now;
}

/**
 * Earliest known time of the execution: trigger time if known, otherwise start time.
 *
 * @param {ExecutionRecord} rec - Record.
 * @returns {number|null} Time.
 */
export function effectiveBegin(rec) {
    return rec.triggeredAt ?? rec.startedAt ?? null;
}
