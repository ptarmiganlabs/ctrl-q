import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { getQscloudCurrentUser } from '../../util/qscloud/user.js';
import { catchLog } from '../../util/log.js';

/**
 * Tests a connection to a Qlik Sense Cloud tenant and retrieves user information.
 *
 * @param {object} options - The options to use for the connection test, including:
 *   - {string} logLevel - The logging level.
 *   - {string} tenantUrl - The URL of the Qlik Sense Cloud tenant.
 *   - {string} host - The host of the Qlik Sense Cloud tenant.
 * @returns {Promise<boolean|object>} - A promise that resolves to `false` if the connection test failed,
 * or an object containing user information if the connection test succeeded.
 * The user information includes tenant ID, user ID, user name, user email, and user status.
 */

export async function qscloudTestConnection(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Testing connection to Qlik Sense Cloud tenant "${options.tenantHost}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get info about user associated with the auth JWT
        const userInfo = await getQscloudCurrentUser(options);

        if (userInfo === false) {
            logger.error(`Could not connect to Qlik Sense Cloud`);
            return false;
        }

        logger.info(`Successfully connected to Qlik Sense Cloud tenant "${options.tenantHost}"`);
        logger.info(`Tenant ID   : ${userInfo.tenantId}`);
        logger.info(`User ID     : ${userInfo.id}`);
        logger.info(`User name   : ${userInfo.name}`);
        logger.info(`User email  : ${userInfo.email}`);
        logger.info(`User status : ${userInfo.status}`);

        return userInfo;
    } catch (err) {
        catchLog(`Error testing connection to Qlik Sense server ${options.host} on port ${options.port}`, err);
        logger.error(`EXPORT APP: ${err.stack}`);
        return false;
    }
}
