import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, qseowScrambleFieldAssertOptions } from '../util/qseow/assert-options.js';
import { scrambleField } from '../cmd/qseow/scramblefield.js';

export function setupQseowScrambleFieldCommand(qseow) {
    qseow
        .command('field-scramble')
        .description('scramble one or more fields in an app. A new app with the scrambled data is created.')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
            await qseowScrambleFieldAssertOptions(options);

            scrambleField(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--engine-port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--qrs-port <port>', 'Qlik Sense server QRS port (usually 4242 for cert auth, 443 for jwt auth)', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption(
            '--secure <true|false>',
            'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.',
            true
        )
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server')

        .requiredOption('--field-name <names...>', 'name of field(s) to be scrambled')
        .requiredOption('--new-app-name <name>', 'name of new app that will contain scrambled data')

        .addOption(new Option('--new-app-publish', 'publish scrambled app to a stream'))
        .addOption(new Option('--new-app-publish-stream-id <id>', 'stream ID to publish scrambled app to').default(''))
        .addOption(new Option('--new-app-publish-stream-name <name>', 'stream name to publish scrambled app to').default(''))

        .addOption(new Option('--new-app-publish-replace', 'publish-replace an existing, published app'))
        .addOption(
            new Option(
                '--new-app-publish-replace-app-id <id>',
                'ID of published app that should be replaced by the new scrambled app'
            ).default('')
        )
        .addOption(
            new Option(
                '--new-app-publish-replace-app-name <name>',
                'Name of published app that should be replaced by the new scrambled app'
            ).default('')
        )

        .addOption(
            new Option('--new-app-delete-existing-unpublished', 'delete any already existing apps with same name as new scrambled app')
        )
        .addOption(new Option('--new-app-delete', 'delete the new scrambled app after all other operations are done'))

        .addOption(new Option('--force', 'force delete and replace operations to proceed without asking for confirmation'));
}
