import path from 'path';
import { version as uuidVersion, validate as uuidValidate } from 'uuid';
import { logger, execPath, verifyFileExists } from '../../../globals.js';

export const qseowSharedParamAssertOptions = async (options) => {
    // Ensure that parameters common to all commands are valid
    if (options.authType === undefined || !options.authType) {
        logger.error('Mandatory option --auth-type is missing. Use it to specify how authorization with Qlik Sense will be done.');
        process.exit(1);
    }

    // Debug
    logger.debug(`Auth type: ${options.authType}`);
    logger.debug(`execPath: ${execPath}`);
    logger.debug(`authCertFile: ${options.authCertFile}`);
    logger.debug(`authCertKeyFile: ${options.authCertKeyFile}`);

    // If certificate authentication is used: certs and user dir/id must be present.
    if (options.authType === 'cert') {
        // Verify that certificate files exists (if specified)
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        const fileCertExists = await verifyFileExists(fileCert);
        if (fileCertExists === false) {
            logger.error(`Missing certificate file ${fileCert}. Aborting`);
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
    } else if (options.authType === 'jwt') {
        // Verify that --auth-jwt parameter is specified
        if (options.authJwt === undefined || !options.authJwt) {
            logger.error('Mandatory option --auth-jwt is missing. Use it to specify the JWT token to use for authentication.');
            process.exit(1);
        }
    }
};

export const userActivityCustomPropertyAssertOptions = (options) => {
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

export const masterItemImportAssertOptions = (options) => {
    if (options.colRefBy === undefined || !options.colRefBy) {
        logger.error(
            'Mandatory option --col-ref-by is missing. Use it to specify how Excel file columns are referenced (by name or position)'
        );
        process.exit(1);
    }
};

export const masterItemMeasureDeleteAssertOptions = (options) => {
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

export const masterItemDimDeleteAssertOptions = (options) => {
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
export const masterItemGetAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
export const getScriptAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
export const getBookmarkAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
export const getTaskAssertOptions = (options) => {
    // ---task-id and --task-tag only allowed for task tables, not trees
    if (options.taskId || options.taskTag) {
        if (options.outputFormat === 'tree') {
            logger.error('Task tree view is not supported when using --task-id or --task-tag. Exiting.');
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

    // Abort if --task-type has been specified when output format is tree
    if (options.outputFormat === 'tree' && options.taskType) {
        logger.error('Task tree view is not supported when using --task-type. Exiting.');
        process.exit(1);
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

    // If:
    // - options.tableDetails is an array
    // - and --table-detail "comptimeconstraint" or "comprule" are set
    //
    // then --table-detail "compositetrigger" must also be present.

    // Ensure options.tableDetails is an array
    if (
        options.tableDetails &&
        !Array.isArray(options.tableDetails) &&
        (options?.tableDetails?.find((item) => item === 'comptimeconstraint') ||
            options?.tableDetails?.find((item) => item === 'comprule')) &&
        !options?.tableDetails?.find((item) => item === 'compositetrigger')
    ) {
        logger.error(
            `--table-details "compositetrigger" must be present when using --table-detail "comptimeconstraint" or "comprule". Exiting.`
        );
        process.exit(1);
    }
};

// eslint-disable-next-line no-unused-vars
export const setTaskCustomPropertyAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
export const taskImportAssertOptions = (options) => {
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
export const appImportAssertOptions = (options) => {
    //
};

// Assert that values in Excel sheet are valid
export const appImportAssertExcelSheet = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
export const appExportAssertOptions = async (options) => {
    // Verify output directory exists
    // const outputDir = mergeDirFilePath([options.outputDir]);
    // const existsOutputDir = await fs.promises.access(outputDir);
    // if (!existsOutputDir) {
    //     logger.error(`The specified output directory "${options.outputDir}" resolves to "${outputDir}", which does not exist. Exiting.`);
    //     process.exit(1);
    // }
};

export const variableGetAssertOptions = (options) => {
    // Make sure options are valid for getting variables
    // At least one app specified?
    if (options.appId === undefined && options.appTag === undefined) {
        logger.error('No app IDs or app tags specified. Exiting.');
        process.exit(1);
    }
};

export const variableDeleteAssertOptions = (options) => {
    // Make sure options are valid for deleting variables

    // At least one app specified?
    if (options.appId === undefined && options.appTag === undefined) {
        logger.error('No app IDs or app tags specified. Exiting.');
        process.exit(1);
    }

    // Either --delete-all OR (--id-type and --variable) should be specified
    if (options.deleteAll === undefined && options.idType === undefined && options.variable === undefined) {
        logger.error('Mandatory options missing.\nEither --delete-all should be specified, or both of --id-type and --variable');
        process.exit(1);
    }

    if (options.deleteAll === undefined) {
        if (options.idType === undefined) {
            logger.error('Mandatory options --id-type missing.');
            process.exit(1);
        } else if (options.variable === undefined) {
            logger.error('Mandatory options --variable missing.');
            process.exit(1);
        }
    }

    // Make sure not *both* --delete-all AND (--id-type and --variable) are specified
    if (options.deleteAll !== undefined && options.idType !== undefined && options.variable !== undefined) {
        logger.error('Invalid combination of options.\nUse either --delete-all or both of --id-type and --variable.');
        process.exit(1);
    }
};

// eslint-disable-next-line no-unused-vars
export const getSessionsAssertOptions = (options) => {
    //
};

// eslint-disable-next-line no-unused-vars
export const deleteSessionsAssertOptions = (options) => {
    //
};
