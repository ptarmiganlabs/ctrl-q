// Fixed settings for the task-gantt command. Kept as constants rather than CLI options to keep the CLI small.

// Two records from different sources are considered the same execution if their trigger times differ by at most this
// much (used when a source has no execution ID, e.g. the Operations Monitor, which rounds to whole seconds).
export const MATCH_TOLERANCE_MS = 10 * 1000;

// Disagreements between sources larger than this are counted as conflicts in the source status.
export const CONFLICT_THRESHOLD_MS = 5 * 1000;

// A record still "running" this long after its trigger, and not listed as a running execution session, is shown as
// "unknown (stale)".
export const STALE_RUNNING_MS = 24 * 60 * 60 * 1000;

// Max number of execution records kept in memory. The oldest finished records are evicted first.
export const MAX_RECORDS = 200000;

// Longest supported --lookback.
export const MAX_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

// Analytics
export const EPISODE_MERGE_GAP_MS = 60 * 1000;
export const MAX_EPISODES = 50;
// Concurrency series are reduced to at most this many buckets (peak values per bucket), with a 1 minute minimum.
export const MAX_CONCURRENCY_BUCKETS = 20000;
export const MIN_CONCURRENCY_BUCKET_MS = 60 * 1000;

// History file. Its writer refreshes the lock file this often, and another instance takes over a lock that has not been
// refreshed for HISTORY_LOCK_STALE_MS. Generous, as computers sharing a history directory may disagree about the time.
export const HISTORY_HEARTBEAT_MS = 10 * 1000;
export const HISTORY_LOCK_STALE_MS = 5 * 60 * 1000;
// Lines queued while the history file cannot be written, e.g. on a full disk: a day or two of a busy site. Lines queued
// while writing works do not count, however many there are.
export const HISTORY_MAX_PENDING_LINES = 50000;
// Records are stored in the daily file of their trigger day. Files this much older than the window start are read
// too, so long-running executions that started before the window are not missed.
export const HISTORY_READ_MARGIN_MS = 2 * 24 * 60 * 60 * 1000;

// Sentinel QRS uses for "no time", e.g. the stop time of a running execution
export const QRS_NULL_DATE = '1753-01-01T00:00:00.000Z';

// Source ids and their bits in ExecutionRecord.src
export const SOURCE = {
    QRS: 'qrs',
    HISTORY: 'history-file',
    OPS_MONITOR: 'ops-monitor',
    SCHED_LOG: 'sched-log',
};

export const SOURCE_BIT = {
    [SOURCE.QRS]: 1,
    [SOURCE.HISTORY]: 2,
    [SOURCE.OPS_MONITOR]: 4,
    [SOURCE.SCHED_LOG]: 8,
};

// Higher rank wins when sources disagree
export const SOURCE_RANK = {
    [SOURCE.QRS]: 4,
    [SOURCE.SCHED_LOG]: 3,
    [SOURCE.HISTORY]: 2,
    [SOURCE.OPS_MONITOR]: 1,
};
