import enigma from 'enigma.js';
import xlsx from 'node-xlsx';
import { v4 as uuidCreate } from 'uuid';

import { logger, setLoggingLevel, isSea, execPath, verifyFileSystemExists, sleep } from '../../../globals.js';
import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { catchLog } from '../../util/log.js';

let importCount = 0;

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
    const _res = await newGenericColorMapRefModel.setProperties(newGenericColorMapRefProp);

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
    const newColorMapLayout = await newColorMapObj.getLayout();
    logger.silly(`newColorMapLayout: ${JSON.stringify(newColorMapLayout, null, 2)}`);

    return colorMapId;
};

// Create master dimension using Enigma.js
const createDimension = async (options, app, dimensionDefRow, colPos, newPerValueColorMap, newDimensionColor, importLimit) => {
    // Create a new master dimension in the app

    const dimensionData = {
        qInfo: {
            qType: 'dimension',
            qId: uuidCreate(),
        },
        qMetaDef: {
            title: dimensionDefRow[colPos.colPosMasterItemName],
            description: dimensionDefRow[colPos.colPosMasterItemDescr],
            tags: dimensionDefRow[colPos.colPosMasterItemTag] ? dimensionDefRow[colPos.colPosMasterItemTag].split(',') : '',
            // owner: {
            //   userId: options.authUserId,
            //   userDirectory: options.authUserDir,
            // },
        },
        qDim: {
            qGrouping: 'N',
            qFieldDefs: [dimensionDefRow[colPos.colPosMasterItemExpr]],
            qFieldLabels: [dimensionDefRow[colPos.colPosMasterItemLabel]],
            title: dimensionDefRow[colPos.colPosMasterItemName],
            qLabelExpression: dimensionDefRow[colPos.colPosMasterItemLabel],
            coloring: {},
        },
    };

    logger.verbose(`Creating new dimension "${dimensionData.qMetaDef.title}"`);
    logger.debug(`Measure data: ${JSON.stringify(dimensionData, null, 2)}`);

    // Debug: Add import count to dimension title
    // dimensionData.qMetaDef.title = `${importCount}: ${dimensionDefRow[colPos.colPosMasterItemName]}`;

    const newDimensionModel = await app.createDimension(dimensionData);
    const newDimensionLayout = await newDimensionModel.getLayout();
    logger.silly(`New dimension layout: ${JSON.stringify(newDimensionLayout, null, 2)}`);

    // Do we have any per-value color data for this row?
    if (newPerValueColorMap) {
        // Create new color map and attach it to the existing dimension
        const newColorMapId = await createColorMap(app, dimensionData.qInfo.qId, newPerValueColorMap);

        // Update master item with new per-value color data
        dimensionData.qDim.coloring.colorMapRef = newColorMapId;
        dimensionData.qDim.coloring.hasValueColors = true;
    }

    // Do we have a dimension color value?
    if (newDimensionColor) {
        // Use the dimension color in the Excel file
        dimensionData.qDim.coloring.baseColor = newDimensionColor.baseColor;
    }

    // Set properties of created dimension
    const res = await newDimensionModel.setProperties(dimensionData);

    importCount += 1;
    logger.info(`(${importCount}/${importLimit}) Created new dimension "${dimensionData.qMetaDef.title}"`);

    // Get layout of created dimension
    const updatedDimensionModel = await app.getDimension(dimensionData.qInfo.qId);
    const updatedDimensionLayout = updatedDimensionModel.getLayout();

    return updatedDimensionLayout;
};

