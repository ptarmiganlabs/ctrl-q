import { mergeIntervals } from '../shared/sweep.js';

/**
 * Track which time ranges the loaded history is known to be complete for.
 *
 * Coverage is global (e.g. while Ctrl-Q was polling QRS, or the period the Operations Monitor holds) or per task (e.g.
 * from the oldest execution QRS still retains for a task until the time it was read). A chart must show time outside
 * coverage as "unknown", never as "idle".
 *
 * Ranges are kept merged, so asking for a lane's coverage stays cheap however many ranges were added.
 *
 * @returns {object} The coverage tracker.
 */
export function createCoverage() {
    let global = [];
    const tasks = new Map();
    // The range Ctrl-Q has been watching QRS continuously in this session. Replaced on every poll instead of appended.
    let live = null;
    // Nothing before this time is complete, e.g. because the oldest executions were evicted from memory
    let completeFrom = null;

    /**
     * Set the range in which Ctrl-Q has been watching all tasks live.
     *
     * @param {number|null} from - Start, or null to clear.
     * @param {number} [to] - End.
     */
    const setLive = (from, to) => {
        live = from !== null && to > from ? [from, to] : null;
    };

    /**
     * Mark a range as covered for all tasks.
     *
     * @param {number} from - Start.
     * @param {number} to - End.
     */
    const addGlobal = (from, to) => {
        if (to > from) global = mergeIntervals([...global, [from, to]]);
    };

    /**
     * Mark a range as covered for one task.
     *
     * @param {string} taskId - Task id.
     * @param {number} from - Start.
     * @param {number} to - End.
     */
    const addTask = (taskId, from, to) => {
        if (!(to > from)) return;
        tasks.set(taskId, mergeIntervals([...(tasks.get(taskId) || []), [from, to]]));
    };

    /**
     * Declare that nothing before a time is complete any more (e.g. after evicting old executions from memory).
     *
     * @param {number|null} t - Time, or null for no limit.
     */
    const setCompleteFrom = (t) => {
        completeFrom = t;
    };

    const limit = (ranges) =>
        completeFrom === null ? ranges : ranges.filter(([, b]) => b > completeFrom).map(([a, b]) => [Math.max(a, completeFrom), b]);

    /**
     * Covered ranges for one task, including global coverage.
     *
     * @param {string} taskId - Task id.
     * @returns {Array<[number, number]>} Merged ranges.
     */
    const forTask = (taskId) =>
        limit(mergeIntervals([...global, ...(tasks.get(taskId) || []), ...(live ? [live] : [])].map((iv) => [...iv])));

    /**
     * Global coverage only.
     *
     * @returns {Array<[number, number]>} Merged ranges.
     */
    const globalRanges = () => limit(mergeIntervals([...global, ...(live ? [live] : [])].map((iv) => [...iv])));

    return { addGlobal, addTask, setLive, setCompleteFrom, forTask, globalRanges, live: () => live, completeFrom: () => completeFrom };
}
