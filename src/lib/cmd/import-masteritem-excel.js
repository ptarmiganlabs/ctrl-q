/* eslint-disable no-await-in-loop */
const enigma = require('enigma.js');
const xlsx = require('node-xlsx').default;
const uuidCreate = require('uuid').v4;

const { setupEnigmaConnection } = require('../util/enigma');
const { logger, setLoggingLevel, isPkg, execPath, verifyFileExists } = require('../../globals');
const { promises } = require('winston-daily-rotate-file');

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
 * @param {*} existingDimLayout
 * @param {*} newPerValueColorMap
 */
const createColorMap = async (app, colorMapId, newPerValueColorMap) => {
    // Get id for new color map
    if (colorMapId === null) {
        // We're dealing with a not-yet-created dimension. Get a new ID for the color map
        // eslint-disable-next-line no-param-reassign
        colorMapId = uuidCreate();
    }

    // 2. Create new, empty color map
    const newGenericColorMapRefModel = await app.createObject({
        qInfo: {
            qType: 'ColorMap',
            qId: `ColorMapModel_${colorMapId}`,
        },
        colorMap: {},
    });

    // 3. Get properties of created color map
    const newGenericColorMapRefProp = await newGenericColorMapRefModel.getProperties();
    newGenericColorMapRefProp.colorMap = newPerValueColorMap;

    // const newColorMapProperties = await newGenericColorMapRefModel.getProperties();
    // const newColorMapPropertiesLayout = await newGenericColorMapRefModel.getLayout();
    // 4. Set properties of created color map
    let res = await newGenericColorMapRefModel.setProperties(newGenericColorMapRefProp);

    // let res = await newGenericColorMapRefModel.setProperties({
    //     qInfo: {
    //         qId: `ColorMapModel_${colorMapId}`,
    //         qType: 'ColorMap',
    //     },
    //     qExtendsId: '',
    //     qMetaDef: {},
    //     qStateName: '',
    //     colorMap: newPerValueColorMap,
    // });
    // let res = await newGenericColorMapRefModel.setProperties(newPerValueColorMap);

    // 5. Get newly created color map object
    const newColorMapObj = await app.getObject(`ColorMapModel_${colorMapId}`);

    // 6. Get layout of newly created color map object
    const newColorMapLayout = await newGenericColorMapRefModel.getLayout();
    // const a1 = await newGenericColorMapRefModel.getLayout();

    return colorMapId;
};

/**
 *
 * @param {*} options
 */
