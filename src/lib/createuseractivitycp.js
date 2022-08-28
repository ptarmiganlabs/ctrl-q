const qrsInteract = require('qrs-interact');
const path = require('path');

const { logger, setLoggingLevel } = require('../globals');

/**
 *
 * @param {*} options
 */
const createUserActivityCustomProperty = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

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
            logger.error(`USER ACTIVITY CP: Error getting user activity custom property: ${err}`);
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
                    logger.error(`USER ACTIVITY CP: Error creating user activity custom property: ${err}`);
                }
                if (result.statusCode === 201) {
                    logger.verbose(`USER ACTIVITY CP: Created new custom property "${options.customPropertyName}"`);
                }
            }
        }
    } catch (err) {
        // Return error msg
        logger.error(`USER ACTIVITY CP: ${err}`);
    }
};

module.exports = {
    createUserActivityCustomProperty,
};
