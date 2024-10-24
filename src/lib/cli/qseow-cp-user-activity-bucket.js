import { Option } from 'commander';

import { catchLog } from '../util/log.js';
// import { qseowSharedParamAssertOptions, customPropertyUserActivityBucketsAssertOptions } from '../util/qseow/assert-options.js';
// import customPropertyUserActivityBuckets from '../cmd/qseow/custom-property-user-activity-buckets.js';

export function setupQseowUserActivityCustomPropertyCommand(qseow) {
    //
}

// program
//     .command('user-activity-cp-create')
//     .description(
//         'create custom property and populate it with values ("activity buckets") indicating how long ago users last logged into Sense'
//     )
//     .action(async (options) => {
//         try {
//             let optionsLocal = options;
//             await qseowSharedParamAssertOptions(options);
//             optionsLocal = userActivityCustomPropertyAssertOptions(options);
//             createUserActivityCustomProperty(optionsLocal);
//         } catch (err) {
//             logger.error(`USER ACTIVITY CP: ${err}`);
//         }
//     })
//     .addOption(
//         new Option('--log-level <level>', 'log level')
//             .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
//             .default('info')
//     )
//     .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
//     .option('--port <port>', 'Qlik Sense repository API port', '4242')
//     .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
//     .requiredOption('--secure <true|false>', 'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.', true)
//     .option('--auth-user-dir <directory>', 'user directory for user to connect with', 'Internal')
//     .option('--auth-user-id <userid>', 'user ID for user to connect with', 'sa_repository')

//     .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
//     .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
//     .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
//     .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
//     .option('--jwt <JWT>', 'JSON Web Token (JWT) to use for authenticating with Qlik Sense', '')

//     .requiredOption('--user-directory <name>', 'name of user directory whose users will be updated with activity info')
//     .requiredOption('--custom-property-name <name>', 'name of custom property that will hold user activity buckets')
//     .addOption(
//         new Option('--force <true|false>', 'forcibly overwrite and replace custom property and its values if it already exists')
//             .choices(['true', 'false'])
//             .default('false')
//     )
//     .option('--activity-buckets <buckets...>', 'custom property values/user activity buckets to be defined. In days.', [
//         '1',
//         '7',
//         '14',
//         '30',
//         '90',
//         '180',
//         '365',
//     ]);
