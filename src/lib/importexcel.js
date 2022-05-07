/* eslint-disable no-await-in-loop */
const enigma = require('enigma.js');
const xlsx = require('node-xlsx').default;

const { setupEnigmaConnection } = require('./enigma');
const { logger, setLoggingLevel } = require('../globals');

/**
 * Find of column's positioon (zero based) given a column name.
 * Column names are passed in as array
 * If column names does not exist an error is thrown
 * @param {*} colPosition
 */
const getColumnPos = (options, colName, colNameArray) => {
    const colMatches = colNameArray.filter((col) => col === colName);

    if (colMatches.length === 1) {
        return colNameArray.indexOf(colMatches[0]);
    }

    throw Error(`EXCEL IMPORT: Could not find column "${colName}" on sheet ${options.sheet}`);
};

/**
 *
 * @param {*} options
 */
const importMasterItemFromExcel = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.loglevel);

        logger.info(`Import master items from definitions in Excel file "${options.file}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Parse Excel file
        const workSheetsFromFile = xlsx.parse(options.file);

        // Verify paramaters
        const sheet = workSheetsFromFile.find((item) => item.name === options.sheet);
        if (!sheet) {
            logger.error(`EXCEL IMPORT: Can't find sheet ${options.sheet} in file ${options.file}`);
            throw new Error('aaa');
        }

        // --col-by-ref
        // Position of column (zero based) where measure type info is stored
        const colPosMasterItemType = getColumnPos(options, options.colItemType, sheet.data[0]);

        // --col-master-item-name
        const colPosMasterItemName = getColumnPos(options, options.colMasterItemName, sheet.data[0]);

        // --col-master-item-descr
        const colPosMasterItemDescr = getColumnPos(options, options.colMasterItemDescr, sheet.data[0]);

        // --col-master-item-label
        const colPosMasterItemLabel = getColumnPos(options, options.colMasterItemLabel, sheet.data[0]);

        // --col-master-item-expr
        const colPosMasterItemExpr = getColumnPos(options, options.colMasterItemExpr, sheet.data[0]);

        // --col-master-item-tag
        const colPosMasterItemTag = getColumnPos(options, options.colMasterItemTag, sheet.data[0]);

        // Configure Enigma.js
        const configEnigma = setupEnigmaConnection(options);

        const session = enigma.create(configEnigma);
        if (options.loglevel === 'silly') {
            // eslint-disable-next-line no-console
            session.on('traffic:sent', (data) => console.log('sent:', data));
            // eslint-disable-next-line no-console
            session.on('traffic:received', (data) => console.log('received:', data));
        }
        const global = await session.open();

        const engineVersion = await global.engineVersion();
        logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

        const app = await global.openDoc(options.appid, '', '', '', false);
        logger.verbose(`Opened app ${options.appid}.`);

        // Get list of all existing master dimensions and measures

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
                },
            },
        };

        // https://help.qlik.com/en-US/sense-developer/May2021/APIs/EngineAPI/definitions-NxLibraryMeasureDef.html
        const measureCall = {
            qInfo: {
                qId: 'measureObject',
                qType: 'MeasureList',
            },
            qMeasureListDef: {
                qType: 'measure',
                qData: {
                    measure: '/qMeasure',
                },
            },
        };

        // Get master dimensions
        const genericDimObj = await app.createSessionObject(dimensionCall);
        const dimObj = await genericDimObj.getLayout();

        // Get master measures
        const genericMeasureObj = await app.createSessionObject(measureCall);
        const measureObj = await genericMeasureObj.getLayout();

        // Loop through rows in Excel file, extracting data for rows flagged as master items
        let importCount = 0;
        if (sheet && sheet.data.length > 0) {
            // Loop through all rows
            // eslint-disable-next-line no-restricted-syntax
            for (const row of sheet.data) {
                logger.debug(`Current row master item type: ${row[colPosMasterItemType]}`);
                if (row[colPosMasterItemType] === 'dim-single') {
                    // A master dimension of type "single" should be created based on the current row

                    // Data that should be written to new dimension
                    let dimSingleData = {
                        qInfo: {
                            qType: 'dimension',
                        },
                        qDim: {
                            // title: row[parseInt(options.columnname, 10)],
                            qGrouping: 'N',
                            qFieldDefs: [row[colPosMasterItemExpr]],
                            // qFieldLabels: [row[parseInt(options.columnexpr, 10)]],
                            qFieldLabels: [],
                            qLabelExpression: row[colPosMasterItemLabel],
                            // row[parseInt(options.columnlabel, 10)].substring(0, 1) === '='
                            //     ? row[parseInt(options.columnlabel, 10)]
                            //     : `'${row[parseInt(options.columnlabel, 10)]}'`,
                        },
                        qMetaDef: {
                            title: row[colPosMasterItemName],
                            description: row[colPosMasterItemDescr],
                            tags: row[colPosMasterItemTag].split(','),
                            owner: {
                                userId: options.userid,
                                userDirectory: options.userdir,
                            },
                        },
                    };

                    // Test if a master dimension with the given title already exists.
                    // If it does, update it rather than creating a new one.
                    const existingItem = dimObj.qDimensionList.qItems.find((item) => item.qMeta.title === row[colPosMasterItemName]);
                    if (existingItem) {
                        // An existing master dimension has same name as the one being created.

                        // Get existing dimension (that should be updated)
                        const existingDim = await app.getDimension(existingItem.qInfo.qId);

                        dimSingleData = {
                            qInfo: {
                                qType: 'dimension',
                            },
                            qDim: {
                                qGrouping: 'N',
                                qFieldDefs: [row[colPosMasterItemExpr]],
                                qFieldLabels: [],
                                title: row[colPosMasterItemName],
                                qLabelExpression: row[colPosMasterItemLabel],
                                // row[parseInt(options.columnlabel, 10)].substring(0, 1) === '='
                                //     ? row[parseInt(options.columnlabel, 10)]
                                //     : `'${row[parseInt(options.columnlabel, 10)]}'`,
                                // coloring: colorBlock,
                            },
                            qMetaDef: {
                                title: row[colPosMasterItemName],
                                description: row[colPosMasterItemDescr],
                                tags: row[colPosMasterItemTag].split(','),
                                // masterScriptId: t.msId,
                                // owner: {
                                //   userId: options.userid,
                                //   userDirectory: options.userdir,
                                // },
                            },
                        };

                        // Update existing dimension with new data
                        const res = await existingDim.setProperties(dimSingleData);
                        logger.info(`Updated existing dimension "${dimSingleData.qMetaDef.title}"`);

                        importCount += 1;
                        if (importCount === parseInt(options.limitImportCount, 10)) {
                            break;
                        }
                    } else {
                        // Create a new master dimension in the app
                        const res = await app.createDimension(dimSingleData);
                        logger.info(`Created new dimension "${dimSingleData.qMetaDef.title}"`);

                        importCount += 1;
                        if (importCount === parseInt(options.limitImportCount, 10)) {
                            break;
                        }
                    }
                } else if (row[colPosMasterItemType] === 'measure') {
                    // A master measure should be created based on the current row

                    // Data that should be written to new measure
                    let measureData = {
                        qInfo: {
                            qType: 'measure',
                        },
                        qMeasure: {
                            qLabel: row[colPosMasterItemLabel],
                            qGrouping: 'N',
                            qDef: row[colPosMasterItemExpr],
                            qExpressions: [],
                            qActiveExpression: 0,
                            qLabelExpression: row[colPosMasterItemLabel],
                            // row[parseInt(options.columnlabel, 10)].substring(0, 1) === '='
                            //     ? row[parseInt(options.columnlabel, 10)]
                            //     : `'${row[parseInt(options.columnlabel, 10)]}'`,
                            // coloring:colorBlock
                        },
                        qMetaDef: {
                            title: row[colPosMasterItemName],
                            description: row[colPosMasterItemDescr],
                            tags: row[colPosMasterItemTag].split(','),
                            // masterScriptId:t.msId
                            // owner: {
                            //   userId: options.userid,
                            //   userDirectory: options.userdir,
                            // },
                        },
                    };

                    // Test if a master measure with the given title already exists.
                    // If it does, update it rather than creating a new one.
                    const existingItem = measureObj.qMeasureList.qItems.find((item) => item.qMeta.title === row[colPosMasterItemName]);
                    if (existingItem) {
                        // An existing master measure has same name as the one being created.

                        // Get existing measure (that should be updated)
                        const existingMeasure = await app.getMeasure(existingItem.qInfo.qId);

                        measureData = {
                            qInfo: {
                                qType: 'measure',
                            },
                            qMeasure: {
                                qLabel: row[colPosMasterItemLabel],
                                qGrouping: 'N',
                                qDef: row[colPosMasterItemExpr],
                                qExpressions: [],
                                qActiveExpression: 0,
                                qLabelExpression: row[colPosMasterItemLabel],
                                //     row[parseInt(options.columnlabel, 10)].substring(0, 1) === '='
                                //         ? row[parseInt(options.columnlabel, 10)]
                                //         : `'${row[parseInt(options.columnlabel, 10)]}'`,
                                // coloring:colorBlock
                            },
                            qMetaDef: {
                                title: row[colPosMasterItemName],
                                description: row[colPosMasterItemDescr],
                                tags: row[colPosMasterItemTag].split(','),
                                // masterScriptId:t.msId
                                // owner: {
                                //   userId: options.userid,
                                //   userDirectory: options.userdir,
                                // },
                            },
                        };

                        // Update existing measure with new data
                        const res = await existingMeasure.setProperties(measureData);
                        logger.info(`Updated existing measure "${measureData.qMetaDef.title}"`);

                        importCount += 1;
                        if (importCount === parseInt(options.limitImportCount, 10)) {
                            break;
                        }
                    } else {
                        // Create a new master measure in the app
                        const res = await app.createMeasure(measureData);
                        logger.info(`Created new measure "${measureData.qMetaDef.title}"`);

                        importCount += 1;
                        if (importCount === parseInt(options.limitImportCount, 10)) {
                            break;
                        }
                    }
                }
            }
        }

        if ((await session.close()) === true) {
            logger.verbose(`Closed session after adding/updating master items in app ${options.appid} on host ${options.host}`);
        } else {
            logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
        }
    } catch (err) {
        logger.error(err.stack);
    }
};

const importMasterItemFromFile = (options) => {
    if (options.fileType === 'excel') {
        // Source file type is Excel
        importMasterItemFromExcel(options);
    }
};

module.exports = {
    importMasterItemFromFile,
};
