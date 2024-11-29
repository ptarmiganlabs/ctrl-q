import { Option, InvalidArgumentError } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, userActivityBucketsCustomPropertyAssertOptions } from '../util/qseow/assert-options.js';
import { createUserActivityBucketsCustomProperty } from '../cmd/qseow/createuseractivitycp.js';

// Function to parse update batch size
// Must be a number between 1 and 25
function parseUpdateBatchSize(value) {
    console.log('sdklfjsdlkfjsdlkfjsdlfkj');
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 25) {
        throw new InvalidArgumentError('Must be a number between 1 and 25.');
    }
    return parsedValue;
}

export function setupQseowUserActivityCustomPropertyCommand(qseow) {
    qseow
        .command('user-activity-bucket-cp-create')
        .description(
            'create custom property and populate it with values ("activity buckets") indicating how long ago users last logged into Sense'
        )
        .action(async (options) => {
            try {
                const newOptions = options;

                await qseowSharedParamAssertOptions(newOptions);
                await userActivityBucketsCustomPropertyAssertOptions(newOptions);

                const result = await createUserActivityBucketsCustomProperty(newOptions);
            } catch (err) {
                catchLog('USER ACTIVITY BUCKET CUSTOM PROPERTY', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(new Option('--port <port>', 'Qlik Sense repository API port').default('4242').env('CTRLQ_PORT'))
        .addOption(
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix')
                .makeOptionMandatory()
                .default('')
                .env('CTRLQ_VIRTUAL_PROXY')
        )
        .addOption(
            new Option(
                '--secure <true|false>',
                'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.'
            )
                .makeOptionMandatory()
                .default(true)
                .env('CTRLQ_SECURE')
        )
        .addOption(
            new Option('--auth-user-dir <directory>', 'user directory for user to connect with').default('Internal').env('CTRLQ_USER_DIR')
        )
        .addOption(new Option('--auth-user-id <userid>', 'user ID for user to connect with').default('sa_repository').env('CTRLQ_USER_ID'))
        .addOption(
            new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert').env('CTRLQ_AUTH_TYPE')
        )
        .addOption(
            new Option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)')
                .default('./cert/client.pem')
                .env('CTRLQ_CERT_FILE')
        )
        .addOption(
            new Option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)')
                .default('./cert/client_key.pem')
                .env('CTRLQ_CERT_KEY_FILE')
        )
        .addOption(
            new Option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)')
                .default('./cert/root.pem')
                .env('CTRLQ_ROOT_CERT_FILE')
        )
        .addOption(new Option('--jwt <JWT>', 'JSON Web Token (JWT) to use for authenticating with Qlik Sense').default('').env('CTRLQ_JWT'))
        .addOption(
            new Option('--user-directory <name...>', 'name of user directories whose users will be updated with activity info')
                .default('')
                .env('CTRLQ_USER_DIR')
        )
        .addOption(
            new Option(
                '--license-type <name...>',
                'license type(s) to consider when calculating user activity. Default is all license types.'
            )
                .choices(['analyzer', 'analyzer-time', 'login', 'professional', 'user'])
                .default(['analyzer', 'analyzer-time', 'login', 'professional', 'user'])
                .env('CTRLQ_LICENSE_TYPE')
        )
        .addOption(
            new Option('--custom-property-name <name>', 'name of custom property that will hold user activity buckets')
                .makeOptionMandatory()
                .env('CTRLQ_CUSTOM_PROPERTY_NAME')
        )
        .addOption(
            new Option(
                '--force',
                'forcibly overwrite and replace custom property and its values if the custom property already exists'
            ).env('CTRLQ_FORCE')
        )
        .addOption(
            new Option(
                '--activity-buckets <buckets...>',
                'custom property values/user activity buckets to be defined. A comma or space separated list of numbers, representing days since last login.'
            )
                .default(['1', '7', '14', '30', '90', '180', '365'])
                .env('CTRLQ_ACTIVITY_BUCKETS')
        )
        .addOption(
            new Option(
                '--update-batch-size <number of users>',
                'number of users to update in each batch when writing user activity info back into Sense. Valid values are 1-25.'
            )
                .argParser(parseUpdateBatchSize)
                .default(25)
                .env('CTRLQ_UPDATE_BATCH_SIZE')
        )
        .addOption(
            new Option(
                '--update-batch-sleep <seconds>',
                'Wait this long before continuing after each batch of users has been updated in Sense. 0 = no wait.'
            )
                .default(3)
                .env('CTRLQ_UPDATE_BATCH_SLEEP')
        )
        .addOption(
            new Option(
                '--update-user-sleep <milliseconds>',
                'Wait this long after updating each user in the Qlik Sense repository. 0 = no wait.'
            )
                .default(500)
                .env('CTRLQ_UPDATE_USER_SLEEP')
        )
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not create or update anything - just show what would be done').env(
                'CTRLQ_DRY_RUN'
            )
        );
}
