'use strict';

const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma.js');

/**
 * 
 * @param {*} options 
 * @param {*} command 
 */
const createMasterDimension = async (options, command) => {
  try {
    console.log('Create master dimension');
    console.log('Options: ' + JSON.stringify(options, null, 2));

    // Configure Enigma.js
    const configEnigma = setupEnigmaConnection(options);

    var session = enigma.create(configEnigma);
    var global = await session.open();

    const engineVersion = await global.engineVersion();
    console.log(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

    var app = await global.openDoc(options.appid, '', '', '', false);
    console.log(`Opened app ${options.appid}.`);

    // Get master dimensions
    const dimensionCall = {
      qInfo: {
        qId: 'DimensionObjectExt',
        qType: 'DimensionListExt',
      },
      qDimensionListDef: {
        qType: 'dimension',
        qData: {
          grouping: '/qDim/qGrouping',
          info: '/qDimInfos',
          title: '/qMetaDef/title',
          tags: '/qMetaDef/tags',
          expression: '/qDim',
          description: '/qMetaDef/description',
        },
      },
    };

    // Not used right now
    // const appLayout = await app.getAppLayout();
    // const appProperties = await app.getAppProperties();

    const genericDimObj = await app.createObject(dimensionCall);
    const dimObj = await genericDimObj.getLayout();
    if (dimObj) {
      // var testData1 = {
      //   qInfo: {
      //     // qId: 'UPRBXKf',
      //     qType: 'dimension',
      //   },
      //   qMetaDef: {
      //     title: 'Dimension 2b',
      //     description: 'Description for dimension 2',
      //     // createdDate: '2021-06-06T20:28:24.565Z',
      //     // modifiedDate: '2021-06-06T20:28:24.565Z',
      //     published: false,
      //     // publishTime: '1753-01-01T00:00:00.000Z',
      //     approved: false,
      //     owner: {
      //       id: '40cbdd7c-251d-4cce-9dc1-1bd678aa9fa9',
      //       userId: 'goran',
      //       userDirectory: 'LAB',
      //       userDirectoryConnectorName: 'LAB',
      //       name: 'Göran Sander',
      //       privileges: null,
      //     },
      //     qSize: -1,
      //     sourceObject: '',
      //     draftObject: '',
      //     // privileges: ['read', 'update', 'delete', 'exportdata', 'publish', 'approve'],
      //     tags: [],
      //   },
      //   qDim: {
      //     // info: [
      //     //   {
      //     //     qName: 'Dim2',
      //     //     // qTags: ['$ascii', '$text'],
      //     //     qIsSemantic: false,
      //     //   },
      //     // ],
      //     title: 'Dimension 2b',
      //     // coloring: { changeHash: '0.03484771814318943' },
      //     // grouping: 'N',
      //     tags: [],
      //     // expression: {
      //     qGrouping: 'N',
      //     qFieldDefs: ['Dim2'],
      //     qFieldLabels: ['Dimension 2b'],
      //     qLabelExpression: "'label expression for dimension 2'",
      //     // title: 'Dimension 2b',
      //     // coloring: { changeHash: '0.03484771814318943' },
      //     // },
      //     description: 'Description for dimension 2',
      //   },
      // };

      // testData1 = {
      //   qInfo: {
      //     qId: 'Dimension01',
      //     qType: 'Dimension',
      //   },
      //   qDim: {
      //     title: 'something',
      //     qGrouping: 'N',
      //     qFieldDefs: ['Country'],
      //     qFieldLabels: ['Country label'],
      //   },
      //   qMetaDef: {
      //     title: 'something',
      //   },
      // };

      // var testData1 = {
      //   qInfo: {
      //     qType: 'dimension',
      //   },
      //   qDim: {
      //     qGrouping: 'N',
      //     qFieldDefs: ['AsciiNum'],
      //     title: 'AsciiNum',
      //     coloring: {
      //       changeHash: '0.13870465115802433',
      //     },
      //     qFieldLabels: ['AsciiNum'],
      //   },
      //   qMetaDef: {
      //     title: 'AsciiNum',
      //     description: '',
      //     tags: [],
      //     owner: {
      //       userId: 'goran',
      //       userDirectory: 'LAB',
      //     },
      //   },
      // };

      // var testData1 = {
      //   qInfo: { qId: '0064e480-6e12-4871-be1f-3652f05ca21c', qType: 'dimension' },
      //   qMetaDef: {
      //     title: 'Dimension 2c',
      //     description: 'Description for dimension 2',
      //     owner: {
      //       id: '40cbdd7c-251d-4cce-9dc1-1bd678aa9fa9',
      //       userId: 'goran',
      //       userDirectory: 'LAB',
      //       userDirectoryConnectorName: 'LAB',
      //       name: 'Göran Sander',
      //       privileges: null,
      //     },
      //     qSize: -1,
      //     sourceObject: '',
      //     draftObject: '',
      //     privileges: ['read', 'update', 'delete', 'exportdata', 'publish', 'approve'],
      //     tags: [],
      //   },
      //   qDim: {
      //     info: [{ qName: 'Dim2', qTags: ['$ascii', '$text'], qIsSemantic: false }],
      //     title: 'Dimension 2c',
      //     tags: [],
      //     description: 'Description for dimension 2',
      //     grouping: 'N',
      //     expression: {
      //       qGrouping: 'N',
      //       qFieldDefs: ['Dim2'],
      //       qFieldLabels: ['Dimension 2c'],
      //       qLabelExpression: "'label expression for dimension 2'",
      //       title: 'Dimension 2c',
      //       tags: [],
      //       description: 'Description for dimension 2',
      //     },
      //   },
      // };

      var testData1 = {
        qInfo: {
          qType: 'dimension',
        },
        qDim: {
          title: 'abc123',
          qGrouping: 'N',
          qFieldDefs: [],
          qFieldLabels: [],
        },
        qMetaDef: {
          title: 'abc123',
          tags: [],
          owner: {
            // id: '40cbdd7c-251d-4cce-9dc1-1bd678aa9fa9',
            userId: 'goran',
            userDirectory: 'LAB',
            // userDirectoryConnectorName: 'LAB',
            // name: 'Göran Sander',
            // privileges: null,
          },
        },
      };

      const a = await app.createDimension(testData1);

      const b = await app.saveObjects();

      // const genericDimObj = await app.createObject(dimensionCall);
      // // const a = await dimObj.getInfo();
      // // const b = await dimObj.getListObjectData();
      // const dimObj = await genericDimObj.getLayout();
      // if (dimObj) {
      //   const dimensions = dimObj.qDimensionList.qItems;
      //   // const d = await dimObj.getProperties();

      //   for (const dimension of dimensions) {
      //     if (options.itemid === undefined || options.itemid === dimension.qInfo.qId) {
      //       dimensionTable.push([
      //         dimension.qInfo.qId,
      //         dimension.qInfo.qType,
      //         dimension.qMeta.title,
      //         dimension.qData.description,
      //         dimension.qData.descriptionExpression !== undefined ? dimension.qData.descriptionExpression : '',
      //         dimension.qData.expression.descriptionExpression ? dimension.qData.expression.descriptionExpression.qStringExpression.qExpr : '',
      //         dimension.qData.expression.qFieldDefs.length,
      //         dimension.qData.expression.qFieldDefs.join('\n'),

      //         dimension.qMeta.approved,
      //         dimension.qData.grouping,
      //         dimension.qMeta.published,
      //         dimension.qMeta.publishTime,
      //         dimension.qMeta.createdDate,
      //         dimension.qMeta.modifiedDate,
      //         dimension.qMeta.owner.userDirectory + '\\' + dimension.qMeta.owner.userId,
      //         dimension.qMeta.tags,
      //       ]);
      //     }
      //   }
      // }
    }

    if ((await session.close()) == true) {
      console.log(`Closed session after managing master items in app ${options.appid} on host ${options.host}`);
    } else {
      console.log(`Error closing session for app ${options.appid} on host ${options.host}`);
    }
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  createMasterDimension,
};
