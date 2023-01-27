const enigma = require('enigma.js');
const { table } = require('table');

const { setupEnigmaConnection } = require('../util/enigma');
const { logger, setLoggingLevel, isPkg, execPath } = require('../../globals');

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
        // 4: { width: 40 },
        // 5: { width: 40 },
        // 6: { width: 40 },
        // 9: { width: 40 },
    },
};

/**
 *
 * @param {*} options
 */
const getMasterDimension = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get master dimensions');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Configure Enigma.js
        const configEnigma = await setupEnigmaConnection(options);

        const session = enigma.create(configEnigma);
        if (options.logLevel === 'silly') {
            // eslint-disable-next-line no-console
            session.on('traffic:sent', (data) => console.log('sent:', data));
            // eslint-disable-next-line no-console
            session.on('traffic:received', (data) => console.log('received:', data));
        }
        const global = await session.open();

        const engineVersion = await global.engineVersion();
        logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

        const app = await global.openDoc(options.appId, '', '', '', false);
        logger.verbose(`Opened app ${options.appId}.`);

        // Get master dimensions
        // https://help.qlik.com/en-US/sense-developer/May2021/APIs/EngineAPI/definitions-NxLibraryDimensionDef.html
        const dimensionCall = {
            qInfo: {
                qId: 'DimensionObjectExt',
                qType: 'DimensionListExt',
            },
            qDimensionListDef: {
                qType: 'dimension',
                qData: {
                    dim: '/qDim',
                    info: '/qDimInfos',
                    // grouping: '/qDim/qGrouping',
                    // title: '/qMetaDef/title',
                    // tags: '/qMetaDef/tags',
                    // expression: '/qDim',
                    // description: '/qMetaDef/description',
                },
            },
        };

        // Not used right now
        // const appLayout = await app.getAppLayout();
        // const appProperties = await app.getAppProperties();

        const genericDimObj = await app.createSessionObject(dimensionCall);
        const dimObj = await genericDimObj.getLayout();

        // Get list of all IDs that should be retrieved
        let getMasterItems = [];

        if (options.masterItem === undefined) {
            // Get all master item measures
            getMasterItems = getMasterItems.concat(dimObj.qDimensionList.qItems);
        } else {
            // Loop over all master items (identified by name or ID) we should get data for
            // eslint-disable-next-line no-restricted-syntax
            for (const masterItem of options.masterItem) {
                // Can we find this master item in the list retrieved from the app?
                if (options.idType === 'name') {
                    const items = dimObj.qDimensionList.qItems.filter((item) => item.qMeta.title === masterItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        getMasterItems = getMasterItems.concat(items);
                    } else {
                        logger.warn(`Master item dimension "${masterItem}" not found`);
                    }
                } else if (options.idType === 'id') {
                    const items = dimObj.qDimensionList.qItems.filter((item) => item.qInfo.qId === masterItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        getMasterItems = getMasterItems.concat(items);
                    } else {
                        logger.warn(`Master item dimension "${masterItem}" not found`);
                    }
                } else {
                    throw Error('Invalid --id-type value');
                }
            }
        }

        logger.verbose(`Master item dimensions to be retrieved: ${JSON.stringify(getMasterItems)}`);

        if (getMasterItems.length === 0) {
            logger.warn(`No matching master item measures found`);
        } else if (options.outputFormat === 'json') {
            logger.debug(`Output to JSON`);

            logger.info(`\n${JSON.stringify(getMasterItems, null, 2)}`);
        } else if (options.outputFormat === 'table') {
            logger.debug(`Output to table`);

            const dimensionTable = [];
            dimensionTable.push([
                'Id',
                'Type',
                'Title',
                'Description (static)',
                'Description (from expression)',
                'Description expression',
                'Label expression',
                'Definition count',
                'Definition',
                'Coloring',
                'Grouping',
                'Approved',
                'Published',
                'Publish time',
                'Created date',
                'Modified date',
                'Owner',
                'Tags',
            ]);

            consoleTableConfig.header = {
                alignment: 'left',
                content: `Dimensions (${getMasterItems.length} dimension(s) found in the app)`,
            };

            // eslint-disable-next-line no-restricted-syntax
            for (const dimension of getMasterItems) {
                logger.debug(`Dimension about to be stored in table array:\n${JSON.stringify(dimension, null, 2)}`);

                dimensionTable.push([
                    dimension.qInfo.qId,
                    dimension.qInfo.qType,
                    dimension.qMeta.title,
                    dimension.qMeta.description,
                    dimension.qData.descriptionExpression !== undefined ? dimension.qData.descriptionExpression : '',
                    dimension.qData.dim.descriptionExpression ? dimension.qData.dim.descriptionExpression.qStringExpression.qExpr : '',
                    dimension.qData.dim.qLabelExpression !== undefined ? dimension.qData.dim.qLabelExpression : '',
                    dimension.qData.dim.qFieldDefs.length,
                    dimension.qData.dim.qFieldDefs.join('\n'),
                    JSON.stringify(dimension.qData.dim.coloring),
                    dimension.qData.dim.qGrouping,
                    dimension.qMeta.approved,
                    dimension.qMeta.published,
                    dimension.qMeta.publishTime,
                    dimension.qMeta.createdDate,
                    dimension.qMeta.modifiedDate,
                    `${dimension.qMeta.owner.userDirectory}\\${dimension.qMeta.owner.userId}`,
                    dimension.qMeta.tags !== undefined ? dimension.qMeta.tags : '',
                ]);
            }

            // Print table to console
            logger.info(`\n${table(dimensionTable, consoleTableConfig)}`);
        }

        if ((await app.destroySessionObject(genericDimObj.id)) === true) {
            logger.debug(`Destroyed session object after managing master items in app ${options.appId} on host ${options.host}`);

            if ((await session.close()) === true) {
                logger.verbose(`Closed session after managing master items in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        } else {
            logger.error(`Error destroying session object for master dimenions`);
        }
    } catch (err) {
        logger.error(err);
    }
};

module.exports = {
    getMasterDimension,
};
