const xlsx = require('node-xlsx').default;
const fs = require('fs');
const path = require('path');
const yesno = require('yesno');

const { logger, setLoggingLevel, isPkg, execPath, mergeDirFilePath, verifyFileExists, isNumeric, sleep } = require('../../globals');
const { QlikSenseApps } = require('../app/class_allapps');

const exportAppToFile = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        // Verify output directory exists. Create if not.
        const outputDir = mergeDirFilePath([execPath, options.outputDir]);
        logger.debug(`The specified output directory "${options.outputDir}" resolves to "${outputDir}".`);
        const existsOutputDir = fs.existsSync(outputDir);
        if (!existsOutputDir) {
            await fs.promises.mkdir(outputDir);
        }

        // const appFileExists = await verifyFileExists(options.fileName);
        // if (appFileExists === false) {
        //     logger.error(`Missing apps definition file "${options.fileName}". Aborting`);
        //     process.exit(1);
        // } else {
        //     logger.verbose(`Apps definition file "${options.fileName}" found`);
        // }

        logger.info(`Export apps to directory "${outputDir}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get all tags
        // const tagsExisting = await getTagsFromQseow(options);

        // Get all custom properties
        // const cpExisting = await getCustomPropertiesFromQseow(options);

        // Set up app structure
        const qlikSenseApps = new QlikSenseApps();
        await qlikSenseApps.init(options);

        // Get apps that should be exported.
        // Take into account app ids, tags etc to be used to determine which apps should be incluided
        const appsToExport = await qlikSenseApps.getAppsFromQseow();
        if (appsToExport === false) {
            return false;
        }

        // Variable to store app metadata, which can be written to e.g. Excel file
        const appMetadata = [
            [
                'App counter',
                'App name',
                'App id',
                'QVF directory',
                'QVF name',
                'Exclude data connections',
                'App tags',
                'App custom properties',
                'Owner user directory',
                'Owner user id',
                'Publish to stream',
            ],
        ];
        let appCounter = 0;

        if (appsToExport.length > 0) {
            logger.info(`Number of apps to export: ${appsToExport.length}`);
            let exportCount = 0;

            // eslint-disable-next-line no-restricted-syntax
            for (const app of appsToExport) {
                // eslint-disable-next-line no-await-in-loop
                const exportAppData = await qlikSenseApps.exportAppStep1(app);

                // eslint-disable-next-line no-await-in-loop
                const resultDownloadApp = await qlikSenseApps.exportAppStep2(exportAppData);

                // eslint-disable-next-line no-await-in-loop
                await sleep(options.sleepAppExport);

                // keep track of app metadata
                appCounter += 1;
                appMetadata.push([
                    appCounter,
                    app.name,
                    app.id,
                    options.outputDir,
                    resultDownloadApp.qvfFileName,
                    options.excludeAppData,
                    app.tags.map((item) => item.name).join(' / '),
                    app.customProperties.map((item) => `${item.definition.name}=${item.value}`).join(' / '),
                    app.owner.userDirectory,
                    app.owner.userId,
                    app.stream ? app.stream.name : '',
                ]);

                exportCount += 1;
                if (exportCount === parseInt(options.limitExportCount, 10)) {
                    logger.warn(
                        `Exported ${options.limitExportCount} app(s), which is the limit set by the --limit-export-count parameter.`
                    );
                    break;
                }
            }

            if (options.metadataFileCreate) {
                // Save app metadata to disk file
                const buffer = xlsx.build([{ name: 'Ctrl-Q app export', data: appMetadata }]); // Returns a buffer

                // Build output file name
                const fileDir = mergeDirFilePath([execPath, options.outputDir]);
                const fileName = `${path.join(fileDir, options.metadataFileName)}`;
                logger.verbose(`Directory where app metadata file will be stored: ${fileDir}`);
                logger.verbose(`Full path to app metadata file: ${fileName}`);

                // Check if app metadata file already exists
                const fileExists = await verifyFileExists(fileName);

                logger.info('------------------------------------');

                if (!fileExists || (fileExists && options.metadataFileOverwrite)) {
                    // File doesn't exist
                    if (options.dryRun) {
                        logger.info(`DRY RUN: Writing app metadata file "${options.metadataFileName}" to disk`);
                    } else {
                        fs.writeFileSync(fileName, buffer);
                        logger.info(`✅ Done writing app metadata file "${options.metadataFileName}" to disk`);
                    }
                } else if (!options.metadataFileOverwrite) {
                    // Target file exist. Ask if user wants to overwrite
                    logger.info();
                    const ok = await yesno({
                        question: `                                  App metadata file "${fileName}" exists. Do you want to overwrite it? (y/n)`,
                    });
                    logger.info();
                    if (!ok) {
                        logger.info(`Not overwriting existing app metadata file "${fileName}"`);
                    } else if (options.dryRun) {
                        logger.info(`DRY RUN: Writing app metadata file "${options.metadataFileName}" to disk`);
                    } else {
                        fs.writeFileSync(fileName, buffer);
                        logger.info(`✅ Done writing app metadata file "${options.metadataFileName}" to disk`);
                    }
                }
            }
        }
        return true;
    } catch (err) {
        logger.error(`EXPORT APP: ${err.stack}`);
    }
};

module.exports = {
    exportAppToFile,
};
