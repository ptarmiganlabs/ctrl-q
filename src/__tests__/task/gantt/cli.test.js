import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import { Command } from 'commander';

import { validateTaskGanttOptions } from '../../../lib/task-gantt/options.js';

// The qseow task-gantt command definition, parsed by commander as on the command line, with the command itself stubbed:
// which options and environment variables end up in the configuration.

const taskGantt = jest.fn(async () => ({}));
jest.unstable_mockModule('../../../lib/cmd/qseow/taskgantt.js', () => ({ taskGantt }));
jest.unstable_mockModule('../../../lib/util/qseow/assert-options.js', () => ({
    // The shared checks look for certificate files; not needed here
    qseowSharedParamAssertOptions: jest.fn(async () => {}),
    taskGanttAssertOptions: (options, context) => {
        const result = validateTaskGanttOptions(options, context);
        if (!result.ok) throw new Error(result.errors.join('; '));
        return result.config;
    },
}));

const { setupQseowTaskGanttCommand } = await import('../../../lib/cli/qseow-task-gantt.js');
const { logger } = await import('../../../globals.js');

const MANDATORY = ['--host', 'sense.example.com', '--auth-user-dir', 'LAB', '--auth-user-id', 'ctrlq'];

let savedEnv;
beforeEach(() => {
    savedEnv = { ...process.env };
    for (const name of Object.keys(process.env)) {
        if (name.startsWith('CTRLQ_')) delete process.env[name];
    }
    taskGantt.mockClear();
});

afterEach(() => {
    process.env = savedEnv;
    process.exitCode = undefined;
    jest.restoreAllMocks();
});

/**
 * Run `ctrl-q qseow task-gantt` with arguments and environment variables.
 *
 * @param {string[]} args - Command line arguments after the mandatory ones.
 * @param {object} [env] - Environment variables.
 * @returns {Promise<object|null>} The configuration taskGantt() was called with, or null if it was not called.
 */
async function run(args = [], env = {}) {
    Object.assign(process.env, env);
    const program = new Command();
    program.exitOverride();
    setupQseowTaskGanttCommand(program.command('qseow'));
    await program.parseAsync(['node', 'ctrl-q', 'qseow', 'task-gantt', ...MANDATORY, ...args]);
    return taskGantt.mock.calls.at(-1)?.[0] ?? null;
}

describe('qseow task-gantt command line', () => {
    test('defaults', async () => {
        const config = await run();

        expect(config).toMatchObject({
            sources: ['qrs', 'history-file'],
            pollIntervalMs: 15000,
            visHost: 'localhost',
            visPort: 3001,
            allowRemote: false,
            filters: { taskTypes: [0, 1], taskIds: [], taskTags: [], appIds: [], appTags: [] },
        });
    });

    test('list options take several values on the command line; tags are kept whole', async () => {
        const config = await run(['--task-type', 'reload', 'user-sync', '--sources', 'qrs', '--task-tag', 'Finance dept', 'HR']);

        expect(config.filters.taskTypes).toEqual([0, 2]);
        expect(config.sources).toEqual(['qrs']);
        expect(config.filters.taskTags).toEqual(['Finance dept', 'HR']);
    });

    test('list environment variables take several values: separated by spaces or commas, tags by commas only', async () => {
        const config = await run([], {
            CTRLQ_TASK_TYPE: 'reload user-sync',
            CTRLQ_SOURCES: 'qrs,history-file',
            CTRLQ_TASK_ID: '966a93e3-5e6d-495a-ac78-a2ba4067a794 0419086f-a935-4358-a356-da2f79069e78',
            CTRLQ_TASK_TAG: 'Finance dept,HR',
            CTRLQ_APP_TAG: 'Sales team',
        });

        expect(config.filters.taskTypes).toEqual([0, 2]);
        expect(config.sources).toEqual(['qrs', 'history-file']);
        expect(config.filters.taskIds).toHaveLength(2);
        expect(config.filters.taskTags).toEqual(['Finance dept', 'HR']);
        expect(config.filters.appTags).toEqual(['Sales team']);
    });

    test('an unknown task type is reported by the validation', async () => {
        const error = jest.spyOn(logger, 'error').mockImplementation(() => {});

        expect(await run(['--task-type', 'bogus'])).toBeNull();
        expect(process.exitCode).toBe(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown task type "bogus" in --task-type.'));
    });

    test.each([
        ['false', false],
        ['0', false],
        ['', false],
        ['true', true],
    ])('CTRLQ_VIS_ALLOW_REMOTE=%j gives allowRemote %s', async (value, expected) => {
        expect((await run([], { CTRLQ_VIS_ALLOW_REMOTE: value })).allowRemote).toBe(expected);
    });

    test('--vis-allow-remote without a value confirms a remote --vis-host', async () => {
        const config = await run(['--vis-host', '0.0.0.0', '--vis-allow-remote']);

        expect(config).toMatchObject({ visHost: '0.0.0.0', allowRemote: true });
    });

    test('a remote host from CTRLQ_VIS_HOST without confirmation fails, and says where the host came from', async () => {
        const error = jest.spyOn(logger, 'error').mockImplementation(() => {});

        expect(await run([], { CTRLQ_VIS_HOST: '0.0.0.0', CTRLQ_VIS_ALLOW_REMOTE: 'false' })).toBeNull();
        expect(process.exitCode).toBe(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('--vis-host 0.0.0.0 (from CTRLQ_VIS_HOST)'));
    });
});
