/**
 * Unit tests for src/lib/util/jwt-env.js, and for how src/ctrl-q.js uses it.
 *
 * Every command option that takes a JWT reads it from CTRLQ_AUTH_JWT. CTRLQ_JWT, which
 * some commands used to read instead, still works as a deprecated stand-in for it.
 */

import { jest, test, expect, describe, beforeEach, afterEach, afterAll } from '@jest/globals';
import fs from 'node:fs';
import { Command, Option } from 'commander';
import { settled } from '../helpers/settled.mjs';

const { aliasDeprecatedJwtEnvVar, usesJwtAuth } = await import('../../lib/util/jwt-env.js');

const DEPRECATED_WARNING = 'Environment variable CTRLQ_JWT is deprecated, use CTRLQ_AUTH_JWT instead.';
const IGNORED_WARNING = 'Environment variable CTRLQ_JWT is deprecated and ignored, as CTRLQ_AUTH_JWT is also set.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up every command defined in src/lib/cli, and return all of them, subcommands included,
 * each with the file that defines it.
 */
const getCliCommands = async () => {
    const cliFiles = fs.readdirSync(new URL('../../lib/cli/', import.meta.url)).filter((file) => file.endsWith('.js'));
    const commands = [];
    const collect = (command, file) => {
        commands.push({ file, command });
        command.commands.forEach((subcommand) => collect(subcommand, file));
    };

    for (const file of cliFiles) {
        const cliModule = await import(`../../lib/cli/${file}`);

        for (const setupCommand of Object.values(cliModule)) {
            // Fresh parent per setup function, as Commander refuses two subcommands with the same name
            const parent = new Command();
            setupCommand(parent);
            parent.commands.forEach((command) => collect(command, file));
        }
    }

    return commands;
};

/**
 * Every option of the commands in src/lib/cli that takes a JWT: one that reads a JWT from the
 * environment, or whose name says it takes one and that isn't a hidden alias.
 */
const getCliJwtOptions = async () =>
    (await getCliCommands()).flatMap(({ file, command }) =>
        command.options
            .filter((option) => /jwt/i.test(option.envVar ?? '') || (/jwt/i.test(option.long ?? '') && !option.hidden))
            .map((option) => ({ file, command, option }))
    );

/**
 * Alias CTRLQ_JWT the way src/ctrl-q.js does, then parse args with a command that has the given
 * options. Returns the options the action handler received and the warning, if any.
 */
const run = async (args, ...options) => {
    const warning = aliasDeprecatedJwtEnvVar();
    const result = { warning };

    const command = new Command('task-get').exitOverride().action((parsedOptions) => {
        result.options = parsedOptions;
    });
    options.forEach((option) => command.addOption(option));

    await command.parseAsync(args, { from: 'user' });
    return result;
};

const jwtOption = () => new Option('--auth-jwt <jwt>', 'JWT').env('CTRLQ_AUTH_JWT');
const authTypeOption = () => new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert');

const originalEnv = { CTRLQ_JWT: process.env.CTRLQ_JWT, CTRLQ_AUTH_JWT: process.env.CTRLQ_AUTH_JWT };
const originalArgv = process.argv;

beforeEach(() => {
    delete process.env.CTRLQ_JWT;
    delete process.env.CTRLQ_AUTH_JWT;
});

afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
});

afterAll(() => {
    Object.entries(originalEnv).forEach(([name, value]) => {
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    });
});

// ---------------------------------------------------------------------------
// CLI definitions
// ---------------------------------------------------------------------------

