import enigma from 'enigma.js';

import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { catchLog } from '../../util/log.js';

/**
 *
 * @param {*} options
 */
export async function getScript(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.verbose('Get app script');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Session ID to use when connecting to the Qlik Sense server
        const sessionId = 'ctrlq';

        // Create new session to Sense engine
        let configEnigma;
        let session;
        try {
            configEnigma = setupEnigmaConnection(options, sessionId);
            session = await enigma.create(configEnigma);
            logger.verbose(`Created session to server ${options.host}.`);
        } catch (err) {
            catchLog(`Error creating session to server ${options.host}`, err);
            process.exit(1);
        }

        // Set up logging of websocket traffic
        addTrafficLogging(session, options);

        let global;
        try {
            global = await session.open();
        } catch (err) {
            catchLog(`Error opening session to server ${options.host}`, err);
            process.exit(1);
        }

        let engineVersion;
        try {
            engineVersion = await global.engineVersion();
            logger.verbose(`Server ${options.host} has engine version ${engineVersion.qComponentVersion}.`);
        } catch (err) {
            catchLog(`Error getting engine version from server ${options.host}`, err);
            process.exit(1);
        }

        // Get open-app-without-data option from command line
        // Convert string to boolean
        const openWithoutData = options.openWithoutData === 'true';
        logger.verbose(`Open app without data: ${openWithoutData}`);

        const app = await global.openDoc(options.appId, '', '', '', openWithoutData);
        logger.verbose(`Opened app ${options.appId}.`);

        // Get app script
        const appScript = await app.getScriptEx();

        if (appScript) {
            logger.info('----- Script metadata -----');
            logger.info(`App id: ${options.appId}`);
            logger.info(`Created date: ${appScript.qMeta.createdDate}`);
            logger.info(`Modified date: ${appScript.qMeta.modifiedDate}`);
            logger.info('----- End script metadata -----');
            // eslint-disable-next-line no-console
            console.log(`${appScript.qScript}`);
        } else {
            logger.error(`Failed getting script for app ${options.appId}`);
        }

        if ((await session.close()) === true) {
            logger.verbose(`Closed session after retrieving script from app ${options.appId} on host ${options.host}`);
        } else {
            logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
        }

        return {
            appId: options.appId,
            appCreatedDate: appScript.qMeta.createdDate,
            appModifiedDate: appScript.qMeta.modifiedDate,
            appScript: appScript.qScript,
        };
    } catch (err) {
        catchLog('Error in getScript', err);
    }
}
