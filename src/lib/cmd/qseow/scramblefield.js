import enigma from 'enigma.js';
import yesno from 'yesno';

import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';
import { deleteAppById, publishApp } from '../../util/qseow/app.js';

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
            logger.warn('No fields specified, no scrambling of data will be done, no new app will be created.');
        } else {
            for (const field of options.fieldName) {
                // TODO make sure field exists before trying to scramble it

                // Scramble field
                try {
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
                logger.verbose(`Closed session after scrambling fields in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }

            // We now have a new app with scrambled data
            // Proceed with other operations on the new app, e.g. publish, publish-replace, delete, etc.
            if (options.newAppPublish) {
                // Publish the new app to stream specified in options.newAppPublishStreamId or options.newAppPublishStreamName

                // Is stream ID or stream name specified?
                let resultPublish;
                if (options.newAppPublishStreamId) {
                    // Publish to stream by stream ID
                    resultPublish = await publishApp(newAppId, options.newAppName, options.newAppPublishStreamId, options);
                } else if (options.newAppPublishStreamName) {
                    // Publish to stream by stream name
                    // First look up stream ID by name
                    // If there are multiple streams with the same name, report error and skip publishing
                    // If no stream with the specified name is found, report error and skip publishing
                    // If one stream is found, publish to that stream
                    const streamArray = await app.getStreamByName(options.newAppPublishStreamName, options);

                    if (streamArray.length === 1) {
                        logger.verbose(`Found stream with name "${options.newAppPublishStreamName}" with ID: ${streamArray[0].id}`);
                        resultPublish = await publishApp(newAppId, options.newAppName, streamArray[0].id, options);
                    } else if (streamArray.length > 1) {
                        logger.error(`More than one stream with name "${options.newAppPublishStreamName}" found. Skipping publish.`);
                    } else {
                        logger.error(`No stream with name "${options.newAppPublishStreamName}" found. Skipping publish.`);
                    }
                }

                if (resultPublish) {
                    logger.info(
                        `Published new app "${options.newAppName}" with app ID: ${newAppId} to stream "${options.newAppPublishStreamName}"`
                    );
                } else {
                    logger.error(`Error publishing new app "${options.newAppName}" with app ID: ${newAppId} to stream.`);
                }
            }

            if (options.newAppPublishReplace) {
                // Publish-replace the new app with an existing published app
                // If app ID is specified, use that
                // If app name is specified, look up app ID by name
                // If no app is found, report error and skip publish-replace
                // If more than one app is found, report error and skip publish-replace
                // If one app is found, publish-replace
                let resultPublishReplace;
                if (options.newAppPublishReplaceAppId) {
                    // Publish-replace by app ID
                    resultPublishReplace = await replaceApp(newAppId, options.newAppName, options.newAppPublishReplaceAppId, options);
                } else if (options.newAppPublishReplaceAppName) {
                    // Publish-replace by app name
                    // First look up app ID by name
                    // If there are multiple apps with the same name, report error and skip publish-replace
                    // If no app with the specified name is found, report error and skip publish-replace
                    // If one app is found, publish-replace
                    const appArray = await app.getAppByName(options.newAppPublishReplaceAppName, options);

                    if (appArray.length === 1) {
                        logger.verbose(`Found app with name "${options.newAppPublishReplaceAppName}" with ID: ${appArray[0].id}`);
                        resultPublishReplace = await replaceApp(newAppId, options.newAppName, appArray[0].id, options);
                    } else if (appArray.length > 1) {
                        logger.error(
                            `More than one app with name "${options.newAppPublishReplaceAppName}" found. Skipping publish-replace.`
                        );
                    } else {
                        logger.error(`No app with name "${options.newAppPublishReplaceAppName}" found. Skipping publish-replace.`);
                    }
                }
            }

            if (options.newAppDeleteExistingUnpublished) {
                // Delete any already existing apps with the same name as the new app
            }

            if (options.newAppDelete) {
                // Delete the new app after all other operations are done
                // Ask user for confirmation unless --force option is set
                if (options.force) {
                    await deleteAppById(newAppId, options);
                    logger.info(`Deleted new app "${options.newAppName}" with app ID: ${newAppId}`);
                } else {
                    const answer = await yesno({
                        question: `Do you want to delete the new app "${options.newAppName}" with app ID: ${newAppId}? (y/n)`,
                    });

                    if (answer) {
                        try {
                            await deleteAppById(newAppId, options);
                            logger.info(`Deleted new, scrambled app "${options.newAppName}" with app ID: ${newAppId}`);
                        } catch (err) {
                            catchLog(`Error deleting new app "${options.newAppName}" with app ID: ${newAppId}`, err);
                        }
                    } else {
                        logger.info(`Did not delete new app "${options.newAppName}" with app ID: ${newAppId}`);
                    }
                }
            }
        }
    } catch (err) {
        catchLog('Error in scrambleField', err);
    }
}
