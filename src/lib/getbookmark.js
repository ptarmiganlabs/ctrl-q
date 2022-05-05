'use strict';

const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma.js');
const { table } = require('table');
const { logger, setLoggingLevel } = require('../globals.js');

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

/**
 * 
 * @param {*} options 
 * @param {*} command 
 */
const getBookmark = async (options, command) => {
  try {
    // Set log level
    setLoggingLevel(options.loglevel);

    logger.verbose('Get bookmarks');
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

    // Get bookmarks in app
    const bookmarkCall = {
      qInfo: {
        qId: 'bookmarkList',
        qType: 'BookmarkListExt',
      },
      qBookmarkListDef: {
        qType: 'bookmark',
        qData: {
          bookmark: '/qBookmark',
        },
      },
    };

    const genericBookmarkObj = await app.createSessionObject(bookmarkCall);
    const bookmarkObj = await genericBookmarkObj.getLayout();

    if (bookmarkObj) {
      const bookmarks = bookmarkObj.qBookmarkList.qItems;

      if (options.outputformat === 'json') {
        let bookmarkObj = [];

        for (const bookmark of bookmarks) {
          if (options.itemid === undefined || options.itemid === bookmark.qInfo.qId) {
            bookmarkObj.push(bookmark);
          }
        }

        logger.info(JSON.stringify(bookmarkObj));
      } else if (options.outputformat === 'table') {
        let bookmarkTable = [];
        bookmarkTable.push([
          'Id',
          'Type',
          'Title',
          'Description',
          'Bookmark definition',
          'Approved',
          'Published',
          'Publish time',
          'Created date',
          'Modified date',
          'Owner'
        ]);

        consoleTableConfig.header = {
          alignment: 'center',
          content: `Bookmarks (${bookmarks.length} bookmarks found in the app)`,
        };

        for (const bookmark of bookmarks) {
          if (options.itemid === undefined || options.itemid === bookmark.qInfo.qId) {
            bookmarkTable.push([
              bookmark.qInfo.qId,
              bookmark.qInfo.qType,
              bookmark.qMeta.title,
              bookmark.qMeta.description,
              JSON.stringify(bookmark.qData.qBookmark),
              bookmark.qMeta.approved,
              bookmark.qMeta.published,
              bookmark.qMeta.publishTime,
              bookmark.qMeta.createdDate,
              bookmark.qMeta.modifiedDate,
              bookmark.qMeta.owner.userDirectory + '\\' + bookmark.qMeta.owner.userId,
            ]);
          }
        }

        // Print table to console
        logger.info(`Bookmarks\n${table(bookmarkTable, consoleTableConfig)}`);
      }
    }

    if ((await app.destroySessionObject(genericBookmarkObj.id)) === true) {
      logger.debug(`Destroyed session object after managing bookmarks in app ${options.appid} on host ${options.host}`);

      if ((await session.close()) === true) {
        logger.verbose(`Closed session after managing bookmarks in app ${options.appid} on host ${options.host}`);
      } else {
        logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
      }
    } else {
      logger.error(`Error destroying session object for bookmarks`);
    }
  } catch (err) {
    logger.error(err);
  }
};

module.exports = {
  getBookmark,
};
