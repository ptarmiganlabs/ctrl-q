/**
 * Unit tests for src/lib/util/jwt-env.js — applyDeprecatedJwtEnvVar()
 *
 * Every command option that takes a JWT reads it from CTRLQ_AUTH_JWT. CTRLQ_JWT, which
 * some commands used to read instead, still works as a deprecated fallback when the JWT
 * is not given on the command line or in CTRLQ_AUTH_JWT.
 */

import { test, expect, describe, beforeEach, afterAll } from '@jest/globals';
import fs from 'node:fs';
import { Command, Option } from 'commander';

const { applyDeprecatedJwtEnvVar } = await import('../../lib/util/jwt-env.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up every command defined in src/lib/cli, and return each option that takes a JWT
 * together with the file that defines it.
 */
const getCliJwtOptions = async () => {
    const cliFiles = fs.readdirSync(new URL('../../lib/cli/', import.meta.url)).filter((file) => file.endsWith('.js'));
    const jwtOptions = [];

    for (const file of cliFiles) {
        const cliModule = await import(`../../lib/cli/${file}`);

        for (const setupCommand of Object.values(cliModule)) {
            // Fresh parent per file, as Commander refuses two subcommands with the same name
            const parent = new Command();
            setupCommand(parent);

            parent.commands.forEach((command) => {
                command.options.filter((option) => /jwt/i.test(option.long)).forEach((option) => jwtOptions.push({ file, option }));
            });
        }
    }

    return jwtOptions;
};

/**
 * Parse args with a command shaped like the real ones, applying the CTRLQ_JWT fallback in a
 * preAction hook the way src/ctrl-q.js does. Returns the options the action handler received
 * and the warning, if any.
 */
const run = async (args, jwtOption = new Option('--auth-jwt <jwt>', 'JWT').env('CTRLQ_AUTH_JWT')) => {
    const result = {};
    const program = new Command().exitOverride();

    program.hook('preAction', (thisCommand, actionCommand) => {
        result.warning = applyDeprecatedJwtEnvVar(actionCommand);
    });

    program
        .command('task-get')
        .addOption(jwtOption)
        .action((options) => {
            result.options = options;
        });

    await program.parseAsync(['task-get', ...args], { from: 'user' });
    return result;
};

const originalEnv = { CTRLQ_JWT: process.env.CTRLQ_JWT, CTRLQ_AUTH_JWT: process.env.CTRLQ_AUTH_JWT };

beforeEach(() => {
    delete process.env.CTRLQ_JWT;
    delete process.env.CTRLQ_AUTH_JWT;
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
            .map(({ file, option }) => `${file}: ${option.long} reads ${option.envVar}`);
        expect(otherEnvVars).toEqual([]);
    });

    test('should not be mandatory, as Commander checks mandatory options before the CTRLQ_JWT fallback runs', async () => {
        const mandatory = (await getCliJwtOptions()).filter(({ option }) => option.mandatory).map(({ file }) => file);
        expect(mandatory).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// CTRLQ_JWT fallback
// ---------------------------------------------------------------------------

describe('applyDeprecatedJwtEnvVar', () => {
    test('should use CTRLQ_JWT when the JWT is not given any other way, and warn that it is deprecated', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options, warning } = await run([]);
        expect(options.authJwt).toBe('legacy-jwt');
        expect(warning).toBe('Environment variable CTRLQ_JWT is deprecated, use CTRLQ_AUTH_JWT instead.');
    });

    test('should prefer CTRLQ_AUTH_JWT over CTRLQ_JWT, and warn that CTRLQ_JWT is ignored', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';
        process.env.CTRLQ_AUTH_JWT = 'current-jwt';

        const { options, warning } = await run([]);
        expect(options.authJwt).toBe('current-jwt');
        expect(warning).toBe('Environment variable CTRLQ_JWT is deprecated and ignored, as CTRLQ_AUTH_JWT is also set.');
    });

    test('should prefer --auth-jwt on the command line over CTRLQ_JWT', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options, warning } = await run(['--auth-jwt', 'cli-jwt']);
        expect(options.authJwt).toBe('cli-jwt');
        expect(warning).toBe('Environment variable CTRLQ_JWT is deprecated, use CTRLQ_AUTH_JWT instead.');
    });

    test('should prefer CTRLQ_JWT over an option default', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options } = await run([], new Option('--jwt <JWT>', 'JWT').default('').env('CTRLQ_AUTH_JWT'));
        expect(options.jwt).toBe('legacy-jwt');
    });

    test('should change nothing and not warn when CTRLQ_JWT is not set', async () => {
        const neither = await run([]);
        expect(neither.options.authJwt).toBeUndefined();
        expect(neither.warning).toBeUndefined();

        process.env.CTRLQ_AUTH_JWT = 'current-jwt';
        const current = await run([]);
        expect(current.options.authJwt).toBe('current-jwt');
        expect(current.warning).toBeUndefined();
    });

    test('should not warn for a command that takes no JWT', async () => {
        process.env.CTRLQ_JWT = 'legacy-jwt';

        const { options, warning } = await run([], new Option('--host <host>', 'host'));
        expect(options).toEqual({});
        expect(warning).toBeUndefined();
    });
});
