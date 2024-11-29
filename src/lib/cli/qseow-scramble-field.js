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
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(
            new Option('--engine-port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)')
                .default('4747')
                .env('CTRLQ_ENGINE_PORT')
        )
        .addOption(
            new Option('--qrs-port <port>', 'Qlik Sense server QRS port (usually 4242 for cert auth, 443 for jwt auth)')
                .default('4242')
                .env('CTRLQ_QRS_PORT')
        )
        .addOption(
            new Option('--schema-version <string>', 'Qlik Sense engine schema version').default('12.612.0').env('CTRLQ_SCHEMA_VERSION')
        )
        .addOption(
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix').makeOptionMandatory().env('CTRLQ_VIRTUAL_PROXY')
        )
        .addOption(
            new Option(
                '--secure <true|false>',
                'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.'
            )
                .default(true)
                .makeOptionMandatory()
                .env('CTRLQ_SECURE')
        )
        .addOption(
            new Option('--auth-user-dir <directory>', 'user directory for user to connect with').makeOptionMandatory().env('CTRLQ_USER_DIR')
        )
        .addOption(new Option('--auth-user-id <userid>', 'user ID for user to connect with').makeOptionMandatory().env('CTRLQ_USER_ID'))
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
        .addOption(new Option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server').env('CTRLQ_JWT'))
        .addOption(new Option('--app-id <id>', 'Qlik Sense app ID to be scrambled').makeOptionMandatory().env('CTRLQ_APP_ID'))
        .addOption(new Option('--field-name <names...>', 'name of field(s) to be scrambled').makeOptionMandatory().env('CTRLQ_FIELD_NAME'))
        .addOption(
            new Option('--new-app-name <name>', 'name of new app that will contain scrambled data. Not used if --new-app-cmd=replace')
                .makeOptionMandatory()
                .env('CTRLQ_NEW_APP_NAME')
        )
        .addOption(
            new Option(
                '--new-app-delete',
                'should the new scrambled app be deleted after the operation is complete? If not, the new app will be placed in the My Work stream'
            ).env('CTRLQ_NEW_APP_DELETE')
        )
        .addOption(
            new Option(
                '--new-app-cmd <command>',
                'what to do with the new app. If nothing is specified in this option the new app will be placed in My Work.\n"publish": publish the new app to the stream specified by --new-app-cmd-id or --new-app-cmd-name. The new app will NOT remain in My Work.\n"replace": Replace an existing published or unpublished app. If the app is published, only the sheets that were originally published with the app are replaced. If the replaced app is not published, the entire app is replaced.'
            )
                .choices(['', 'publish', 'replace'])
                .default('')
                .env('CTRLQ_NEW_APP_CMD')
        )
        .addOption(
            new Option('--new-app-cmd-id <id>', 'stream/app ID that --new-app-cmd acts on. Cannot be used with --new-app-cmd-name')
                .default('')
                .conflicts('new-app-cmd-name')
                .env('CTRLQ_NEW_APP_CMD_ID')
        )
        .addOption(
            new Option('--new-app-cmd-name <name>', 'stream/app name that --new-app-cmd acts on. Cannot be used with --new-app-cmd-id')
                .default('')
                .conflicts('new-app-cmd-id')
                .env('CTRLQ_NEW_APP_CMD_NAME')
        )
        .addOption(
            new Option('--force', 'force delete and replace operations to proceed without asking for confirmation').env('CTRLQ_FORCE')
        );
}