// Function to update an existing master dimension in the app
const updateDimension = async (
    options,
    existingDimension,
    app,
    dimensionDefRow,
    colPos,
    newPerValueColorMap,
    newDimensionColor,
    importLimit
) => {
    const dimensionData = {
        qInfo: {
            qType: 'dimension',
        },
        qMetaDef: {
            title: dimensionDefRow[colPos.colPosMasterItemName],
            description: dimensionDefRow[colPos.colPosMasterItemDescr],
            tags: dimensionDefRow[colPos.colPosMasterItemTag] ? dimensionDefRow[colPos.colPosMasterItemTag].split(',') : '',
        },
        qDim: {
            qGrouping: 'N',
            qFieldDefs: [dimensionDefRow[colPos.colPosMasterItemExpr]],
            qFieldLabels: [dimensionDefRow[colPos.colPosMasterItemLabel]],
            title: dimensionDefRow[colPos.colPosMasterItemName],
            qLabelExpression: dimensionDefRow[colPos.colPosMasterItemLabel],
            coloring: {},
        },
    };

    logger.verbose(`Updating existing dimension "${existingDimension.qMeta.title}"`);
    logger.debug(`Dimension data for existing dimension: ${JSON.stringify(existingDimension, null, 2)}`);

    // Get existing dimension that should be updated
    const existingDimensionModel = await app.getDimension(existingDimension.qInfo.qId);
    const existingDimensionLayout = await existingDimensionModel.getLayout();

    // Update dimension with ID of existing dimension
    dimensionData.qInfo.qId = existingDimension.qInfo.qId;

    // Do we have a new dimension color value?
    if (newDimensionColor) {
        // Use the color provided in the Excel file
        dimensionData.qDim.coloring.baseColor = newDimensionColor.baseColor;
    } else if (existingDimensionLayout.qDim?.coloring?.baseColor) {
        // No new dimension color, delete any existing ones
        delete dimensionData.qDim.coloring.baseColor;

        // Use dimension's existing color, if there is one
        // dimSingleData.qDim.coloring.baseColor = existingDimLayout.qDim.coloring.baseColor;
    }

    // Check if there exists a per-value color map for the existing dimension
    let existingColorMapPromise;
    let existingColorMapModel;
    let existingColorMapLayout;
    try {
        existingColorMapPromise = app.getObject(`ColorMapModel_${existingDimension.qInfo.qId}`);
        [existingColorMapModel] = await Promise.all([existingColorMapPromise]);
        existingColorMapLayout = await existingColorMapModel.getLayout();
    } catch (err) {
        catchLog(`No per-value color map exists for existing dimension "${existingDimensionLayout.qMeta.title}"`, err);
    }

    // Do we have new per-value color data?
    if (newPerValueColorMap) {
        // Does existing dimension already has per-value color data?
        // If so update it rather than creating a new color map
        if (existingColorMapLayout?.id) {
            const res = await existingColorMapModel.setProperties({
                qInfo: existingColorMapModel.qInfo,
                qExtendsId: '',
                qMetaDef: {},
                qStateName: '',
                colorMap: newPerValueColorMap,
            });

            dimensionData.qDim.coloring.colorMapRef = existingDimensionLayout.qInfo.qId;
            dimensionData.qDim.coloring.hasValueColors = true;
        } else {
            // Create new color map and attach it to the existing dimension
            const newColorMapId = await createColorMap(app, existingDimension.qInfo.qId, newPerValueColorMap);

            // Update master item with new per-value color data
            dimensionData.qDim.coloring.colorMapRef = newColorMapId;
            dimensionData.qDim.coloring.hasValueColors = true;
        }
    } else if (existingDimensionLayout.qDim?.coloring?.hasValueColors === true) {
        // No new per-value color data, delete existing one
        delete dimensionData.qDim.coloring.colorMapRef;
        delete dimensionData.qDim.coloring.hasValueColors;
    }

    // Set properties of existing dimension
    const res = await existingDimensionModel.setProperties(dimensionData);

    importCount += 1;
    logger.info(`(${importCount}/${importLimit}) Updated existing dimension "${dimensionData.qMetaDef.title}"`);

    // Get layout of updated dimension
    const updatedDimensionModel = await app.getDimension(existingDimension.qInfo.qId);
    const updatedDimensionLayout = updatedDimensionModel.getLayout();

    return updatedDimensionLayout;
};

// Function to create new master drill-down dimension
const createDrillDownDimension = async (options, app, dimensionDefRow, colPos, newDimensionColor, importLimit) => {
    // Create a new master drill-down dimension in the app
    const dimensionData = {
        qInfo: {
            qType: 'dimension',
            qId: uuidCreate(),
        },
        qMetaDef: {
            title: dimensionDefRow[colPos.colPosMasterItemName],
            description: dimensionDefRow[colPos.colPosMasterItemDescr],
            tags: dimensionDefRow[colPos.colPosMasterItemTag] ? dimensionDefRow[colPos.colPosMasterItemTag].split(',') : '',
            // owner: {
            //   userId: options.authUserId,
            //   userDirectory: options.authUserDir,
            // },
        },
        qDim: {
            qGrouping: 'H',
            qFieldDefs: dimensionDefRow[colPos.colPosMasterItemExpr] ? dimensionDefRow[colPos.colPosMasterItemExpr].split(',') : '',
            title: dimensionDefRow[colPos.colPosMasterItemName],
            coloring: {},
            qFieldLabels: [],
        },
    };

    logger.verbose(`Creating new drill-down dimension "${dimensionData.qMetaDef.title}"`);
    logger.debug(`Measure data: ${JSON.stringify(dimensionData, null, 2)}`);

    // Debug: Add import count to dimension title
    // dimensionData.qMetaDef.title = `${importCount}: ${dimensionDefRow[colPos.colPosMasterItemName]}`;

    const newDimensionModel = await app.createDimension(dimensionData);
    const newDimensionLayout = await newDimensionModel.getLayout();
    logger.silly(`New dimension layout: ${JSON.stringify(newDimensionLayout, null, 2)}`);

    // Do we have a dimension color value?
    if (newDimensionColor) {
        // Use the dimension color in the Excel file
        dimensionData.qDim.coloring.baseColor = newDimensionColor.baseColor;
        dimensionData.qDim.coloring.hasValueColors = false;
    }

    // Set properties of created drill-down dimension
    const res = await newDimensionModel.setProperties(dimensionData);

    importCount += 1;
    logger.info(`(${importCount}/${importLimit}) Created new drill-down dimension "${dimensionData.qMetaDef.title}"`);

    // Get layout of created dimension
    const updatedDimensionModel = await app.getDimension(dimensionData.qInfo.qId);
    const updatedDimensionLayout = updatedDimensionModel.getLayout();

    return updatedDimensionLayout;
};

