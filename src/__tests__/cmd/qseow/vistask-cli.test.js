import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import { Command } from 'commander';

// The qseow task-vis command definition, parsed by commander as on the command line, with the command itself stubbed:
// which web server options reach visTask(), and the exit code when it fails.

const visTask = jest.fn(async () => ({ url: 'http://localhost:3000/', port: 3000, close: async () => {} }));
const visTaskAssertOptions = jest.fn(async () => true);
jest.unstable_mockModule('../../../lib/cmd/qseow/vistask.js', () => ({ visTask }));
jest.unstable_mockModule('../../../lib/util/qseow/assert-options.js', () => ({
    // The shared checks look for certificate files, and the task-vis checks ask QRS about task ids; not needed here
    qseowSharedParamAssertOptions: jest.fn(async () => {}),
    visTaskAssertOptions,
}));

const { setupQseowVisualiseTaskCommand } = await import('../../../lib/cli/qseow-visualise-task.js');
const { logger } = await import('../../../globals.js');

const MANDATORY = ['--host', 'sense.example.com', '--auth-user-dir', 'LAB', '--auth-user-id', 'ctrlq'];

let savedEnv;
beforeEach(() => {
    savedEnv = { ...process.env };
    for (const name of Object.keys(process.env)) {
        if (name.startsWith('CTRLQ_')) delete process.env[name];
    }
    visTask.mockClear();
    visTaskAssertOptions.mockClear();
});

afterEach(() => {
    process.env = savedEnv;
    process.exitCode = undefined;
    jest.restoreAllMocks();
});

/**
 * Run `ctrl-q qseow task-vis` with arguments and environment variables.
 *
 * @param {string[]} args - Command line arguments after the mandatory ones.
 * @param {object} [env] - Environment variables.
 * @returns {Promise<object|null>} The options visTask() was called with, or null if it was not called.
 */
async function run(args = [], env = {}) {
    Object.assign(process.env, env);
    const program = new Command();
    program.exitOverride();
    setupQseowVisualiseTaskCommand(program.command('qseow'));
    await program.parseAsync(['node', 'ctrl-q', 'qseow', 'task-vis', ...MANDATORY, ...args]);
    return visTask.mock.calls.at(-1)?.[0] ?? null;
}

describe('qseow task-vis command line', () => {
    test('the page server listens on localhost:3000 by default', async () => {
        const options = await run();

        expect(options).toMatchObject({ visHost: 'localhost', visPort: '3000' });
        expect(process.exitCode).toBeUndefined();
    });

    test('--vis-host and --vis-port, or their environment variables, pick another host and port', async () => {
        expect(await run(['--vis-host', '0.0.0.0', '--vis-port', '3333'])).toMatchObject({ visHost: '0.0.0.0', visPort: '3333' });
        expect(await run([], { CTRLQ_VIS_HOST: 'myhost.example.com', CTRLQ_VIS_PORT: '4444' })).toMatchObject({
            visHost: 'myhost.example.com',
            visPort: '4444',
        });
    });

    test('--vis-allow-remote is off by default, and on when given without a value', async () => {
        expect((await run()).visAllowRemote).toBeUndefined();
        expect(await run(['--vis-host', '0.0.0.0', '--vis-allow-remote'])).toMatchObject({ visHost: '0.0.0.0', visAllowRemote: true });
    });

    test('--vis-allow-remote also comes from CTRLQ_VIS_ALLOW_REMOTE, as for task-gantt', async () => {
        expect((await run([], { CTRLQ_VIS_ALLOW_REMOTE: 'true' })).visAllowRemote).toBe('true');
    });

    test('the option checks learn which options came from environment variables', async () => {
        await run(['--vis-port', '3333'], { CTRLQ_VIS_HOST: '0.0.0.0' });
        const { fromEnv } = visTaskAssertOptions.mock.calls.at(-1)[1];

        expect(fromEnv.has('visHost')).toBe(true);
        expect(fromEnv.has('visPort')).toBe(false);
    });

    test('the exit code is 1 when the task network cannot be loaded', async () => {
        visTask.mockResolvedValueOnce(false);
        await run();

        expect(process.exitCode).toBe(1);
    });

    test('the exit code is 1, and the reason is logged, when the web server cannot start', async () => {
        const error = jest.spyOn(logger, 'error').mockImplementation(() => {});
        visTask.mockRejectedValueOnce(new Error('Port 3000 on localhost is already in use.'));
        await run();

        expect(process.exitCode).toBe(1);
        expect(error.mock.calls.some(([msg]) => String(msg).includes('Port 3000 on localhost is already in use.'))).toBe(true);
    });
});
