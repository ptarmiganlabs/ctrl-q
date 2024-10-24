/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import enigma from 'enigma.js';

import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma.js';
import { getApps } from '../../util/qseow/app.js';
import { logger, setLoggingLevel, isPkg, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';

/**
 *
 * @param {*} options
 */
const deleteVariable = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get IDs of all apps that should be processed
        const apps = await getApps(options, options.appId, options.appTag);

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

        for (const app of apps) {
            logger.info('------------------------');
            logger.info(`Deleting variables in app ${app.id}, "${app.name}"`);

            // Do we already have a session, or do we need to open a new one?
            if (session.globalPromise === undefined) {
                // Create new session to Sense engine
                try {
                    session = await enigma.create(configEnigma);
                    logger.verbose(`Created new session to server ${options.host}.`);

                    global = await session.open();
                    logger.verbose(`Opened new session to server ${options.host}.`);

                    engineVersion = await global.engineVersion();
                } catch (err) {
                    catchLog(`Error opening session (2) to server ${options.host}`, err);
                    process.exit(1);
                }
            }

            const doc = await global.openDoc(app.id, '', '', '', true);
            logger.verbose(`Opened app ${app.id}, "${app.name}".`);

            // Get variables from app
            // https://help.qlik.com/en-US/sense-developer/May2021/APIs/EngineAPI/services-Doc-GetVariables.html
            const appVariables = await doc.getVariables({
                qType: 'variable',
                qShowReserved: true,
                qShowConfig: true,
                // qData: {},
                qShowSession: true,
            });

            let variablesToProcess = [];
            if (options.deleteAll && options.deleteAll === true) {
                variablesToProcess = variablesToProcess.concat(appVariables);
            } else {
                variablesToProcess = variablesToProcess.concat(options.variable);
            }

            for (const variable of variablesToProcess) {
                // There will be a slightyly different data structure when --delete-all is used.
                const variableIdentifier = options.deleteAll === true ? variable.qName : variable;

                if (options.idType === 'name') {
                    // Does to-be-deleted variable exist in this app?
                    // eslint-disable-next-line arrow-body-style
                    const variableExists = appVariables.find((item) => {
                        return item.qName === variableIdentifier;
                    });

                    if (variableExists) {
                        if (variableExists.qIsScriptCreated === true && variableExists?.qIsReserved !== true) {
                            logger.warn(
                                `Variable "${variableIdentifier}" is created in the load script and must be removed there before it can be deleted from app ${app.id} "${app.name}"`
                            );
                        } else if (variableExists.qIsReserved === true) {
                            logger.warn(
                                `Variable "${variableIdentifier}" is a system variable and cannot be deleted from app ${app.id} "${app.name}"`
                            );
                        } else if (options.dryRun === undefined || options.dryRun === false) {
                            const res = await doc.destroyVariableByName(variableIdentifier);

                            if (res === true) {
                                logger.info(`Success: Removed variable ${variableIdentifier} from app ${app.id} "${app.name}"`);
                            } else {
                                logger.info(`Failure: Could not remove variable ${variableIdentifier} from app ${app.id} "${app.name}"`);
                            }
                        } else {
                            logger.info(
                                `DRY RUN: Delete of variable "${variableIdentifier}" in app ${app.id} "${app.name}" would happen here`
                            );
                        }
                    } else {
                        logger.warn(`Variable "${variableIdentifier}" does not exist in app ${app.id} "${app.name}"`);
                    }
                } else if (options.idType === 'id') {
                    // Does to-be-deleted variable exist in this app?
                    // eslint-disable-next-line arrow-body-style
                    const variableExists = appVariables.find((item) => {
                        return item.qInfo.qId === variableIdentifier;
                    });

                    if (variableExists) {
                        if (variableExists.qIsScriptCreated === true && variableExists?.qIsReserved !== true) {
                            logger.warn(
                                `Variable "${variableIdentifier}" is created in the load script and must be removed there before it can be deleted from app ${app.id} "${app.name}"`
                            );
                        } else if (variableExists.qIsReserved === true) {
                            logger.warn(
                                `Variable "${variableIdentifier}" is a system variable and cannot be deleted from app ${app.id} "${app.name}"`
                            );
                        } else if (options.dryRun === undefined || options.dryRun === false) {
                            const res = await doc.destroyVariableById(variableIdentifier);

                            if (res === true) {
                                logger.info(`Success: Removed variable ${variableIdentifier} from app ${app.id} "${app.name}"`);
                            } else {
                                logger.info(`Failure: Could not remove variable ${variableIdentifier} from app ${app.id} "${app.name}"`);
                            }
                        } else {
                            logger.info(
                                `DRY RUN: Delete of variable "${variableIdentifier}" in app ${app.id} "${app.name}" would happen here`
                            );
                        }
                    } else {
                        logger.warn(`Variable "${variableIdentifier}" does not exist in app ${app.id} "${app.name}"`);
                    }
                }

                // Close app session
                await session.close();
            }
        }

        if (session.globalPromise !== undefined) {
            if ((await session.close()) === true) {
                logger.verbose(`Closed session after deleting app variables`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        }
    } catch (err) {
        catchLog('Error in deleteVariable', err);
    }
};

export default deleteVariable;
