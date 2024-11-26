import enigma from 'enigma.js';
import yesno from 'yesno';
import { validate as uuidValidate } from 'uuid';

import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';
import { deleteAppById, publishApp, replaceApp, getAppByName, getAppById } from '../../util/qseow/app.js';
import { getStreamByName, getStreamById } from '../../util/qseow/stream.js';

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

        // Keep track of the result of the scramble operation
        const scrambleResult = {
            newAppCmd: options.newAppCmd,
            status: 'error',
        };

        // ------------------------------------------------
        // Verify parameters

        // --new-app-name is always required
        if (!options.newAppName) {
            logger.error('Option --new-app-name is required when --new-app-cmd is empty or set to "publish".');
            return scrambleResult;
        }

        // No source app ID specified
        if (!options.appId) {
            logger.error('No source app ID specified.');
            return scrambleResult;
        }

        // No fields specified
        if (!options.fieldName || !Array.isArray(options.fieldName) || options?.fieldName?.length === 0) {
            logger.error('No fields specified.');
            return scrambleResult;
        }

        // Verify that --app-id is a valid GUID
        if (!uuidValidate(options.appId)) {
            logger.error(`Invalid GUID in --app-id: ${options.appId}`);
            return scrambleResult;
        }

        // Verify that source app exists, given --app-id
        const appArray = await getAppById(options.appId, options);
        if (appArray === false) {
            logger.error(`App with ID ${options.appId} not found.`);
            return scrambleResult;
        }

        // Verify that --new-app-cmd is either '', 'publish' or 'replace'
        if (options.newAppCmd !== '' && options.newAppCmd !== 'publish' && options.newAppCmd !== 'replace') {
            logger.error(`Invalid value in --new-app-cmd: ${options.newAppCmd}`);
            return scrambleResult;
        }

        // Given --new-app-cmd-id and --new-app-cmd='publish'
        if (options.newAppCmd === 'publish' && options.newAppCmdId) {
            // Verify that stream ID is a valid GUID
            if (!uuidValidate(options.newAppCmdId)) {
                logger.error(`Invalid GUID in --new-app-cmd-id: ${options.newAppCmdId}`);
                return scrambleResult;
            }

            // Verify that stream exists,
            const streamArray = await getStreamById(options.newAppCmdId, options);
            if (streamArray === false || streamArray.length === 0) {
                logger.error(`Stream with ID ${options.newAppCmdId} not found.`);
                return scrambleResult;
            }
        }

        // Given --new-app-cmd-name and --new-app-cmd='publish'
        if (options.newAppCmd === 'publish' && options.newAppCmdName) {
            // Verify that stream exists,
            const streamArray = await getStreamByName(options.newAppCmdName, options);
            if (streamArray === false || streamArray.length === 0) {
                logger.error(`Stream with name ${options.newAppCmdName} not found.`);
                return scrambleResult;
            }
        }

        // Given --new-app-cmd-id and --new-app-cmd='replace'
        if (options.newAppCmd === 'replace' && options.newAppCmdId) {
            // Verify that app ID is a valid GUID
            if (!uuidValidate(options.newAppCmdId)) {
                logger.error(`Invalid GUID in --new-app-cmd-id: ${options.newAppCmdId}`);
                return scrambleResult;
            }

            // Verify that app exists
            const appArray = await getAppById(options.newAppCmdId, options);
            if (appArray === false) {
                logger.error(`App with ID ${options.newAppCmdId} not found.`);
                return scrambleResult;
            }
        }

        // Given --new-app-cmd-name and --new-app-cmd='replace'
        if (options.newAppCmd === 'replace' && options.newAppCmdName) {
            // Verify that app exists in singular
            const appArray = await getAppByName(options.newAppCmdName, options);
            if (appArray === false || appArray.length === 0) {
                logger.error(`App with name ${options.newAppCmdName} not found.`);
                return scrambleResult;
            }
            if (appArray.length > 1) {
                logger.error(`More than one app with name ${options.newAppCmdName} found.`);
                return scrambleResult;
            }
        }

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

        // Fields to be scrambled are availble in array options.fieldName;
        // If no fields are specified, no scrambling will be done
        // options.fieldNams is an array of field names to be scrambled
        // Verify it's an array
        if (!options.fieldName || !Array.isArray(options.fieldName) || options?.fieldName?.length === 0) {
            // No fields specified
            logger.warn('No fields specified, no scrambling of data will be done, no new app will be created.');

            // Close session
            if ((await session.close()) === true) {
                logger.verbose(`Closed session after scrambling fields in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
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

            // Add new app ID to result object
            scrambleResult.newAppId = newAppId;
            scrambleResult.status = 'success';

            // ------------------------------------------------
            // We now have a new app with scrambled data
            // Proceed with other operations on the new app, e.g. publish, replace, delete, etc.

            if (options.newAppCmd === 'publish') {
                // Publish the new app to stream specified in options.newAppCmdId or options.newAppCmdName

                // Is ID or name specified?
                let resultPublish;
                if (options.newAppCmdId) {
                    // Publish to stream by stream ID
                    resultPublish = await publishApp(newAppId, options.newAppName, options.newAppCmdId, options);
                    scrambleResult.status = 'success';
                } else if (options.newAppCmdName) {
                    // Publish to stream by stream name
                    // First look up stream ID by name
                    // If there are multiple streams with the same name, report error and skip publishing
                    // If no stream with the specified name is found, report error and skip publishing
                    // If one stream is found, publish to that stream
                    const streamArray = await getStreamByName(options.newAppCmdName, options);

                    if (streamArray.length === 1) {
                        logger.verbose(`Found stream with name "${options.newAppCmdName}" with ID: ${streamArray[0].id}`);
                        resultPublish = await publishApp(newAppId, options.newAppName, streamArray[0].id, options);
                        scrambleResult.status = 'success';
                    } else if (streamArray.length > 1) {
                        logger.error(`More than one stream with name "${options.newAppCmdName}" found. Skipping publish.`);
                        scrambleResult.status = 'error';
                    } else {
                        logger.error(`No stream with name "${options.newAppCmdName}" found. Skipping publish.`);
                        scrambleResult.status = 'error';
                    }
                }

                if (resultPublish) {
                    logger.info(`Published new app "${options.newAppName}" with app ID: ${newAppId} to stream "${options.newAppCmdName}"`);
                    scrambleResult.cmdDone = 'publish';
                    scrambleResult.status = 'success';
                } else {
                    logger.error(`Error publishing new app "${options.newAppName}" with app ID: ${newAppId} to stream.`);
                    scrambleResult.status = 'error';
                }
            } else if (options.newAppCmd === 'replace') {
                // Replace an existing app with the new, scrambled app
                // If app ID is specified, use that
                // If app name is specified, look up app ID by name
                // If no app is found, report error and skip replace
                // If more than one app is found, report error and skip replace
                // If one app is found, replace

                let resultReplace;
                if (options.newAppCmdId) {
                    // Replace by app ID
                    if (!options.force) {
                        const answer = await yesno({
                            question: `Do you want to replace the existing app with app ID ${options.newAppCmdId} with the new, scrambled app? (y/n)`,
                        });

                        if (answer) {
                            resultReplace = await replaceApp(newAppId, options.newAppCmdId, options);
                            scrambleResult.status = 'success';
                        } else {
                            logger.warn(
                                `Did not replace existing app with app ID ${options.newAppCmdId} with new, scrambled app "${options.newAppName}" with app ID ${newAppId}. The scrambled app is still available in My Work.`
                            );
                            scrambleResult.status = 'aborted';
                        }
                    } else {
                        resultReplace = await replaceApp(newAppId, options.newAppCmdId, options);
                        scrambleResult.status = 'success';
                    }
                } else if (options.newAppCmdName) {
                    // Replace by app name
                    // First look up app ID by name
                    // If there are multiple apps with the same name, report error and skip replace
                    // If no app with the specified name is found, report error and skip replace
                    // If one app is found, replace
                    const appArray = await getAppByName(options.newAppCmdName, options);

                    if (appArray.length === 1) {
                        logger.info(`Found app with name "${options.newAppCmdName}" with ID: ${appArray[0].id}`);

                        if (!options.force) {
                            const answer = await yesno({
                                question: `Do you want to replace the existing app with name "${options.newAppCmdName}" with the new, scrambled app? (y/n)`,
                            });

                            if (answer) {
                                resultReplace = await replaceApp(newAppId, appArray[0].id, options);
                                scrambleResult.status = 'success';
                            } else {
                                logger.warn(
                                    `Did not replace existing app with name "${options.newAppCmdName}" with new, scrambled app "${options.newAppName}" with app ID ${newAppId}. The scrambled app is still available in My Work.`
                                );
                                scrambleResult.status = 'aborted';
                            }
                        } else {
                            resultReplace = await replaceApp(newAppId, appArray[0].id, options);
                            scrambleResult.status = 'success';
                        }
                    } else if (appArray.length > 1) {
                        logger.error(`More than one app with name "${options.newAppCmdName}" found. Skipping replace.`);
                        scrambleResult.status = 'error';
                    } else {
                        logger.error(`No app with name "${options.newAppCmdName}" found. Skipping replace.`);
                        scrambleResult.status = 'error';
                    }

                    if (resultReplace) {
                        logger.info(
                            `Replaced existing app "${options.newAppCmdName}" (app ID: ${appArray[0].id}) with new, scrambled app "${options.newAppName}" (app ID: ${newAppId})`
                        );
                        scrambleResult.cmdDone = 'replace';
                        scrambleResult.status = 'success';
                    } else {
                        logger.error(
                            `Error replacing existing app "${options.newAppCmdName}" with new, scrambled app "${options.newAppName}"`
                        );
                        scrambleResult.status = 'error';
                    }
                }
            }
        }

        // Return the result of the scramble operation
        return scrambleResult;
    } catch (err) {
        catchLog('Error in scrambleField', err);
    }
}
