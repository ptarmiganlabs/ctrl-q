// Environment variable that holds the JWT used to authenticate with Qlik Sense
const JWT_ENV_VAR = 'CTRLQ_AUTH_JWT';

// Deprecated name for the same thing, which some commands used to read instead
const DEPRECATED_JWT_ENV_VAR = 'CTRLQ_JWT';

/**
 * Falls back to the deprecated CTRLQ_JWT environment variable for the options of a command that take a JWT.
 *
 * Meant to be called from a preAction hook, once Commander has parsed the command line and applied CTRLQ_AUTH_JWT.
 * Follows Commander's own precedence: a JWT given on the command line or in CTRLQ_AUTH_JWT wins over CTRLQ_JWT,
 * which in turn wins over an option's default value.
 *
 * @param {Command} command - The Commander command about to run.
 * @returns {string|undefined} A warning to show the user when CTRLQ_JWT is set and the command takes a JWT, otherwise undefined.
 */
export function applyDeprecatedJwtEnvVar(command) {
    const jwtOptions = command.options.filter((option) => option.envVar === JWT_ENV_VAR);

    if (jwtOptions.length === 0 || !(DEPRECATED_JWT_ENV_VAR in process.env)) {
        return undefined;
    }

    if (JWT_ENV_VAR in process.env) {
        return `Environment variable ${DEPRECATED_JWT_ENV_VAR} is deprecated and ignored, as ${JWT_ENV_VAR} is also set.`;
    }

    jwtOptions.forEach((option) => {
        const key = option.attributeName();

        // Same rule Commander uses when applying an environment variable: never override a value from the command line
        if (command.getOptionValue(key) === undefined || ['default', 'config'].includes(command.getOptionValueSource(key))) {
            command.setOptionValueWithSource(key, process.env[DEPRECATED_JWT_ENV_VAR], 'env');
        }
    });

    return `Environment variable ${DEPRECATED_JWT_ENV_VAR} is deprecated, use ${JWT_ENV_VAR} instead.`;
}
