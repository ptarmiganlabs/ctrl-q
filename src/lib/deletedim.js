const enigma = require('enigma.js');

const { setupEnigmaConnection } = require('./enigma');
const { logger, setLoggingLevel } = require('../globals');

/**
 *
 * @param {*} options
 */
const deleteMasterDimension = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.info('Delete master dimensions');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Configure Enigma.js
        const configEnigma = setupEnigmaConnection(options);

        const session = enigma.create(configEnigma);
        if (options.logLevel === 'silly') {
            session.on('traffic:sent', (data) => console.log('sent:', data));
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

        const genericDimObj = await app.createSessionObject(dimensionCall);
        const dimObj = await genericDimObj.getLayout();

        // Get list of all IDs that should be deleted
        let deleteMasterItems = [];

        if (options.deleteAll || options.masterItem === undefined) {
            // Delete all master item dimensions
            deleteMasterItems = deleteMasterItems.concat(dimObj.qDimensionList.qItems);
        } else {
            // Loop over all master items (identified by name or ID) we should get data for
            // eslint-disable-next-line no-restricted-syntax
            for (const masterItem of options.masterItem) {
                // Can we find this master item in the list retrieved from the app?
                if (options.idType === 'name') {
                    const items = dimObj.qDimensionList.qItems.filter((item) => item.qMeta.title === masterItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        deleteMasterItems = deleteMasterItems.concat(items);
                    } else {
                        logger.warn(`Master item dimension "${masterItem}" not found`);
                    }
                } else if (options.idType === 'id') {
                    const items = dimObj.qDimensionList.qItems.filter((item) => item.qInfo.qId === masterItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        deleteMasterItems = deleteMasterItems.concat(items);
                    } else {
                        logger.warn(`Master item dimension "${masterItem}" not found`);
                    }
                } else {
                    throw Error('Invalid --id-type value');
                }
            }
        }

        logger.debug(`Master item measures to be deleted: ${JSON.stringify(deleteMasterItems)}`);

        if (deleteMasterItems.length === 0) {
            logger.warn(`No matching master item dimensions found`);
        } else {
            // eslint-disable-next-line no-restricted-syntax
            for (const item of deleteMasterItems) {
                if (options.dryRun === undefined || options.dryRun === false) {
                    // eslint-disable-next-line no-await-in-loop
                    const res = await app.destroyDimension(item.qInfo.qId);
                    if (res !== true) {
                        logger.error(`Failed deleting dimension "${item.qMeta.title}", id=${item.qInfo.qId} in app "${item.qInfo.qId}"`);
                    } else {
                        logger.info(`Deleted master item dimension "${item.qMeta.title}", id=${item.qInfo.qId} in app "${options.appId}"`);
                    }
                } else {
                    logger.info(`DRY RUN: Delete of master item dimension "${item.qMeta.title}", id=${item.qInfo.qId} would happen here`);
                }
            }
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
        logger.error(err.stack);
    }
};

module.exports = {
    deleteMasterDimension,
};
