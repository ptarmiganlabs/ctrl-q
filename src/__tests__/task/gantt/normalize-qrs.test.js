import { test, expect, describe } from '@jest/globals';
import fs from 'node:fs';

import { fromExecutionResult, parseQrsDate, parseExecutionDetails, normalizeNodeName } from '../../../lib/task-gantt/normalize/qrs.js';
import { statusBucket, isTerminalStatus, statusCodeFromName } from '../../../lib/task-gantt/model/status.js';
import { recordKey, effectiveEnd, effectiveBegin } from '../../../lib/task-gantt/model/execution-record.js';

// Real QRS rows (anonymised) from the lab: 6 reload tasks started at once with capacity 4, so two of them queued
const ROWS = JSON.parse(fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8'));
const byTask = (id) => ROWS.find((r) => r.taskID === id);
const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794'; // queued 46 s, then failed
const CAL_PERF_2 = '60f56836-b6e4-4690-8896-a2262c4ebb8c'; // started at once, succeeded

describe('statusBucket', () => {
    test('maps every status code 0-14', () => {
        expect(statusBucket(0).bucket).toBeNull();
        expect(statusBucket(1)).toEqual({ bucket: 'waiting', terminal: false, name: 'Triggered' });
        expect(statusBucket(3)).toEqual({ bucket: 'queued', terminal: false, name: 'Queued' });
        expect(statusBucket(2).bucket).toBe('running');
        expect(statusBucket(7)).toEqual({ bucket: 'success', terminal: true, name: 'FinishedSuccess' });
        expect(statusBucket(8)).toEqual({ bucket: 'failed', terminal: true, name: 'FinishedFail' });
        expect(statusBucket(6).bucket).toBe('aborted');
        expect(statusBucket(9).bucket).toBe('skipped');
        expect(statusBucket(12)).toEqual({ bucket: 'error', terminal: true, name: 'Reset' });
        expect(statusBucket(13).bucket).toBe('waiting');
        expect(statusBucket(14).bucket).toBe('running');
        expect(statusBucket(99)).toEqual({ bucket: null, terminal: false, name: 'Unknown (99)' });
    });

    test('isTerminalStatus and statusCodeFromName', () => {
        expect([6, 7, 8, 9, 11, 12].every(isTerminalStatus)).toBe(true);
        expect([0, 1, 2, 3, 4, 5, 10, 13, 14].some(isTerminalStatus)).toBe(false);
        expect(statusCodeFromName('FinishedFail')).toBe(8);
        expect(statusCodeFromName('Nope')).toBeUndefined();
    });
});

describe('parseQrsDate', () => {
    test('treats the 1753 sentinel and junk as null', () => {
        expect(parseQrsDate('1753-01-01T00:00:00.000Z')).toBeNull();
        expect(parseQrsDate('')).toBeNull();
        expect(parseQrsDate('not a date')).toBeNull();
        expect(parseQrsDate('2026-10-06T06:29:45.239Z')).toBe(Date.UTC(2026, 9, 6, 6, 29, 45, 239));
    });
});

describe('parseExecutionDetails / normalizeNodeName', () => {
    test('sorts details by time', () => {
        const parsed = parseExecutionDetails(byTask(CONTENT_MONITOR).details);

        expect(parsed[0].message).toBe('Changing task state to Triggered');
        expect(parsed.map((d) => d.t)).toEqual([...parsed.map((d) => d.t)].sort((a, b) => a - b));
    });

    test('lower-cases node names', () => {
        expect(normalizeNodeName(' Sense-Node1.Example.com ')).toBe('sense-node1.example.com');
        expect(normalizeNodeName(undefined)).toBe('');
    });
});

describe('fromExecutionResult', () => {
    test('uses startTime as the trigger time and the Started detail as the real start (queued run)', () => {
        const row = byTask(CONTENT_MONITOR);
        const rec = fromExecutionResult(row, new Map([[CONTENT_MONITOR, 0]]));

        expect(rec.triggeredAt).toBe(Date.parse('2026-10-06T06:29:45.239Z'));
        expect(rec.queuedAt).toBe(Date.parse('2026-10-06T06:29:45.640Z'));
        expect(rec.startedAt).toBe(Date.parse('2026-10-06T06:30:31.688Z'));
        expect(rec.stoppedAt).toBe(Date.parse('2026-10-06T06:31:10.481Z'));
        // The engine finished (scriptlog stored) before QRS set the stop time
        expect(rec.finishedAt).toBe(Date.parse('2026-10-06T06:31:09.498Z'));
        expect(rec.status).toBe(8);
        expect(rec.taskType).toBe(0);
        expect(rec.nodeName).toBe('sense-node1.example.com');
        expect(rec.failureReason).toBe('Message from ReloadProvider: Reload failed in Engine. Check engine or script logs.');
        expect(rec.key).toBe(`r:${row.id}`);
        expect(rec.executionId).toBe(row.executionID);
        expect(rec.confidence).toBe('exact');
    });

    test('a run that started at once has no queue time', () => {
        const rec = fromExecutionResult(byTask(CAL_PERF_2));

        expect(rec.queuedAt).toBeNull();
        expect(rec.startedAt - rec.triggeredAt).toBeLessThan(1000);
        expect(rec.failureReason).toBeNull();
        expect(rec.taskType).toBeNull();
    });

    test('a running row has no stop time, and an app-less task no app id', () => {
        const row = {
            ...byTask(CAL_PERF_2),
            status: 2,
            stopTime: '1753-01-01T00:00:00.000Z',
            appID: '00000000-0000-0000-0000-000000000000',
            details: byTask(CAL_PERF_2).details.filter((d) => !/FinishedSuccess|scriptlog/.test(d.message)),
        };
        const rec = fromExecutionResult(row);

        expect(rec.stoppedAt).toBeNull();
        expect(rec.finishedAt).toBeNull();
        expect(rec.status).toBe(2);
        expect(rec.appId).toBeNull();
        expect(rec.startedAt).not.toBeNull();
    });

    test('a queued row has a queue time but no start yet', () => {
        const row = {
            ...byTask(CONTENT_MONITOR),
            status: 3,
            stopTime: '1753-01-01T00:00:00.000Z',
            details: byTask(CONTENT_MONITOR).details.filter((d) => /Triggered$|worker scheduler|to Queued$/.test(d.message)),
        };
        const rec = fromExecutionResult(row);

        expect(rec.queuedAt).not.toBeNull();
        expect(rec.startedAt).toBeNull();
        expect(rec.stoppedAt).toBeNull();
    });

    test('takes the node from the details when executingNodeName is empty', () => {
        const rec = fromExecutionResult({ ...byTask(CAL_PERF_2), executingNodeName: '' });

        expect(rec.nodeName).toBe('sense-node1.example.com');
    });

    test('a finished row with a missing stop time ends at modifiedDate', () => {
        const row = { ...byTask(CAL_PERF_2), stopTime: '1753-01-01T00:00:00.000Z' };

        expect(fromExecutionResult(row).stoppedAt).toBe(Date.parse(row.modifiedDate));
    });

    test('rows that never ran, and junk, give null', () => {
        expect(fromExecutionResult({ ...byTask(CAL_PERF_2), status: 0 })).toBeNull();
        expect(fromExecutionResult(null)).toBeNull();
        expect(fromExecutionResult({ id: 'x' })).toBeNull();
    });

    test('skipped executions have no start', () => {
        const rec = fromExecutionResult({ ...byTask(CAL_PERF_2), status: 9, details: [] });

        expect(rec.startedAt).toBeNull();
    });
});

describe('record helpers', () => {
    test('recordKey prefers result id, then execution id, then task + time', () => {
        expect(recordKey({ resultId: 'a', executionId: 'b', taskId: 't', triggeredAt: 1 })).toBe('r:a');
        expect(recordKey({ executionId: 'b', taskId: 't', triggeredAt: 1 })).toBe('x:b');
        expect(recordKey({ taskId: 't', triggeredAt: 1 })).toBe('f:t:1');
    });

    test('effectiveEnd / effectiveBegin', () => {
        expect(effectiveEnd({ stoppedAt: null }, 50)).toBe(50);
        expect(effectiveEnd({ stoppedAt: 10 }, 50)).toBe(10);
        expect(effectiveBegin({ triggeredAt: null, startedAt: 5 })).toBe(5);
        expect(effectiveBegin({ triggeredAt: 3, startedAt: 5 })).toBe(3);
    });
});