// Function to update an existing master drill-down dimension in the app
const updateDrillDownDimension = async (options, existingDimension, app, dimensionDefRow, colPos, newDimensionColor, importLimit) => {
    const dimensionData = {
        qInfo: {
            qType: 'dimension',
        },
        qMetaDef: {
            title: dimensionDefRow[colPos.colPosMasterItemName],
            description: dimensionDefRow[colPos.colPosMasterItemDescr],
            tags: dimensionDefRow[colPos.colPosMasterItemTag] ? dimensionDefRow[colPos.colPosMasterItemTag].split(',') : '',
        },
        qDim: {
            qGrouping: 'H',
            qFieldDefs: dimensionDefRow[colPos.colPosMasterItemExpr] ? dimensionDefRow[colPos.colPosMasterItemExpr].split(',') : '',
            title: dimensionDefRow[colPos.colPosMasterItemName],
            coloring: {},
            qFieldLabels: [],
        },
    };

    logger.verbose(`Updating existing drill-down dimension "${existingDimension.qMeta.title}"`);
    logger.debug(`Dimension data for existing drill-down dimension: ${JSON.stringify(existingDimension, null, 2)}`);

    // Get existing drill-down dimension that should be updated
    const existingDimensionModel = await app.getDimension(existingDimension.qInfo.qId);
    const existingDimensionLayout = await existingDimensionModel.getLayout();

    // Update dimension with ID of existing dimension
    dimensionData.qInfo.qId = existingDimension.qInfo.qId;

    // Do we have a new dimension color value?
    if (newDimensionColor) {
        // Use the color provided in the Excel file
        dimensionData.qDim.coloring.baseColor = newDimensionColor.baseColor;
        dimensionData.qDim.coloring.hasValueColors = true;
    } else if (existingDimensionLayout.qDim?.coloring?.baseColor) {
        // No new dimension color, delete any existing ones
        delete dimensionData.qDim.coloring.baseColor;

        // Use dimension's existing color, if there is one
        // dimSingleData.qDim.coloring.baseColor = existingDimLayout.qDim.coloring.baseColor;
    }

    // Set properties of existing drill-down dimension
    const res = await existingDimensionModel.setProperties(dimensionData);

    importCount += 1;
    logger.info(`(${importCount}/${importLimit}) Updated existing drill-down dimension "${dimensionData.qMetaDef.title}"`);

    // Get layout of updated dimension
    const updatedDimensionModel = await app.getDimension(existingDimension.qInfo.qId);
    const updatedDimensionLayout = updatedDimensionModel.getLayout();

    return updatedDimensionLayout;
};

// Create a master measure using Enigma.js
// Format used when Qlik's web client creates a new measure:'
// {
//     "qInfo": {
//         "qType": "measure",
//         "qId": "sCNnDvj"
//     },
//     "qMetaDef": {
//         "title": "DefName",
//         "description": "DefDescr",
//         "tags": [
//             "Tag1",
//             "Tag2"
//         ]
//     },
//     "qMeasure": {
//         "qLabel": "DefName",
//         "qDef": "'DefExpr'",
//         "qLabelExpression": "'DefLabelExpr'",
//         "isCustomFormatted": false,
//         "qNumFormat": {
//             "qType": "D",
//             "qnDec": 2,
//             "qDec": "",
//             "qThou": "",
//             "qFmt": "YYYY-MM-DD"
//         },
//         "coloring": {
//             "baseColor": {
//                 "color": "#8a85c6",
//                 "index": 8
//             },
//             "gradient": {
//                 "colors": [
//                     {
//                         "color": "#006580",
//                         "index": 6
//                     },
//                     {
//                         "color": "#C4CFDA",
//                         "index": -1
//                     },
//                     {
//                         "color": "#4477aa",
//                         "index": -1
//                     },
//                     {
//                         "color": "#7db8da",
//                         "index": -1
//                     }
//                 ],
//                 "breakTypes": [
//                     false,
//                     false,
//                     true
//                 ],
//                 "limits": [
//                     0.25,
//                     0.433,
//                     0.683
//                 ],
//                 "limitType": "percent"
//             }
//         }
//     }
// }

