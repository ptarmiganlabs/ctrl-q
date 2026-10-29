// Environment variable that holds the JWT used to authenticate with Qlik Sense
const JWT_ENV_VAR = 'CTRLQ_AUTH_JWT';

// Deprecated name for the same thing, which some commands used to read instead
const DEPRECATED_JWT_ENV_VAR = 'CTRLQ_JWT';

/**
 * Lets the deprecated CTRLQ_JWT environment variable stand in for CTRLQ_AUTH_JWT, when only CTRLQ_JWT is set.
 *
 * Call it before Commander parses the command line. Commander then applies the JWT like any other environment
 * variable: a JWT given on the command line wins over it, it wins over an option's default, and it satisfies a
 * mandatory option.
 *
 * @param {object} [env] - The environment to read and update. Defaults to process.env.
 * @returns {string|undefined} A warning to show when CTRLQ_JWT is set, otherwise undefined.
 */
export function aliasDeprecatedJwtEnvVar(env = process.env) {
    if (!(DEPRECATED_JWT_ENV_VAR in env)) {
        return undefined;
    }

    if (JWT_ENV_VAR in env) {
        return `Environment variable ${DEPRECATED_JWT_ENV_VAR} is deprecated and ignored, as ${JWT_ENV_VAR} is also set.`;
    }

    env[JWT_ENV_VAR] = env[DEPRECATED_JWT_ENV_VAR];
    return `Environment variable ${DEPRECATED_JWT_ENV_VAR} is deprecated, use ${JWT_ENV_VAR} instead.`;
}

/**
 * Whether a command authenticates with a JWT, and so whether a warning about CTRLQ_JWT concerns it.
 *
 * @param {Command} command - A Commander command whose options have been parsed.
 * @returns {boolean} True when the command takes a JWT from CTRLQ_AUTH_JWT and its auth type is jwt.
 */
export function usesJwtAuth(command) {
    return command.options.some((option) => option.envVar === JWT_ENV_VAR) && command.opts().authType === 'jwt';
}
