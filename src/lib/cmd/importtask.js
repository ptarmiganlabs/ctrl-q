const xlsx = require('node-xlsx').default;
const { parse } = require('csv-parse');
// const { parse } = require('csv-parse/lib/sync');
const fs = require('fs');
// const fsp = require('fs').promises;

const { finished } = require('stream/promises');

const { logger, setLoggingLevel, isPkg, execPath, verifyFileExists, isNumeric } = require('../../globals');
const { QlikSenseTasks } = require('../task/class_alltasks');
const { QlikSenseApps } = require('../app/class_allapps');
const { getTaskColumnPosFromHeaderRow } = require('../util/lookups');
const { getTagsFromQseow } = require('../util/tag');
const { getCustomPropertiesFromQseow } = require('../util/customproperties');

const getHeaders = async (options) => {
    const records = [];
    const parser = fs.createReadStream(options.fileName).pipe(
        parse({
            info: true,
            to_line: 1,
        })
    );
    parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
            // Work with each record
            records.push(record);
        }
    });
    await finished(parser);
    return records;
};

const processCsvFile = async (options) => {
    // First get header row

    // const parser = parse({
    //     delimiter: ',',
    //     info: true,
    //     // to_line: 1,
    // });

    // const parser = fs.createReadStream(options.fileName).pipe(
    //     parse({
    //         info: true,
    //         to_line: 1,
    //     }).pipe(process.stdout)
    // );

    const headers = await getHeaders(options);

    // const headers = fs.createReadStream(options.fileName).pipe(parser).pipe(process.stdout);

    // const content = await fsp.readFile(options.fileName);

    // Parse the CSV content
    // const headers = parse(content, { bom: true, to_line: 1 });

    const headerRow = [];

    // Push all column headers to array
    // eslint-disable-next-line no-restricted-syntax
    for (const record of headers) {
        // Get each column header text
        headerRow.push(record.record);
    }
    // // eslint-disable-next-line no-restricted-syntax
    // for await (const record of headers) {
    //     // for await (const record of parser) {
    //     // Get each column header text
    //     headerRow.push(record.record);
    // }

    // Get positions of column headers
    const colHeaders = getTaskColumnPosFromHeaderRow(headerRow[0]);

    const records = [];
    const parser = fs.createReadStream(options.fileName).pipe(
        parse({
            info: true,
            skip_empty_lines: true,
            cast(value, context) {
                // Ensure all data read from CSV file has valid types and values
                // Cast strings to numbers where applicable, etc
                if (context.lines === 1) {
                    // We're in the header row
                    return value;
                }

                // "Task counter" column. Should be integer
                if (context.column === colHeaders.taskCounter.pos) {
                    if (typeof value !== 'string' || !isNumeric(value)) {
                        logger.error(`PARSING CSV: Column "${colHeaders.taskCounter.name}" contains a non-integer value. Exiting.`);
                        process.exit(1);
                    } else {
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.taskEnabled.pos) {
                    // 0, 1 or empty
                    if (typeof value !== 'string' || !(value === '0' || value === '1' || value.trim() === '')) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.taskEnabled.name}" should be 0, 1 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value === '1') {
                            return true;
                        }
                        if (value === '0' || value.trim() === '') {
                            return false;
                        }
                    }
                }
                if (context.column === colHeaders.taskSessionTimeout.pos) {
                    // Integer greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) > 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.taskSessionTimeout.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.taskMaxRetries.pos) {
                    // Integer equal to or greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) >= 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.taskMaxRetries.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.isPartialReload.pos) {
                    // 0, 1 or empty
                    if (typeof value !== 'string' || !(value === '0' || value === '1' || value.trim() === '')) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.isPartialReload.name}" should be 0, 1 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value === '1') {
                            return true;
                        }
                        if (value === '0' || value.trim() === '') {
                            return false;
                        }
                    }
                }
                if (context.column === colHeaders.isManuallyTriggered.pos) {
                    // 0, 1 or empty
                    if (typeof value !== 'string' || !(value === '0' || value === '1' || value.trim() === '')) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.isManuallyTriggered.name}" should be 0, 1 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value === '1') {
                            return true;
                        }
                        if (value === '0' || value.trim() === '') {
                            return false;
                        }
                    }
                }
                if (context.column === colHeaders.eventCounter.pos) {
                    // Integer greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) > 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.eventCounter.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.eventEnabled.pos) {
                    // 0, 1 or empty
                    if (typeof value !== 'string' || !(value === '0' || value === '1' || value.trim() === '')) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.eventEnabled.name}" should be 0, 1 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value === '1') {
                            return true;
                        }
                        if (value === '0' || value.trim() === '') {
                            return false;
                        }
                    }
                }
                if (context.column === colHeaders.timeConstraintSeconds.pos) {
                    // Integer equal to or greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) >= 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.timeConstraintSeconds.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.timeConstraintMinutes.pos) {
                    // Integer equal to or greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) >= 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.timeConstraintMinutes.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.timeConstraintHours.pos) {
                    // Integer equal to or greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) >= 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.timeConstraintHours.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.timeConstraintDays.pos) {
                    // Integer equal to or greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) >= 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.timeConstraintDays.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }
                if (context.column === colHeaders.ruleCounter.pos) {
                    // Integer greater than 0 or empty
                    if (
                        typeof value !== 'string' ||
                        (value.trim().length > 0 && !isNumeric(value)) ||
                        !(parseInt(value, 10) > 0 || value.trim() === '')
                    ) {
                        logger.error(
                            `PARSING CSV: Column "${colHeaders.ruleCounter.name}" should be greather than 0 or empty. Current value is "${value}". Exiting.`
                        );
                        process.exit(1);
                    } else {
                        if (value.trim() === '') {
                            return '';
                        }
                        return parseInt(value, 10);
                    }
                }

                return value;
            },
        })
    );

    // eslint-disable-next-line no-restricted-syntax
    for await (const record of parser) {
        // ALways add the header line
        if (record.info.lines === 1) {
            // Header row
            records.push(record.record);
        } else if (parseInt(options.limitImportCount, 10) > 0) {
            // Is there an import limit specified?
            if (record.record[colHeaders.taskCounter.pos] <= parseInt(options.limitImportCount, 10)) {
                records.push(record.record);
            }
        } else {
            records.push(record.record);
        }
    }

    return records;
};

