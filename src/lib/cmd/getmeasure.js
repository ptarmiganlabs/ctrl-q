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
        // 4: { width: 30 },
        // 5: { width: 30 },
        // 6: { width: 30 },
    },
};

/**
 *
 * @param {*} options
 */
const getMasterMeasure = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get master measures');
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

        // Get master measures
        // https://help.qlik.com/en-US/sense-developer/May2021/APIs/EngineAPI/definitions-NxLibraryMeasureDef.html
        const measureCall = {
            qInfo: {
                qId: 'measureObject',
                qType: 'MeasureList',
                // qId: 'measureObjectExt',
                // qType: 'MeasureListExt',
            },
            qMeasureListDef: {
                qType: 'measure',
                qData: {
                    measure: '/qMeasure',
                },
            },
        };
        const genericMeasureObj = await app.createSessionObject(measureCall);
        const measureObj = await genericMeasureObj.getLayout();

        // Get list of all IDs that should be retrieved
        let getMasterItems = [];

        if (options.masterItem === undefined) {
            // Get all master item measures
            getMasterItems = getMasterItems.concat(measureObj.qMeasureList.qItems);
        } else {
            // Loop over all master items (identified by name or ID) we should get data for
            // eslint-disable-next-line no-restricted-syntax
            for (const masterItem of options.masterItem) {
                // Can we find this master item in the list retrieved from the app?
                if (options.idType === 'name') {
                    const items = measureObj.qMeasureList.qItems.filter((item) => item.qMeta.title === masterItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        getMasterItems = getMasterItems.concat(items);
                    } else {
                        logger.warn(`Master item measure "${masterItem}" not found`);
                    }
                } else if (options.idType === 'id') {
                    const items = measureObj.qMeasureList.qItems.filter((item) => item.qInfo.qId === masterItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        getMasterItems = getMasterItems.concat(items);
                    } else {
                        logger.warn(`Master item measure "${masterItem}" not found`);
                    }
                } else {
                    throw Error('Invalid --id-type value');
                }
            }
        }

        logger.verbose(`Master item measures to be retrieved: ${JSON.stringify(getMasterItems)}`);

        if (getMasterItems.length === 0) {
            logger.warn(`No matching master item measures found`);
        } else if (options.outputFormat === 'json') {
            logger.debug(`Output to JSON`);

            logger.info(`\n${JSON.stringify(getMasterItems, null, 2)}`);
        } else if (options.outputFormat === 'table') {
            logger.debug(`Output to table`);

            const measureTable = [];
            measureTable.push([
                'Id',
                'Type',
                'Title',
                'Description',
                'Label',
                'Label expression',
                'Definition',
                'Coloring',
                'Number format',
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
                content: `Measures (${getMasterItems.length} measure(s) found in the app)`,
            };

            // eslint-disable-next-line no-restricted-syntax
            for (const measure of getMasterItems) {
                logger.debug(`Measure about to be stored in table array:\n${JSON.stringify(measure, null, 2)}`);

                measureTable.push([
                    measure.qInfo.qId,
                    measure.qInfo.qType,
                    measure.qMeta.title,
                    measure.qMeta.description,
                    measure.qData.measure.qLabel,
                    measure.qData.measure.qLabelExpression,
                    measure.qData.measure.qDef,
                    JSON.stringify(measure.qData.coloring),
                    JSON.stringify(measure.qData.measure.qNumFormat),
                    measure.qData.measure.qGrouping,
                    measure.qMeta.approved,
                    measure.qMeta.published,
                    measure.qMeta.publishTime,
                    measure.qMeta.createdDate,
                    measure.qMeta.modifiedDate,
                    `${measure.qMeta.owner.authUserDirectory}\\${measure.qMeta.owner.authUserId}`,
                    measure.qMeta.tags,
                ]);
            }

            // Print table to console
            logger.info(`\n${table(measureTable, consoleTableConfig)}`);
        } else {
            logger.error('Undefined --output-format option');
        }

        if ((await app.destroySessionObject(genericMeasureObj.id)) === true) {
            logger.debug(`Destroyed session object after managing master items in app ${options.appId} on host ${options.host}`);

            if ((await session.close()) === true) {
                logger.verbose(`Closed session after getting master item measures in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        } else {
            logger.error(`Error destroying session object for master measures`);
        }
    } catch (err) {
        logger.error(err.stack);
    }
};

module.exports = {
    getMasterMeasure,
};
