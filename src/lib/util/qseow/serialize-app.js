/**
 * @fileoverview Serialization utilities for Qlik Sense apps.
 * Converts Qlik Sense app objects into JSON format for extraction and analysis.
 * Based on Butler's serialize_app.js
 * @module qseow/serialize-app
 */

import { logger } from '../../../globals.js';

/**
 * Retrieves a list of app objects of a specific type.
 * Uses enigma.js session object to get full property trees for each object.
 * @async
 * @param {Object} app - The Qlik Sense app object (enigma.js app connection)
 * @param {string} objectType - Type of objects to retrieve (e.g., 'sheet', 'story', 'masterobject')
 * @returns {Promise<Object[]>} Array of objects with full property trees
 */
async function getList(app, objectType) {
    logger.debug(`SERIALIZE APP GET LIST: Retrieving objects of type "${objectType}"`);

    const list = await app.createSessionObject({
        qAppObjectListDef: {
            qType: objectType,
            qData: {
                id: '/qInfo/qId',
            },
        },
        qInfo: {
            qId: objectType + 'List',
            qType: objectType + 'List',
        },
        qMetaDef: {},
        qExtendsId: '',
    });

    const layout = await list.getLayout();
    const objects = await Promise.all(
        layout.qAppObjectList.qItems.map(async (d) => {
            const handle = await app.getObject(d.qInfo.qId);
            return handle.getFullPropertyTree();
        })
    );

    logger.verbose(`SERIALIZE APP GET LIST: Retrieved ${objects.length} objects of type "${objectType}"`);
    return objects;
}

/**
 * Retrieves all master dimensions from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of dimension objects with properties
 */
async function getDimensions(app) {
    logger.debug('SERIALIZE APP GET DIMENSIONS: Retrieving master dimensions');

    const list = await app.createSessionObject({
        qDimensionListDef: {
            qType: 'dimension',
            qData: {
                info: '/qDimInfos',
            },
            qMeta: {},
        },
        qInfo: { qId: 'DimensionList', qType: 'DimensionList' },
    });

    const layout = await list.getLayout();
    const dimensions = await Promise.all(
        layout.qDimensionList.qItems.map(async (d) => {
            const dimension = await app.getDimension(d.qInfo.qId);
            return dimension.getProperties();
        })
    );

    logger.verbose(`SERIALIZE APP GET DIMENSIONS: Retrieved ${dimensions.length} master dimensions`);
    return dimensions;
}

/**
 * Retrieves all master measures from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of measure objects with properties
 */
async function getMeasures(app) {
    logger.debug('SERIALIZE APP GET MEASURES: Retrieving master measures');

    const list = await app.createSessionObject({
        qMeasureListDef: {
            qType: 'measure',
            qData: {
                info: '/qDimInfos',
            },
            qMeta: {},
        },
        qInfo: { qId: 'MeasureList', qType: 'MeasureList' },
    });

    const layout = await list.getLayout();
    const measures = await Promise.all(
        layout.qMeasureList.qItems.map(async (d) => {
            const measure = await app.getMeasure(d.qInfo.qId);
            const properties = await measure.getProperties();
            return properties;
        })
    );

    logger.verbose(`SERIALIZE APP GET MEASURES: Retrieved ${measures.length} master measures`);
    return measures;
}

/**
 * Retrieves all bookmarks from the app.
 * Includes bookmark state data in the properties.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of bookmark objects with properties and state
 */
async function getBookmarks(app) {
    logger.debug('SERIALIZE APP GET BOOKMARKS: Retrieving bookmarks');

    const list = await app.createSessionObject({
        qBookmarkListDef: {
            qType: 'bookmark',
            qData: {
                info: '/qDimInfos',
            },
            qMeta: {},
        },
        qInfo: { qId: 'BookmarkList', qType: 'BookmarkList' },
    });

    const layout = await list.getLayout();
    const bookmarks = await Promise.all(
        layout.qBookmarkList.qItems.map(async (d) => {
            const bookmark = await app.getBookmark(d.qInfo.qId);
            const properties = await bookmark.getProperties();
            const bookmarkLayout = await bookmark.getLayout();

            properties.qData = properties.qData || {};
            properties.qData.qBookMark = bookmarkLayout.qBookmark;

            return properties;
        })
    );

    logger.verbose(`SERIALIZE APP GET BOOKMARKS: Retrieved ${bookmarks.length} bookmarks`);
    return bookmarks;
}

