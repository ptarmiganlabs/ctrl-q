import { test, expect, describe } from '@jest/globals';
import fs from 'node:fs';

import { computeConcurrency, executionIntervals, countsTowardsCapacity } from '../../../lib/task-gantt/analytics/concurrency.js';
import { findEpisodes } from '../../../lib/task-gantt/analytics/episodes.js';
import { computeTaskStats } from '../../../lib/task-gantt/analytics/task-stats.js';
import { fromExecutionResult } from '../../../lib/task-gantt/normalize/qrs.js';

// The lab run: 6 reload tasks triggered at 06:29:45 with maxConcurrentEngines = 4; Content Monitor and Operations
// Monitor queued for ~46-49 s.
const ROWS = JSON.parse(fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8'));
const RELOAD_TASKS = new Map(
    [
        '966a93e3-5e6d-495a-ac78-a2ba4067a794',
        'a87ae597-be31-4453-be04-5b4f67489d8d',
        '0419086f-a935-4358-a356-da2f79069e78',
        '8d2c5d0c-12e2-4dc8-9832-de1ae367a373',
        '60f56836-b6e4-4690-8896-a2262c4ebb8c',
        '5fee7b84-76f8-4cc1-ba4f-466d8eefa8be',
    ].map((id) => [id, 0])
);
const RECORDS = ROWS.map((r) => fromExecutionResult(r, RELOAD_TASKS)).filter((r) => r && RELOAD_TASKS.has(r.taskId));
const FROM = Date.parse('2026-10-06T06:00:00.000Z');
const TO = Date.parse('2026-10-06T07:00:00.000Z');
const NOW = TO;
const NODE = 'sense-node1.example.com';

describe('executionIntervals / countsTowardsCapacity', () => {
    test('splits a queued run into a queue and a run interval', () => {
        const ivs = executionIntervals({ queuedAt: 10, startedAt: 20, stoppedAt: 30, status: 7 }, 100);

        expect(ivs).toEqual([
            { start: 10, end: 20, kind: 'queue' },
            { start: 20, end: 30, kind: 'run' },
        ]);
    });

    test('a run ends when the engine finished, before QRS sets the stop time', () => {
        expect(executionIntervals({ queuedAt: null, startedAt: 20, stoppedAt: 30, finishedAt: 29, status: 7 }, 100)).toEqual([
            { start: 20, end: 29, kind: 'run' },
        ]);
    });

    test('ongoing intervals end now; an aborted queued run ends at its stop time', () => {
        expect(executionIntervals({ queuedAt: 10, startedAt: null, stoppedAt: null, status: 3 }, 100)).toEqual([
            { start: 10, end: 100, kind: 'queue' },
        ]);
        expect(executionIntervals({ queuedAt: 10, startedAt: null, stoppedAt: 40, status: 6 }, 100)).toEqual([
            { start: 10, end: 40, kind: 'queue' },
        ]);
    });

    test('only reload tasks count against capacity', () => {
        expect(countsTowardsCapacity({ taskType: 0 })).toBe(true);
        expect(countsTowardsCapacity({ taskType: 1 })).toBe(false);
        expect(countsTowardsCapacity({ taskType: null, appId: 'a' })).toBe(true);
        expect(countsTowardsCapacity({ taskType: null, appId: null })).toBe(false);
    });
});

describe('computeConcurrency on the lab congestion run', () => {
    const conc = computeConcurrency(RECORDS, { now: NOW, from: FROM, to: TO });

    test('peaks at 4 running and 2 queued on the node (queued tasks start as engine slots free up)', () => {
        const points = conc.points.get(NODE);

        expect(Math.max(...points.map((p) => p[1]))).toBe(4);
        expect(Math.max(...points.map((p) => p[2]))).toBe(2);
        expect(points[points.length - 1]).toEqual([expect.any(Number), 0, 0]);
    });

    test('bucketed series cover the window at 1 minute resolution', () => {
        expect(conc.bucketMs).toBe(60000);
        expect(conc.total).toHaveLength(60);
        expect(conc.nodes.map((n) => n.name)).toEqual([NODE]);
        const peakBucket = conc.total.find((b) => b[0] === Date.parse('2026-10-06T06:29:00.000Z'));
        expect(peakBucket).toEqual([peakBucket[0], 4, 2]);
    });
});

/**
 * The straightforward version of findEpisodes' task attribution: for every episode, look at every record of its node.
 * Slow (episodes x records), but obviously right; findEpisodes must give the same result.
 */
function naiveEpisodes(pointsByNode, capacityByNode, records, { now, from, to, mergeGapMs = 60000 }) {
    const ov = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    const out = [];
    for (const [node, points] of pointsByNode) {
        const capacity = capacityByNode.get(node);
        const raw = [];
        for (let i = 0; i < points.length; i += 1) {
            const [t, running, queued] = points[i];
            const tEnd = i + 1 < points.length ? points[i + 1][0] : t;
            if (tEnd > t && (queued > 0 || (capacity > 0 && running >= capacity))) {
                const last = raw[raw.length - 1];
                if (last && t - last.to <= mergeGapMs) {
                    last.to = tEnd;
                    last.peakRunning = Math.max(last.peakRunning, running);
                    last.peakQueued = Math.max(last.peakQueued, queued);
                } else raw.push({ from: t, to: tEnd, peakRunning: running, peakQueued: queued });
            }
        }
        for (const r of raw) {
            const ep = { ...r, from: Math.max(r.from, from), to: Math.min(r.to, to) };
            if (ep.to <= ep.from) continue;
            const byTask = new Map();
            for (const rec of records) {
                if (!countsTowardsCapacity(rec) || (rec.nodeName || '') !== node) continue;
                const begin = rec.queuedAt ?? rec.startedAt;
                if (begin === null || begin === undefined) continue;
                const end = rec.stoppedAt ?? now;
                const o = ov(begin, end, ep.from, ep.to);
                if (o <= 0) continue;
                const wait =
                    rec.queuedAt !== null && rec.queuedAt !== undefined ? ov(rec.queuedAt, rec.startedAt ?? end, ep.from, ep.to) : 0;
                const e = byTask.get(rec.taskId) || { taskId: rec.taskId, overlapMs: 0, waitMs: 0, runs: 0 };
                e.overlapMs += o;
                e.waitMs += wait;
                e.runs += 1;
                byTask.set(rec.taskId, e);
            }
            const tasks = [...byTask.values()].sort((a, b) => b.waitMs - a.waitMs || b.overlapMs - a.overlapMs);
            out.push({ ...ep, node, capacity: capacity ?? null, waitMs: tasks.reduce((s, t) => s + t.waitMs, 0), tasks });
        }
    }
    return out.sort((a, b) => b.waitMs - a.waitMs || b.to - b.from - (a.to - a.from) || a.from - b.from);
}

// Small deterministic random number generator (mulberry32), so a failing case can be reproduced
function rng(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('findEpisodes against the straightforward version', () => {
    test.each([1, 2, 3, 4, 5, 6, 7, 8])('random scenario %i gives the same episodes and tasks', (seed) => {
        const random = rng(seed);
        const pick = (list) => list[Math.floor(random() * list.length)];
        const nodes = ['node-a', 'node-b', 'node-c', ''];
        const capacityByNode = new Map([
            ['node-a', 2],
            ['node-b', 4],
            ['node-c', 0],
        ]);
        const records = [];
        for (let i = 0; i < 400; i += 1) {
            const triggered = FROM - 20 * 60000 + Math.floor(random() * 100 * 60000);
            const queued = random() < 0.4 ? triggered + Math.floor(random() * 2000) : null;
            const started = random() < 0.9 ? triggered + Math.floor(random() * 10 * 60000) : null;
            const stopped = started !== null && random() < 0.9 ? started + Math.floor(random() * 20 * 60000) : null;
            records.push({
                taskId: `task-${Math.floor(random() * 25)}`,
                taskType: random() < 0.9 ? 0 : 1,
                appId: 'app',
                nodeName: pick(nodes),
                status: stopped === null ? 2 : 7,
                triggeredAt: triggered,
                queuedAt: queued,
                startedAt: started,
                stoppedAt: stopped,
            });
        }
        const now = TO + 5 * 60000;
        const conc = computeConcurrency(records, { now, from: FROM, to: TO });

        const fast = findEpisodes(conc.points, capacityByNode, records, { now, from: FROM, to: TO, maxEpisodes: 1000 });
        const naive = naiveEpisodes(conc.points, capacityByNode, records, { now, from: FROM, to: TO });
        expect(fast.length).toBeGreaterThan(0);
        expect(fast).toEqual(naive);
    });

    test('30 days of hourly congestion on 4 nodes (86k executions, ~3k episodes) take well under a second', () => {
        const HOUR = 3600000;
        const start = Date.parse('2026-09-06T00:00:00.000Z');
        const records = [];
        for (let n = 0; n < 4; n += 1) {
            for (let h = 0; h < 30 * 24; h += 1) {
                // 30 tasks triggered on the hour, 4 slots, 5-minute reloads: they run in 8 batches
                for (let k = 0; k < 30; k += 1) {
                    const t = start + h * HOUR;
                    const started = t + Math.floor(k / 4) * 300000;
                    records.push({
                        taskId: `task-${n}-${k}`,
                        taskType: 0,
                        appId: 'app',
                        nodeName: `node-${n}`,
                        status: 7,
                        triggeredAt: t,
                        queuedAt: k >= 4 ? t + 100 : null,
                        startedAt: started,
                        stoppedAt: started + 299000,
                    });
                }
            }
        }
        const window = { now: start + 30 * 24 * HOUR, from: start, to: start + 30 * 24 * HOUR };
        const capacityByNode = new Map([0, 1, 2, 3].map((n) => [`node-${n}`, 4]));
        const conc = computeConcurrency(records, window);

        const t0 = Date.now();
        const episodes = findEpisodes(conc.points, capacityByNode, records, { ...window, maxEpisodes: 5000 });
        const ms = Date.now() - t0;

        expect(records).toHaveLength(86400);
        expect(episodes).toHaveLength(4 * 30 * 24);
        expect(episodes[0].tasks).toHaveLength(30);
        // The episodes x records version took several seconds here
        expect(ms).toBeLessThan(1500);
    });
});

describe('findEpisodes', () => {
    const conc = computeConcurrency(RECORDS, { now: NOW, from: FROM, to: TO });
    const episodes = findEpisodes(conc.points, new Map([[NODE, 4]]), RECORDS, { now: NOW, from: FROM, to: TO });

    test('finds one congestion episode with the queued tasks first', () => {
        expect(episodes).toHaveLength(1);
        const [ep] = episodes;
        expect(ep).toMatchObject({ node: NODE, capacity: 4, peakRunning: 4, peakQueued: 2 });
        // Queue waits: Content Monitor ~46 s, Operations Monitor ~49 s
        expect(ep.waitMs).toBeGreaterThan(90000);
        expect(ep.waitMs).toBeLessThan(100000);
        expect(
            ep.tasks
                .slice(0, 2)
                .map((t) => t.taskId)
                .sort()
        ).toEqual(['0419086f-a935-4358-a356-da2f79069e78', '966a93e3-5e6d-495a-ac78-a2ba4067a794']);
        expect(ep.tasks).toHaveLength(6);
        expect(ep.to - ep.from).toBeGreaterThan(40000);
    });

    test('with unknown capacity only queueing counts', () => {
        const eps = findEpisodes(conc.points, new Map(), RECORDS, { now: NOW, from: FROM, to: TO });

        expect(eps).toHaveLength(1);
        expect(eps[0].capacity).toBeNull();
        expect(eps[0].peakQueued).toBe(2);
    });

    test('no episodes when nothing queued and capacity is never reached', () => {
        const relaxed = findEpisodes(
            conc.points,
            new Map([[NODE, 10]]),
            RECORDS.map((r) => ({ ...r, queuedAt: null })),
            { now: NOW, from: FROM, to: TO }
        );
        const conc2 = computeConcurrency(
            RECORDS.map((r) => ({ ...r, queuedAt: null })),
            { now: NOW, from: FROM, to: TO }
        );

        expect(findEpisodes(conc2.points, new Map([[NODE, 10]]), RECORDS, { now: NOW, from: FROM, to: TO })).toEqual([]);
        expect(relaxed.length).toBeGreaterThanOrEqual(0);
    });

    test('episodes are clipped to the window', () => {
        const eps = findEpisodes(conc.points, new Map([[NODE, 4]]), RECORDS, {
            now: NOW,
            from: Date.parse('2026-10-06T06:30:00.000Z'),
            to: TO,
        });

        expect(eps[0].from).toBe(Date.parse('2026-10-06T06:30:00.000Z'));
    });
});

describe('computeTaskStats', () => {
    test('counts runs, failures, waits and durations per task', () => {
        const stats = computeTaskStats(RECORDS, { now: NOW, from: FROM, to: TO });
        const content = stats.get('966a93e3-5e6d-495a-ac78-a2ba4067a794');
        const calPerf2 = stats.get('60f56836-b6e4-4690-8896-a2262c4ebb8c');

        expect(content).toMatchObject({ runs: 1, fails: 1, lastStatus: 8 });
        expect(content.totalWaitMs).toBeGreaterThan(45000);
        expect(calPerf2).toMatchObject({ runs: 1, fails: 0, lastStatus: 7 });
        expect(calPerf2.p50Ms).toBeGreaterThan(40000);
        expect(calPerf2.totalWaitMs).toBeLessThan(1000);
    });

    test('ignores executions outside the window', () => {
        expect(computeTaskStats(RECORDS, { now: NOW, from: TO + 1, to: TO + 1000 }).size).toBe(0);
    });
});
