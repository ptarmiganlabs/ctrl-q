const enigma = require('enigma.js');
const { table } = require('table');

const { setupEnigmaConnection } = require('./enigma');
const { logger, setLoggingLevel, isPkg, execPath } = require('../globals');

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
        4: { width: 100 },
        // 5: { width: 30 },
        // 6: { width: 30 },
    },
};

/**
 *
 * @param {*} options
 */
const getBookmark = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get bookmarks');
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

        // Get list of all IDs that should be retrieved
        let getBookmarks = [];

        if (options.bookmark === undefined) {
            // Get all master item measures
            getBookmarks = getBookmarks.concat(bookmarkObj.qBookmarkList.qItems);
        } else {
            // Loop over all master items (identified by name or ID) we should get data for
            // eslint-disable-next-line no-restricted-syntax
            for (const bookmarkItem of options.bookmark) {
                // Can we find this master item in the list retrieved from the app?
                if (options.idType === 'name') {
                    const items = bookmarkObj.qBookmarkList.qItems.filter((item) => item.qMeta.title === bookmarkItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        getBookmarks = getBookmarks.concat(items);
                    } else {
                        logger.warn(`Bookmark "${bookmarkItem}" not found`);
                    }
                } else if (options.idType === 'id') {
                    const items = bookmarkObj.qBookmarkList.qItems.filter((item) => item.qInfo.qId === bookmarkItem);
                    if (items.length > 0) {
                        // We've found the measure that's to be retrieved.
                        getBookmarks = getBookmarks.concat(items);
                    } else {
                        logger.warn(`Bookmark "${bookmarkItem}" not found`);
                    }
                } else {
                    throw Error('Invalid --id-type value');
                }
            }
        }

        logger.verbose(`Bookmarks to be retrieved: ${JSON.stringify(getBookmarks)}`);

        if (getBookmarks.length === 0) {
            logger.warn(`No matching bookmarks found`);
        } else if (options.outputFormat === 'json') {
            logger.debug(`Output to JSON`);

            logger.info(`\n${JSON.stringify(getBookmarks, null, 2)}`);
        } else if (options.outputFormat === 'table') {
            logger.debug(`Output to table`);

            const bookmarkTable = [];
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
                'Owner',
            ]);

            consoleTableConfig.header = {
                alignment: 'left',
                content: `Bookmarks (${getBookmarks.length} bookmark(s) found in the app)`,
            };

            // eslint-disable-next-line no-restricted-syntax
            for (const bookmark of getBookmarks) {
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
                    `${bookmark.qMeta.owner.authUserDirectory}\\${bookmark.qMeta.owner.authUserId}`,
                ]);
            }

            // Print table to console
            logger.info(`Bookmarks\n${table(bookmarkTable, consoleTableConfig)}`);
        } else {
            logger.error('Undefined --output-format option');
        }

        if ((await app.destroySessionObject(genericBookmarkObj.id)) === true) {
            logger.debug(`Destroyed session object after managing bookmarks in app ${options.appId} on host ${options.host}`);

            if ((await session.close()) === true) {
                logger.verbose(`Closed session after managing bookmarks in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        } else {
            logger.error(`Error destroying session object for bookmarks`);
        }
    } catch (err) {
        logger.error(err.stack);
    }
};

module.exports = {
    getBookmark,
};
