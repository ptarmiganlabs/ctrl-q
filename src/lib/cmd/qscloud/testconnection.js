import { logger, setLoggingLevel, isPkg, execPath } from '../../../globals.js';
import { getQscloudCurrentUser } from '../../util/qscloud/user.js';
import { catchLog } from '../../util/log.js';

export async function qscloudTestConnection(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Testing connection to Qlik Sense Cloud tenant "${options.tenantUrl}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get info about user associated with the auth JWT
        const userInfo = await getQscloudCurrentUser(options);

        if (userInfo === false) {
            logger.error(`Could not connect to Qlik Sense Cloud`);
            return false;
        }

        logger.info(`Successfully connected to Qlik Sense Cloud tenant "${options.host}"`);
        logger.info(`Tenant ID  : ${userInfo.tenantId}`);
        logger.info(`User ID    : ${userInfo.id}`);
        logger.info(`User name  : ${userInfo.name}`);
        logger.info(`User email : ${userInfo.email}`);
        logger.info(`User status: ${userInfo.status}`);
    } catch (err) {
        catchLog(`Error testing connection to Qlik Sense server ${options.host} on port ${options.port}`, err);
        logger.error(`EXPORT APP: ${err.stack}`);
        return false;
    }
}
