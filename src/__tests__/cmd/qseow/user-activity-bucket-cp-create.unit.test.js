/**
 * Unit tests for how the qseow user-activity-bucket-cp-create command, defined in
 * src/lib/cli/qseow-cp-user-activity-bucket.js, takes a JWT.
 *
 * What the command does is mocked; the real option checks run, as they decide whether a JWT was given.
 */

import { jest, describe, test, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { Command } from 'commander';

jest.unstable_mockModule('../../../lib/cmd/qseow/createuseractivitycp.js', () => ({
    createUserActivityBucketsCustomProperty: jest.fn(),
}));

const { createUserActivityBucketsCustomProperty } = await import('../../../lib/cmd/qseow/createuseractivitycp.js');
const { logger } = await import('../../../globals.js');
const { setupQseowUserActivityCustomPropertyCommand } = await import('../../../lib/cli/qseow-cp-user-activity-bucket.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run the command with JWT authentication and the given extra arguments.
 * Returns the options the command ran with, and the warnings and errors it logged.
 */
const run = async (args) => {
    const qseow = new Command('qseow').exitOverride();
    setupQseowUserActivityCustomPropertyCommand(qseow);

    await qseow.parseAsync(
        [
            'user-activity-bucket-cp-create',
            '--host',
            'qlik.example.com',
            '--custom-property-name',
            'UserActivity',
            '--auth-type',
            'jwt',
            ...args,
        ],
        { from: 'user' }
    );

    return {
        options: createUserActivityBucketsCustomProperty.mock.calls[0]?.[0],
        warnings: logger.warn.mock.calls.map(([message]) => message),
        errors: logger.error.mock.calls.map(([message]) => message),
    };
};

const originalEnv = { CTRLQ_JWT: process.env.CTRLQ_JWT, CTRLQ_AUTH_JWT: process.env.CTRLQ_AUTH_JWT };

beforeEach(() => {
    delete process.env.CTRLQ_JWT;
    delete process.env.CTRLQ_AUTH_JWT;

    createUserActivityBucketsCustomProperty.mockReset();
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    // An option check that fails exits; stop there instead, with its error logged
    jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
    });
});

afterEach(() => {
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
// JWT options
// ---------------------------------------------------------------------------

describe('qseow user-activity-bucket-cp-create', () => {
    test('should take the JWT from --auth-jwt', async () => {
        const { options, errors } = await run(['--auth-jwt', 'cli-jwt']);

        expect(errors).toEqual([]);
        expect(options.authJwt).toBe('cli-jwt');
    });

    test('should take the JWT from CTRLQ_AUTH_JWT', async () => {
        process.env.CTRLQ_AUTH_JWT = 'env-jwt';

        const { options, errors } = await run([]);

        expect(errors).toEqual([]);
        expect(options.authJwt).toBe('env-jwt');
    });

    test('should still accept the JWT as --jwt, warning that it is deprecated', async () => {
        const { options, warnings, errors } = await run(['--jwt', 'old-jwt']);

        expect(errors).toEqual([]);
        expect(options.authJwt).toBe('old-jwt');
        expect(warnings).toContain('Option --jwt is deprecated, use --auth-jwt instead.');
    });

    test('should prefer --auth-jwt over --jwt', async () => {
        const { options } = await run(['--auth-jwt', 'cli-jwt', '--jwt', 'old-jwt']);

        expect(options.authJwt).toBe('cli-jwt');
    });

    test('should prefer --jwt on the command line over CTRLQ_AUTH_JWT', async () => {
        process.env.CTRLQ_AUTH_JWT = 'env-jwt';

        const { options } = await run(['--jwt', 'old-jwt']);

        expect(options.authJwt).toBe('old-jwt');
    });

    test('should not show --jwt in the help', () => {
        const qseow = new Command('qseow');
        setupQseowUserActivityCustomPropertyCommand(qseow);

        const help = qseow.commands[0].helpInformation();

        expect(help).toContain('--auth-jwt <jwt>');

        // No option line in the help starts with --jwt, whatever its placeholder
        expect(help).not.toMatch(/^\s*--jwt\b/m);
    });
});
