import enigma from 'enigma.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import upath from 'upath';

import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { setupEnigmaConnection, addTrafficLogging } from '../../util/qseow/enigma_util.js';
import { catchLog } from '../../util/log.js';
import { serializeApp } from '../../util/qseow/serialize-app.js';
import { getAppById, getApps } from '../../util/qseow/app.js';
import { extractIntel } from '../../util/qseow/intel/index.js';

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
        scriptLines: appData.metadata.loadScript?.split('\n').length || 0,
    };
}

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
    };
}

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
            configEnigma = setupEnigmaConnection(options, sessionId);
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

        if (options.appId) {
            appIds = Array.isArray(options.appId) ? options.appId : [options.appId];
            logger.verbose(`Using specified app IDs: ${appIds.join(', ')}`);
        } else if (options.appTag) {
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

        for (const appId of appIds) {
            logger.info(`Processing app: ${appId}`);

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

            const openWithoutData = options.openWithoutData === 'true';
            const app = await global.openDoc(appId, '', '', '', openWithoutData);
            logger.verbose(`Opened app ${appId}`);

            const appObj = await serializeApp(app);

            appDataArray.push({
                appId,
                appName: appObj.properties?.qTitle || 'Unknown',
                metadata: appObj,
            });

            logger.verbose(`Serialized app ${appId}`);

            await session.close();
            logger.verbose(`Closed session for app ${appId}`);
        }

        if (session.globalPromise !== undefined) {
            if ((await session.close()) === true) {
                logger.verbose(`Closed final session`);
            } else {
                logger.error(`Error closing final session`);
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
