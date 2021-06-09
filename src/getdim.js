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
    4: { width: 40 },
    5: { width: 40 },
    6: { width: 40 },
    9: { width: 40 },
  },
};

const getMasterDimension = async (options, command) => {
  try {
    // Set log level
    setLoggingLevel(options.loglevel);

    logger.verbose('Get master dimension(s)');
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

    if (dimObj) {
      const dimensions = dimObj.qDimensionList.qItems;

      if (options.outputformat === 'json') {
        let dimensionObj = [];

        for (const dimension of dimensions) {
          if (options.itemid === undefined || options.itemid === dimension.qInfo.qId) {
            dimensionObj.push(dimension);
          }
        }

        logger.debug(JSON.stringify(dimensionObj));
      } else if (options.outputformat === 'table') {
        let dimensionTable = [];
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
          alignment: 'center',
          content: `Dimensions (${dimensions.length} dimensions found in the app)`,
        };

        for (const dimension of dimensions) {
          if (options.itemid === undefined || options.itemid === dimension.qInfo.qId) {
            dimensionTable.push([
              dimension.qInfo.qId,
              dimension.qInfo.qType,
              dimension.qMeta.title,
              dimension.qMeta.description,
              dimension.qData.descriptionExpression !== undefined ? dimension.qData.descriptionExpression : '',
              dimension.qData.dim.descriptionExpression ? dimension.qData.dim.descriptionExpression.qStringExpression.qExpr : '',
              dimension.qData.dim.qLabelExpression != undefined ? dimension.qData.dim.qLabelExpression : '',
              dimension.qData.dim.qFieldDefs.length,
              dimension.qData.dim.qFieldDefs.join('\n'),
              JSON.stringify(dimension.qData.dim.coloring),
              dimension.qData.dim.qGrouping,
              dimension.qMeta.approved,
              dimension.qMeta.published,
              dimension.qMeta.publishTime,
              dimension.qMeta.createdDate,
              dimension.qMeta.modifiedDate,
              dimension.qMeta.owner.userDirectory + '\\' + dimension.qMeta.owner.userId,
              dimension.qMeta.tags !== undefined ? dimension.qMeta.tags : '',
            ]);
          }
        }

        // Print table to console
        console.log(table(dimensionTable, consoleTableConfig));
      }
    }

    if ((await app.destroySessionObject(genericDimObj.id)) === true) {
      logger.debug(`Destroyed session object after managing master items in app ${options.appid} on host ${options.host}`);

      if ((await session.close()) === true) {
        logger.verbose(`Closed session after managing master items in app ${options.appid} on host ${options.host}`);
      } else {
        logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
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