// Create a new master measure in the app
const createMeasure = async (options, app, measureDefRow, colPos, newSegmentColors, newMeasureColor, importLimit) => {
    const measureData = {
        qInfo: {
            qType: 'measure',
            qId: uuidCreate(),
        },
        qMetaDef: {
            title: measureDefRow[colPos.colPosMasterItemName],
            description: measureDefRow[colPos.colPosMasterItemDescr],
            tags: measureDefRow[colPos.colPosMasterItemTag] ? measureDefRow[colPos.colPosMasterItemTag].split(',') : '',
            // owner: {
            //   userId: options.authUserId,
            //   userDirectory: options.authUserDir,
            // },
        },
        qMeasure: {
            qLabel: measureDefRow[colPos.colPosMasterItemLabel],
            // qGrouping: 'N',
            qDef: measureDefRow[colPos.colPosMasterItemExpr],
            qLabelExpression: measureDefRow[colPos.colPosMasterItemLabel],
            // qExpressions: [],
            // qActiveExpression: 0,
            // row[parseInt(options.columnlabel, 10)].substring(0, 1) === '='
            //     ? row[parseInt(options.columnlabel, 10)]
            //     : `'${row[parseInt(options.columnlabel, 10)]}'`,
            coloring: {},
        },
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

    // Add owner
    // measureData.qMetaDef.owner = {
    //     userId: options.authUserId,
    //     userDirectory: options.authUserDir,
    // };

    logger.verbose(`Creating new measure "${measureData.qMetaDef.title}"`);
    logger.debug(`Measure data: ${JSON.stringify(measureData, null, 2)}`);

    // Debug: Add import count to measure title
    // measureData.qMetaDef.title = `${importCount}: ${measureDefRow[colPos.colPosMasterItemName]}`;

    const newMeasureModel = await app.createMeasure(measureData);

    importCount += 1;
    logger.info(`(${importCount}/${importLimit}) Created new measure "${measureData.qMetaDef.title}"`);

    const newMeasureLayout = newMeasureModel.getLayout();

    return newMeasureLayout;
};

// Update an existing master measure in the app
const updateMeasure = async (options, existingMeasure, app, measureDefRow, colPos, newSegmentColors, newMeasureColor, importLimit) => {
    const measureData = {
        qInfo: {
            qType: 'measure',
        },
        qMetaDef: {
            title: measureDefRow[colPos.colPosMasterItemName],
            description: measureDefRow[colPos.colPosMasterItemDescr],
            tags: measureDefRow[colPos.colPosMasterItemTag] ? measureDefRow[colPos.colPosMasterItemTag].split(',') : '',
        },
        qMeasure: {
            qLabel: measureDefRow[colPos.colPosMasterItemLabel],
            qDef: measureDefRow[colPos.colPosMasterItemExpr],
            qLabelExpression: measureDefRow[colPos.colPosMasterItemLabel],
            coloring: {},
        },
    };

    logger.verbose(`Updating existing measure "${existingMeasure.qMeta.title}"`);
    logger.debug(`Measure data for existing measure: ${JSON.stringify(existingMeasure, null, 2)}`);

    // Get existing measure that should be updated
    const existingMeasureModel = await app.getMeasure(existingMeasure.qInfo.qId);
    const existingMeasureLayout = await existingMeasureModel.getLayout();

    // Update measure with ID of existing measure
    measureData.qInfo.qId = existingMeasure.qInfo.qId;

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

    logger.debug(`Measure data: ${JSON.stringify(measureData, null, 2)}`);

    // Update existing measure with new data
    const res = await existingMeasureModel.setProperties(measureData);

    importCount += 1;
    logger.info(`(${importCount}/${importLimit}) Updated existing measure "${measureData.qMetaDef.title}"`);

    const updatedMeasureModel = await app.getMeasure(existingMeasure.qInfo.qId);
    const updatedMeasureLayout = updatedMeasureModel.getLayout();

    return updatedMeasureLayout;
};

// Validate that fields common to all master items are valid
const validateMasterItemFields = (masterItemDefRow, colPos) => {
    // Limitations are listed here: https://help.qlik.com/en-US/sense/May2023/Subsystems/Hub/Content/Sense_Hub/Introduction/guidelines-visualizations-fields-naming.htm

    // Validate master item name
    if (masterItemDefRow[colPos.colPosMasterItemName] === undefined) {
        logger.error(`Master item name is undefined`);
        process.exit(1);
    }

    // Make sure master item names do not include these characters: = [ ] {} $ ´ ` '. If they do, replace them with _
    // https://help.qlik.com/en-US/sense/May2023/Subsystems/Hub/Content/Sense_Hub/Introduction/guidelines-visualizations-fields-naming.htm
    // if (masterItemDefRow[colPos.colPosMasterItemName].match(/[\=\[\]\{\}\(\)\$\´\`\'\"]/g)) {
    if (masterItemDefRow[colPos.colPosMasterItemName].match(/[=[\]{}$´`'"]/g)) {
        logger.warn(
            `Master item name "${masterItemDefRow[colPos.colPosMasterItemName]}" contains characters that are not allowed. Replacing with _`
        );
        // eslint-disable-next-line no-param-reassign
        masterItemDefRow[colPos.colPosMasterItemName] = masterItemDefRow[colPos.colPosMasterItemName].replace(
            // /[\=\[\]\{\}\(\)\$\´\`\'\"]/g,
            /[=[\]{}$´`'"]/g,
            '_'
        );
    }

    // Ensure master item name and description are not too long
    if (masterItemDefRow[colPos.colPosMasterItemName]?.length > 255) {
        logger.warn(
            `Measure name "${masterItemDefRow[colPos.colPosMasterItemName]}" is too long (max 255 characters). Truncating to 255 characters`
        );
        // eslint-disable-next-line no-param-reassign
        masterItemDefRow[colPos.colPosMasterItemName] = masterItemDefRow[colPos.colPosMasterItemName].substring(0, 255);
    }
    if (masterItemDefRow[colPos.colPosMasterItemDescr]?.length > 512) {
        logger.warn(
            `Measure description "${
                masterItemDefRow[colPos.colPosMasterItemDescr]
            }" is too long (max 512 characters). Truncating to 512 characters`
        );
        // eslint-disable-next-line no-param-reassign
        masterItemDefRow[colPos.colPosMasterItemDescr] = masterItemDefRow[colPos.colPosMasterItemDescr].substring(0, 512);
    }

    // Make sure there are no more than 30 tags and that each tag is no longer than 31 characters
    if (masterItemDefRow[colPos.colPosMasterItemTag]?.length > 0) {
        const tags = masterItemDefRow[colPos.colPosMasterItemTag].split(',');
        if (tags.length > 30) {
            logger.warn(
                `Measure tags "${
                    masterItemDefRow[colPos.colPosMasterItemTag]
                }" contains more than 30 tags. Only the first 30 tags will be used`
            );
            // eslint-disable-next-line no-param-reassign
            masterItemDefRow[colPos.colPosMasterItemTag] = tags.slice(0, 30).join(',');
        }
        tags.forEach((tag) => {
            if (tag.length > 31) {
                logger.warn(`Measure tag "${tag}" is too long (max 31 characters). Truncating to 31 characters`);
                // eslint-disable-next-line no-param-reassign
                tag = tag.substring(0, 31);
            }
        });
    }

    return masterItemDefRow;
};

// Validate that fields common to all master dimensions are valid
const validateMasterDimensionFields = (masterItemDefRow, colPos) => {
    // Limitations are listed here: https://help.qlik.com/en-US/sense/May2023/Subsystems/Hub/Content/Sense_Hub/Introduction/guidelines-visualizations-fields-naming.htm

    // Validate master dimension expression
    if (masterItemDefRow[colPos.colPosMasterItemExpr]?.length > 64000) {
        logger.error(
            `Dimension expression "${masterItemDefRow[colPos.colPosMasterItemExpr]}" is too long (max 64000 characters). Aborting import.`
        );
        process.exit(1);
    }

    if (masterItemDefRow[colPos.colPosMasterItemLabel]?.length > 255) {
        logger.warn(
            `Dimension label "${
                masterItemDefRow[colPos.colPosMasterItemLabel]
            }" is too long (max 255 characters). Truncating to 255 characters`
        );
        // eslint-disable-next-line no-param-reassign
        masterItemDefRow[colPos.colPosMasterItemLabel] = masterItemDefRow[colPos.colPosMasterItemLabel].substring(0, 255);
    }

    return masterItemDefRow;
};

// Validate that fields common to all master measures are valid
const validateMasterMeasureFields = (masterItemDefRow, colPos) => {
    // Limitations are listed here: https://help.qlik.com/en-US/sense/May2023/Subsystems/Hub/Content/Sense_Hub/Introduction/guidelines-visualizations-fields-naming.htm

    // Validate master measure expression
    if (masterItemDefRow[colPos.colPosMasterItemExpr]?.length > 64000) {
        logger.warn(
            `Measure expression "${masterItemDefRow[colPos.colPosMasterItemExpr]}" is too long (max 64000 characters). Aborting import.`
        );
        process.exit(1);
    }

    if (masterItemDefRow[colPos.colPosMasterItemLabel]?.length > 255) {
        logger.warn(
            `Measure label "${
                masterItemDefRow[colPos.colPosMasterItemLabel]
            }" is too long (max 255 characters). Truncating to 255 characters`
        );
        // eslint-disable-next-line no-param-reassign
        masterItemDefRow[colPos.colPosMasterItemLabel] = masterItemDefRow[colPos.colPosMasterItemLabel].substring(0, 255);
    }

    return masterItemDefRow;
};

// Take 10 items at a time from defintions array and creates master items for them.
// Repeat until all definitions have been processed.
const createMasterItems = async (masterItemDefs, options, colPos, existingMeasures, existingDimensions, session) => {
    const masterItemDefinitions = masterItemDefs.slice();

    // Remove header row
    const headerRow = masterItemDefinitions.splice(0, 1)[0];
    logger.silly(`Header row: ${JSON.stringify(headerRow)}`);

    // Remove any empty rows
    masterItemDefinitions.forEach((row, index) => {
        if (row[colPos.colPosMasterItemName] === undefined) {
            logger.debug(`Removing empty row ${index}`);
            masterItemDefinitions.splice(index, 1);
        }
    });

    // Remove all except first --limit-import-count first rows
    let importLimit = 0;
    if (options.limitImportCount > 0) {
        masterItemDefinitions.splice(options.limitImportCount);
        importLimit = masterItemDefinitions.length;
    } else {
        importLimit = masterItemDefinitions.length;
    }

    while (masterItemDefinitions.length > 0) {
        const masterItemBatch = masterItemDefinitions.splice(0, 10);

        // Create new session to Sense engine
        //         let configEnigma;
        //         let session;
        //         try {
        // console.log('A1');
        //             configEnigma = await setupEnigmaConnection(options, sessionId);
        // console.log('A2');
        //             session = await enigma.create(configEnigma);
        // console.log('A3');
        //         } catch (err) {
        //             logger.error(`Error creating session to server ${options.host}: ${err}`);
        //             process.exit(1);
        //         }

        //         // Set up logging of websocket traffic
        //         addTrafficLogging(session, options);

        let global;
        try {
            global = await session.open();
        } catch (err) {
            catchLog(`Error opening session to server ${options.host}`, err);
            process.exit(1);
        }

        const engineVersion = await global.engineVersion();
        logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

        // Open app
        const app = await global.openDoc(options.appId, '', '', '', false);
        logger.verbose(`Opened app ${options.appId}.`);

        // Call for each item in measureDefinition array
        // eslint-disable-next-line no-restricted-syntax
        for (const entry of masterItemBatch) {
            let masterItemDefRow = entry;

            logger.debug(`Current row master item type: ${masterItemDefRow[colPos.colPosMasterItemType]}`);

            // Call function to determine if shared master item fields are valid
            // eslint-disable-next-line no-param-reassign
            masterItemDefRow = validateMasterItemFields(masterItemDefRow, colPos);

            if (masterItemDefRow[colPos.colPosMasterItemType] === 'dim-single') {
                // A master dimension should be created based on the current row

                // eslint-disable-next-line no-param-reassign
                masterItemDefRow = validateMasterDimensionFields(masterItemDefRow, colPos);

                // Is there any per-value color data for this row?
                let newPerValueColorMap = null;
                if (masterItemDefRow[colPos.colPosMasterItemPerValueColor]?.length > 0) {
                    const cleanColorString = masterItemDefRow[colPos.colPosMasterItemPerValueColor].replace('\r', '').replace('\n', '');
                    newPerValueColorMap = JSON.parse(`${cleanColorString}`);
                    logger.debug(`Color map loaded from Excel file: ${JSON.stringify(newPerValueColorMap)}`);
                }

                // Is there any dimension color data for this row?
                let newDimColor = null;
                if (masterItemDefRow[colPos.colPosMasterItemColor]?.length > 0) {
                    const cleanColorString = masterItemDefRow[colPos.colPosMasterItemColor].replace('\r', '').replace('\n', '');
                    newDimColor = JSON.parse(`${cleanColorString}`);
                    logger.debug(`Dimension color loaded from Excel file: ${JSON.stringify(newDimColor)}`);
                }

                // Test if a master dimension with the given title already exists.
                // If it does, update it rather than creating a new one.
                const existingItem = existingDimensions.find((item) => item.qMeta.title === masterItemDefRow[colPos.colPosMasterItemName]);
                if (existingItem) {
                    // An existing master dimension has same name as the one being created.

                    // Is it a dry run?
                    if (options.dryRun) {
                        importCount += 1;
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have updated existing dimension "${
                                masterItemDefRow[colPos.colPosMasterItemName]
                            }"`
                        );
                    } else {
                        await updateDimension(
                            options,
                            existingItem,
                            app,
                            masterItemDefRow,
                            colPos,
                            newPerValueColorMap,
                            newDimColor,
                            importLimit
                        );
                    }
                } else {
                    // A new master dimension should be created based on the current row

                    // Is it a dry run?
                    // eslint-disable-next-line no-lonely-if
                    if (options.dryRun) {
                        importCount += 1;
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have created new dimension "${
                                masterItemDefRow[colPos.colPosMasterItemName]
                            }"`
                        );
                    } else {
                        await createDimension(options, app, masterItemDefRow, colPos, newPerValueColorMap, newDimColor, importLimit);
                    }
                }
            } else if (masterItemDefRow[colPos.colPosMasterItemType] === 'dim-drilldown') {
                // A master drill-down dimension should be created based on the current row

                // eslint-disable-next-line no-param-reassign
                masterItemDefRow = validateMasterDimensionFields(masterItemDefRow, colPos);

                // Is there any dimension color data for this row?
                let newDimColor = null;
                if (masterItemDefRow[colPos.colPosMasterItemColor]?.length > 0) {
                    const cleanColorString = masterItemDefRow[colPos.colPosMasterItemColor].replace('\r', '').replace('\n', '');
                    newDimColor = JSON.parse(`${cleanColorString}`);
                    logger.debug(`Dimension color loaded from Excel file: ${JSON.stringify(newDimColor)}`);
                }

                // Test if a master drill-down dimension with the given title already exists.
                // If it does, update it rather than creating a new one.
                const existingItem = existingDimensions.find((item) => item.qMeta.title === masterItemDefRow[colPos.colPosMasterItemName]);
                if (existingItem) {
                    // An existing master drill-down dimension has same name as the one being created.

                    // Is it a dry run?
                    if (options.dryRun) {
                        importCount += 1;
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have updated existing drill-down dimension "${
                                masterItemDefRow[colPos.colPosMasterItemName]
                            }"`
                        );
                    } else {
                        await updateDrillDownDimension(options, existingItem, app, masterItemDefRow, colPos, newDimColor, importLimit);
                    }
                } else {
                    // A new master drill-down dimension should be created based on the current row

                    // Is it a dry run?
                    // eslint-disable-next-line no-lonely-if
                    if (options.dryRun) {
                        importCount += 1;
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have created new drill-down dimension "${
                                masterItemDefRow[colPos.colPosMasterItemName]
                            }"`
                        );
                    } else {
                        await createDrillDownDimension(options, app, masterItemDefRow, colPos, newDimColor, importLimit);
                    }
                }
            } else if (masterItemDefRow[colPos.colPosMasterItemType] === 'measure') {
                // A master measure should be created or updated based on the current row

                // Call function to determine if shared master measure fields are valid
                // eslint-disable-next-line no-param-reassign
                masterItemDefRow = validateMasterMeasureFields(masterItemDefRow, colPos);

                // Is there any segment color data for this row?
                let newSegmentColors = null;
                if (masterItemDefRow[colPos.colPosMasterItemPerValueColor]?.length > 0) {
                    const cleanColorString = masterItemDefRow[colPos.colPosMasterItemPerValueColor].replace('\r', '').replace('\n', '');
                    newSegmentColors = JSON.parse(`${cleanColorString}`);
                    logger.debug(`Color map loaded from Excel file: ${JSON.stringify(newSegmentColors)}`);
                }

                // Is there any measure color data for this row?
                let newMeasureColor = null;
                if (masterItemDefRow[colPos.colPosMasterItemColor]?.length > 0) {
                    const cleanColorString = masterItemDefRow[colPos.colPosMasterItemColor].replace('\r', '').replace('\n', '');
                    newMeasureColor = JSON.parse(`${cleanColorString}`);
                    logger.debug(`Dimension color loaded from Excel file: ${JSON.stringify(newMeasureColor)}`);
                }

                // Test if a master measure with the given title already exists.
                // If it does, update it rather than creating a new one.
                const existingItem = existingMeasures.find((item) => item.qMeta.title === masterItemDefRow[colPos.colPosMasterItemName]);
                if (existingItem) {
                    // An existing master measure has same name as the one being created.

                    // Is it a dry run?
                    if (options.dryRun) {
                        importCount += 1;
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have updated existing measure "${
                                masterItemDefRow[colPos.colPosMasterItemName]
                            }"`
                        );
                    } else {
                        await updateMeasure(
                            options,
                            existingItem,
                            app,
                            masterItemDefRow,
                            colPos,
                            newSegmentColors,
                            newMeasureColor,
                            importLimit
                        );
                    }
                } else {
                    // A new master measure should be created based on the current row

                    // Is it a dry run?
                    // eslint-disable-next-line no-lonely-if
                    if (options.dryRun) {
                        importCount += 1;
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have created new measure "${
                                masterItemDefRow[colPos.colPosMasterItemName]
                            }"`
                        );
                    } else {
                        await createMeasure(options, app, masterItemDefRow, colPos, newSegmentColors, newMeasureColor, importLimit);
                    }
                }
            } else {
                // Unknown master item type
                importCount += 1;
                logger.warn(
                    `(${importCount}/${importLimit}) Found an unknown master item type: "${
                        masterItemDefRow[colPos.colPosMasterItemType]
                    }". Ignoring this line in the imported file.`
                );
            }

            // Optional pause before creating next master item. Use async sleep function.
            if (options.sleepBetweenImports > 0) {
                logger.debug(`Sleeping for ${options.sleepBetweenImports} ms`);
                await sleep(options.sleepBetweenImports);
            }
        }

        // console.log('session.close 1');
        // if ((await session.close()) === true) {
        //     logger.verbose(`Closed session after adding/updating 10 master items in app ${options.appId} on host ${options.host}`);

        //     // Wait 2 sec before creating a new session
        //     // This will help avoiding the 5 concurrent session limit
        //     logger.debug(`Sleeping for 2 s`);
        //     await sleep(2000);
        // } else {
        //     logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
        // }
    }
};

