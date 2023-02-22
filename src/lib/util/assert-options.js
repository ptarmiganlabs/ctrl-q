const path = require('path');
const uuidVersion = require('uuid').version;
const uuidValidate = require('uuid').validate;

const { logger, execPath, verifyFileExists } = require('../../globals');

const sharedParamAssertOptions = async (options) => {
    // Ensure that parameters common to all commands are valid
    if (options.authType === undefined || !options.authType) {
        logger.error('Mandatory option --auth-type is missing. Use it to specify how authorization with Qlik Sense will be done.');
        process.exit(1);
    }

    // Verify that certificate files exists (if specified)
    const fileCert = path.resolve(execPath, options.authCertFile);
    const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

    const fileCertExists = await verifyFileExists(fileCert);
    if (fileCertExists === false) {
        logger.error(`Missing certificate key file ${fileCert}. Aborting`);
        process.exit(1);
    } else {
        logger.verbose(`Certificate file ${fileCert} found`);
    }

    const fileCertKeyExists = await verifyFileExists(fileCertKey);
    if (fileCertKeyExists === false) {
        logger.error(`Missing certificate key file ${fileCertKey}. Aborting`);
        process.exit(1);
    } else {
        logger.verbose(`Certificate key file ${fileCertKey} found`);
    }
};

const userActivityCustomPropertyAssertOptions = (options) => {
    const newOptions = options;

    // If certificate authentication is used: certs and user dir/id must be present.
    if (options.authType === 'cert' && (!options.authUserDir || !options.authUserId)) {
        logger.error('User directory and user ID are mandatory options when using certificate for authenticating with Sense');
        process.exit(1);
    }

    // Ensure activity buckets are all integers
    newOptions.activityBuckets = options.activityBuckets.map((item) => parseInt(item, 10));
    logger.verbose(`User activity buckets: ${options.activityBuckets}`);

    // Sort activity buckets
    options.activityBuckets.sort((a, b) => a - b);
    return newOptions;
};

const masterItemImportAssertOptions = (options) => {
    if (options.colRefBy === undefined || !options.colRefBy) {
        logger.error(
            'Mandatory option --col-ref-by is missing. Use it to specify how Excel file columns are referenced (by name or position)'
        );
        process.exit(1);
    }
};

const masterItemMeasureDeleteAssertOptions = (options) => {
    // Make sure options are valid for deleting master measures

    // Either --delete-all OR (--id-type and --master-item) should be specified
    if (options.deleteAll === undefined && options.idType === undefined && options.masterItem === undefined) {
        logger.error('Mandatory options missing.\nEither --delete-all should be specified, or both of --id-type and --master-item');
        process.exit(1);
    }

    if (options.deleteAll === undefined) {
        if (options.idType === undefined) {
            logger.error('Mandatory options --id-type missing.');
            process.exit(1);
        } else if (options.masterItem === undefined) {
            logger.error('Mandatory options --master-item missing.');
            process.exit(1);
        }
    }

    // Make sure not *both* --delete-all AND (--id-type and --master-item) are specified
    if (options.deleteAll !== undefined && options.idType !== undefined && options.masterItem !== undefined) {
        logger.error('Invalid combination of options.\nUse either --delete-all OR --id-type/--master-item.');
        process.exit(1);
    }
};

const masterItemDimDeleteAssertOptions = (options) => {
    // Make sure options are valid for deleting master dimensions

    // Either --delete-all OR (--id-type and --master-item) should be specified
    if (options.deleteAll === undefined && options.idType === undefined && options.masterItem === undefined) {
        logger.error('Mandatory options missing.\nEither --delete-all should be specified, or both of --id-type and --master-item');
        process.exit(1);
    }

    if (options.deleteAll === undefined) {
        if (options.idType === undefined) {
            logger.error('Mandatory options --id-type missing.');
            process.exit(1);
        } else if (options.masterItem === undefined) {
            logger.error('Mandatory options --master-item missing.');
            process.exit(1);
        }
    }

    // Make sure not *both* --delete-all AND (--id-type and --master-item) are specified
    if (options.deleteAll !== undefined && options.idType !== undefined && options.masterItem !== undefined) {
        logger.error('Invalid combination of options.\nUse either --delete-all OR --id-type/--master-item.');
        process.exit(1);
    }
};

// eslint-disable-next-line no-unused-vars
const masterItemGetAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
const getScriptAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
const getBookmarkAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
const getTaskAssertOptions = (options) => {
    // --task-id and --task-tag only allowed for task tables, not trees
    if (options.taskId || options.taskTag) {
        if (options.outputFormat === 'tree') {
            logger.error('Task tree view is not supported when specifying task IDs and/or task tags. Exiting.');
            process.exit(1);
        }

        // Verify all task IDs are valid uuids
        if (options.taskId) {
            // eslint-disable-next-line no-restricted-syntax
            for (const taskId of options.taskId) {
                if (!uuidValidate(taskId)) {
                    logger.error(`Invalid format of task ID parameter "${taskId}". Exiting.`);
                    process.exit(1);
                } else {
                    logger.verbose(`Task id "${taskId}" is a valid uuid version ${uuidVersion(taskId)}`);
                }
            }
        }
    }

    // --table-details not allowed when --output-format is set to tree.
    if (options.outputFormat === 'tree' && options.tableDetails) {
        logger.error(`--table-details not allowed when --output-format is set to tree. Exiting.`);
        process.exit(1);
    }

    // --tree-details not allowed when --output-format is set to table.
    if (options.outputFormat === 'table' && options.treeDetails) {
        logger.error(`--tree-details not allowed when --output-format is set to table. Exiting.`);
        process.exit(1);
    }
};

// eslint-disable-next-line no-unused-vars
const setTaskCustomPropertyAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
const taskImportAssertOptions = (options) => {
    // If --import-app is specified, the import file type must be Excel
    if (options.importApp && options.fileType !== 'excel') {
        logger.error(
            `Invalid combination of options.\nFile type must be "excel" when importing apps as part of task import.\nCurrent value for --file-type is "${options.fileType}"`
        );
        process.exit(1);
    }

    // If --import-app is specified, a sheet name must also be specified via --import-app-sheet-name option
    if (options.importApp && (options.importAppSheetName === undefined || options?.importAppSheetName.length === 0)) {
        logger.error(
            `Invalid combination of options.\nWhen using --import-app you must also specify a sheet name in the Excel file where app definitions are found, i.e. the --import-app-sheet-name option."`
        );
        process.exit(1);
    }

    // If --file-type is excel: --sheet-name is required
    if (options.fileType === 'excel' && options.sheetName === undefined) {
        logger.error('Invalid combination of options.\nWhen importing from Excel file you must also specify the --sheet-name option.');
        process.exit(1);
    }
};

// eslint-disable-next-line no-unused-vars
const appImportAssertOptions = (options) => {
    //
};

module.exports = {
    sharedParamAssertOptions,
    userActivityCustomPropertyAssertOptions,
    masterItemImportAssertOptions,
    masterItemMeasureDeleteAssertOptions,
    masterItemDimDeleteAssertOptions,
    masterItemGetAssertOptions,
    getScriptAssertOptions,
    getBookmarkAssertOptions,
    getTaskAssertOptions,
    setTaskCustomPropertyAssertOptions,
    taskImportAssertOptions,
    appImportAssertOptions,
};
