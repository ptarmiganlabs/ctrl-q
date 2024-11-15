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
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense repository API port', '4242')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption(
            '--secure <true|false>',
            'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.',
            true
        )
        .option('--auth-user-dir <directory>', 'user directory for user to connect with', 'Internal')
        .option('--auth-user-id <userid>', 'user ID for user to connect with', 'sa_repository')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--jwt <JWT>', 'JSON Web Token (JWT) to use for authenticating with Qlik Sense', '')

        .option('--user-directory <name...>', 'name of user directories whose users will be updated with activity info', '')
        .addOption(
            new Option(
                '--license-type <name...>',
                'license type(s) to consider when calculating user activity. Default is all license types.'
            )
                .choices(['analyzer', 'analyzer-time', 'login', 'professional', 'user'])
                .default(['analyzer', 'analyzer-time', 'login', 'professional', 'user'])
        )

        .requiredOption('--custom-property-name <name>', 'name of custom property that will hold user activity buckets')
        .addOption(
            new Option('--force', 'forcibly overwrite and replace custom property and its values if the custom property already exists')
        )
        .option(
            '--activity-buckets <buckets...>',
            'custom property values/user activity buckets to be defined. A comma or space separated list of numbers, representing days since last login.',
            ['1', '7', '14', '30', '90', '180', '365']
        )
        .option(
            '--update-batch-size <number of users>',
            'number of users to update in each batch when writing user activity info back into Sense. Valid values are 1-25.',
            parseUpdateBatchSize,
            25
        )
        .option(
            '--update-batch-sleep <seconds>',
            'Wait this long before continuing after each batch of users has been updated in Sense. 0 = no wait.',
            3
        )
        .option(
            '--update-user-sleep <milliseconds>',
            'Wait this long after updating each user in the Qlik Sense repository. 0 = no wait.',
            500
        )

        .option('--dry-run', 'do a dry run, i.e. do not create or update anything - just show what would be done');
}
