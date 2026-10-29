// Concurrency computations shared by the Node.js backend and the task-gantt web page.
// Plain ES module without imports, so the browser can load it as-is.

/**
 * Compute how many executions are running and queued over time, as a step function.
 *
 * Intervals are half-open, [start, end): an execution ending at the same instant another one starts does not overlap
 * with it.
 *
 * @param {Array<{start: number, end: number, kind: string}>} intervals - kind 'run' (running) or 'queue' (queued).
 * @returns {Array<[number, number, number]>} Change points [time, running, queued], sorted by time. The values hold
 *   from that time until the next change point. Starts and ends at 0.
 */
export function sweepConcurrency(intervals) {
    const events = [];
    for (const iv of intervals) {
        if (!(iv.end > iv.start)) {
            continue;
        }
        const run = iv.kind === 'run' ? 1 : 0;
        const queue = iv.kind === 'queue' ? 1 : 0;
        events.push([iv.start, run, queue], [iv.end, -run, -queue]);
    }
    // Process all changes at the same time together; order within a time does not matter for the result
    events.sort((a, b) => a[0] - b[0]);

    const points = [];
    let running = 0;
    let queued = 0;
    let i = 0;
    while (i < events.length) {
        const t = events[i][0];
        while (i < events.length && events[i][0] === t) {
            running += events[i][1];
            queued += events[i][2];
            i += 1;
        }
        const last = points[points.length - 1];
        if (last && last[1] === running && last[2] === queued) {
            continue;
        }
        points.push([t, running, queued]);
    }
    return points;
}

/**
 * Reduce a step function to fixed-size buckets, keeping the peak values within each bucket. This keeps short peaks
 * visible however far the chart is zoomed out.
 *
 * @param {Array<[number, number, number]>} points - Change points from sweepConcurrency().
 * @param {number} from - Start of the range.
 * @param {number} to - End of the range.
 * @param {number} bucketMs - Bucket width in ms.
 * @returns {Array<[number, number, number]>} One entry per bucket: [bucket start, peak running, peak queued].
 */
export function bucketPeaks(points, from, to, bucketMs) {
    if (!(to > from) || !(bucketMs > 0)) {
        return [];
    }
    const n = Math.ceil((to - from) / bucketMs);
    const out = new Array(n);
    let idx = 0;
    // Value in effect at the start of the range
    let running = 0;
    let queued = 0;
    while (idx < points.length && points[idx][0] <= from) {
        running = points[idx][1];
        queued = points[idx][2];
        idx += 1;
    }
    for (let b = 0; b < n; b += 1) {
        const bStart = from + b * bucketMs;
        const bEnd = bStart + bucketMs;
        let maxRun = running;
        let maxQueue = queued;
        while (idx < points.length && points[idx][0] < bEnd) {
            running = points[idx][1];
            queued = points[idx][2];
            maxRun = Math.max(maxRun, running);
            maxQueue = Math.max(maxQueue, queued);
            idx += 1;
        }
        out[b] = [bStart, maxRun, maxQueue];
    }
    return out;
}

/**
 * Pick a bucket width so a range is covered by at most maxBuckets buckets, rounded up to whole minutes.
 *
 * @param {number} rangeMs - Length of the range.
 * @param {number} maxBuckets - Max number of buckets.
 * @param {number} minBucketMs - Smallest bucket width.
 * @returns {number} Bucket width in ms.
 */
export function chooseBucketMs(rangeMs, maxBuckets, minBucketMs) {
    const raw = Math.max(minBucketMs, Math.ceil(rangeMs / maxBuckets));
    return Math.ceil(raw / 60000) * 60000;
}

/**
 * Merge overlapping or touching intervals.
 *
 * @param {Array<[number, number]>} intervals - [from, to] pairs.
 * @returns {Array<[number, number]>} Sorted, non-overlapping intervals.
 */
export function mergeIntervals(intervals) {
    const sorted = intervals.filter((iv) => iv[1] > iv[0]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [from, to] of sorted) {
        const last = out[out.length - 1];
        if (last && from <= last[1]) {
            last[1] = Math.max(last[1], to);
        } else {
            out.push([from, to]);
        }
    }
    return out;
}

/**
 * Parts of [from, to] not covered by the given intervals.
 *
 * @param {Array<[number, number]>} covered - Merged intervals, e.g. from mergeIntervals().
 * @param {number} from - Range start.
 * @param {number} to - Range end.
 * @returns {Array<[number, number]>} Gaps.
 */
export function gapsIn(covered, from, to) {
    const gaps = [];
    let cursor = from;
    for (const [a, b] of covered) {
        if (b <= cursor) {
            continue;
        }
        if (a >= to) {
            break;
        }
        if (a > cursor) {
            gaps.push([cursor, Math.min(a, to)]);
        }
        cursor = Math.max(cursor, b);
        if (cursor >= to) {
            break;
        }
    }
    if (cursor < to) {
        gaps.push([cursor, to]);
    }
    return gaps;
}
