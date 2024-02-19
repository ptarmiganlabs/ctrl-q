import enigma from 'enigma.js';
import { table } from 'table';
import { setupEnigmaConnection, addTrafficLogging } from '../util/enigma.js';
import { logger, setLoggingLevel, isPkg, execPath } from '../../globals.js';

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
    let session;

    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get bookmarks');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Session ID to use when connecting to the Qlik Sense server
        const sessionId = 'ctrlq';

        // Create new session to Sense engine
        let configEnigma;
        try {
            configEnigma = await setupEnigmaConnection(options, sessionId);
            session = await enigma.create(configEnigma);
            logger.verbose(`Created session to server ${options.host}.`);
        } catch (err) {
            // Show more brief info if running as a stand-alone binary.
            if (isPkg) {
                if (err.message) {
                    logger.error(`Error creating session to server ${options.host}: ${err.message}`);
                } else {
                    logger.error(`Error creating session to server ${options.host}: ${err}`);
                }
            } else if (err.stack) {
                logger.error(`Error creating session to server ${options.host}: ${err.stack}`);
            } else if (err.message) {
                logger.error(`Error creating session to server ${options.host}: ${err.message}`);
            } else {
                logger.error(`Error creating session to server ${options.host}: ${err}`);
            }
            process.exit(1);
        }

        // Set up logging of websocket traffic
        addTrafficLogging(session, options);

        let global;
        try {
            global = await session.open();
        } catch (err) {
            if (isPkg) {
                if (err.message) {
                    logger.error(`Error opening session to server ${options.host}: ${err.message}`);
                } else {
                    logger.error(`Error opening session to server ${options.host}: ${err}`);
                }
            } else if (err.stack) {
                logger.error(`Error opening session to server ${options.host}: ${err.stack}`);
            } else if (err.message) {
                logger.error(`Error opening session to server ${options.host}: ${err.message}`);
            } else {
                logger.error(`Error opening session to server ${options.host}: ${err}`);
            }
            process.exit(1);
        }

        let engineVersion;
        try {
            engineVersion = await global.engineVersion();
            logger.verbose(`Server ${options.host} has engine version ${engineVersion.qComponentVersion}.`);
        } catch (err) {
            if (isPkg) {
                if (err.message) {
                    logger.error(`Error getting engine version from server ${options.host}: ${err.message}`);
                } else {
                    logger.error(`Error getting engine version from server ${options.host}: ${err}`);
                }
            } else if (err.stack) {
                logger.error(`Error getting engine version from server ${options.host}: ${err.stack}`);
            } else if (err.message) {
                logger.error(`Error getting engine version from server ${options.host}: ${err.message}`);
            } else {
                logger.error(`Error getting engine version from server ${options.host}: ${err}`);
            }
            process.exit(1);
        }

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
                    `${bookmark.qMeta.owner.userDirectory}\\${bookmark.qMeta.owner.userId}`,
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
                return getBookmarks;
            }
            logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            return false;
        }
        logger.error(`Error destroying session object for bookmarks`);
        return false;
    } catch (err) {
        if (isPkg) {
            if (err.message) {
                logger.error(`Error getting bookmarks in app ${options.appId} on host ${options.host}: ${err.message}`);
            } else {
                logger.error(`Error getting bookmarks in app ${options.appId} on host ${options.host}: ${err}`);
            }
        } else if (err.stack) {
            logger.error(`Error getting bookmarks in app ${options.appId} on host ${options.host}: ${err.stack}`);
        } else if (err.message) {
            logger.error(`Error getting bookmarks in app ${options.appId} on host ${options.host}: ${err.message}`);
        } else {
            logger.error(`Error getting bookmarks in app ${options.appId} on host ${options.host}: ${err}`);
        }

        // Is there an active session? Close it if so.
        if (session !== undefined) {
            if ((await session.close()) === true) {
                logger.verbose(`Closed session after error getting bookmarks in app ${options.appId} on host ${options.host}`);
                return false;
            }
            logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            return false;
        }
        return false;
    }
};

export default getBookmark;