describe('CLI options that take a JWT', () => {
    test('should all read it from CTRLQ_AUTH_JWT', async () => {
        const jwtOptions = await getCliJwtOptions();
        expect(jwtOptions.length).toBeGreaterThan(0);

        const otherEnvVars = jwtOptions
            .filter(({ option }) => option.envVar !== 'CTRLQ_AUTH_JWT')
            .map(({ file, command, option }) => `${file}: ${command.name()} ${option.long} reads ${option.envVar}`);
        expect(otherEnvVars).toEqual([]);
    });

    test('should be --auth-jwt in every command that offers JWT authentication', async () => {
        const offersJwtAuth = (command) =>
            command.options.some((option) => option.attributeName() === 'authType' && option.argChoices?.includes('jwt'));
        const jwtAuthCommands = (await getCliCommands()).filter(({ command }) => offersJwtAuth(command));
        expect(jwtAuthCommands.length).toBeGreaterThan(0);

        // The QRS and engine connections, and the check for a missing JWT, all read options.authJwt
        const withoutAuthJwt = jwtAuthCommands
            .filter(
                ({ command }) =>
                    !command.options.some((option) => option.attributeName() === 'authJwt' && option.envVar === 'CTRLQ_AUTH_JWT')
            )
            .map(({ file, command }) => `${file}: ${command.name()}`);
        expect(withoutAuthJwt).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// aliasDeprecatedJwtEnvVar
// ---------------------------------------------------------------------------

describe('aliasDeprecatedJwtEnvVar', () => {
    test('should copy CTRLQ_JWT to CTRLQ_AUTH_JWT when only CTRLQ_JWT is set, and warn that it is deprecated', () => {
        const env = { CTRLQ_JWT: 'legacy-jwt' };

        expect(aliasDeprecatedJwtEnvVar(env)).toBe(DEPRECATED_WARNING);
        expect(env).toEqual({ CTRLQ_JWT: 'legacy-jwt', CTRLQ_AUTH_JWT: 'legacy-jwt' });
    });

    test('should leave CTRLQ_AUTH_JWT alone when both are set, and warn that CTRLQ_JWT is ignored', () => {
        const env = { CTRLQ_JWT: 'legacy-jwt', CTRLQ_AUTH_JWT: 'current-jwt' };

        expect(aliasDeprecatedJwtEnvVar(env)).toBe(IGNORED_WARNING);
        expect(env).toEqual({ CTRLQ_JWT: 'legacy-jwt', CTRLQ_AUTH_JWT: 'current-jwt' });
    });

    test('should change nothing and not warn when CTRLQ_JWT is not set', () => {
        const neither = {};
        expect(aliasDeprecatedJwtEnvVar(neither)).toBeUndefined();
        expect(neither).toEqual({});

        const current = { CTRLQ_AUTH_JWT: 'current-jwt' };
        expect(aliasDeprecatedJwtEnvVar(current)).toBeUndefined();
        expect(current).toEqual({ CTRLQ_AUTH_JWT: 'current-jwt' });
    });

    test('should use process.env by default', () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        expect(aliasDeprecatedJwtEnvVar()).toBe(DEPRECATED_WARNING);
        expect(process.env.CTRLQ_AUTH_JWT).toBe('legacy-jwt');
    });
});

// ---------------------------------------------------------------------------
// Commander, once CTRLQ_JWT is aliased
// ---------------------------------------------------------------------------

describe('A command parsed after aliasing CTRLQ_JWT', () => {
    test('should get its JWT from CTRLQ_JWT when it is not given any other way', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options } = await run([], jwtOption());
        expect(options.authJwt).toBe('legacy-jwt');
    });

    test('should prefer CTRLQ_AUTH_JWT over CTRLQ_JWT', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';
        process.env.CTRLQ_AUTH_JWT = 'current-jwt';

        const { options } = await run([], jwtOption());
        expect(options.authJwt).toBe('current-jwt');
    });

    test('should prefer --auth-jwt on the command line over CTRLQ_JWT', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options } = await run(['--auth-jwt', 'cli-jwt'], jwtOption());
        expect(options.authJwt).toBe('cli-jwt');
    });

    test('should prefer CTRLQ_JWT over an option default', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options } = await run([], jwtOption().default(''));
        expect(options.authJwt).toBe('legacy-jwt');
    });

    test('should accept CTRLQ_JWT for a mandatory JWT option', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options } = await run([], jwtOption().makeOptionMandatory());
        expect(options.authJwt).toBe('legacy-jwt');
    });
});

