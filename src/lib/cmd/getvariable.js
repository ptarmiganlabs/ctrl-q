/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import enigma from 'enigma.js';

import { table } from 'table';
import { setupEnigmaConnection, addTrafficLogging } from '../util/enigma.js';
import { getApps } from '../util/app.js';
import { logger, setLoggingLevel, isPkg, execPath } from '../../globals.js';
import { catchLog } from '../util/log.js';

const consoleTableConfig = {
    border: {
        topBody: `─`,
        topJoin: `┬`,
        topLeft: `┌`,
        topRight: `┐`,

        bottomBody: `─`,
        bottomJoin: `┴`,
        bottomLeft: `└`,
        bottomRight: `┘`,

        bodyLeft: `│`,
        bodyRight: `│`,
        bodyJoin: `│`,

        joinBody: `─`,
        joinLeft: `├`,
        joinRight: `┤`,
        joinJoin: `┼`,
    },
    columns: {
        // 3: { width: 40 },
        // 4: { width: 30 },
        // 5: { width: 30 },
        // 6: { width: 30 },
    },
};

/**
 *
 * @param {*} options
 */
const getVariable = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get IDs of all apps that should be processed
        const apps = await getApps(options, options.appId, options.appTag);

        logger.info(`Found ${apps.length} apps to process`);

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
            catchLog(`Error opening session (1) to server ${options.host}`, err);
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

        let allVariables = [];
        let subsetVariables = [];

        for (const app of apps) {
            logger.info(`Getting variables from app ${app.id}, "${app.name}"`);

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

            // Open app without data
            const doc = await global.openDoc(app.id, '', '', '', true);
            logger.verbose(`Opened app ${app.id}, "${app.name}".`);

            // Get variables from app
            // https://help.qlik.com/en-US/sense-developer/May2021/APIs/EngineAPI/services-Doc-GetVariables.html
            // const appVariables = await doc.getVariables({
            //     qType: 'variable',
            //     qShowReserved: true,
            //     qShowConfig: true,
            //     qData: { tags: '/tags' },
            //     qShowSession: true,
            // });

            const appVariablesModel = await doc.createSessionObject({
                qInfo: {
                    qId: 'VariableList',
                    qType: 'VariableList',
                },
                qVariableListDef: {
                    qType: 'variable',
                    qShowReserved: true,
                    qShowConfig: true,
                    qData: {
                        tags: '/tags',
                    },
                },
            });

            const appVariablesLayout = await appVariablesModel.getLayout();

            // allVariables = allVariables.concat({ appId: app.id, appName: app.name, variables: appVariables });
            allVariables = allVariables.concat({ appId: app.id, appName: app.name, variables: appVariablesLayout.qVariableList.qItems });

            // Close app session
            // await doc.session.close();
            await session.close();
        }

        if (options.variable === undefined) {
            // Get all variables
            subsetVariables = subsetVariables.concat(allVariables);
        } else {
            // Loop over all variables (identified by name or ID) in all apps that we should get data for
            for (const app of allVariables) {
                // Can we find this variable in the list retrieved from the app?
                if (options.idType === 'name') {
                    const items = app.variables.filter((item) => {
                        // Is this variable one that should be included in the results?
                        // eslint-disable-next-line arrow-body-style
                        const items2 = options.variable.find((variable) => {
                            return variable === item.qName;
                        });
                        return items2 === undefined ? false : items2;
                    });

                    if (items.length > 0) {
                        // We've found at least one variable that should be returned
                        subsetVariables = subsetVariables.concat({ appId: app.appId, appName: app.appName, variables: items });
                    } else {
                        logger.warn(`No matching variables found in app ${app.appId} "${app.appName}"`);
                    }
                } else if (options.idType === 'id') {
                    const items = app.variables.filter((item) => {
                        // Is this variable one that should be included in the results?
                        // eslint-disable-next-line arrow-body-style
                        const items2 = options.variable.find((variable) => {
                            return variable === item.qInfo.qId;
                        });
                        return items2 === undefined ? false : items2;
                    });

                    if (items.length > 0) {
                        // We've found at least one variable that should be returned
                        subsetVariables = subsetVariables.concat({ appId: app.appId, appName: app.appName, variables: items });
                    } else {
                        logger.warn(`No matching variables found in app ${app.appId} "${app.appName}"`);
                    }
                } else {
                    throw Error('Invalid --id-type value');
                }
            }
        }

        if (subsetVariables.length === 0) {
            logger.warn(`No matching variables found`);
        } else if (options.outputFormat === 'json') {
            logger.debug(`Output to JSON`);

            logger.info(`\n${JSON.stringify(subsetVariables, null, 2)}`);
        } else if (options.outputFormat === 'table') {
            logger.debug(`Output to table`);

            const variableTable = [];
            variableTable.push([
                'App ID',
                'App name',
                'Variable ID',
                'Variable name',
                'Description',
                'Type',
                'Definition',
                'Is reserved',
                'Is script created',
                'Created date',
                'Modified date',
                'Engine object type',
                'Size',
                'Title',
                'Privileges',
                'Tags',
            ]);

            consoleTableConfig.header = {
                alignment: 'left',
                content: `In-app variables`,
            };

            // eslint-disable-next-line no-restricted-syntax
            for (const app of subsetVariables) {
                // eslint-disable-next-line no-restricted-syntax
                for (const variable of app.variables) {
                    logger.debug(`Variable about to be stored in table array:\n${JSON.stringify(variable, null, 2)}`);

                    variableTable.push([
                        app.appId,
                        app.appName,
                        variable.qInfo.qId,
                        variable.qName,
                        variable.qDescription ? variable.qDescription : '',
                        variable.qInfo.qType,
                        variable.qDefinition,
                        variable.qIsReserved ? variable.qIsReserved : '',
                        variable.qIsScriptCreated ? variable.qIsScriptCreated : '',
                        variable.qMeta.createdDate ? variable.qMeta.createdDate : '',
                        variable.qMeta.modifiedDate ? variable.qMeta.modifiedDate : '',
                        variable.qMeta.qEngineObjectType ? variable.qMeta.qEngineObjectType : '',
                        variable.qMeta.qSize ? variable.qMeta.qSize : '',
                        variable.qMeta.title ? variable.qMeta.title : '',
                        variable.qMeta.privileges.toString(),
                        variable.qData?.tags !== undefined ? variable.qData.tags.toString() : '',
                    ]);
                }
            }

            // Print table to console
            logger.info(`\n${table(variableTable, consoleTableConfig)}`);
        } else {
            logger.error('Undefined --output-format option');
        }

        if (session.globalPromise !== undefined) {
            if ((await session.close()) === true) {
                logger.verbose(`Closed session after getting app variables.`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        }
    } catch (err) {
        catchLog(`Error in getVariable`, err);
    }
};

export default getVariable;
