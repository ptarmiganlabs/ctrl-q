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

    return objects;
}

/**
 * Retrieves all master dimensions from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of dimension objects with properties
 */
async function getDimensions(app) {
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

    return dimensions;
}

/**
 * Retrieves all master measures from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of measure objects with properties
 */
async function getMeasures(app) {
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
    const list = await app.createSessionObject({
        qInfo: {
            qId: 'mediaList',
            qType: 'MediaList',
        },
        qMediaListDef: {},
    });

    const layout = await list.getLayout();
    return layout.qMediaList.qItems.filter((d) => {
        return d.qUrlDef.substring(0, 7) === '/media/';
    });
}

/**
 * Retrieves all snapshots from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of snapshot objects with properties
 */
async function getSnapshots(app) {
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
    return layout.qFieldList.qItems;
}

/**
 * Retrieves all data connections from the app.
 * @async
 * @param {Object} app - The Qlik Sense app object
 * @returns {Promise<Object[]>} Array of connection detail objects
 */
async function getDataConnections(app) {
    const connections = await app.getConnections();
    const connectionDetails = await Promise.all(
        connections.map(async (d) => {
            return app.getConnection(d.qId);
        })
    );

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

    return variables;
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
    };

    // Get app properties
    const properties = await app.getAppProperties();
    appObj.properties = properties;

    // Get load script
    const script = await app.getScript();
    appObj.loadScript = script;

    // Get lists (sheets, stories, master objects, app props)
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
    await Promise.all(
        Object.keys(METHODS).map(async (key) => {
            const data = await METHODS[key](app);
            appObj[key] = data;
        })
    );

    return appObj;
}
