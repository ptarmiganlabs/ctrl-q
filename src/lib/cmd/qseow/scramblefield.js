import enigma from 'enigma.js';
import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';

/**
 *
 * @param {*} options
 */
export async function scrambleField(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Scramble field');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Session ID to use when connecting to the Qlik Sense server
        const sessionId = 'ctrlq';

        // Create new session to Sense engine
        let configEnigma;
        let session;
        try {
            configEnigma = await setupEnigmaConnection(options, sessionId);
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

        const app = await global.openDoc(options.appId, '', '', '', false);
        logger.verbose(`Opened app ${options.appId}.`);

        // Fields to be scrambled are availbel in array options.fieldName;

        if (options.fieldName.length === 0) {
            // No fields specified
            logger.warn('No fields specified, no scrambling of data will be done');
        } else {
            // eslint-disable-next-line no-restricted-syntax
            for (const field of options.fieldName) {
                // TODO make sure field exists before trying to scramble it

                // Scramble field
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const res = await app.scramble(field);
                    logger.info(`Scrambled field "${field}"`);
                } catch (err) {
                    catchLog(`Error scrambling field "${field}". please make sure it exists in the app.`, err);
                }
            }

            // The scrambled data cannot be written back to the original app, it has to be saved to a new app
            const newAppId = await app.saveAs(options.newAppName);
            logger.info(`Scrambled data written to new app "${options.newAppName}" with app ID: ${newAppId}`);

            if ((await session.close()) === true) {
                logger.verbose(`Closed session after managing master items in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        }
    } catch (err) {
        catchLog('Error in scrambleField', err);
    }
}
