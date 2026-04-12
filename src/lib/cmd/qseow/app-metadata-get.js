/**
 * @fileoverview Command for extracting metadata from Qlik Sense apps.
 *
 * This module retrieves comprehensive metadata from one or more Qlik Sense apps including:
 * - Load script
 * - App properties
 * - Sheets and stories
 * - Master objects, dimensions, and measures
 * - Bookmarks and variables
 * - Field definitions and data connections
 * - Table and key information from the data model
 *
 * Supports output in JSON and QVD formats, with optional intel extraction
 * for analyzing labels, expressions, and field references.
 *
 * @module cmd/qseow/app-metadata-get
 */

import enigma from 'enigma.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import upath from 'upath';

import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { catchLog } from '../../util/log.js';
import { serializeApp } from '../../util/qseow/serialize-app.js';
import { getApps } from '../../util/qseow/app.js';
import { extractIntel } from '../../util/qseow/intel/index.js';

/**
 * Creates QVD files containing structured intel extracted from app metadata.
 *
 * Generates three QVD files:
 * - Run metadata: Information about the extraction run itself
 * - Items: All extracted intel items with their properties
 * - Associations: Relationships between items and sheet visualizations
 *
 * @async
 * @param {Object} appData - App data object containing appId, appName, and metadata
 * @param {string} outputDir - Directory where QVD files will be written
 * @param {string} intelFileName - Base name for the intel QVD files
 * @param {Object} log - Logger instance for status messages
 * @returns {Promise<void>} Resolves when QVD files are created
 */
async function createIntelQvd(appData, outputDir, intelFileName, log) {
    const { QvdDataFrame } = await import('qvdjs');

    log.info(`Creating intel QVDs for app: ${appData.appName}`);

    const safeAppName = appData.appName.replace(/[^a-zA-Z0-9]/g, '_');
    const intelResult = extractIntel(appData.metadata, appData.appId, appData.appName);
    const intel = intelResult.intel;

    // QVD 1: Run metadata
    const runColumns = ['run_key', 'extracted_at', 'app_id', 'app_name', 'extractor_count', 'extractor_list', 'total_item_count'];
    const runData = [[1, intel.extractedAt, intel.appId, intel.appName, intel.extractors.length, intel.extractors.join(','), intel.count]];
    const runDf = await QvdDataFrame.fromDict({ columns: runColumns, data: runData });
    const runFile = upath.join(outputDir, `${intelFileName}_run_${safeAppName}.qvd`);
    await runDf.toQvd(runFile);
    log.info(`Created intel run QVD: ${runFile}`);

    // QVD 2: Items
    const itemColumns = ['item_key', 'run_key', 'value', 'type', 'source_type', 'source_id', 'source_name', 'path'];
    const itemData = intel.items.map((item, idx) => [
        idx + 1,
        1,
        item.value,
        item.type,
        item.sourceType,
        item.sourceId,
        item.sourceName,
        item.path,
    ]);
    const itemDf = await QvdDataFrame.fromDict({ columns: itemColumns, data: itemData });
    const itemFile = upath.join(outputDir, `${intelFileName}_items_${safeAppName}.qvd`);
    await itemDf.toQvd(itemFile);
    log.info(`Created intel items QVD: ${itemFile}`);

    // QVD 3: Associations
    const assocColumns = [
        'association_key',
        'item_key',
        'sheet_id',
        'sheet_name',
        'cell_name',
        'cell_type',
        'parent_viz_id',
        'parent_viz_type',
    ];
    const assocData = [];
    let assocKey = 1;
    intel.items.forEach((item, idx) => {
        const assoc = item.associations || {};

        const hasAssociation =
            assoc.sheetId || assoc.sheetName || assoc.cellName || assoc.cellType || assoc.parentVizId || assoc.parentVizType;

        if (hasAssociation) {
            assocData.push([
                assocKey++,
                idx + 1,
                assoc.sheetId || '',
                assoc.sheetName || '',
                assoc.cellName || '',
                assoc.cellType || '',
                assoc.parentVizId || '',
                assoc.parentVizType || '',
            ]);
        } else {
            assocKey++;
        }
    });
    const assocDf = await QvdDataFrame.fromDict({ columns: assocColumns, data: assocData });
    const assocFile = upath.join(outputDir, `${intelFileName}_associations_${safeAppName}.qvd`);
    await assocDf.toQvd(assocFile);
    log.info(`Created intel associations QVD: ${assocFile}`);
}