/**
 * Retrieves embedded media files from the app.
 * Filters to only include media files with /media/ prefix.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of media file objects
 */
async function getMediaList(app) {
    logger.debug('SERIALIZE APP GET MEDIA: Retrieving embedded media');

    const list = await app.createSessionObject({
        qInfo: {
            qId: 'mediaList',
            qType: 'MediaList',
        },
        qMediaListDef: {},
    });

    const layout = await list.getLayout();
    const mediaItems = layout.qMediaList.qItems.filter((d) => {
        return d.qUrlDef.substring(0, 7) === '/media/';
    });

    logger.verbose(`SERIALIZE APP GET MEDIA: Retrieved ${mediaItems.length} embedded media files`);
    return mediaItems;
}

/**
 * Retrieves all snapshots from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of snapshot objects with properties
 */
async function getSnapshots(app) {
    logger.debug('SERIALIZE APP GET SNAPSHOTS: Retrieving snapshots');

    const list = await app.createSessionObject({
        qBookmarkListDef: {
            qType: 'snapshot',
            qData: {
                info: '/qDimInfos',
            },
            qMeta: {},
        },
        qInfo: { qId: 'BookmarkList', qType: 'BookmarkList' },
    });

    const layout = await list.getLayout();
    const snapshots = await Promise.all(
        layout.qBookmarkList.qItems.map(async (d) => {
            const bookmark = await app.getBookmark(d.qInfo.qId);
            const properties = await bookmark.getProperties();
            return properties;
        })
    );

    logger.verbose(`SERIALIZE APP GET SNAPSHOTS: Retrieved ${snapshots.length} snapshots`);
    return snapshots;
}

/**
 * Retrieves all fields from the app.
 * Includes system, hidden, source tables, and semantic fields.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of field objects
 */
async function getFields(app) {
    logger.debug('SERIALIZE APP GET FIELDS: Retrieving fields');

    const fields = await app.createSessionObject({
        qFieldListDef: {
            qShowSystem: true,
            qShowHidden: true,
            qShowSrcTables: true,
            qShowSemantic: true,
        },
        qInfo: { qId: 'FieldList', qType: 'FieldList' },
    });

    const layout = await fields.getLayout();
    const fieldItems = layout.qFieldList.qItems;

    logger.verbose(`SERIALIZE APP GET FIELDS: Retrieved ${fieldItems.length} fields`);
    return fieldItems;
}

/**
 * Retrieves all data connections from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of connection detail objects
 */
async function getDataConnections(app) {
    logger.debug('SERIALIZE APP GET DATA CONNECTIONS: Retrieving data connections');

    const connections = await app.getConnections();
    const connectionDetails = await Promise.all(
        connections.map(async (d) => {
            return app.getConnection(d.qId);
        })
    );

    logger.verbose(`SERIALIZE APP GET DATA CONNECTIONS: Retrieved ${connectionDetails.length} data connections`);
    return connectionDetails;
}

/**
 * Retrieves all variables from the app.
 * Includes script-created, reserved, and config variables.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of variable objects with properties
 */
async function getVariables(app) {
    logger.debug('SERIALIZE APP GET VARIABLES: Retrieving variables');

    const list = await app.createSessionObject({
        qVariableListDef: {
            qType: 'variable',
            qShowReserved: true,
            qShowConfig: true,
            qData: {
                info: '/qDimInfos',
            },
            qMeta: {},
        },
        qInfo: { qId: 'VariableList', qType: 'VariableList' },
    });

    const layout = await list.getLayout();
    const variables = await Promise.all(
        layout.qVariableList.qItems.map(async (d) => {
            const variable = await app.getVariableById(d.qInfo.qId);
            const properties = await variable.getProperties();

            if (d.qIsScriptCreated) properties.qIsScriptCreated = d.qIsScriptCreated;
            if (d.qIsReserved) properties.qIsReserved = d.qIsReserved;
            if (d.qIsConfig) properties.qIsConfig = d.qIsConfig;

            return properties;
        })
    );

    logger.verbose(`SERIALIZE APP GET VARIABLES: Retrieved ${variables.length} variables`);
    return variables;
}