const importMasterItemFromExcel = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Import master items from definitions in Excel file "${options.file}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Verify Master items Excel file exists
        const excelFileExists = await verifyFileExists(options.file);
        if (excelFileExists === false) {
            logger.error(`Missing master item Excel file ${options.file}. Aborting`);
            process.exit(1);
        } else {
            logger.verbose(`Master item Excel file ${options.file} found`);
        }

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

        // --col-master-item-color
        const colPosMasterItemColor = getColumnPos(options, options.colMasterItemColor, sheet.data[0]);

        // --col-master-item-color
        const colPosMasterItemPerValueColor = getColumnPos(options, options.colMasterItemPerValueColor, sheet.data[0]);

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
                qId: 'MeasureList',
                qType: 'MeasureList',
            },
            qMeasureListDef: {
                qType: 'measure',
                qData: {
                    measure: '/qMeasure',
                    title: '/qMetaDef/title',
                    tags: '/qMetaDef/tags',
                    labelExpression: '/qMeasure/qLabelExpression',
                },
            },
        };

        // Get master dimensions
        const dimsModel = await app.createSessionObject(dimensionCall);
        const dimsLayout = await dimsModel.getLayout();

        // Get master measures
        const measuresModel = await app.createSessionObject(measureCall);
        const measuresLayout = await measuresModel.getLayout();

        // Loop through rows in Excel file, extracting data for rows flagged as master items
        let importCount = 0;
        if (sheet && sheet.data.length > 0) {
            let rowCount = 0;

            // Loop through all rows
            // eslint-disable-next-line no-restricted-syntax
            for (const row of sheet.data) {
                logger.debug(`Current row master item type: ${row[colPosMasterItemType]}`);
                if (row[colPosMasterItemType] === 'dim-single') {
                    // A master dimension of type "single" should be created based on the current row

                    // Data that should be written to new dimension
                    const dimSingleData = {
                        qInfo: {
                            qType: 'dimension',
                        },
                        qDim: {
                            qGrouping: 'N',
                            qFieldDefs: [row[colPosMasterItemExpr]],
                            qFieldLabels: [row[colPosMasterItemExpr]],
                            title: row[colPosMasterItemName],
                            qLabelExpression: row[colPosMasterItemLabel],
                            // row[parseInt(options.columnlabel, 10)].substring(0, 1) === '='
                            //     ? row[parseInt(options.columnlabel, 10)]
                            //     : `'${row[parseInt(options.columnlabel, 10)]}'`,
                            coloring: {},
                            // coloring: colorBlock,
                        },
                        qMetaDef: {
                            title: row[colPosMasterItemName],
                            description: row[colPosMasterItemDescr],
                            tags: row[colPosMasterItemTag] ? row[colPosMasterItemTag].split(',') : '',
                            // owner: {
                            //   userId: options.authUserId,
                            //   userDirectory: options.authUserDir,
                            // },
                        },
                    };

                    // Is there any per-value color data for this row?
                    let newPerValueColorMap = null;
                    if (row[colPosMasterItemPerValueColor]?.length > 0) {
                        const cleanColorString = row[colPosMasterItemPerValueColor].replace('\r', '').replace('\n', '');
                        newPerValueColorMap = JSON.parse(`${cleanColorString}`);
                        logger.debug(`Color map loaded from Excel file: ${JSON.stringify(newPerValueColorMap)}`);
                    }

                    // Is there any dimension color data for this row?
                    let newDimColor = null;
                    if (row[colPosMasterItemColor]?.length > 0) {
                        const cleanColorString = row[colPosMasterItemColor].replace('\r', '').replace('\n', '');
                        newDimColor = JSON.parse(`${cleanColorString}`);
                        logger.debug(`Dimension color loaded from Excel file: ${JSON.stringify(newDimColor)}`);
                    }

                    // Test if a master dimension with the given title already exists.
                    // If it does, update it rather than creating a new one.
                    const existingItem = dimsLayout.qDimensionList.qItems.find((item) => item.qMeta.title === row[colPosMasterItemName]);
                    if (existingItem) {
                        // An existing master dimension has same name as the one being created
                        // Update the existing dimension with data from the Excel file

                        // Get model and layout for the existing dimension
                        const existingDimModel = await app.getDimension(existingItem.qInfo.qId);
                        const existingDimLayout = await existingDimModel.getLayout();

                        // Update dimension with new info
                        dimSingleData.qInfo.qId = existingItem.qInfo.qId;

                        // Do we have a new dimension color value?
                        if (newDimColor) {
                            // Use the color provided in the Excel file
                            dimSingleData.qDim.coloring.baseColor = newDimColor.baseColor;
                        } else if (existingDimLayout.qDim?.coloring?.baseColor) {
                            // No new dimension color, delete any existing ones
                            delete dimSingleData.qDim.coloring.baseColor;

                            // Use dimension's existing color, if there is one
                            // dimSingleData.qDim.coloring.baseColor = existingDimLayout.qDim.coloring.baseColor;
                        }

                        // Check if there exists a per-value color map for the existing dimension
                        let existingColorMapPromise;
                        let existingColorMapModel;
                        let existingColorMapLayout;
                        try {
                            existingColorMapPromise = app.getObject(`ColorMapModel_${existingItem.qInfo.qId}`);
                            [existingColorMapModel] = await Promise.all([existingColorMapPromise]);
                            existingColorMapLayout = await existingColorMapModel.getLayout();
                        } catch (err) {
                            logger.verbose(`No per-value color map exists for existing dimension "${existingDimLayout.qMeta.title}"`);
                        }

                        // Do we have new per-value color data?
                        if (newPerValueColorMap) {
                            // Does existing dimension already has per-value color data?
                            // If so update it rather than creating a new color map
                            if (existingColorMapModel?.id) {
                                let res = await existingColorMapModel.setProperties({
                                    qInfo: existingColorMapLayout.qInfo,
                                    qExtendsId: '',
                                    qMetaDef: {},
                                    qStateName: '',
                                    colorMap: newPerValueColorMap,
                                });

                                dimSingleData.qDim.coloring.colorMapRef = existingDimLayout.qInfo.qId;
                                dimSingleData.qDim.coloring.hasValueColors = true;
                            } else {
                                // Create new color map and attach it to the existing dimension
                                const newColorMapId = await createColorMap(app, existingDimLayout.qInfo.qId, newPerValueColorMap);

                                // Update master item with new per-value color data
                                dimSingleData.qDim.coloring.colorMapRef = newColorMapId;
                                dimSingleData.qDim.coloring.hasValueColors = true;
                            }
                        } else if (existingDimLayout.qDim?.coloring?.hasValueColors === true) {
                            // No new per value colors, delete any existing ones
                            delete dimSingleData.qDim.coloring.colorMapRef;
                            delete dimSingleData.qDim.coloring.hasValueColors;

                            // Use dimension's existing
                            // dimSingleData.qDim.coloring.colorMapRef = existingDimLayout.qDim.coloring.colorMapRef;
                            // dimSingleData.qDim.coloring.hasValueColors = existingDimLayout.qDim.coloring.hasValueColors;
                        }

                        // 7. Set properties of existing dimension
                        let res = await existingDimModel.setProperties(dimSingleData);
                        res = await app.getAppLayout();
                        logger.info(`Updated existing dimension "${dimSingleData.qMetaDef.title}"`);
                    } else {
                        // Create a new master dimension in the app

                        // Add owner
                        dimSingleData.qMetaDef.owner = {
                            userId: options.authUserId,
                            userDirectory: options.authUserDir,
                        };

                        const newDimModel = await app.createDimension(dimSingleData);
                        const newDimLayout = await newDimModel.getLayout();

                        // Do we have a new dimension color value?
                        if (newDimColor) {
                            // Use the color provided in the Excel file
                            dimSingleData.qDim.coloring.baseColor = newDimColor.baseColor;
                        }

                        // Do we have new per-value color data?
                        if (newPerValueColorMap) {
                            // Create new color map and attach it to the existing dimension
                            const newColorMapId = await createColorMap(app, newDimLayout.qInfo.qId, newPerValueColorMap);

                            // Update master item with new per-value color data
                            dimSingleData.qDim.coloring.colorMapRef = newColorMapId;
                            dimSingleData.qDim.coloring.hasValueColors = true;
                        }

                        // Set properties of existing dimension
                        res = await newDimModel.setProperties(dimSingleData);
                        res = await app.getAppLayout();
                        logger.info(`Created new dimension "${dimSingleData.qMetaDef.title}"`);
                    }

                    importCount += 1;
                    if (importCount === parseInt(options.limitImportCount, 10)) {
                        break;
                    }
                } else if (row[colPosMasterItemType] === 'measure') {
                    // A master measure should be created based on the current row

                    // Data that should be written to new measure
                    const measureData = {
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
                            coloring: {},
                            // coloring: colorBlock
                        },
                        qMetaDef: {
                            title: row[colPosMasterItemName],
                            description: row[colPosMasterItemDescr],
                            tags: row[colPosMasterItemTag] ? row[colPosMasterItemTag].split(',') : '',
                            // masterScriptId:t.msId
                            // owner: {
                            //   userId: options.authUserId,
                            //   userDirectory: options.authUserDir,
                            // },
                        },
                    };

                    // Is there any segment color data for this row?
                    let newSegmentColors = null;
                    if (row[colPosMasterItemPerValueColor]?.length > 0) {
                        const cleanColorString = row[colPosMasterItemPerValueColor].replace('\r', '').replace('\n', '');
                        newSegmentColors = JSON.parse(`${cleanColorString}`);
                        logger.debug(`Color map loaded from Excel file: ${JSON.stringify(newSegmentColors)}`);
                    }

                    // Is there any measure color data for this row?
                    let newMeasureColor = null;
                    if (row[colPosMasterItemColor]?.length > 0) {
                        const cleanColorString = row[colPosMasterItemColor].replace('\r', '').replace('\n', '');
                        newMeasureColor = JSON.parse(`${cleanColorString}`);
                        logger.debug(`Dimension color loaded from Excel file: ${JSON.stringify(newMeasureColor)}`);
                    }

                    // Test if a master measure with the given title already exists.
                    // If it does, update it rather than creating a new one.
                    const existingItem = measuresLayout.qMeasureList.qItems.find((item) => item.qMeta.title === row[colPosMasterItemName]);
                    if (existingItem) {
                        // An existing master measure has same name as the one being created.

                        // Get existing measure (that should be updated)
                        const existingMeasureModel = await app.getMeasure(existingItem.qInfo.qId);
                        const existingMeasureLayout = await existingMeasureModel.getLayout();

                        // Update measure with new info
                        measureData.qInfo.qId = existingItem.qInfo.qId;

                        // Do we have a measure color value?
                        if (newMeasureColor) {
                            // Use the measure color in the Excel file
                            measureData.qMeasure.coloring.baseColor = newMeasureColor;
                        } else if (existingMeasureLayout.qMeasure?.coloring?.baseColor) {
                            // No new measure color, delete any existing one
                            delete measureData.qMeasure.coloring.baseColor;
                        }

                        // Do we have new segment color data?
                        if (newSegmentColors) {
                            // Does existing measure already has segment color data?
                            // If so update it rather than creating a new color map
                            measureData.qMeasure.coloring.gradient = newSegmentColors;
                        } else if (existingMeasureLayout.qMeasure?.coloring?.gradient) {
                            // No new segment color, delete existing one
                            delete measureData.qMeasure.coloring.gradient;
                        }

                        // Update existing measure with new data
                        const res = await existingMeasureModel.setProperties(measureData);
                        logger.info(`Updated existing measure "${measureData.qMetaDef.title}"`);
                    } else {
                        // Create a new master measure in the app
                        const newMeasureModel = await app.createMeasure(measureData);
                        const newMeasureLayout = await newMeasureModel.getLayout();

                        // Add owner
                        measureData.qMetaDef.owner = {
                            userId: options.authUserId,
                            userDirectory: options.authUserDir,
                        };

                        // Do we have a measure color value?
                        if (newMeasureColor) {
                            // Use the measure color in the Excel file
                            measureData.qMeasure.coloring.baseColor = newMeasureColor;
                        }

                        // Do we have new segment color data?
                        if (newSegmentColors) {
                            // Use the measure segment color from the Excel file
                            measureData.qMeasure.coloring.gradient = newSegmentColors;
                        }

                        // Update the created measure with new data
                        const res = await newMeasureModel.setProperties(measureData);
                        logger.info(`Created new measure "${measureData.qMetaDef.title}"`);
                    }

                    importCount += 1;
                    if (importCount === parseInt(options.limitImportCount, 10)) {
                        break;
                    }
                } else {
                    // Don't warn if it's the first line/header in the Excel file
                    // eslint-disable-next-line no-lonely-if
                    if (rowCount !== 0) {
                        logger.warn(
                            `Found an unknown master item type: "${row[colPosMasterItemType]}". Ignoring this line in the imported file.`
                        );
                    }
                }
                rowCount += 1;
            }
        }

        if ((await session.close()) === true) {
            logger.verbose(`Closed session after adding/updating master items in app ${options.appId} on host ${options.host}`);
        } else {
            logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
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