const importTaskFromFile = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Import tasks from definitions in file "${options.fileName}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get all tags
        const tagsExisting = await getTagsFromQseow(options);

        // Get all custom properties
        const cpExisting = await getCustomPropertiesFromQseow(options);

        // Verify task definitions file exists
        const taskFileExists = await verifyFileExists(options.fileName);
        if (taskFileExists === false) {
            logger.error(`Missing task file "${options.fileName}". Aborting`);
            process.exit(1);
        } else {
            logger.verbose(`Task file "${options.fileName}" found`);
        }

        let tasksFromFile = null;
        let appsFromFile = null;

        if (options.fileType === 'csv') {
            // Parse CSV file
            const tmpTasksFromFile = await processCsvFile(options);
            if (tmpTasksFromFile) {
                // Some tasks were read from CSV.
                // Build data structure to be used by later parts of the script
                tasksFromFile = {
                    name: 'Ctrl-Q task import from CSV',
                    data: [],
                };

                // eslint-disable-next-line no-restricted-syntax
                for (const item of tmpTasksFromFile) {
                    tasksFromFile.data.push(item);
                }
            }

            // All columns read from the CSV will be strings.
            // Convert columns that should be integers to just that. Also ensure all values are valid numbers.
        } else if (options.fileType === 'excel') {
            // Parse Excel file
            const workSheetsFromFile = xlsx.parse(options.fileName);

            // Verify that task definitions sheet exists
            tasksFromFile = workSheetsFromFile.find((item) => item.name === options.sheetName);
            if (!tasksFromFile) {
                throw new Error(`EXCEL IMPORT: Can't find sheet ${options.sheetName} in file ${options.fileName}`);
            }

            // Is there an import limit specified?
            // If so only include the first --limit-import-count tasks
            if (parseInt(options.limitImportCount, 10) > 0) {
                // Get positions of column headers
                const colHeaders = getTaskColumnPosFromHeaderRow(tasksFromFile.data[0]);

                const limitedTasks = tasksFromFile.data.filter((task) => {
                    // Are we on header line?
                    if (task[colHeaders.taskCounter.pos] === colHeaders.taskCounter.name) {
                        // This is the header
                        return true;
                    }

                    // Only keep first x tasks
                    if (task[colHeaders.taskCounter.pos] <= parseInt(options.limitImportCount, 10)) {
                        return true;
                    }
                    return false;
                });

                // Copy limited set of tasks to original variable that will be used during task import
                tasksFromFile.data = [];
                tasksFromFile.data.push(...limitedTasks);
            }

            // If apps should be imported: Verify that app import sheet exists
            if (options.importApp) {
                appsFromFile = workSheetsFromFile.find((item) => item.name === options.importAppSheetName);
                if (!appsFromFile) {
                    throw new Error(`EXCEL IMPORT: Can't find sheet ${options.importAppSheetName} in file ${options.fileName}`);
                }
            }
        }

        // All definitions now loaded from source file
        let importedApps;

        if (options.importApp) {
            // If apps should be imported that's the should be done before tasks are imported
            const qlikSenseApps = new QlikSenseApps();
            await qlikSenseApps.init(options);

            // Import apps specified in Excel file
            importedApps = await qlikSenseApps.importAppsFromFiles(appsFromFile, tagsExisting, cpExisting);
        }

        // Set up new reload task object
        const qlikSenseTasks = new QlikSenseTasks();
        await qlikSenseTasks.init(options, importedApps);
        const taskList = await qlikSenseTasks.getTaskModelFromFile(tasksFromFile, tagsExisting, cpExisting);
    } catch (err) {
        logger.error(`IMPORT TASK: ${err.stack}`);
    }
};

module.exports = {
    importTaskFromFile,
};
