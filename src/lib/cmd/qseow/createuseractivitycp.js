import axios from 'axios';

import { logger, setLoggingLevel, isSea, execPath, sleep } from '../../../globals.js';
import { setupQrsConnection } from '../../util/qseow/qrs.js';
import { catchLog } from '../../util/log.js';
import {
    getUserActivityProfessional,
    getUserActivityAnalyzer,
    getUserActivityAnalyzerTime,
    getUserActivityLogin,
    getUserActivityUser,
    getUsersLastActivity,
} from './useractivity.js';
import { getCustomPropertiesFromQseow, createCustomProperty, updateCustomProperty } from '../../util/qseow/customproperties.js';

const _MS_PER_DAY = 1000 * 60 * 60 * 24;

// a and b are javascript Date objects
function dateDiffInDays(a, b) {
    // Discard the time and time-zone information.
    const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

/**
 * Function to create custom property for tracking user activity in QMC.
 *
 * - User activity is tracked based on the number of days since the user last logged in.
 *   - This information is available via QRS API /license/<access license type>/full
 *   - Possible access license types are:
 *     - professionalaccesstype
 *     - analyzeraccesstype
 *     - analyzertimeaccesstype
 *     - loginaccesstype
 *     - useraccesstype
 * - A custom property will be set to users based on the number of days since the user last logged in.
 * - For example, if the user last logged in 3 days ago, the custom property will be set to 3.
 * - The custom property will be created with the name passed in via the command line.
 * - The custom property will have a set of allowed values, specified via the command line (or as default values if not specified).
 * - Certificate or JWT authentication is used to connect to the Qlik Sense repository service (QRS).
 *
 * General steps:
 * - Check if the custom property already exists in QMC
 *   - If it does not exist, create it
 *   - If it does exist, check if the allowed values are the same as the ones passed in via the command line
 *     - If they are different, show a warning and do nothing, unless the --force parameter equals true
 *       - If --force equals true, delete the existing custom property and create a new one using data from the command line
 *     - If they are the same, show an info message and continue
 * - Get user activity for each access license type enabled via the command line option --license-type
 *   - Filter QRS call on
 *     - users' user directory, if specified via the command line
 *     - users' tag(s), if specified via the command line (future feature)
 *     - users' custom property value(s), if specified via the command line (future feature)
 * - Get user activity for each user. How many days ago was the user last active?
 *   - Calculate activity buckets for all users (matching command line filters) before writing back to QRS
 * - Update users in QRS with the user activity custom property value
 *   - Update batches of users using the QRS API endpoint POST /user/many
 *   - Batch size determined by command line parameter --update-batch-size
 *   - Wait for a short time between each batch, to avoid overloading the QRS. Delay is determined by command line parameter --update-batch-sleep
 *
 * If the process above fails at some point, show an error message and return with false.
 * @param {*} options
 */
export async function createUserActivityBucketsCustomProperty(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('== Step 1: Create custom property for tracking user activity in QMC');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Sort activity buckets passed via command line in ascending order
        // When creating new or updating existing custom property, the allowed values should be sorted in ascending order
        const activityBucketsSorted = options.activityBuckets.sort((a, b) => a - b);

        // Get custom properties from QSEoW
        let customProperties = await getCustomPropertiesFromQseow(options);
        logger.info(`  Successfully retrieved ${customProperties.length} custom properties from QSEoW`);

        // Does the custom property already exist in QMC?
        let customPropertyExisting = customProperties.find((cp) => cp.name === options.customPropertyName);

        if (customPropertyExisting) {
            // A custom property with correct name already exists

            // Does the existing CP have *exactly* the same choice-values as passed in via command line?
            if (activityBucketsSorted.length === customPropertyExisting.choiceValues.length) {
                // Same number of custom property values. Are they the same and in same order?
                let keepExistingCustomProperty = true;

                for (let i = 0; i < activityBucketsSorted.length; i++) {
                    if (activityBucketsSorted[i] !== customPropertyExisting.choiceValues[i]) {
                        keepExistingCustomProperty = false;
                        break;
                    }
                }

                if (keepExistingCustomProperty) {
                    // Custom property already exists with the same allowed values, in the same order, as passed in via command line.
                    // Show info message and continue, no need to modify the existing custom property
                    logger.info(
                        `  Custom property "${options.customPropertyName}" already exists with the same allowed values as passed in via command line. No action needed.`
                    );
                } else {
                    logger.warn(
                        `Custom property already exists, but existing values are different from the ones passed in via command line.`
                    );
                    logger.warn(`Allowed values for existing custom property: ${customPropertyExisting.choiceValues}`);
                    logger.warn(`Allowed values (sorted ascending) passed in via command line: ${activityBucketsSorted}`);

                    // Do nothing, unless the --force parameter equals true
                    if (options.force === 'true' || options.force === true) {
                        // Force overwrite the existing custom property
                        logger.info(
                            `  Option "--force" specified, updating custom property ${options.customPropertyName} with new allowed values.`
                        );

                        // Update existing custom property
                        // First copy existing custom property to a new object, then replace the choiceValues with the new ones
                        const customPropertyDefinition = JSON.parse(JSON.stringify(customPropertyExisting));
                        customPropertyDefinition.choiceValues = activityBucketsSorted;

                        // Is it a dry run?
                        if (options.dryRun) {
                            logger.info(
                                `(${importCount}/${importLimit}) Dry run: Would have updated custom property "${options.customPropertyName}" with activity info`
                            );
                        } else {
                            const result = await updateCustomProperty(options, customPropertyDefinition);
                            if (result) {
                                logger.verbose(
                                    `  Updated existing custom property "${options.customPropertyName}" with new allowed values passed in via command line.`
                                );
                            } else {
                                logger.error(
                                    `Failed to update existing custom property "${options.customPropertyName}" with new allowed values.`
                                );
                                return false;
                            }
                        }
                    } else {
                        // Don't force overwrite the existing custom property.
                        // Show warning and return
                        logger.warn(`"--force" option not specified. Aborting.`);
                        return false;
                    }
                }
            } else {
                // Custom property exists, but has different number of values compared to command line options.
                // Do nothing unless the --force paramerer equals true
                if (options.force === 'false' || options.force === false || options.force === undefined) {
                    // Don't force overwrite the existni custom property.
                    // Show warning and return
                    logger.warn(
                        `Custom property "${options.customPropertyName}" already exists, but has different allowed values compared to the ones passed in via command line. Use the --force option to overwrite the existing custom property.`
                    );
                    logger.warn(`Use the --force option to overwrite the existing custom property.`);
                    return false;
                } else {
                    // Force replace the existing custom property
                    logger.verbose(`  Replacing custom property ${options.customPropertyName}`);

                    // Update existing custom property
                    // First copy existing custom property to a new object, then replace the choiceValues with the new ones
                    const customPropertyDefinition = JSON.parse(JSON.stringify(customPropertyExisting));
                    customPropertyDefinition.choiceValues = activityBucketsSorted;

                    // Is it a dry run?
                    if (options.dryRun) {
                        logger.info(
                            `(${importCount}/${importLimit}) Dry run: Would have updated custom property "${options.customPropertyName}" to have new activity bucket values.`
                        );
                    } else {
                        const result = await updateCustomProperty(options, customPropertyDefinition);
                        if (result) {
                            logger.verbose(
                                `  Updated existing custom property "${options.customPropertyName}" with new allowed values passed in via command line.`
                            );
                        } else {
                            logger.error(
                                `Failed to update existing custom property "${options.customPropertyName}" with new allowed values.`
                            );
                            return false;
                        }
                    }
                }
            }
        } else {
            // Custom property does not exist. Create it.

            // Create custom property definition/payload to QRS POST call
            const customPropertyDefinition = {
                valueType: 'Text',
                schemaPath: 'CustomPropertyDefinition',
                objectTypes: ['User'],
                name: options.customPropertyName,
                description: 'Ctrl-Q user activity bucket',
                choiceValues: activityBucketsSorted,
            };

            // Is it a dry run?
            if (options.dryRun) {
                logger.info(`(${importCount}/${importLimit}) Dry run: Would have created custom property "${options.customPropertyName}"`);
            } else {
                const result = await createCustomProperty(options, customPropertyDefinition);
                if (result) {
                    logger.verbose(`  Created custom property "${options.customPropertyName}"`);
                } else {
                    logger.error(`Failed to create custom property "${options.customPropertyName}"`);
                    return false;
                }
            }
        }

        // Get custom property again, as it has potentially been created or updated
        customProperties = await getCustomPropertiesFromQseow(options);

        // Does the custom property already exist in QMC?
        customPropertyExisting = customProperties.find((cp) => cp.name === options.customPropertyName);

        // Get user activity for each access license type enabled via the command line option --license-type
        // Filter QRS call on
        // - users' user directory, if specified via the command line
        // If user directory is not specified, no filtering on user directory will be done

        let activityAnalyzer = [];
        let activityAnalyzerTime = [];
        let activityLogin = [];
        let activityProfessional = [];
        let activityUser = [];

        logger.info('');
        logger.info(`== Step 2 : Getting user activity for each license type enabled via the command line...`);

        // Is "analyzer" license type enabled?
        if (options.licenseType.includes('analyzer')) {
            // Get user activity for analyzer license type
            // Array of objects:
            // {
            //     "privileges" : [ "privileges", "privileges" ],
            //     "quarantineEnd" : "2000-01-23T04:56:07.000+00:00",
            //     "schemaPath" : "schemaPath",
            //     "quarantined" : true,
            //     "deletedUserId" : "deletedUserId",
            //     "lastUsed" : "2000-01-23T04:56:07.000+00:00",
            //     "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //     "modifiedByUserName" : "modifiedByUserName",
            //     "deletedUserDirectory" : "deletedUserDirectory",
            //     "excess" : true,
            //     "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //     "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //     "user" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "userDirectory" : "userDirectory",
            //       "userDirectoryConnectorName" : "userDirectoryConnectorName",
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "userId" : "userId"
            //     }
            // }
            activityAnalyzer = await getUserActivityAnalyzer(options);
            logger.debug(`  Analyzer licenses: ${JSON.stringify(activityAnalyzer)}`);
        }

        // Is "analyzer-time" license type enabled?
        if (options.licenseType.includes('analyzer-time')) {
            // Get user activity for analyzer-time license type
            // Array of objects:
            // {
            //     "latestActivity" : "2000-01-23T04:56:07.000+00:00",
            //     "privileges" : [ "privileges", "privileges" ],
            //     "hostName" : "hostName",
            //     "sessions" : [ {
            //       "latestActivity" : "2000-01-23T04:56:07.000+00:00",
            //       "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //       "modifiedByUserName" : "modifiedByUserName",
            //       "schemaPath" : "schemaPath",
            //       "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "sessionID" : "sessionID",
            //       "serverNodeConfigurationId" : "serverNodeConfigurationId"
            //     }, {
            //       "latestActivity" : "2000-01-23T04:56:07.000+00:00",
            //       "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //       "modifiedByUserName" : "modifiedByUserName",
            //       "schemaPath" : "schemaPath",
            //       "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "sessionID" : "sessionID",
            //       "serverNodeConfigurationId" : "serverNodeConfigurationId"
            //     } ],
            //     "useStopTime" : "2000-01-23T04:56:07.000+00:00",
            //     "useStartTime" : "2000-01-23T04:56:07.000+00:00",
            //     "schemaPath" : "schemaPath",
            //     "serverNodeConfigurationId" : "serverNodeConfigurationId",
            //     "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //     "modifiedByUserName" : "modifiedByUserName",
            //     "analyzerTimeAccessType" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91"
            //     },
            //     "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //     "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //     "user" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "userDirectory" : "userDirectory",
            //       "userDirectoryConnectorName" : "userDirectoryConnectorName",
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "userId" : "userId"
            //     }
            // }
            activityAnalyzerTime = await getUserActivityAnalyzerTime(options);
            logger.debug(`  Analyzer time licenses: ${JSON.stringify(activityAnalyzerTime)}`);
        }

        // Is "login" license type enabled?
        if (options.licenseType.includes('login')) {
            // Get user activity for login license type
            // Array of objects:
            // {
            //     "latestActivity" : "2000-01-23T04:56:07.000+00:00",
            //     "privileges" : [ "privileges", "privileges" ],
            //     "hostName" : "hostName",
            //     "sessions" : [ {
            //       "latestActivity" : "2000-01-23T04:56:07.000+00:00",
            //       "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //       "modifiedByUserName" : "modifiedByUserName",
            //       "schemaPath" : "schemaPath",
            //       "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "sessionID" : "sessionID",
            //       "serverNodeConfigurationId" : "serverNodeConfigurationId"
            //     }, {
            //       "latestActivity" : "2000-01-23T04:56:07.000+00:00",
            //       "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //       "modifiedByUserName" : "modifiedByUserName",
            //       "schemaPath" : "schemaPath",
            //       "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "sessionID" : "sessionID",
            //       "serverNodeConfigurationId" : "serverNodeConfigurationId"
            //     } ],
            //     "useStopTime" : "2000-01-23T04:56:07.000+00:00",
            //     "useStartTime" : "2000-01-23T04:56:07.000+00:00",
            //     "schemaPath" : "schemaPath",
            //     "serverNodeConfigurationId" : "serverNodeConfigurationId",
            //     "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //     "loginAccessType" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91"
            //     },
            //     "modifiedByUserName" : "modifiedByUserName",
            //     "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //     "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //     "user" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "userDirectory" : "userDirectory",
            //       "userDirectoryConnectorName" : "userDirectoryConnectorName",
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "userId" : "userId"
            //     }
            // }
            activityLogin = await getUserActivityLogin(options);
            logger.debug(`  Login licenses: ${JSON.stringify(activityLogin)}`);
        }

        // Is "professional" license type enabled?
        if (options.licenseType.includes('professional')) {
            // Get user activity for professional license type
            // Array of objects:
            // {
            //     "privileges" : [ "privileges", "privileges" ],
            //     "quarantineEnd" : "2000-01-23T04:56:07.000+00:00",
            //     "schemaPath" : "schemaPath",
            //     "quarantined" : true,
            //     "deletedUserId" : "deletedUserId",
            //     "lastUsed" : "2000-01-23T04:56:07.000+00:00",
            //     "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //     "modifiedByUserName" : "modifiedByUserName",
            //     "deletedUserDirectory" : "deletedUserDirectory",
            //     "excess" : true,
            //     "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //     "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //     "user" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "userDirectory" : "userDirectory",
            //       "userDirectoryConnectorName" : "userDirectoryConnectorName",
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "userId" : "userId"
            //     }
            // }
            activityProfessional = await getUserActivityProfessional(options);
            logger.debug(`  Professional licenses: ${JSON.stringify(activityProfessional)}`);
        }

        // Is "user" license type enabled?
        if (options.licenseType.includes('user')) {
            // Get user activity for user license type
            // Array of objects:
            // {
            //     "lastUsed" : "2000-01-23T04:56:07.000+00:00",
            //     "privileges" : [ "privileges", "privileges" ],
            //     "createdDate" : "2000-01-23T04:56:07.000+00:00",
            //     "quarantineEnd" : "2000-01-23T04:56:07.000+00:00",
            //     "modifiedByUserName" : "modifiedByUserName",
            //     "deletedUserDirectory" : "deletedUserDirectory",
            //     "schemaPath" : "schemaPath",
            //     "modifiedDate" : "2000-01-23T04:56:07.000+00:00",
            //     "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //     "quarantined" : true,
            //     "user" : {
            //       "privileges" : [ "privileges", "privileges" ],
            //       "userDirectory" : "userDirectory",
            //       "userDirectoryConnectorName" : "userDirectoryConnectorName",
            //       "name" : "name",
            //       "id" : "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
            //       "userId" : "userId"
            //     },
            //     "deletedUserId" : "deletedUserId"
            // }
            activityUser = await getUserActivityUser(options);
            logger.debug(`  User licenses: ${JSON.stringify(activityUser)}`);
        }

        const usersLastActivity = await getUsersLastActivity(
            activityAnalyzer,
            activityAnalyzerTime,
            activityLogin,
            activityProfessional,
            activityUser
        );

        // Assign users to activity buckets
        logger.info('');
        logger.info(`== Step 3 : Calculate days since last activity for each user...`);

        for (const user of usersLastActivity) {
            // How many days ago was user active? Round down to nearest full day
            const dateNow = new Date();
            const dateUserLastActivity = new Date(user.lastUsed);
            const diffDays = dateDiffInDays(dateUserLastActivity, dateNow);

            for (const bucket of activityBucketsSorted) {
                // Assign user to activity bucket that is equal to or greater than the number of days since last activity
                if (diffDays <= bucket) {
                    user.activityBucket = bucket;
                    break;
                }
            }
        }
        logger.verbose(`  Assigned activity buckets to users via custom property ${options.customPropertyName}`);

        // Update data in QRS
        // Batch updates to avoid overloading QRS by calling once for each user
        // Batch size determined by command line parameter --update-batch-size
        // Wait for a short time between each batch, to avoid overloading the QRS. Delay is determined by command line parameter --update-batch-sleep
        const batchSize = options.updateBatchSize;
        const batchSleep = options.updateBatchSleep * 1000; // Convert seconds to milliseconds
        const totalBatches = Math.ceil(usersLastActivity.length / batchSize);
        const outputUserArray = [];

        logger.info('');
        logger.info(`== Step 4 : Get user data from Sense, one batch at a time (each batch is ${batchSize} users)...`);
        logger.info(`  Total number of users to process: ${usersLastActivity.length}`);
        logger.info(`  Total number of batches: ${totalBatches}`);

        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = start + batchSize;
            const usersBatch = usersLastActivity.slice(start, end);

            logger.info('');
            logger.info(`  >> Batch ${i + 1} of ${totalBatches} (users ${start + 1} to ${end})`);
            logger.info(`     Calculating activity buckets`);

            // Get full user data from QRS for users in this batch
            // Users are identified by usersBartch[i].userSenseId
            // This is the user ID in Qlik Sense

            // First create filter string for QRS call. Format is
            // filter=userId eq 'user1.id' or userId eq 'user2.id' or userId eq 'user3.id'
            const filter = usersBatch.map((user) => {
                return `id eq ${user.userSenseId}`;
            });
            const filterString = filter.join(' or ');
            logger.debug(`  Filter string for getting user batch ${i} from QRS: ${filterString}`);

            const axiosConfig = setupQrsConnection(options, {
                method: 'get',
                path: 'qrs/user/full',
                queryParameters: [
                    {
                        name: 'filter',
                        value: filterString,
                    },
                ],
            });

            // Get current info from QRS for this batch of users
            const result = await axios.request(axiosConfig);
            let currentUserInfo;
            if (result.status === 200) {
                currentUserInfo = JSON.parse(result.data);
                logger.debug(`  Response from QRS for getting user batch ${i}: ${result.status}`);
            } else {
                logger.error(`Error ${result.status} getting user batch ${i} from QRS`);
                return false;
            }

            // Update user objects with activity buckets
            logger.info(`     Preparing user activity custom property`);

            for (const currentUser of currentUserInfo) {
                // user is a full user object from QRS

                const userActivityCp = currentUser.customProperties.find((cp) => cp.definition.name === options.customPropertyName);

                if (userActivityCp) {
                    // User activity custom property already exists
                    // Remove it
                    currentUser.customProperties = currentUser.customProperties.filter(
                        (cp) => cp.definition.name !== options.customPropertyName
                    );
                }
                // Custom property does not exist for this user, add it
                // Note that the custom property itself however exists, it's just not assigned to this user (yet)
                currentUser.customProperties.push({
                    definition: {
                        valueType: 'Text',
                        name: customPropertyExisting.name,
                        id: customPropertyExisting.id,
                        choiceValues: customPropertyExisting.choiceValues,
                    },
                    value: usersBatch.find((user) => user.userSenseId === currentUser.id).activityBucket.toString(),
                });

                // Add user to output array
                outputUserArray.push(currentUser);
            }

            // Pause options.updateBatchSleep seconds before next batch
            logger.info(`     Pausing ${options.updateBatchSleep} seconds before next batch...`);
            if (batchSleep > 0) await sleep(batchSleep);
        }

        logger.info('');
        logger.info(`Done calculating activity buckets for all users. Proceeding to update user activity custom property in Qlik Sense.`);

        logger.info('');
        logger.info(`== Step 5 : Update user activity custom property in Qlik Sense.`);

        // Update user activity custom property in Qlik Sense
        // Loop over the same buckets, using the same batch size.
        // Data to be sent to QRS is the outputUserArray array
        const totalOutputBatches = Math.ceil(outputUserArray.length / batchSize);
        logger.info(`  Number of batches to process: ${totalOutputBatches} of ${batchSize} users each.`);

        let userCounter = 1;
        for (let i = 0; i < totalOutputBatches; i++) {
            const start = i * batchSize;
            const end = start + batchSize;
            const usersBatch = outputUserArray.slice(start, end);

            logger.info(`  Storing activity buckets for batch ${i + 1} of ${totalBatches} in Sense repository.`);

            // Loop over the users in the batch, writing the user activity custom property to QRS
            for (const user of usersBatch) {
                // Is it a dry run?
                if (options.dryRun) {
                    logger.info(
                        `(${importCount}/${importLimit}) Dry run: Would have updated ${userCounter} of ${outputUserArray.length}, "${user.userDirectory}\\${user.userId}" in batch ${
                            i + 1
                        } of ${totalBatches}`
                    );
                } else {
                    // Payload: array of user objects
                    const axiosConfig = setupQrsConnection(options, {
                        method: 'put',
                        path: `qrs/user/${user.id}`,
                        body: user,
                    });

                    const result = await axios.request(axiosConfig);
                    if (result.status === 200) {
                        logger.info(
                            `    Updated user ${userCounter} of ${outputUserArray.length}, "${user.userDirectory}\\${user.userId}" in batch ${
                                i + 1
                            } of ${totalBatches}`
                        );
                    } else {
                        logger.error(`Error ${result.status} updating user activity custom property for batch ${i + 1} of ${totalBatches}`);
                        return false;
                    }
                }
                userCounter++;

                // Pause half a second between each user
                if (options.updateUserSleep > 0) await sleep(options.updateUserSleep);
            }
        }

        logger.info('');
        logger.info(`Done updating user activity custom property in Qlik Sense.`);

        return true;
    } catch (err) {
        // Return error msg
        catchLog(`Error creating user activity custom property`, err);
    }
}
