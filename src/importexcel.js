'use strict';

const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma.js');
var xlsx = require('node-xlsx').default;
const { logger, setLoggingLevel } = require('./globals.js');

/**
 * 
 * @param {*} options 
 * @param {*} command 
 */
const importFromExcel = async (options, command) => {
  try {
    // Set log level
    setLoggingLevel(options.loglevel);

    logger.verbose('Import master items from definitions in Excel file');
    logger.debug('Options: ' + JSON.stringify(options, null, 2));

    // Verify paramaters
    // TODO ensure all column indexes are numbers

    // Parse Excel file
    const workSheetsFromFile = xlsx.parse(options.file);

    // Configure Enigma.js
    const configEnigma = setupEnigmaConnection(options);

    var session = enigma.create(configEnigma);
    if (options.loglevel == 'silly') {
      session.on('traffic:sent', (data) => console.log('sent:', data));
      session.on('traffic:received', (data) => console.log('received:', data));
    }
    var global = await session.open();

    const engineVersion = await global.engineVersion();
    logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

    var app = await global.openDoc(options.appid, '', '', '', false);
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
    let sheet = workSheetsFromFile.find((sheet) => sheet.name === options.sheet);
    if (sheet && sheet.data.length > 0) {
      // Loop through all rows
      for (const row of sheet.data) {
        if (row[parseInt(options.columnflag, 10)] === 'dim') {
          // A master dimension should be created based on the current row

          // Data that should be written to new dimension
          let dimData = {
            qInfo: {
              qType: 'dimension',
            },
            qDim: {
              // title: row[parseInt(options.columnname, 10)],
              qGrouping: 'N',
              qFieldDefs: [row[parseInt(options.columnexpr, 10)]],
              // qFieldLabels: [row[parseInt(options.columnexpr, 10)]],
              qFieldLabels: [],
              qLabelExpression:
                row[parseInt(options.columnlabel, 10)].substring(0, 1) == '='
                  ? row[parseInt(options.columnlabel, 10)]
                  : `'${row[parseInt(options.columnlabel, 10)]}'`,
            },
            qMetaDef: {
              title: row[parseInt(options.columnname, 10)],
              description: row[parseInt(options.columndescr, 10)],
              tags: row[parseInt(options.columntag, 10)].split(','),
              owner: {
                userId: options.userid,
                userDirectory: options.userdir,
              },
            },
          };

          // Test if a master dimension with the given title already exists.
          // If it does, update it rather than creating a new one.
          let existingItem = dimObj.qDimensionList.qItems.find((item) => item.qMeta.title === row[parseInt(options.columnname, 10)]);
          if (existingItem) {
            // An existing master dimension has same name as the one being created.

            // Get existing dimension (that should be updated)
            let existingDim = await app.getDimension(existingItem.qInfo.qId);

            dimData = {
              qInfo: {
                qType: 'dimension',
              },
              qDim: {
                qGrouping: 'N',
                qFieldDefs: [row[parseInt(options.columnexpr, 10)]],
                qFieldLabels: [],
                title: row[parseInt(options.columnname, 10)],
                qLabelExpression:
                  row[parseInt(options.columnlabel, 10)].substring(0, 1) == '='
                    ? row[parseInt(options.columnlabel, 10)]
                    : `'${row[parseInt(options.columnlabel, 10)]}'`,
                // coloring: colorBlock,
              },
              qMetaDef: {
                title: row[parseInt(options.columnname, 10)],
                description: row[parseInt(options.columndescr, 10)],
                tags: row[parseInt(options.columntag, 10)].split(','),
                // masterScriptId: t.msId,
                // owner: {
                //   userId: options.userid,
                //   userDirectory: options.userdir,
                // },
              },
            };

            // Update existing dimension with new data
            let res = await existingDim.setProperties(dimData);
            logger.verbose(`Updated existing dimension "${dimData.qMetaDef.title}"`)            
          } else {
            // Create a new master dimension in the app
            const res = await app.createDimension(dimData);
            logger.verbose(`Created new dimension "${dimData.qMetaDef.title}"`)            
          }
        } else if (row[parseInt(options.columnflag, 10)] === 'measure') {
          // A master measure should be created based on the current row

          // Data that should be written to new measure
          let measureData = {
            qInfo: {
              qType: 'measure',
            },
            qMeasure: {
              qLabel: row[parseInt(options.columnname, 10)],
              qGrouping: 'N',
              qDef: row[parseInt(options.columnexpr, 10)],
              qExpressions: [],
              qActiveExpression: 0,
              qLabelExpression:
                row[parseInt(options.columnlabel, 10)].substring(0, 1) == '='
                  ? row[parseInt(options.columnlabel, 10)]
                  : `'${row[parseInt(options.columnlabel, 10)]}'`,
              // coloring:colorBlock
            },
            qMetaDef: {
              title: row[parseInt(options.columnname, 10)],
              description: row[parseInt(options.columndescr, 10)],
              tags: row[parseInt(options.columntag, 10)].split(','),
              // masterScriptId:t.msId
              // owner: {
              //   userId: options.userid,
              //   userDirectory: options.userdir,
              // },
            },
          };

          // Test if a master measure with the given title already exists.
          // If it does, update it rather than creating a new one.
          let existingItem = measureObj.qMeasureList.qItems.find((item) => item.qMeta.title === row[parseInt(options.columnname, 10)]);
          if (existingItem) {
            // An existing master measure has same name as the one being created.

            // Get existing measure (that should be updated)
            let existingMeasure = await app.getMeasure(existingItem.qInfo.qId);

            measureData = {
              qInfo: {
                qType: 'measure',
              },
              qMeasure: {
                qLabel: row[parseInt(options.columnname, 10)],
                qGrouping: 'N',
                qDef: row[parseInt(options.columnexpr, 10)],
                qExpressions: [],
                qActiveExpression: 0,
                qLabelExpression:
                  row[parseInt(options.columnlabel, 10)].substring(0, 1) == '='
                    ? row[parseInt(options.columnlabel, 10)]
                    : `'${row[parseInt(options.columnlabel, 10)]}'`,
                // coloring:colorBlock
              },
              qMetaDef: {
                title: row[parseInt(options.columnname, 10)],
                description: row[parseInt(options.columndescr, 10)],
                tags: row[parseInt(options.columntag, 10)].split(','),
                // masterScriptId:t.msId
                // owner: {
                //   userId: options.userid,
                //   userDirectory: options.userdir,
                // },
              },
            };

            // Update existing measure with new data
            let res = await existingMeasure.setProperties(measureData);
            logger.verbose(`Updated existing measure "${measureData.qMetaDef.title}"`)            
          } else {
            // Create a new master measure in the app

            const res = await app.createMeasure(measureData);
            logger.verbose(`Created new measure "${measureData.qMetaDef.title}"`)            
          }
        }
      }
    }

    if ((await session.close()) === true) {
      logger.verbose(`Closed session after managing master items in app ${options.appid} on host ${options.host}`);
    } else {
      logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
    }
  } catch (err) {
    logger.error(err);
  }
};

module.exports = {
  importFromExcel,
};
