import { jest, test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';

import { logger } from '../../../globals.js';
import {
    parseDuration,
    parseFlag,
    expandHome,
    toList,
    validateTaskGanttOptions,
    SELECTABLE_SOURCES,
    DEFAULT_HISTORY_DIR,
} from '../../../lib/task-gantt/options.js';
import { taskGanttAssertOptions } from '../../../lib/util/qseow/assert-options.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// Real task/app ids from the lab fixture (Content Monitor and Operations Monitor reload tasks)
const TASK_ID_1 = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
const TASK_ID_2 = '0419086f-a935-4358-a356-da2f79069e78';
const APP_ID = 'b3a1c2d4-1e2f-4a5b-8c9d-0e1f2a3b4c5d';

/**
 * Options as commander hands them to the action handler when only the mandatory options are given,
 * i.e. with the CLI defaults filled in (all values that come from the command line are strings).
 *
 * @param {object} overrides - Options to change.
 * @returns {object} Options.
 */
function cliOptions(overrides = {}) {
    return {
        logLevel: 'info',
        host: 'sense-node1.example.com',
        qrsPort: '4242',
        virtualProxy: '',
        secure: true,
        authType: 'cert',
        authUserDir: 'LAB',
        authUserId: 'ctrlq',
        authCertFile: './cert/client.pem',
        authCertKeyFile: './cert/client_key.pem',
        authRootCertFile: './cert/root.pem',
        lookback: '7d',
        sources: [...SELECTABLE_SOURCES],
        pollInterval: '15',
        historyDir: DEFAULT_HISTORY_DIR,
        historyRetentionDays: '90',
        taskType: ['reload', 'ext-program'],
        visHost: 'localhost',
        visPort: '3001',
        ...overrides,
    };
}

/**
 * Validate options that are expected to be invalid and return the error messages.
 *
 * @param {object} overrides - Options to change from the CLI defaults.
 * @returns {string[]} Errors.
 */
function errorsFor(overrides) {
    const result = validateTaskGanttOptions(cliOptions(overrides));
    expect(result.ok).toBe(false);
    expect(result.config).toBeNull();
    return result.errors;
}

/**
 * Validate options that are expected to be valid and return the resulting config.
 *
 * @param {object} overrides - Options to change from the CLI defaults.
 * @returns {object} Config.
 */
function configFor(overrides) {
    const result = validateTaskGanttOptions(cliOptions(overrides));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    return result.config;
}

describe('toList and parseFlag', () => {
    test('toList flattens, splits, trims and drops empty values', () => {
        expect(toList(undefined)).toEqual([]);
        expect(toList(null)).toEqual([]);
        expect(toList('a, b  c')).toEqual(['a', 'b', 'c']);
        expect(toList(['a,b', ' c '])).toEqual(['a', 'b', 'c']);
        expect(toList(['a b, c d'], /,/)).toEqual(['a b', 'c d']);
        expect(toList(['a b', ''], null)).toEqual(['a b']);
    });

    test('parseFlag', () => {
        expect(parseFlag(undefined)).toBe(false);
        expect(parseFlag(null)).toBe(false);
        expect(parseFlag(false)).toBe(false);
        expect(parseFlag(true)).toBe(true);
        expect(parseFlag(' Yes ')).toBe(true);
        expect(parseFlag('off')).toBe(false);
        expect(parseFlag('2')).toBeNull();
    });
});

describe('parseDuration', () => {
    test.each([
        ['30m', 30 * MIN],
        ['12h', 12 * HOUR],
        ['7d', 7 * DAY],
        ['4w', 4 * WEEK],
        ['1m', MIN],
        ['0m', 0],
    ])('parses %s', (value, expected) => {
        expect(parseDuration(value)).toBe(expected);
    });

    test('units are case-insensitive', () => {
        expect(parseDuration('12H')).toBe(12 * HOUR);
        expect(parseDuration('2W')).toBe(2 * WEEK);
        expect(parseDuration('10M')).toBe(10 * MIN);
        expect(parseDuration('3D')).toBe(3 * DAY);
    });

    test('accepts decimals and rounds to whole milliseconds', () => {
        expect(parseDuration('1.5h')).toBe(90 * MIN);
        expect(parseDuration('0.5d')).toBe(12 * HOUR);
        expect(parseDuration('2.25w')).toBe(2.25 * WEEK);
        // 1/3 minute = 20000 ms exactly, 0.0001 minute = 6 ms
        expect(parseDuration('0.0001m')).toBe(6);
        expect(Number.isInteger(parseDuration('0.33333m'))).toBe(true);
        expect(parseDuration('0.33333m')).toBe(Math.round(0.33333 * MIN));
    });

    test('ignores surrounding whitespace and whitespace between number and unit', () => {
        expect(parseDuration('  12h  ')).toBe(12 * HOUR);
        expect(parseDuration('12 h')).toBe(12 * HOUR);
        expect(parseDuration('\t7\td\n')).toBe(7 * DAY);
    });

    test.each([
        ['12', 'number without unit'],
        ['h', 'unit without number'],
        ['12s', 'seconds are not a supported unit'],
        ['1y', 'years are not a supported unit'],
        ['12hours', 'long unit name'],
        ['12hh', 'repeated unit'],
        ['1h30m', 'combined units'],
        ['-1h', 'negative number'],
        ['+1h', 'explicit sign'],
        ['.5h', 'decimal without leading digit'],
        ['1.h', 'decimal point without decimals'],
        ['1,5h', 'decimal comma'],
        ['1e3m', 'exponent notation'],
        ['1 2h', 'space inside the number'],
        ['', 'empty string'],
        ['   ', 'whitespace only'],
    ])('returns null for %j (%s)', (value) => {
        expect(parseDuration(value)).toBeNull();
    });

    test('returns null for null, undefined and non-string values without a unit', () => {
        expect(parseDuration(null)).toBeNull();
        expect(parseDuration(undefined)).toBeNull();
        expect(parseDuration(12)).toBeNull();
        expect(parseDuration({})).toBeNull();
        expect(parseDuration([])).toBeNull();
    });

    test('stringifies non-string input', () => {
        // A single-element array stringifies to its element
        expect(parseDuration(['12h'])).toBe(12 * HOUR);
    });
});

describe('expandHome', () => {
    const home = path.join(path.sep, 'home', 'tester');

    test('expands a lone ~ to the home directory', () => {
        expect(expandHome('~', home)).toBe(home);
    });

    test('expands ~/ to a path under the home directory', () => {
        expect(expandHome('~/x', home)).toBe(path.join(home, 'x'));
        expect(expandHome('~/.ctrl-q/task-history', home)).toBe(path.join(home, '.ctrl-q', 'task-history'));
        expect(expandHome('~/', home)).toBe(home);
    });

    test('expands ~\\ (Windows separator) as well', () => {
        expect(expandHome('~\\x', home)).toBe(path.join(home, 'x'));
    });

    test('normalises .. segments after ~/', () => {
        expect(expandHome('~/a/../b', home)).toBe(path.join(home, 'b'));
    });

    test('expands the default history dir to a path under the home directory', () => {
        expect(expandHome(DEFAULT_HISTORY_DIR, home)).toBe(path.join(home, '.ctrl-q', 'task-history'));
    });

    test('does not treat ~user or a ~ elsewhere in the path as the home directory', () => {
        expect(expandHome('~other/x', home)).toBe(path.resolve('~other/x'));
        expect(expandHome('a/~/b', home)).toBe(path.resolve('a/~/b'));
    });

    test('resolves relative paths against the current directory', () => {
        expect(expandHome('history', home)).toBe(path.join(process.cwd(), 'history'));
        expect(expandHome('./a/b', home)).toBe(path.join(process.cwd(), 'a', 'b'));
        expect(path.isAbsolute(expandHome('../x', home))).toBe(true);
    });

    test('leaves absolute paths as they are (normalised)', () => {
        const abs = path.join(os.tmpdir(), 'ctrl-q-history');
        expect(expandHome(abs, home)).toBe(abs);
        expect(expandHome(path.join(abs, 'sub', '..'), home)).toBe(abs);
    });

    test('treats empty, null and undefined as the current directory', () => {
        expect(expandHome('', home)).toBe(process.cwd());
        expect(expandHome(null, home)).toBe(process.cwd());
        expect(expandHome(undefined, home)).toBe(process.cwd());
    });

    test('defaults to the real home directory', () => {
        expect(expandHome('~')).toBe(os.homedir());
        expect(expandHome('~/x')).toBe(path.join(os.homedir(), 'x'));
    });
});

describe('validateTaskGanttOptions: valid input', () => {
    test('returns the full config for the CLI defaults', () => {
        const result = validateTaskGanttOptions(cliOptions());

        expect(result).toEqual({
            ok: true,
            errors: [],
            config: {
                qseow: {
                    host: 'sense-node1.example.com',
                    qrsPort: '4242',
                    port: '4242',
                    virtualProxy: '',
                    secure: true,
                    authType: 'cert',
                    authUserDir: 'LAB',
                    authUserId: 'ctrlq',
                    authCertFile: './cert/client.pem',
                    authCertKeyFile: './cert/client_key.pem',
                    authRootCertFile: './cert/root.pem',
                    authJwt: undefined,
                },
                lookbackMs: 7 * DAY,
                sources: ['qrs', 'history-file'],
                pollIntervalMs: 15000,
                historyDir: path.join(os.homedir(), '.ctrl-q', 'task-history'),
                historyRetentionDays: 90,
                filters: { taskTypes: [0, 1], taskIds: [], taskTags: [], appIds: [], appTags: [] },
                visHost: 'localhost',
                visPort: 3001,
                allowRemote: false,
            },
        });
    });

    test('does not leak CLI-only options such as the log level into the config', () => {
        const config = configFor({ logLevel: 'debug' });

        expect(JSON.stringify(config)).not.toContain('debug');
        expect(config).not.toHaveProperty('logLevel');
        expect(config.qseow).not.toHaveProperty('logLevel');
    });

    test('passes JWT auth options through to the qseow block', () => {
        const config = configFor({
            authType: 'jwt',
            authJwt: 'header.payload.signature',
            qrsPort: '443',
            virtualProxy: 'jwt',
            secure: 'false',
        });

        expect(config.qseow).toMatchObject({
            authType: 'jwt',
            authJwt: 'header.payload.signature',
            qrsPort: '443',
            port: '443',
            virtualProxy: 'jwt',
            secure: 'false',
        });
    });

    describe('qseow ports', () => {
        test('qrsPort is used for both qrsPort and port', () => {
            const config = configFor({ qrsPort: '4243' });

            expect(config.qseow.qrsPort).toBe('4243');
            expect(config.qseow.port).toBe('4243');
        });

        test('falls back to --port when --qrs-port is not set', () => {
            const config = configFor({ qrsPort: undefined, port: '443' });

            expect(config.qseow.qrsPort).toBe('443');
            expect(config.qseow.port).toBe('443');
        });

        test('qrsPort wins over port', () => {
            const config = configFor({ qrsPort: '4242', port: '443' });

            expect(config.qseow.qrsPort).toBe('4242');
            expect(config.qseow.port).toBe('4242');
        });

        test('defaults to 4242 when neither is set', () => {
            const config = configFor({ qrsPort: undefined });

            expect(config.qseow.qrsPort).toBe('4242');
            expect(config.qseow.port).toBe('4242');
        });

        test('numeric ports are turned into strings', () => {
            const config = configFor({ qrsPort: 4242 });

            expect(config.qseow.qrsPort).toBe('4242');
            expect(config.qseow.port).toBe('4242');
        });

        test('null qrsPort also falls back to port', () => {
            expect(configFor({ qrsPort: null, port: 443 }).qseow.port).toBe('443');
        });
    });

    test('virtual proxy defaults to an empty string', () => {
        expect(configFor({ virtualProxy: undefined }).qseow.virtualProxy).toBe('');
        expect(configFor({ virtualProxy: 'hdr' }).qseow.virtualProxy).toBe('hdr');
    });

    describe('lookback', () => {
        test.each([
            ['10m', 10 * MIN],
            ['0.5h', 30 * MIN],
            ['12h', 12 * HOUR],
            ['90d', 90 * DAY],
            ['12w', 12 * WEEK],
            ['2160h', 90 * DAY],
        ])('accepts %s', (lookback, expected) => {
            expect(configFor({ lookback }).lookbackMs).toBe(expected);
        });
    });

    describe('sources', () => {
        test('qrs is always added, first, when not selected', () => {
            expect(configFor({ sources: ['history-file'] }).sources).toEqual(['qrs', 'history-file']);
        });

        test('qrs is the only source when no sources are given', () => {
            expect(configFor({ sources: undefined }).sources).toEqual(['qrs']);
            expect(configFor({ sources: null }).sources).toEqual(['qrs']);
            expect(configFor({ sources: [] }).sources).toEqual(['qrs']);
            expect(configFor({ sources: '' }).sources).toEqual(['qrs']);
        });

        test('keeps the selected order when qrs is selected explicitly', () => {
            expect(configFor({ sources: ['qrs'] }).sources).toEqual(['qrs']);
            expect(configFor({ sources: ['history-file', 'qrs'] }).sources).toEqual(['history-file', 'qrs']);
        });

        test('accepts a comma or space separated string, e.g. from an environment variable', () => {
            expect(configFor({ sources: 'history-file' }).sources).toEqual(['qrs', 'history-file']);
            expect(configFor({ sources: 'qrs,history-file' }).sources).toEqual(['qrs', 'history-file']);
            expect(configFor({ sources: 'qrs history-file' }).sources).toEqual(['qrs', 'history-file']);
            expect(configFor({ sources: ' qrs , history-file ' }).sources).toEqual(['qrs', 'history-file']);
        });

        test('does not modify the options, so the shared commander default array stays intact', () => {
            const sources = ['history-file'];
            configFor({ sources });

            expect(sources).toEqual(['history-file']);
            expect(SELECTABLE_SOURCES).toEqual(['qrs', 'history-file']);
        });
    });

    describe('poll interval', () => {
        test('0 turns live updates off', () => {
            expect(configFor({ pollInterval: '0' }).pollIntervalMs).toBe(0);
            expect(configFor({ pollInterval: 0 }).pollIntervalMs).toBe(0);
        });

        test('5 seconds is the shortest interval', () => {
            expect(configFor({ pollInterval: '5' }).pollIntervalMs).toBe(5000);
        });

        test('is converted to milliseconds', () => {
            expect(configFor({ pollInterval: '60' }).pollIntervalMs).toBe(60000);
            expect(configFor({ pollInterval: 3600 }).pollIntervalMs).toBe(3600000);
        });
    });

    describe('history', () => {
        test('expands ~ in --history-dir', () => {
            expect(configFor({ historyDir: '~/gantt' }).historyDir).toBe(path.join(os.homedir(), 'gantt'));
        });

        test('uses the default history dir when --history-dir is empty or missing', () => {
            const expected = path.join(os.homedir(), '.ctrl-q', 'task-history');

            expect(configFor({ historyDir: undefined }).historyDir).toBe(expected);
            expect(configFor({ historyDir: '' }).historyDir).toBe(expected);
        });

        test('makes a relative --history-dir absolute', () => {
            expect(configFor({ historyDir: 'hist' }).historyDir).toBe(path.resolve('hist'));
        });

        test('keeps an absolute --history-dir', () => {
            const dir = path.join(os.tmpdir(), 'ctrl-q-gantt-history');
            expect(configFor({ historyDir: dir }).historyDir).toBe(dir);
        });

        test('retention days is turned into a number', () => {
            expect(configFor({ historyRetentionDays: '1' }).historyRetentionDays).toBe(1);
            expect(configFor({ historyRetentionDays: 365 }).historyRetentionDays).toBe(365);
        });
    });

    describe('task type filter', () => {
        test('maps task type names to QRS task type codes', () => {
            const config = configFor({ taskType: ['reload', 'ext-program', 'user-sync', 'distribute', 'preload'] });

            expect(config.filters.taskTypes).toEqual([0, 1, 2, 3, 4]);
        });

        test('keeps the given order', () => {
            expect(configFor({ taskType: ['preload', 'reload'] }).filters.taskTypes).toEqual([4, 0]);
        });

        test('accepts a single string or a comma separated string', () => {
            expect(configFor({ taskType: 'reload' }).filters.taskTypes).toEqual([0]);
            expect(configFor({ taskType: 'reload,distribute' }).filters.taskTypes).toEqual([0, 3]);
        });

        test('no task types gives an empty list', () => {
            expect(configFor({ taskType: undefined }).filters.taskTypes).toEqual([]);
        });
    });

    describe('id and tag filters', () => {
        test('passes task ids, app ids and tags through', () => {
            const config = configFor({
                taskId: [TASK_ID_1, TASK_ID_2],
                appId: [APP_ID],
                taskTag: ['nightly', 'finance'],
                appTag: ['monitor'],
            });

            expect(config.filters).toEqual({
                taskTypes: [0, 1],
                taskIds: [TASK_ID_1, TASK_ID_2],
                taskTags: ['nightly', 'finance'],
                appIds: [APP_ID],
                appTags: ['monitor'],
            });
        });

        test('ids are split on commas and spaces, also within one value, and empty entries are dropped', () => {
            const config = configFor({ taskId: [`${TASK_ID_1},,${TASK_ID_2}`], appId: ` ${APP_ID} ` });

            expect(config.filters.taskIds).toEqual([TASK_ID_1, TASK_ID_2]);
            expect(config.filters.appIds).toEqual([APP_ID]);
        });

        test('tags given on the command line are kept whole, also with spaces or commas in them', () => {
            const config = configFor({ taskTag: ['Finance dept', 'a,b'], appTag: ['', 'c'] });

            expect(config.filters.taskTags).toEqual(['Finance dept', 'a,b']);
            expect(config.filters.appTags).toEqual(['c']);
        });

        test('tags from an environment variable are separated by commas only, since tag names may contain spaces', () => {
            // Commander passes an environment variable of a list option as one value
            const result = validateTaskGanttOptions(cliOptions({ taskTag: ['Finance dept, HR,,'], appTag: ['Sales team'] }), {
                fromEnv: new Set(['taskTag', 'appTag']),
            });

            expect(result.config.filters.taskTags).toEqual(['Finance dept', 'HR']);
            expect(result.config.filters.appTags).toEqual(['Sales team']);
        });

        test('sources, task types and ids from environment variables may hold several values', () => {
            const result = validateTaskGanttOptions(
                cliOptions({ sources: ['qrs history-file'], taskType: ['reload user-sync'], taskId: [`${TASK_ID_1} ${TASK_ID_2}`] }),
                { fromEnv: new Set(['sources', 'taskType', 'taskId']) }
            );

            expect(result.errors).toEqual([]);
            expect(result.config.sources).toEqual(['qrs', 'history-file']);
            expect(result.config.filters.taskTypes).toEqual([0, 2]);
            expect(result.config.filters.taskIds).toEqual([TASK_ID_1, TASK_ID_2]);
        });

        test('accepts upper case GUIDs', () => {
            expect(configFor({ taskId: [TASK_ID_1.toUpperCase()] }).filters.taskIds).toEqual([TASK_ID_1.toUpperCase()]);
        });
    });

    describe('web page server', () => {
        test('vis host defaults to localhost', () => {
            expect(configFor({ visHost: undefined }).visHost).toBe('localhost');
            expect(configFor({ visHost: '' }).visHost).toBe('localhost');
        });

        test.each(['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '::1', '[::1]'])(
            'loopback host %s needs no confirmation',
            (visHost) => {
                const config = configFor({ visHost });

                expect(config.visHost).toBe(visHost);
                expect(config.allowRemote).toBe(false);
            }
        );

        test('vis port is turned into a number, 0 and 65535 included', () => {
            expect(configFor({ visPort: '3001' }).visPort).toBe(3001);
            expect(configFor({ visPort: '0' }).visPort).toBe(0);
            expect(configFor({ visPort: '65535' }).visPort).toBe(65535);
            expect(configFor({ visPort: 8080 }).visPort).toBe(8080);
        });

        test('a non-loopback vis host is accepted with --vis-allow-remote', () => {
            const config = configFor({ visHost: '0.0.0.0', visAllowRemote: true });

            expect(config.visHost).toBe('0.0.0.0');
            expect(config.allowRemote).toBe(true);
        });

        test('--vis-allow-remote also accepts the string "true", e.g. from CTRLQ_VIS_ALLOW_REMOTE', () => {
            const config = configFor({ visHost: '192.168.1.10', visAllowRemote: 'true' });

            expect(config.allowRemote).toBe(true);
        });

        test('--vis-allow-remote with a loopback host is accepted and recorded', () => {
            expect(configFor({ visHost: 'localhost', visAllowRemote: true }).allowRemote).toBe(true);
        });
    });
});

describe('validateTaskGanttOptions: errors', () => {
    describe('lookback', () => {
        test.each(['12', 'abc', '12s', '-1d', ''])('rejects malformed lookback %j', (lookback) => {
            expect(errorsFor({ lookback })).toEqual([
                `Invalid --lookback "${lookback}". Use a number followed by m, h, d or w, e.g. 12h or 7d.`,
            ]);
        });

        test('a missing lookback is reported as invalid', () => {
            expect(errorsFor({ lookback: undefined })).toEqual([
                'Invalid --lookback "undefined". Use a number followed by m, h, d or w, e.g. 12h or 7d.',
            ]);
        });

        test.each(['9m', '0m', '0.1h', '9.99m', '91d', '13w', '2161h'])('rejects lookback %s outside 10m..90d', (lookback) => {
            expect(errorsFor({ lookback })).toEqual([`--lookback must be between 10m and 90d, got "${lookback}".`]);
        });
    });

    describe('sources', () => {
        test('rejects an unknown source', () => {
            expect(errorsFor({ sources: ['qrs', 'bogus'] })).toEqual([
                'Unknown source "bogus" in --sources. Valid sources: qrs, history-file.',
            ]);
        });

        test('sources that exist internally but are not selectable are rejected', () => {
            expect(errorsFor({ sources: ['ops-monitor', 'sched-log'] })).toEqual([
                'Unknown source "ops-monitor" in --sources. Valid sources: qrs, history-file.',
                'Unknown source "sched-log" in --sources. Valid sources: qrs, history-file.',
            ]);
        });

        test('source names are case-sensitive', () => {
            expect(errorsFor({ sources: 'QRS' })).toEqual(['Unknown source "QRS" in --sources. Valid sources: qrs, history-file.']);
        });
    });

    describe('poll interval', () => {
        test.each(['1', '4', 1, 4])('rejects %j: between 0 and 5 seconds', (pollInterval) => {
            expect(errorsFor({ pollInterval })).toEqual(['--poll-interval must be 0 (no live updates) or at least 5 seconds.']);
        });

        test.each(['2.5', '15.5', '-5', '-1', 'abc', '15s', undefined])('rejects %j: not a whole, non-negative number', (pollInterval) => {
            expect(errorsFor({ pollInterval })).toEqual([`--poll-interval must be a whole number of seconds, got "${pollInterval}".`]);
        });
    });

    describe('history retention days', () => {
        test.each(['0', '-1', '1.5', 'abc', '30d', undefined, 0])('rejects %j', (historyRetentionDays) => {
            expect(errorsFor({ historyRetentionDays })).toEqual([
                `--history-retention-days must be a whole number of days, at least 1, got "${historyRetentionDays}".`,
            ]);
        });
    });

    describe('vis port', () => {
        test.each(['-1', '65536', '70000', '30.5', 'abc', undefined])('rejects %j', (visPort) => {
            expect(errorsFor({ visPort })).toEqual([`--vis-port must be a port number (0-65535), got "${visPort}".`]);
        });
    });

    describe('vis host', () => {
        const remoteError = (host) =>
            `--vis-host ${host} makes the page reachable from other computers. Add --vis-allow-remote to confirm; the page is then protected by a random access token.`;

        test.each(['0.0.0.0', '192.168.1.10', 'sense-node1.example.com', '::', 'localhost.example.com', '127.0.0.1.example.com'])(
            'non-loopback host %s requires --vis-allow-remote',
            (visHost) => {
                expect(errorsFor({ visHost })).toEqual([remoteError(visHost)]);
            }
        );

        test.each([false, 'false', 'FALSE', '0', 'no', 'off', '', undefined])(
            '--vis-allow-remote %j does not count as confirmation',
            (visAllowRemote) => {
                expect(errorsFor({ visHost: '0.0.0.0', visAllowRemote })).toEqual([remoteError('0.0.0.0')]);
            }
        );

        test.each([true, 'true', 'TRUE', '1', 1, 'yes', 'on'])('--vis-allow-remote %j confirms', (visAllowRemote) => {
            expect(configFor({ visHost: '0.0.0.0', visAllowRemote }).allowRemote).toBe(true);
        });

        test('an unclear --vis-allow-remote value is an error', () => {
            expect(errorsFor({ visHost: 'localhost', visAllowRemote: 'maybe' })).toEqual([
                '--vis-allow-remote must be true or false, got "maybe".',
            ]);
        });

        test('the error says when the host came from the CTRLQ_VIS_HOST environment variable', () => {
            const result = validateTaskGanttOptions(cliOptions({ visHost: '0.0.0.0' }), { fromEnv: new Set(['visHost']) });

            expect(result.errors).toEqual([
                '--vis-host 0.0.0.0 (from CTRLQ_VIS_HOST) makes the page reachable from other computers. Add --vis-allow-remote to confirm; the page is then protected by a random access token.',
            ]);
        });
    });

    describe('task type', () => {
        test('rejects an unknown task type', () => {
            expect(errorsFor({ taskType: ['reload', 'bogus'] })).toEqual(['Unknown task type "bogus" in --task-type.']);
        });

        test('task type names are case-sensitive', () => {
            expect(errorsFor({ taskType: 'Reload' })).toEqual(['Unknown task type "Reload" in --task-type.']);
        });

        // Object.prototype keys pass the `t in TASK_TYPE_CODES` check, and the function value ends up in filters.taskTypes.
        // Commander's .choices() blocks these on the command line, but the validator itself should reject them too.
        test.each(['toString', 'constructor', 'hasOwnProperty', '__proto__'])(
            'rejects Object.prototype key %s as a task type',
            (taskType) => {
                expect(errorsFor({ taskType })).toEqual([`Unknown task type "${taskType}" in --task-type.`]);
            }
        );
    });

    describe('task and app ids', () => {
        test('rejects a task id that is not a GUID', () => {
            expect(errorsFor({ taskId: [TASK_ID_1, 'not-a-guid'] })).toEqual([
                '"not-a-guid" is not a valid task/app id (expected a GUID).',
            ]);
        });

        test('rejects an app id that is not a GUID', () => {
            expect(errorsFor({ appId: 'Operations Monitor' })).toEqual([
                '"Operations" is not a valid task/app id (expected a GUID).',
                '"Monitor" is not a valid task/app id (expected a GUID).',
            ]);
        });

        test('rejects GUIDs with braces or wrong length', () => {
            expect(errorsFor({ taskId: [`{${TASK_ID_1}}`, TASK_ID_1.slice(0, -1)] })).toEqual([
                `"{${TASK_ID_1}}" is not a valid task/app id (expected a GUID).`,
                `"${TASK_ID_1.slice(0, -1)}" is not a valid task/app id (expected a GUID).`,
            ]);
        });

        test('reports task id errors before app id errors', () => {
            expect(errorsFor({ appId: ['bad-app'], taskId: ['bad-task'] })).toEqual([
                '"bad-task" is not a valid task/app id (expected a GUID).',
                '"bad-app" is not a valid task/app id (expected a GUID).',
            ]);
        });
    });

    test('collects all errors in one pass, in option order', () => {
        const result = validateTaskGanttOptions(
            cliOptions({
                lookback: '1m',
                sources: ['bogus'],
                pollInterval: '3',
                historyRetentionDays: '0',
                visPort: '99999',
                visHost: '10.0.0.1',
                taskType: ['nope'],
                taskId: ['x'],
                appId: ['y'],
            })
        );

        expect(result).toEqual({
            ok: false,
            config: null,
            errors: [
                '--lookback must be between 10m and 90d, got "1m".',
                'Unknown source "bogus" in --sources. Valid sources: qrs, history-file.',
                '--poll-interval must be 0 (no live updates) or at least 5 seconds.',
                '--history-retention-days must be a whole number of days, at least 1, got "0".',
                '--vis-port must be a port number (0-65535), got "99999".',
                '--vis-host 10.0.0.1 makes the page reachable from other computers. Add --vis-allow-remote to confirm; the page is then protected by a random access token.',
                'Unknown task type "nope" in --task-type.',
                '"x" is not a valid task/app id (expected a GUID).',
                '"y" is not a valid task/app id (expected a GUID).',
            ],
        });
    });

    test('an empty options object reports every mandatory value as invalid', () => {
        const result = validateTaskGanttOptions({});

        expect(result.ok).toBe(false);
        expect(result.errors).toEqual([
            'Invalid --lookback "undefined". Use a number followed by m, h, d or w, e.g. 12h or 7d.',
            '--poll-interval must be a whole number of seconds, got "undefined".',
            '--history-retention-days must be a whole number of days, at least 1, got "undefined".',
            '--vis-port must be a port number (0-65535), got "undefined".',
        ]);
    });
});

describe('taskGanttAssertOptions', () => {
    let exitSpy;
    let errorSpy;

    beforeEach(() => {
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit(${code})`);
        });
        errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        exitSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test('returns the config for valid options without logging errors or exiting', () => {
        const options = cliOptions({ sources: ['history-file'], taskId: [TASK_ID_1] });

        const config = taskGanttAssertOptions(options);

        expect(config).toEqual(validateTaskGanttOptions(options).config);
        expect(config.sources).toEqual(['qrs', 'history-file']);
        expect(config.filters.taskIds).toEqual([TASK_ID_1]);
        expect(exitSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test('logs each error and exits with code 1 for invalid options', () => {
        const options = cliOptions({ lookback: '100d', visHost: '0.0.0.0', taskId: ['nope'] });

        expect(() => taskGanttAssertOptions(options)).toThrow('process.exit(1)');

        expect(exitSpy).toHaveBeenCalledTimes(1);
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy.mock.calls).toEqual([
            ['--lookback must be between 10m and 90d, got "100d".'],
            [
                '--vis-host 0.0.0.0 makes the page reachable from other computers. Add --vis-allow-remote to confirm; the page is then protected by a random access token.',
            ],
            ['"nope" is not a valid task/app id (expected a GUID).'],
        ]);
    });

    test('logs all errors before exiting', () => {
        const order = [];
        errorSpy.mockImplementation(() => order.push('error'));
        exitSpy.mockImplementation((code) => {
            order.push(`exit ${code}`);
            throw new Error('exit');
        });

        expect(() => taskGanttAssertOptions(cliOptions({ pollInterval: '2', visPort: 'x' }))).toThrow('exit');
        expect(order).toEqual(['error', 'error', 'exit 1']);
    });

    test('a single invalid option gives a single error line', () => {
        expect(() => taskGanttAssertOptions(cliOptions({ historyRetentionDays: '0' }))).toThrow('process.exit(1)');

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('--history-retention-days must be a whole number of days, at least 1, got "0".');
    });
});

describe('validateTaskGanttOptions: numeric options must be whole numbers', () => {
    // An empty value (e.g. an empty CTRLQ_POLL_INTERVAL env var) must not silently become 0
    test.each([
        ['pollInterval', '--poll-interval'],
        ['visPort', '--vis-port'],
        ['historyRetentionDays', '--history-retention-days'],
    ])('%s rejects empty, blank, exponent and hex values', (option, flag) => {
        for (const value of ['', '   ', '1e1', '0x10', '1.5', '-1']) {
            const errors = errorsFor({ [option]: value });
            expect(errors.some((e) => e.includes(flag))).toBe(true);
        }
    });

    test('surrounding whitespace is fine', () => {
        const config = configFor({ pollInterval: ' 30 ', visPort: ' 3005 ', historyRetentionDays: ' 10 ' });

        expect(config.pollIntervalMs).toBe(30000);
        expect(config.visPort).toBe(3005);
        expect(config.historyRetentionDays).toBe(10);
    });
});
