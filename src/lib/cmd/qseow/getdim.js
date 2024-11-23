import enigma from 'enigma.js';

import { table } from 'table';
import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';

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
        9: { width: 100 },
    },
};

/**
 *
 * @param {*} options
 */
export async function getMasterDimension(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get master dimensions');
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
            // Get ALL master dimensions
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

        // Find coloring data (if available) for each dimension
        for (const dimension of getMasterItems) {
            // Find per-value colors, if defined
            // Such colors are NOT available for drill-down dimensions, which are identified by dimension.qData.dim.qGrouping="H"
            if (
                dimension.qData.dim.qGrouping !== 'H' &&
                dimension.qData?.coloring?.hasValueColors === true &&
                dimension.qData?.coloring?.colorMapRef !== undefined
            ) {
                try {
                    const genericColorMapRefModel = await app.getObject(`ColorMapModel_${dimension.qData.coloring.colorMapRef}`);
                    const colorMapRefLayout = await genericColorMapRefModel.getLayout();
                    dimension.colorMap = colorMapRefLayout.colorMap;
                } catch (err) {
                    catchLog(`Error getting color map for dimension ${dimension.qInfo.qId}`, err);
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

                let colorColumn = '';
                if (dimension?.qData?.coloring?.baseColor) {
                    // There is dimension color defined
                    colorColumn = 'Dimension color:\n';
                    colorColumn += JSON.stringify(dimension.qData.coloring.baseColor);
                }

                if (colorColumn.length > 0) {
                    colorColumn += '\n\n';
                }

                if (dimension?.colorMap) {
                    // There are dimensional per-value colors defined
                    colorColumn += 'Value colors:\n';
                    colorColumn += JSON.stringify(dimension.colorMap);
                }

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
                    colorColumn,
                    dimension.qData.dim.qGrouping,
                    dimension.qMeta.approved,
                    dimension.qMeta.published,
                    dimension.qMeta.publishTime,
                    dimension.qMeta.createdDate,
                    dimension.qMeta.modifiedDate,
                    `${dimension.qMeta.owner.userDirectory}\\${dimension.qMeta.owner.userId}`,
                    dimension.qMeta.tags !== undefined ? dimension.qMeta.tags.toString() : '',
                ]);
            }

            // Print table to console
            logger.info(`\n${table(dimensionTable, consoleTableConfig)}`);
        }

        if ((await app.destroySessionObject(genericDimObj.id)) === true) {
            logger.debug(`Destroyed session object after managing master items in app ${options.appId} on host ${options.host}`);

            if ((await session.close()) === true) {
                logger.verbose(`Closed session after managing master dimension(s) in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        } else {
            logger.error(`Error destroying session object for master dimenions`);
        }
    } catch (err) {
        catchLog(`Error getting master dimensions`, err);
    }
}
