import { logger, setLoggingLevel, isPkg, execPath } from '../../globals.js';
import getAboutFromQseow from '../util/about.js';
import { catchLog } from '../util/log.js';

const testConnection = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
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
};

export default testConnection;