/**
 *
 * @param {*} options
 */
const importMasterItemFromExcel = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Import master items from definitions in Excel file "${options.file}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Verify Master items Excel file exists
        const excelFileExists = await verifyFileSystemExists(options.file);
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

        // console.log('B6');
        const app = await global.openDoc(options.appId, '', '', '', false);
        logger.verbose(`Opened app ${options.appId}.`);
        // console.log('B7');
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
                    // measure: '/qMeasure',
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

        // Close session
        // console.log('session.close 2');
        // if ((await session.close()) === true) {
        //     logger.verbose(
        //         `Closed session after reading list of existing master measure & dimensions in app ${options.appId} on host ${options.host}`
        //     );

        //     // Wait 2 sec before continuing
        //     // This will help avoiding the 5 concurrent session limit
        //     logger.debug(`Sleeping for 2 s`);
        //     await sleep(2000);
        // } else {
        //     logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
        // }

        // Loop through rows in Excel file, extracting data for rows flagged as master items
        // let importCount = 0;
        if (sheet && sheet.data.length > 0) {
            const res = await createMasterItems(
                sheet.data,
                options,
                {
                    colPosMasterItemType,
                    colPosMasterItemName,
                    colPosMasterItemDescr,
                    colPosMasterItemLabel,
                    colPosMasterItemExpr,
                    colPosMasterItemTag,
                    colPosMasterItemColor,
                    colPosMasterItemPerValueColor,
                },
                measuresLayout.qMeasureList.qItems,
                dimsLayout.qDimensionList.qItems,
                session
            );
        }

        logger.info(`Imported ${importCount} master items from Excel file ${options.file}`);

        // const resSave = await app.doSave();
        // console.log('session.close 1');
        if ((await session.close()) === true) {
            logger.verbose(`Closed session after adding/updating master items in app ${options.appId} on host ${options.host}`);
        } else {
            logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
        }
    } catch (err) {
        catchLog('Error importing master items from Excel file', err);
    }
};

const importMasterItemFromFile = async (options) => {
    if (options.fileType === 'excel') {
        // Source file type is Excel
        await importMasterItemFromExcel(options);
    }
};

export default importMasterItemFromFile;