// ---------------------------------------------------------------------------
// usesJwtAuth
// ---------------------------------------------------------------------------

describe('usesJwtAuth', () => {
    const parse = (args, ...options) => {
        const command = new Command('task-get').exitOverride().action(() => {});
        options.forEach((option) => command.addOption(option));
        command.parse(args, { from: 'user' });
        return command;
    };

    test('should be true for a command that takes a JWT and authenticates with one', () => {
        expect(usesJwtAuth(parse(['--auth-type', 'jwt'], jwtOption(), authTypeOption()))).toBe(true);
    });

    test('should be false for a command that authenticates with a certificate', () => {
        expect(usesJwtAuth(parse(['--auth-type', 'cert'], jwtOption(), authTypeOption()))).toBe(false);
        expect(usesJwtAuth(parse([], jwtOption(), authTypeOption()))).toBe(false);
    });

    test('should be false for a command that takes no JWT', () => {
        expect(usesJwtAuth(parse(['--auth-type', 'jwt'], authTypeOption()))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// src/ctrl-q.js
// ---------------------------------------------------------------------------

describe('ctrl-q', () => {
    /**
     * Run src/ctrl-q.js itself as `ctrl-q qseow connection-test <args>`, with the connection test mocked.
     * Returns the options that reached the connection test and the warnings logged.
     */
    const runCtrlQ = async (args) => {
        let ran;
        let exited;
        const connectionTested = new Promise((resolve, reject) => {
            ran = resolve;
            exited = reject;
        });

        jest.unstable_mockModule('../../lib/cmd/qseow/testconnection.js', () => ({
            testConnection: jest.fn(async (options) => ran(options)),
        }));
        jest.spyOn(process, 'exit').mockImplementation((code) => exited(new Error(`ctrl-q exited with code ${code}`)));

        // The same, freshly loaded, logger that ctrl-q.js is about to import
        const { logger } = await import('../../globals.js');
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

        process.argv = [
            process.argv[0],
            'ctrl-q.js',
            'qseow',
            'connection-test',
            '--host',
            'qlik.example.com',
            '--log-level',
            'error',
            ...args,
        ];
        await import('../../ctrl-q.js');

        // Well within the test's own timeout, so that a command that never runs fails here, saying so
        const options = await settled(connectionTested, 2000);
        return { options, warnings: warn.mock.calls.map(([message]) => message) };
    };

    // Loading every module of ctrl-q.js afresh can take a while on a slow machine
    const RUN_CTRL_Q_TIMEOUT = 15000;

    test(
        'should run a command with the JWT from CTRLQ_JWT, warning that it is deprecated',
        async () => {
            process.env.CTRLQ_JWT = 'legacy-jwt';

            const { options, warnings } = await runCtrlQ(['--auth-type', 'jwt']);

            expect(options.authJwt).toBe('legacy-jwt');
            expect(warnings).toEqual([DEPRECATED_WARNING]);
        },
        RUN_CTRL_Q_TIMEOUT
    );

    test(
        'should not warn about CTRLQ_JWT for a command that authenticates with a certificate',
        async () => {
            process.env.CTRLQ_JWT = 'legacy-jwt';

            // Any existing files will do, as nothing connects
            const certFiles = [
                '--auth-cert-file',
                'package.json',
                '--auth-cert-key-file',
                'package.json',
                '--auth-root-cert-file',
                'package.json',
            ];
            const { options, warnings } = await runCtrlQ(['--auth-type', 'cert', ...certFiles]);

            expect(options.authType).toBe('cert');
            expect(warnings).toEqual([]);
        },
        RUN_CTRL_Q_TIMEOUT
    );
});