/**
 * Retrieves tables and keys from the app's data model.
 *
 * Returns table information and key fields that link tables together.
 *
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object>} Object containing tables (qtr) and keys (qk)
 */
async function getTablesAndKeys(app) {
    logger.debug('SERIALIZE APP GET TABLES AND KEYS: Retrieving tables and keys from data model');

    const params = {
        qWindowSize: { qcx: 0, qcy: 0 },
        qNullSize: { qcx: 0, qcy: 0 },
        qCellHeight: 0,
        qSyntheticMode: false,
        // Not supported in schema 12.612.0, but available in newer schemas like 12.936.0
        // qIncludeSysVars: false,
        // qIncludeProfiling: false,
    };

    const result = await app.getTablesAndKeys(params);

    logger.verbose(`SERIALIZE APP GET TABLES AND KEYS: Retrieved ${result.qtr?.length ?? 0} tables and ${result.qk?.length ?? 0} keys`);
    return result;
}

/**
 * Serializes a Qlik Sense app into a JSON object.
 *
 * Extracts all app metadata including properties, load script, sheets, stories,
 * master objects, dimensions, measures, bookmarks, media, snapshots, fields,
 * data connections, and variables.
 *
 * @async
 * @param {Object} app - The Qlik Sense app object (enigma.js app connection)
 * @returns {Promise<Object>} Serialized app data object containing all metadata
 * @throws {Error} If app is not a valid enigma.js app connection
 * @example
 * const appData = await serializeApp(app);
 * // appData.properties - App metadata
 * // appData.loadScript - Load script
 * // appData.sheets - Sheet objects
 * // appData.dimensions - Master dimensions
 * // etc.
 */
export async function serializeApp(app) {
    logger.debug('SERIALIZE APP: Starting app serialization');

    if (!app || typeof app.createSessionObject !== 'function') {
        throw new Error('Expects a valid enigma.js app connection');
    }

    const appObj = {};

    // Define object types to retrieve via getList
    const LISTS = [{ sheets: 'sheet' }, { stories: 'story' }, { masterobjects: 'masterobject' }, { appprops: 'appprops' }];

    // Define object types to retrieve via dedicated methods
    const METHODS = {
        dimensions: getDimensions,
        measures: getMeasures,
        bookmarks: getBookmarks,
        embeddedmedia: getMediaList,
        snapshots: getSnapshots,
        fields: getFields,
        dataconnections: getDataConnections,
        variables: getVariables,
        tables: getTablesAndKeys,
    };

    // Get app properties
    logger.debug('SERIALIZE APP: Getting app properties');
    const properties = await app.getAppProperties();
    appObj.properties = properties;
    logger.debug(`SERIALIZE APP: App name: "${properties.qTitle}"`);

    // Get load script
    logger.debug('SERIALIZE APP: Getting load script');
    const script = await app.getScript();
    appObj.loadScript = script;
    logger.verbose(`SERIALIZE APP: Load script length: ${script.length} characters`);

    // Get lists (sheets, stories, master objects, app props)
    logger.debug('SERIALIZE APP: Getting sheets, stories, master objects, and app props');
    const listData = await Promise.all(
        LISTS.map(async (d) => {
            const objectType = d[Object.keys(d)[0]];
            return getList(app, objectType);
        })
    );

    LISTS.forEach((d, y) => {
        const key = Object.keys(d)[0];
        appObj[key] = listData[y];
    });

    // Get other metadata via METHODS
    logger.debug('SERIALIZE APP: Getting dimensions, measures, bookmarks, media, snapshots, fields, connections, variables, tables');
    await Promise.all(
        Object.keys(METHODS).map(async (key) => {
            const data = await METHODS[key](app);
            appObj[key] = data;
        })
    );

    logger.debug('SERIALIZE APP: App serialization complete');
    return appObj;
}