/**
 * Builds a summary data object with counts for various app components.
 *
 * @param {Object} appData - App data object with appId, appName, and metadata
 * @returns {Object} Summary object with counts for sheets, stories, dimensions, measures, etc.
 */
function buildSummaryData(appData) {
    return {
        appId: appData.appId,
        appName: appData.appName,
        sheetCount: appData.metadata.sheets?.length || 0,
        storyCount: appData.metadata.stories?.length || 0,
        masterObjectCount: appData.metadata.masterobjects?.length || 0,
        dimensionCount: appData.metadata.dimensions?.length || 0,
        measureCount: appData.metadata.measures?.length || 0,
        bookmarkCount: appData.metadata.bookmarks?.length || 0,
        variableCount: appData.metadata.variables?.length || 0,
        fieldCount: appData.metadata.fields?.length || 0,
        dataConnectionCount: appData.metadata.dataconnections?.length || 0,
        tableCount: appData.metadata.tables?.qtr?.length || 0,
        scriptLines: appData.metadata.loadScript?.split('\n').length || 0,
    };
}

/**
 * Builds a full data object containing all app metadata.
 *
 * @param {Object} appData - App data object with appId, appName, and metadata
 * @param {string} server - Server hostname
 * @param {string} engineVersion - Qlik Engine version string
 * @returns {Object} Full metadata object with exportedAt, server, engineVersion, and all metadata sections
 */
function buildFullData(appData, server, engineVersion) {
    return {
        exportedAt: new Date().toISOString(),
        server,
        engineVersion,
        appId: appData.appId,
        appName: appData.appName,
        script: appData.metadata.loadScript,
        properties: appData.metadata.properties,
        sheets: appData.metadata.sheets,
        stories: appData.metadata.stories,
        masterobjects: appData.metadata.masterobjects,
        dimensions: appData.metadata.dimensions,
        measures: appData.metadata.measures,
        bookmarks: appData.metadata.bookmarks,
        variables: appData.metadata.variables,
        fields: appData.metadata.fields,
        dataconnections: appData.metadata.dataconnections,
        tables: appData.metadata.tables,
    };
}

/**
 * Retrieves metadata from one or more Qlik Sense apps.
 *
 * This is the main function that orchestrates the metadata retrieval process.
 * It connects to the Qlik Sense server, retrieves metadata for specified apps
 * (by ID, tag, or all apps), and optionally creates intel files.
 *
 * @async
 * @param {Object} options - Command options object
 * @param {string} [options.host] - Qlik Sense server hostname
 * @param {string} [options.appId] - Specific app ID or array of IDs
 * @param {string} [options.appTag] - App tag to filter by (or array of tags)
 * @param {string} [options.outputFormat='json'] - Output format: 'json' or 'qvd'
 * @param {string} [options.outputCount='multiple'] - 'single' for one file per app, 'multiple' to combine
 * @param {string} [options.outputDest='file'] - 'file' or 'screen'
 * @param {string} [options.outputDetail='full'] - 'summary', 'full', or 'both'
 * @param {string} [options.openWithoutData='true'] - Open app without loading data
 * @param {string} [options.createIntelFile] - Create intel extraction files
 * @param {string} [options.outputDir='.'] - Output directory for files
 * @param {string} [options.outputFileName='app-metadata'] - Base filename for output
 * @param {string} [options.intelFileName='app-metadata-intel'] - Base filename for intel files
 * @param {number} [options.limitAppCount=0] - Maximum apps to process when not specifying appId
 * @param {number} [options.sleepBetweenApps=1000] - Milliseconds to wait between apps
 * @param {string} [options.logLevel] - Logging level
 * @returns {Promise<Object[]>} Array of app data objects with metadata
 */
