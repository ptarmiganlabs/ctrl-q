const xlsx = require('node-xlsx').default;
const fs = require('fs');

const { logger, setLoggingLevel, isPkg, execPath, mergeDirFilePath, verifyFileExists, isNumeric } = require('../../globals');
const { QlikSenseApps } = require('../app/class_allapps');
const { getTagsFromQseow } = require('../util/tag');
const { getCustomPropertiesFromQseow } = require('../util/customproperties');

const exportAppToFile = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        // Verify output directory exists. Create if not.
        const outputDir = mergeDirFilePath([options.outputDir]);
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

        if (appsToExport.length > 0) {
            //
        }
        // let appsFromFile = null;

        // if (options.fileType === 'excel') {
        //     // Parse Excel file
        //     const workSheetsFromFile = xlsx.parse(options.fileName);

        //     // Verify that task definitions sheet exists
        //     appsFromFile = workSheetsFromFile.find((item) => item.name === options.sheetName);
        //     if (!appsFromFile) {
        //         throw new Error(`EXCEL APP IMPORT: Can't find sheet ${options.sheetName} in file ${options.fileName}`);
        //     }

        //     // Is there an import limit specified?
        //     // If so only include the first --limit-import-count tasks
        //     if (parseInt(options.limitImportCount, 10) > 0) {
        //         // Get positions of column headers
        //         const colHeaders = getAppColumnPosFromHeaderRow(appsFromFile.data[0]);

        //         const limitedApps = appsFromFile.data.filter((app) => {
        //             // Are we on header line?
        //             if (app[colHeaders.appCounter.pos] === colHeaders.appCounter.name) {
        //                 // This is the header
        //                 return true;
        //             }

        //             // Only keep first x tasks
        //             if (app[colHeaders.appCounter.pos] <= parseInt(options.limitImportCount, 10)) {
        //                 return true;
        //             }
        //             return false;
        //         });

        //         // Copy limited set of tasks to original variable that will be used during task import
        //         appsFromFile.data = [];
        //         appsFromFile.data.push(...limitedApps);
        //     }

        //     // All definitions now loaded from source file
        //     const qlikSenseApps = new QlikSenseApps();
        //     await qlikSenseApps.init(options);

        //     // Import apps specified in Excel file
        //     const importedApps = await qlikSenseApps.importAppsFromFiles(appsFromFile, tagsExisting, cpExisting);
        //     logger.debug(`Imported apps:\n${JSON.stringify(importedApps, null, 2)}`);
        // }
    } catch (err) {
        logger.error(`GET TASK: ${err.stack}`);
    }
};

module.exports = {
    exportAppToFile,
};
