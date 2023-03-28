const xlsx = require('node-xlsx').default;
const fs = require('fs');
const { resolve } = require('path');

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

                exportCount += 1;
                if (exportCount === parseInt(options.limitExportCount, 10)) {
                    logger.warn(
                        `Exported ${options.limitExportCount} app(s), which is the limit set by the --limit-export-count parameter. Exiting.`
                    );
                    process.exit(0);
                }
            }
        }
        return true;
    } catch (err) {
        logger.error(`GET TASK: ${err.stack}`);
    }
};

module.exports = {
    exportAppToFile,
};