async function getAppMetadata(options) {
    try {
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.verbose('Get app metadata');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        const outputFormat = options.outputFormat || 'json';
        const outputCount = options.outputCount || 'multiple';
        const outputDest = options.outputDest || 'file';
        const outputDetail = options.outputDetail || 'full';
        const createIntelFile = options.createIntelFile !== 'false';

        logger.debug(`Output format: ${outputFormat}, count: ${outputCount}, dest: ${outputDest}, createIntelFile: ${createIntelFile}`);

        const sessionId = 'ctrlq';

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

        let appIds = [];

        // Determine which apps to process: either by specific ID, tag filter, or all apps
        if (options.appId) {
            // Use explicitly specified app ID(s)
            appIds = Array.isArray(options.appId) ? options.appId : [options.appId];
            logger.verbose(`Using specified app IDs: ${appIds.join(', ')}`);
        } else if (options.appTag) {
            // Get apps filtered by tag(s)
            const appTags = Array.isArray(options.appTag) ? options.appTag : [options.appTag];
            logger.verbose(`Getting apps with tags: ${appTags.join(', ')}`);

            const apps = await getApps(options, [], appTags);
            if (apps && Array.isArray(apps)) {
                appIds = apps.map((app) => app.id);
                logger.verbose(`Found ${appIds.length} apps with specified tags`);
            } else {
                logger.error('No apps found with specified tags');
                process.exit(1);
            }
        } else {
            // No filter specified, get all apps from server
            logger.verbose('No app ID or tag specified, getting all apps');
            const docList = await global.getDocList();
            appIds = docList.map((doc) => doc.qDocId);
            logger.verbose(`Found ${appIds.length} apps on server`);
        }

        if (options.limitAppCount > 0 && appIds.length > options.limitAppCount) {
            appIds = appIds.slice(0, options.limitAppCount);
            logger.verbose(`Limited to ${options.limitAppCount} app(s) due to --limit-app-count option`);
        }

        const appDataArray = [];

        // Milliseconds to wait between apps (if processing multiple apps)
        const sleepBetweenApps = parseInt(options.sleepBetweenApps, 10) || 0;

        // Process each app: create session, open app, serialize, cleanup
        for (let appIndex = 0; appIndex < appIds.length; appIndex++) {
            const appId = appIds[appIndex];
            logger.info(`Processing app: ${appId}`);

            try {
                // Create a new session if needed (first app or previous session closed)
                if (session.globalPromise === undefined) {
                    try {
                        session = await enigma.create(configEnigma);
                        logger.verbose(`Created new session to server ${options.host}.`);

                        global = await session.open();
                        logger.verbose(`Opened new session to server ${options.host}.`);
                    } catch (err) {
                        catchLog(`Error creating new session for app ${appId}`, err);
                        process.exit(1);
                    }
                }

                // Open the app in Sense
                const openWithoutData = options.openWithoutData === 'true';
                const app = await global.openDoc(appId, '', '', '', openWithoutData);
                logger.verbose(`Opened app ${appId}`);

                // Extract all metadata from the app
                const appObj = await serializeApp(app);

                appDataArray.push({
                    appId,
                    appName: appObj.properties?.qTitle || 'Unknown',
                    metadata: appObj,
                });

                logger.verbose(`Serialized app ${appId}`);
            } catch (err) {
                catchLog(`Error processing app ${appId}`, err);
                process.exit(1);
            } finally {
                // Always close the session after processing the app
                if (session.globalPromise !== undefined) {
                    await session.close();
                    logger.verbose(`Closed session for app ${appId}`);
                }
            }

            // Add delay after session close to give Qlik Engine time to fully release the app
            if (sleepBetweenApps > 0 && appIndex < appIds.length - 1) {
                logger.verbose(`Sleeping ${sleepBetweenApps}ms before processing next app`);
                await new Promise((resolve) => setTimeout(resolve, sleepBetweenApps));
            }
        }

        if (outputDest === 'screen') {
            if (outputCount === 'single') {
                if (outputDetail === 'summary' || outputDetail === 'both') {
                    // eslint-disable-next-line no-console
                    console.log('\n=== App Metadata Summary (all apps) ===\n');
                    appDataArray.forEach((appData) => {
                        // eslint-disable-next-line no-console
                        console.log(JSON.stringify(buildSummaryData(appData), null, 2));
                    });
                }
                if (outputDetail === 'full' || outputDetail === 'both') {
                    if (outputDetail === 'both') {
                        // eslint-disable-next-line no-console
                        console.log('\n=== App Metadata Full Details (all apps) ===\n');
                    }
                    // eslint-disable-next-line no-console
                    console.log(
                        JSON.stringify(
                            {
                                exportedAt: new Date().toISOString(),
                                server: options.host,
                                engineVersion: engineVersion.qComponentVersion,
                                appCount: appDataArray.length,
                                apps: appDataArray.map((appData) => buildFullData(appData, options.host, engineVersion.qComponentVersion)),
                            },
                            null,
                            2
                        )
                    );
                }
            } else {
                for (const appData of appDataArray) {
                    // eslint-disable-next-line no-console
                    console.log(`\n=== App: ${appData.appName} (${appData.appId}) ===\n`);

                    if (outputDetail === 'summary' || outputDetail === 'both') {
                        // eslint-disable-next-line no-console
                        console.log('--- Summary ---');
                        // eslint-disable-next-line no-console
                        console.log(JSON.stringify(buildSummaryData(appData), null, 2));
                    }
                    if (outputDetail === 'full' || outputDetail === 'both') {
                        if (outputDetail === 'both') {
                            // eslint-disable-next-line no-console
                            console.log('--- Full Details ---');
                        }
                        // eslint-disable-next-line no-console
                        console.log(JSON.stringify(buildFullData(appData, options.host, engineVersion.qComponentVersion), null, 2));
                    }
                }
            }
        } else {
            const outputDir = options.outputDir || '.';
            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true });
                logger.verbose(`Created output directory: ${outputDir}`);
            }

            const outputBasename = options.outputFileName || 'app-metadata';
            const intelFileName = options.intelFileName || 'app-metadata-intel';

            if (outputFormat === 'qvd') {
                const { QvdDataFrame } = await import('qvdjs');
                const columns = [
                    'app_id',
                    'app_name',
                    'script',
                    'properties',
                    'sheets',
                    'stories',
                    'masterobjects',
                    'dimensions',
                    'measures',
                    'bookmarks',
                    'variables',
                    'fields',
                    'dataconnections',
                    'tables',
                ];

                if (outputCount === 'single') {
                    const outputFile = upath.join(outputDir, `${outputBasename}.qvd`);
                    logger.info(`Creating single QVD file: ${outputFile}`);

                    const data = appDataArray.map((item) => [
                        item.appId,
                        item.appName,
                        item.metadata.loadScript,
                        JSON.stringify(item.metadata.properties),
                        JSON.stringify(item.metadata.sheets),
                        JSON.stringify(item.metadata.stories),
                        JSON.stringify(item.metadata.masterobjects),
                        JSON.stringify(item.metadata.dimensions),
                        JSON.stringify(item.metadata.measures),
                        JSON.stringify(item.metadata.bookmarks),
                        JSON.stringify(item.metadata.variables),
                        JSON.stringify(item.metadata.fields),
                        JSON.stringify(item.metadata.dataconnections),
                        JSON.stringify(item.metadata.tables),
                    ]);

                    const df = await QvdDataFrame.fromDict({ columns, data });
                    await df.toQvd(outputFile);
                    logger.info(`Created QVD file: ${outputFile}`);

                    if (createIntelFile) {
                        for (const ad of appDataArray) {
                            await createIntelQvd(ad, outputDir, intelFileName, logger);
                        }
                    }
                } else {
                    for (const appData of appDataArray) {
                        const safeAppName = appData.appName.replace(/[^a-zA-Z0-9]/g, '_');
                        const outputFile = upath.join(outputDir, `${outputBasename}_${safeAppName}.qvd`);
                        logger.info(`Creating QVD file for app: ${appData.appName}`);

                        const data = [
                            [
                                appData.appId,
                                appData.appName,
                                appData.metadata.loadScript,
                                JSON.stringify(appData.metadata.properties),
                                JSON.stringify(appData.metadata.sheets),
                                JSON.stringify(appData.metadata.stories),
                                JSON.stringify(appData.metadata.masterobjects),
                                JSON.stringify(appData.metadata.dimensions),
                                JSON.stringify(appData.metadata.measures),
                                JSON.stringify(appData.metadata.bookmarks),
                                JSON.stringify(appData.metadata.variables),
                                JSON.stringify(appData.metadata.fields),
                                JSON.stringify(appData.metadata.dataconnections),
                                JSON.stringify(appData.metadata.tables),
                            ],
                        ];

                        const df = await QvdDataFrame.fromDict({ columns, data });
                        await df.toQvd(outputFile);
                        logger.info(`Created QVD file: ${outputFile}`);

                        if (createIntelFile) {
                            await createIntelQvd(appData, outputDir, intelFileName, logger);
                        }
                    }
                }
            } else if (outputCount === 'single') {
                const outputFile = upath.join(outputDir, `${outputBasename}.json`);
                logger.info(`Creating single JSON file: ${outputFile}`);

                const combinedJson = {
                    exportedAt: new Date().toISOString(),
                    server: options.host,
                    engineVersion: engineVersion.qComponentVersion,
                    appCount: appDataArray.length,
                    apps: appDataArray.map((item) => buildFullData(item, options.host, engineVersion.qComponentVersion)),
                };

                writeFileSync(outputFile, JSON.stringify(combinedJson, null, 2));
                logger.info(`Created JSON file: ${outputFile}`);
            } else {
                for (const appData of appDataArray) {
                    const safeAppName = appData.appName.replace(/[^a-zA-Z0-9]/g, '_');
                    const outputFile = upath.join(outputDir, `${outputBasename}_${safeAppName}.json`);
                    logger.info(`Creating JSON file for app: ${appData.appName}`);

                    const singleAppJson = {
                        exportedAt: new Date().toISOString(),
                        server: options.host,
                        engineVersion: engineVersion.qComponentVersion,
                        ...buildFullData(appData, options.host, engineVersion.qComponentVersion),
                    };

                    writeFileSync(outputFile, JSON.stringify(singleAppJson, null, 2));
                    logger.info(`Created JSON file: ${outputFile}`);

                    if (createIntelFile && outputFormat === 'json') {
                        const intelOutputFile = upath.join(outputDir, `${intelFileName}_${safeAppName}.json`);
                        logger.info(`Creating intel file for app: ${appData.appName}`);

                        const intelResult = extractIntel(appData.metadata, appData.appId, appData.appName);
                        writeFileSync(intelOutputFile, JSON.stringify(intelResult, null, 2));
                        logger.info(`Created intel file: ${intelOutputFile}`);
                    }

                    if (createIntelFile && outputFormat === 'qvd') {
                        await createIntelQvd(appData, outputDir, intelFileName, logger);
                    }
                }
            }

            if (createIntelFile && outputFormat === 'json' && outputCount === 'single') {
                const intelOutputFile = upath.join(outputDir, `${intelFileName}.json`);
                logger.info(`Creating single intel file`);

                const combinedIntel = {
                    intel: {
                        extractedAt: new Date().toISOString(),
                        appId: appDataArray.length === 1 ? appDataArray[0].appId : '',
                        appName: appDataArray.length === 1 ? appDataArray[0].appName : 'Multiple Apps',
                        engineVersion: engineVersion.qComponentVersion,
                        server: options.host,
                        appCount: appDataArray.length,
                        extractors: ['sheet', 'dimension', 'measure', 'variable', 'bookmark', 'dataconnection'],
                        count: 0,
                        items: [],
                    },
                };

                appDataArray.forEach((appData) => {
                    const intelResult = extractIntel(appData.metadata, appData.appId, appData.appName);
                    combinedIntel.intel.items.push(...intelResult.intel.items);
                });
                combinedIntel.intel.count = combinedIntel.intel.items.length;

                writeFileSync(intelOutputFile, JSON.stringify(combinedIntel, null, 2));
                logger.info(`Created intel file: ${intelOutputFile}`);
            }

            if (createIntelFile && outputFormat === 'qvd' && outputCount === 'single') {
                logger.info(`Creating single intel QVD files`);
                for (const appData of appDataArray) {
                    await createIntelQvd(appData, outputDir, logger);
                }
            }
        }

        logger.info(`Successfully processed ${appDataArray.length} app(s)`);

        return appDataArray;
    } catch (err) {
        catchLog('Error in getAppMetadata', err);
    }
}

export { getAppMetadata };
