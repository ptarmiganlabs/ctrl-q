// import { csvParse } from 'csv-parse';

const xlsx = require('node-xlsx').default;

const { logger, setLoggingLevel, isPkg, execPath, verifyFileExists, isNumeric } = require('../../globals');
const { QlikSenseApps } = require('../app/class_allapps');
const { getAppColumnPosFromHeaderRow } = require('../util/lookups');
const { getTagsFromQseow } = require('../util/tag');
const { getCustomPropertiesFromQseow } = require('../util/customproperties');

const importAppFromFile = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Import apps from definitions in file "${options.fileName}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get all tags
        const tagsExisting = await getTagsFromQseow(options);

        // Get all custom properties
        const cpExisting = await getCustomPropertiesFromQseow(options);

        // Verify file exists
        const appFileExists = await verifyFileExists(options.fileName);
        if (appFileExists === false) {
            logger.error(`Missing apps definition file "${options.fileName}". Aborting`);
            process.exit(1);
        } else {
            logger.verbose(`Apps definition file "${options.fileName}" found`);
        }

        let appsFromFile = null;

        if (options.fileType === 'excel') {
            // Parse Excel file
            const workSheetsFromFile = xlsx.parse(options.fileName);

            // Verify that app definitions sheet exists
            appsFromFile = workSheetsFromFile.find((item) => item.name === options.sheetName);
            if (!appsFromFile) {
                throw new Error(`EXCEL APP IMPORT: Can't find sheet ${options.sheetName} in file ${options.fileName}`);
            }

            // Is there an import limit specified?
            // If so only include the first --limit-import-count tasks
            if (parseInt(options.limitImportCount, 10) > 0) {
                // Get positions of column headers
                const colHeaders = getAppColumnPosFromHeaderRow(appsFromFile.data[0]);

                const limitedApps = appsFromFile.data.filter((app) => {
                    // Are we on header line?
                    if (app[colHeaders.appCounter.pos] === colHeaders.appCounter.name) {
                        // This is the header
                        return true;
                    }

                    // Only keep first x tasks
                    if (app[colHeaders.appCounter.pos] <= parseInt(options.limitImportCount, 10)) {
                        return true;
                    }
                    return false;
                });

                // Copy limited set of tasks to original variable that will be used during task import
                appsFromFile.data = [];
                appsFromFile.data.push(...limitedApps);
            }

            // All definitions now loaded from source file
            const qlikSenseApps = new QlikSenseApps();
            await qlikSenseApps.init(options);

            // Import apps specified in Excel file
            const importedApps = await qlikSenseApps.importAppsFromFiles(appsFromFile, tagsExisting, cpExisting);
            logger.debug(`Imported apps:\n${JSON.stringify(importedApps, null, 2)}`);
            return importedApps;
        }
        return false;
    } catch (err) {
        logger.error(`IMPORT APP: ${err.stack}`);
    }
};

module.exports = {
    importAppFromFile,
};
