import qrsInteract from 'qrs-interact';
import path from 'path';
import { logger, setLoggingLevel, isPkg, execPath } from '../../globals.js';

import {
    getUserActivityProfessional,
    getUserActivityAnalyzer,
    getUserActivityAnalyzerTime,
    getUserActivityLogin,
    getUserActivityUser,
    getUsersLastActivity,
} from './useractivity.js';
import { catchLog } from '../util/log.js';

const _MS_PER_DAY = 1000 * 60 * 60 * 24;

// a and b are javascript Date objects
function dateDiffInDays(a, b) {
    // Discard the time and time-zone information.
    const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

/**
 *
 * @param {*} options
 */
const createUserActivityCustomProperty = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Create custom property for tracking user activity in QMC');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Set up connection to Sense repository service
        const certPath = path.resolve(process.cwd(), options.authCertFile);
        const keyPath = path.resolve(process.cwd(), options.authCertKeyFile);

        // Verify cert files exist

        const configQRS = {
            hostname: options.host,
            portNumber: options.port,
            certificates: {
                certFile: certPath,
                keyFile: keyPath,
            },
        };

        configQRS.headers = {
            'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
            'Content-Type': 'application/json',
        };

        // eslint-disable-next-line new-cap
        const qrsInteractInstance = new qrsInteract(configQRS);
        let result;

        // Does CP already exist?
        try {
            result = await qrsInteractInstance.Get(`custompropertydefinition/full?filter=name eq '${options.customPropertyName}'`);
        } catch (err) {
            // Return error msg
            catchLog(`USER ACTIVITY CP: Error getting user activity custom property`, err);
        }

        if (result.statusCode === 200) {
            if (result.body.length === 1) {
                // CP exists
                logger.debug(`USER ACTIVITY CP: Custom property name passed via command line exists`);

                // Does the existing CP have *exactly* the same values as passed in via comand line?
                if (options.activityBuckets.length === result.body[0].choiceValues.length) {
                    // Same number of custom property values. Are they the same?
                } else {
                    // Different number of values. Do nothing, unless the --force paramerer equals true
                    // eslint-disable-next-line no-lonely-if
                    if (options.force === 'false') {
                        // Don't force overwrite the existni custom property.
                        // Show warning and return
                        logger.warn(
                            `USER ACTIVITY CP: Custom property already exists, with existing values different from the ones pass in via command line. Aborting.`
                        );
                    } else {
                        //
                        logger.verbose(`USER ACTIVITY CP: Replacing custom property ${options.customPropertyName}`);
                    }
                }
            } else if (result.body.length === 0) {
                // CP does not exist
                logger.debug(`USER ACTIVITY CP: Custom property name passed via command line does not exist`);

                // Create new CP
                try {
                    result = await qrsInteractInstance.Post(
                        'custompropertydefinition',
                        {
                            name: options.customPropertyName,
                            valueType: 'Text',
                            // choiceValues: ['1', '7', '14'],
                            choiceValues: options.activityBuckets,
                            objectTypes: ['User'],
                            description: 'Ctrl-Q user activity buckets',
                        },
                        'json'
                    );
                } catch (err) {
                    catchLog(`USER ACTIVITY CP: Error creating user activity custom property`, err);
                }

                if (result.statusCode === 201) {
                    logger.verbose(`USER ACTIVITY CP: Created new custom property "${options.customPropertyName}"`);
                }
            }

            // User activity info will available in following format
            // Array of objects:
            // {
            //     id: "41e8464e-87ed-4ea3-9fc7-e09d2dc6781a",
            //     createdDate: "2021-11-19T12:23:58.850Z",
            //     modifiedDate: "2022-08-27T06:47:08.600Z",
            //     modifiedByUserName: "LAB\\testuser_2",
            //     user: {
            //       id: "9e403391-58a7-4442-ada7-c54dc8906016",
            //       userId: "testuser_2",
            //       userDirectory: "LAB",
            //       userDirectoryConnectorName: "LAB",
            //       name: "Testuser2",
            //       privileges: null,
            //     },
            //     lastUsed: "2022-08-27T06:47:08.584Z",
            //     excess: false,
            //     quarantined: false,
            //     quarantineEnd: "1753-01-01T00:00:00.000Z",
            //     deletedUserId: "",
            //     deletedUserDirectory: "",
            //     privileges: null,
            //     schemaPath: "License.AnalyzerAccessType",
            //   }

            // Get user activity via QRS API, per license type
            const activityProfessional = await getUserActivityProfessional(qrsInteractInstance);
            logger.debug(`USER ACTIVITY CP: Professional licenses: ${JSON.stringify(activityProfessional)}`);

            const activityAnalyzer = await getUserActivityAnalyzer(qrsInteractInstance);
            logger.debug(`USER ACTIVITY CP: Analyzer licenses: ${JSON.stringify(activityAnalyzer)}`);

            const activityAnalyzerTime = await getUserActivityAnalyzerTime(qrsInteractInstance);
            logger.debug(`USER ACTIVITY CP: Analyzer time licenses: ${JSON.stringify(activityAnalyzerTime)}`);

            const activityLogin = await getUserActivityLogin(qrsInteractInstance);
            logger.debug(`USER ACTIVITY CP: Login licenses: ${JSON.stringify(activityLogin)}`);

            const activityUser = await getUserActivityUser(qrsInteractInstance);
            logger.debug(`USER ACTIVITY CP: User licenses: ${JSON.stringify(activityUser)}`);

            const usersLastActivity = await getUsersLastActivity(
                activityProfessional,
                activityAnalyzer,
                activityAnalyzerTime,
                activityLogin,
                activityUser
            );

            // Assign users to activity buckets
            // eslint-disable-next-line no-restricted-syntax
            for (const user of usersLastActivity) {
                // How many days ago was user active? Round down to nearest full day
                const dateNow = new Date();
                const dateUserLastActivity = new Date(user.lastUsed);
                // const diffTime = Math.abs(dateNow - dateUserLastActivity);
                // const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const diffDays = dateDiffInDays(dateUserLastActivity, dateNow);

                // eslint-disable-next-line no-restricted-syntax
                for (const bucket of options.activityBuckets) {
                    if (diffDays <= bucket) {
                        user.activityBucket = bucket;
                        break;
                    }
                }

                // Set custom property for user
                try {
                    // eslint-disable-next-line no-await-in-loop
                    result = await qrsInteractInstance.Post(
                        'custompropertydefinition',
                        {
                            name: options.customPropertyName,
                            valueType: 'Text',
                            // choiceValues: ['1', '7', '14'],
                            choiceValues: options.activityBuckets,
                            objectTypes: ['User'],
                            description: 'Ctrl-Q user activity buckets',
                        },
                        'json'
                    );
                } catch (err) {
                    catchLog(`USER ACTIVITY CP: Error creating user activity custom property`, err);
                }
            }
            logger.verbose(`USER ACTIVITY CP: Assigned activity buckets to users via custom property ${options.customPropertyName}`);
        }
    } catch (err) {
        // Return error msg
        catchLog(`USER ACTIVITY CP: Error creating user activity custom property`, err);
    }
};

export default createUserActivityCustomProperty;
