/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const enigma = require('enigma.js');

const { setupEnigmaConnection } = require('../util/enigma');
const { getApps } = require('../util/app');
const { logger, setLoggingLevel, isPkg, execPath } = require('../../globals');

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

        // Configure Enigma.js
        const configEnigma = await setupEnigmaConnection(options);

        for (const app of apps) {
            logger.info('------------------------');
            logger.info(`Deleting variables in app ${app.id} "${app.name}"`);

            const session = enigma.create(configEnigma);
            if (options.logLevel === 'silly') {
                session.on('traffic:sent', (data) => console.log('sent:', data));
                session.on('traffic:received', (data) => console.log('received:', data));
            }
            const global = await session.open();

            const engineVersion = await global.engineVersion();
            logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

            const doc = await global.openDoc(app.id, '', '', '', true);
            logger.verbose(`Opened app ${app.id} "${app.name}".`);

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
            }
            // Close app session
            await doc.session.close();
        }
    } catch (err) {
        logger.error(`DELETE VARIABLE: ${err.stack}`);
    }
};

module.exports = {
    deleteVariable,
};
