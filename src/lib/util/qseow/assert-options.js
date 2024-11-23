import { version as uuidVersion, validate as uuidValidate } from 'uuid';

import { logger, execPath, verifyFileSystemExists } from '../../../globals.js';
import { getCertFilePaths } from '../qseow/cert.js';

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

        // Get certificate paths
        const { fileCert, fileCertKey, fileCertCA } = getCertFilePaths(options);

        const fileCertExists = await verifyFileSystemExists(fileCert);
        if (fileCertExists === false) {
            logger.error(`Missing certificate file ${fileCert}. Aborting`);
            process.exit(1);
        } else {
            logger.verbose(`Certificate file ${fileCert} found`);
        }

        const fileCertKeyExists = await verifyFileSystemExists(fileCertKey);
        if (fileCertKeyExists === false) {
            logger.error(`Missing certificate key file ${fileCertKey}. Aborting`);
            process.exit(1);
        } else {
            logger.verbose(`Certificate key file ${fileCertKey} found`);
        }

        const fileCertCAExists = await verifyFileSystemExists(fileCertCA);
        if (fileCertCAExists === false) {
            logger.error(`Missing certificate CA file ${fileCertCA}. Aborting`);
            process.exit(1);
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

export const masterItemGetAssertOptions = (options) => {
    //
};

export const getScriptAssertOptions = (options) => {
    //
};

export const getBookmarkAssertOptions = (options) => {
    //
};

export const getTaskAssertOptions = (options) => {
    // ---task-id and --task-tag only allowed for task tables, not trees
    if (options.taskId || options.taskTag) {
        if (options.outputFormat === 'tree') {
            logger.error('Task tree view is not supported when using --task-id or --task-tag. Exiting.');
            process.exit(1);
        }

        // Verify all task IDs are valid uuids
        if (options.taskId) {
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

export const setTaskCustomPropertyAssertOptions = (options) => {
    //
};

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

export const appImportAssertOptions = (options) => {
    //
};

// Assert that values in Excel sheet are valid
export const appImportAssertExcelSheet = (options) => {
    //
};

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

export const getSessionsAssertOptions = (options) => {
    //
};

export const deleteSessionsAssertOptions = (options) => {
    //
};

export const userActivityBucketsCustomPropertyAssertOptions = (options) => {
    // Verify that custom property name only contains letters, numbers and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(options.customPropertyName)) {
        logger.error(`Invalid custom property name "${options.customPropertyName}". Only letters, numbers and underscores are allowed.`);
        process.exit(1);
    }
};

export async function qseowScrambleFieldAssertOptions(options) {
    // Rules for options:
    // - --new-app-publish: Publish the scrambled app to a stream. Optional.
    //   - If true, --new-app-publish-stream-id and --new-app-publish-stream-name options are used to determine which stream to publish to. Exactly one of those options must be present in this case.
    // --new-app-publish-stream-id: Stream to which the scrambled app will be published. Default is ''.
    // --new-app-publish-stream-name: Stream to which the scrambled app will be published. Default is ''. If more than one stream matches this name an error is returned.
    // --new-app-publish-replace: Do a publish-replace using the scrambled app as source. Optional.
    //   - If true, The --new-app-publish-replace-app-id and --new-app-publish-replace-app-name options are used to determine which published app should be replaced. Exactly one of those two options must be present in this case.
    // - --new-app-publish-replace-app-id: App ID for published app that will be replaced by newly created scrambled app. Default is ''.
    // - --new-app-publish-replace-app-name: App name of published app that will be replaced by newly created scrambled app. Default is ''. If more than one published app matches this name an error is returned.
    // - --new-app-delete-existing-unpublished:
    //   - If true, all unpublished apps (irrespective of owner) matching the app name passed in --new-app-name will be deleted before the source app is copied and scrambled.
    // - --new-app-delete: Once all other activities are done, delete the newly created scrambled app.
    // - --force: Do not ask for acknowledgment before deleting or replacing existing apps.

    // --new-app-publish: Publish the scrambled app to a stream. Optional.

    // Variable to keep track of whether options are valid
    let validOptions = true;

    if (options.newAppPublish) {
        // Neither of --new-app-publish-stream-id or --new-app-publish-stream-name are non-empty strings, exit
        if (options.newAppPublishStreamId === '' && options.newAppPublishStreamName === '') {
            logger.error(
                'When --new-app-publish is true, exactly one of --new-app-publish-stream-id or --new-app-publish-stream-name must be present.'
            );
            validOptions = false;
        }

        // If both --new-app-publish-stream-id and --new-app-publish-stream-name are non-empty strings, exit
        if (options.newAppPublishStreamId !== '' && options.newAppPublishStreamName !== '') {
            logger.error(
                'When --new-app-publish is true, exactly one of --new-app-publish-stream-id or --new-app-publish-stream-name must be present.'
            );
            validOptions = false;
        }

        // If --new-app-publish-stream-id is a non-empty string, it must be a valid uuid
        if (options.newAppPublishStreamId !== '' && !uuidValidate(options.newAppPublishStreamId)) {
            logger.error(`Invalid format of stream ID "${options.newAppPublishStreamId}".`);
            validOptions = false;
        }

        // If --new-app-publish-stream-name is a non-empty string, it must not contain any special characters
        if (options.newAppPublishStreamName !== '' && !/^[a-zA-Z0-9_]+$/.test(options.newAppPublishStreamName)) {
            logger.error(`Invalid stream name "${options.newAppPublishStreamName}". Only letters, numbers and underscores are allowed.`);
            validOptions = false;
        }

        // If --new-app-publish-stream-name is a non-empty string, it must exist in the Qlik Sense environment
        if (options.newAppPublishStreamName !== '') {
            // TODO: Implement this check
            //     const stream = await global.getStream(options.newAppPublishStreamName);
            //     if (stream === null) {
            //         logger.error(`Stream "${options.newAppPublishStreamName}" does not exist in the Qlik Sense environment.`);
            //         validOptions = false;
            //     }
        }
    }

    // --new-app-publish-replace: Do a publish-replace using the scrambled app as source. Optional.
    if (options.newAppPublishReplace) {
        // Neither of --new-app-publish-replace-app-id or --new-app-publish-replace-app-name are non-empty strings, exit
        if (options.newAppPublishReplaceAppId === '' && options.newAppPublishReplaceAppName === '') {
            logger.error(
                'When --new-app-publish-replace is true, exactly one of --new-app-publish-replace-app-id or --new-app-publish-replace-app-name must be present.'
            );
            validOptions = false;
        }

        // If both --new-app-publish-replace-app-id and --new-app-publish-replace-app-name are non-empty strings, exit
        if (options.newAppPublishReplaceAppId !== '' && options.newAppPublishReplaceAppName !== '') {
            logger.error(
                'When --new-app-publish-replace is true, exactly one of --new-app-publish-replace-app-id or --new-app-publish-replace-app-name must be present.'
            );
            validOptions = false;
        }

        // If --new-app-publish-replace-app-id is a non-empty string, it must be a valid uuid
        if (options.newAppPublishReplaceAppId !== '' && !uuidValidate(options.newAppPublishReplaceAppId)) {
            logger.error(`Invalid format of app ID "${options.newAppPublishReplaceAppId}".`);
            validOptions = false;
        }

        // If --new-app-publish-replace-app-name is a non-empty string, that app must exist in the Qlik Sense environment and be published
        if (options.newAppPublishReplaceAppName !== '') {
            // TODO: Implement this check
        }
    }

    // --new-app-delete-existing-unpublished: If true, all unpublished apps (irrespective of owner) matching the app name passed in --new-app-name will be deleted before the source app is copied and scrambled.
    if (options.newAppDeleteExistingUnpublished) {
        // --new-app-delete-existing-unpublished is true, but --new-app-name is not a non-empty string
        if (options.newAppName === '') {
            logger.error('When --new-app-delete-existing-unpublished is true, --new-app-name must be a non-empty string.');
            validOptions = false;
        }
    }

    if (validOptions === false) {
        logger.error('Invalid options, exiting.');
        process.exit(1);
    }
}
