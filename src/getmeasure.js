'use strict';

const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma.js');
const { table } = require('table');
const { logger, setLoggingLevel } = require('./globals.js');

var consoleTableConfig = {
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
    3: { width: 40 },
    // 4: { width: 30 },
    // 5: { width: 30 },
    // 6: { width: 30 },
  },
};

const getMasterMeasure = async (options, command) => {
  try {
    // Set log level
    setLoggingLevel(options.loglevel);

    logger.verbose('Get master measure(s)');
    logger.debug('Options: ' + JSON.stringify(options, null, 2));

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

    // Get master measures
    // https://help.qlik.com/en-US/sense-developer/May2021/APIs/EngineAPI/definitions-NxLibraryMeasureDef.html
    const measureCall = {
      qInfo: {
        qId: 'measureObjectExt',
        qType: 'MeasureListExt',
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

    if (measureObj) {
      const measures = measureObj.qMeasureList.qItems;

      if (options.outputformat === 'json') {
        let measureObj = [];

        for (const measure of measures) {
          if (options.itemid === undefined || options.itemid === measure.qInfo.qId) {
            measureObj.push(measure);
          }
        }

        logger.debug(JSON.stringify(measureObj));
      } else if (options.outputformat === 'table') {
        let measureTable = [];
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
          alignment: 'center',
          content: `Measures (${measures.length} measures found in the app)`,
        };

        for (const measure of measures) {
          if (options.itemid === undefined || options.itemid === measure.qInfo.qId) {
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
              measure.qMeta.owner.userDirectory + '\\' + measure.qMeta.owner.userId,
              measure.qMeta.tags,
            ]);
          }
        }

        // Print table to console
        console.log(table(measureTable, consoleTableConfig));
      }
    }

    if ((await app.destroySessionObject(genericMeasureObj.id)) === true) {
      logger.debug(`Destroyed session object after managing master items in app ${options.appid} on host ${options.host}`);

      if ((await session.close()) === true) {
        logger.verbose(`Closed session after managing master items in app ${options.appid} on host ${options.host}`);
      } else {
        logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
      }
    } else {
      logger.error(`Error destroying session object for master measures`);
    }
  } catch (err) {
    logger.error(err);
  }
};

module.exports = {
  getMasterMeasure,
};
