import { test, expect, describe } from '@jest/globals';

import { sweepConcurrency, bucketPeaks, chooseBucketMs, mergeIntervals, gapsIn } from '../../../lib/task-gantt/shared/sweep.js';

describe('sweepConcurrency', () => {
    test('counts overlapping runs and queue waits', () => {
        const points = sweepConcurrency([
            { start: 0, end: 10, kind: 'run' },
            { start: 5, end: 15, kind: 'run' },
            { start: 5, end: 8, kind: 'queue' },
        ]);

        expect(points).toEqual([
            [0, 1, 0],
            [5, 2, 1],
            [8, 2, 0],
            [10, 1, 0],
            [15, 0, 0],
        ]);
    });

    test('touching intervals do not overlap', () => {
        const points = sweepConcurrency([
            { start: 0, end: 10, kind: 'run' },
            { start: 10, end: 20, kind: 'run' },
        ]);

        expect(points).toEqual([
            [0, 1, 0],
            [20, 0, 0],
        ]);
    });

    test('ignores empty and inverted intervals', () => {
        expect(
            sweepConcurrency([
                { start: 5, end: 5, kind: 'run' },
                { start: 9, end: 3, kind: 'run' },
            ])
        ).toEqual([]);
    });
});

describe('bucketPeaks', () => {
    test('keeps short peaks visible in every bucket they touch', () => {
        const points = [
            [0, 1, 0],
            [12, 3, 2],
            [13, 1, 0],
            [40, 0, 0],
        ];

        expect(bucketPeaks(points, 0, 40, 10)).toEqual([
            [0, 1, 0],
            [10, 3, 2],
            [20, 1, 0],
            [30, 1, 0],
        ]);
    });

    test('carries the value in effect at the range start', () => {
        expect(bucketPeaks([[0, 2, 0]], 100, 120, 10)).toEqual([
            [100, 2, 0],
            [110, 2, 0],
        ]);
    });

    test('empty for bad ranges', () => {
        expect(bucketPeaks([], 10, 10, 5)).toEqual([]);
        expect(bucketPeaks([], 0, 10, 0)).toEqual([]);
    });

    test('chooseBucketMs keeps the bucket count bounded, in whole minutes', () => {
        expect(chooseBucketMs(7 * 86400000, 20000, 60000)).toBe(60000);
        expect(chooseBucketMs(90 * 86400000, 20000, 60000)).toBe(420000);
    });
});

describe('mergeIntervals / gapsIn', () => {
    test('merges overlapping and touching intervals', () => {
        expect(
            mergeIntervals([
                [5, 10],
                [0, 3],
                [3, 4],
                [9, 12],
                [20, 20],
            ])
        ).toEqual([
            [0, 4],
            [5, 12],
        ]);
    });

    test('finds the uncovered parts of a range', () => {
        expect(
            gapsIn(
                [
                    [10, 20],
                    [30, 40],
                ],
                0,
                50
            )
        ).toEqual([
            [0, 10],
            [20, 30],
            [40, 50],
        ]);
        expect(gapsIn([[0, 100]], 10, 50)).toEqual([]);
        expect(gapsIn([], 10, 50)).toEqual([[10, 50]]);
    });
});
