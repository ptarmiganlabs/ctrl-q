/**
 * Unit tests for the exit status of the qseow task-get command, defined in src/lib/cli/qseow-get-task.js.
 *
 * getTask() is mocked; the real option checks run.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Command } from 'commander';

jest.unstable_mockModule('../../../lib/cmd/qseow/gettask.js', () => ({
    getTask: jest.fn(),
}));

const { getTask } = await import('../../../lib/cmd/qseow/gettask.js');
const { logger } = await import('../../../globals.js');
const { setupGetTaskCommand } = await import('../../../lib/cli/qseow-get-task.js');

/**
 * Run qseow task-get with JWT authentication.
 */
const run = async () => {
    const qseow = new Command('qseow').exitOverride();
    setupGetTaskCommand(qseow);

    await qseow.parseAsync(
        [
            'task-get',
            '--host',
            'qlik.example.com',
            '--auth-user-dir',
            'dir',
            '--auth-user-id',
            'user',
            '--auth-type',
            'jwt',
            '--auth-jwt',
            'jwt',
        ],
        { from: 'user' }
    );
};

beforeEach(() => {
    getTask.mockReset();
    jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
    process.exitCode = undefined;
    jest.restoreAllMocks();
});

describe('qseow task-get', () => {
    test('should exit with code 1 when getting the tasks fails', async () => {
        getTask.mockResolvedValue(false);

        await run();

        expect(getTask).toHaveBeenCalledTimes(1);
        expect(process.exitCode).toBe(1);
    });

    test('should exit with code 1 when getting the tasks throws', async () => {
        getTask.mockRejectedValue(new Error('QRS unavailable'));

        await run();

        expect(process.exitCode).toBe(1);
    });

    test('should leave the exit code alone when getting the tasks works', async () => {
        getTask.mockResolvedValue(true);

        await run();

        expect(process.exitCode).toBeUndefined();
    });
});
