import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { getAboutFromQseow } from '../../util/qseow/about.js';
import { catchLog } from '../../util/log.js';

/**
 * Tests a connection to a client-managed Qlik Sense Enterprise (QSEoW) server.
 *
 * @param {object} options - The options to use for the connection test.
 * @returns {Promise<boolean|object>} - A promise that resolves to `true` if the connection test succeeded, or an object with the Qlik Sense repository version and build date if the `--json` option was supplied.
 */
export async function testConnection(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Testing connection to Qlik Sense server ${options.host} on port ${options.port}`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        const aboutInfo = await getAboutFromQseow(options);

        if (!aboutInfo) {
            logger.error(`Could not get about info from QSEoW`);
            return false;
        }

        logger.info(`Successfully connected to Qlik Sense server ${options.host} on port ${options.port}`);
        logger.info(`Qlik Sense repository build version: ${aboutInfo.buildVersion}`);
        logger.info(`Qlik Sense repository build date: ${aboutInfo.buildDate}`);

        return aboutInfo;
    } catch (err) {
        catchLog(`Error testing connection to Qlik Sense server ${options.host} on port ${options.port}`, err);
        logger.error(`EXPORT APP: ${err.stack}`);
        return false;
    }
}
