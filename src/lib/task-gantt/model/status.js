import { mapTaskExecutionStatus } from '../../util/qseow/lookups.js';

// Display buckets for QRS TaskExecutionStatus codes. lookups.js stays the single source of truth for code <-> name.
const BUCKETS = new Map([
    [1, 'waiting'], // Triggered
    [10, 'waiting'], // Retry
    [13, 'waiting'], // DistributionQueue
    [3, 'queued'], // Queued
    [2, 'running'], // Started
    [14, 'running'], // DistributionRunning
    [4, 'aborting'], // AbortInitiated
    [5, 'aborting'], // Aborting
    [6, 'aborted'], // Aborted
    [7, 'success'], // FinishedSuccess
    [8, 'failed'], // FinishedFail
    [9, 'skipped'], // Skipped
    [11, 'error'], // Error
    [12, 'error'], // Reset
]);

const TERMINAL = new Set([6, 7, 8, 9, 11, 12]);

export const STATUS = {
    NEVER_STARTED: 0,
    TRIGGERED: 1,
    STARTED: 2,
    QUEUED: 3,
    ABORTED: 6,
    FINISHED_SUCCESS: 7,
    FINISHED_FAIL: 8,
    SKIPPED: 9,
    ERROR: 11,
};

/**
 * Map a QRS task execution status code to a display bucket.
 *
 * @param {number} code - TaskExecutionStatus code, 0-14.
 * @returns {{bucket: string|null, terminal: boolean, name: string}} Bucket (null for NeverStarted and unknown codes),
 *   whether the execution has finished, and the status name.
 */
export function statusBucket(code) {
    return {
        bucket: BUCKETS.get(code) ?? null,
        terminal: TERMINAL.has(code),
        name: mapTaskExecutionStatus.get(code) ?? `Unknown (${code})`,
    };
}

/**
 * Is the status code a final one, i.e. the execution has ended?
 *
 * @param {number} code - TaskExecutionStatus code.
 * @returns {boolean} True for Aborted, FinishedSuccess, FinishedFail, Skipped, Error and Reset.
 */
export function isTerminalStatus(code) {
    return TERMINAL.has(code);
}

/**
 * Map a status name as written in QRS execution details, e.g. "FinishedFail", to its code.
 *
 * @param {string} name - Status name.
 * @returns {number|undefined} Status code.
 */
export function statusCodeFromName(name) {
    const code = mapTaskExecutionStatus.get(name);
    return typeof code === 'number' ? code : undefined;
}
