import { logger, appVersion, isSea, execPath } from '../../globals.js';

// Option names holding credentials, e.g. authJwt, jwt and apikey. Their values must never reach the log.
const SENSITIVE_KEY = /jwt|apikey|api_key|password|secret|token|authorization/i;
const REDACTED = '<redacted>';

/**
 * Returns a shallow copy of a CLI options object where values of credential-like options are replaced.
 *
 * @param {Object} options - CLI options, e.g. from commander.
 * @returns {Object} Copy of the options object that is safe to log.
 */
export const redactOptions = (options) => {
    if (!options || typeof options !== 'object') {
        return options;
    }

    const redacted = {};
    for (const [key, value] of Object.entries(options)) {
        redacted[key] = SENSITIVE_KEY.test(key) && value !== undefined && value !== null && value !== '' ? REDACTED : value;
    }
    return redacted;
};

/**
 * Returns a copy of an axios request config that is safe to log.
 * Credential-like headers (Authorization etc.) are replaced, and the https agent (holding certificates) is left out.
 *
 * @param {Object} axiosConfig - Axios request config, e.g. from setupQrsConnection().
 * @returns {Object} Copy of the config that is safe to log.
 */
export const redactAxiosConfig = (axiosConfig) => {
    if (!axiosConfig || typeof axiosConfig !== 'object') {
        return axiosConfig;
    }

    const { httpsAgent, headers, ...rest } = axiosConfig;
    return { ...rest, headers: redactOptions(headers), httpsAgent: httpsAgent ? '<https agent>' : undefined };
};

/**
 * Logs startup information for the Ctrl-Q application.
 *
 * This function logs details such as the application version, log level,
 * command, and command description. It also includes additional information
 * about the execution environment, such as whether Ctrl-Q is running as a
 * stand-alone binary and the execution path.
 *
 * @param {Object} options - The options object containing configuration details.
 * @param {string} cmd - The command executed by the user.
 * @param {string} cmdDesc - A description of the executed command.
 */
export const logStartupInfo = (options, cmd, cmdDesc) => {
    logger.info('-----------------------------------------------------------');
    logger.info('| Ctrl-Q');
    logger.info('| ');
    logger.info(`| Version      : ${appVersion}`);
    logger.info(`| Log level    : ${options.logLevel}`);
    logger.info(`| `);
    logger.info(`| Command      : ${cmd}`);
    logger.info(`|              : ${cmdDesc}`);
    logger.info(`| `);
    logger.info(`| Run Ctrl-Q with the '--help' option to see a list of all available options for this command.`);
    logger.info(`| `);
    logger.info(`| https://github.com/ptarmiganlabs/ctrl-q`);
    logger.info('----------------------------------------------------------');
    logger.info(``);
    logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
    logger.verbose(`Ctrl-Q was started from ${execPath}`);
    logger.verbose(`Options: ${JSON.stringify(redactOptions(options), null, 2)}`);
    logger.verbose(``);
};

// Function used to provide consistent logging to all try-catch blocks
export const catchLog = (msgContext, err) => {
    if (isSea) {
        if (err.message) {
            logger.error(`${msgContext}: ${err.message}`);
        } else {
            logger.error(`${msgContext}: ${err}`);
        }
    } else if (err.stack) {
        logger.error(`${msgContext}: ${err.stack}`);
    } else if (err.message) {
        logger.error(`${msgContext}: ${err.message}`);
    } else {
        logger.error(`${msgContext}: ${err}`);
    }
};
