const xlsx = require('node-xlsx').default;

const { logger, setLoggingLevel, isPkg, execPath, verifyFileExists } = require('../../globals');
const { QlikSenseTasks } = require('../task/class_alltasks');

const importTaskFromFile = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info(`Import tasks from definitions in file "${options.fileName}"`);
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Verify file exists
        const taskFileExists = await verifyFileExists(options.fileName);
        if (taskFileExists === false) {
            logger.error(`Missing task file "${options.fileName}". Aborting`);
            process.exit(1);
        } else {
            logger.verbose(`Task file "${options.fileName}" found`);
        }

        let tasksFromFile = null;
        if (options.fileType === 'csv') {
            //
        } else if (options.fileType === 'excel') {
            // Parse Excel file
            const workSheetsFromFile = xlsx.parse(options.fileName);

            tasksFromFile = workSheetsFromFile.find((item) => item.name === options.sheetName);
            if (!tasksFromFile) {
                // logger.error(`EXCEL IMPORT: Can't find sheet ${options.sheetName} in file ${options.fileName}`);
                throw new Error(`EXCEL IMPORT: Can't find sheet ${options.sheetName} in file ${options.fileName}`);
            }
        }
        // All definitions now loaded from source file

        // Set up new reload task object
        const qlikSenseTasks = new QlikSenseTasks();
        await qlikSenseTasks.init(options);
        const taskList = await qlikSenseTasks.getTaskModelFromFile(tasksFromFile);
        // qlikSenseTasks.getTaskModelFromFile(tasksFromFile);
        // await qlikSenseTasks.saveTaskModelToQseow();
        // qlikSenseTasks.saveTaskModelToQseow();

        // How should the task model be used?
        // Send to Sense, view as table, view as tree
    } catch (err) {
        logger.error(`GET TASK: ${err.stack}`);
    }
};

module.exports = {
    importTaskFromFile,
};
