import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, variableDeleteAssertOptions } from '../util/qseow/assert-options.js';
import { deleteVariable } from '../cmd/qseow/deletevariable.js';

export function setupQseowDeleteVariableCommand(qseow) {
    qseow
        .command('variable-delete')
        .description('delete one or more variables in one or more apps')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
            variableDeleteAssertOptions(options);

            deleteVariable(options);
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
            new Option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)')
                .default('4242')
                .env('CTRLQ_QRS_PORT')
        )
        .addOption(
            new Option('--schema-version <string>', 'Qlik Sense engine schema version').default('12.612.0').env('CTRLQ_SCHEMA_VERSION')
        )
        .addOption(new Option('--app-id <id...>', 'Qlik Sense app ID(s) to get variables from').env('CTRLQ_APP_ID'))
        .addOption(new Option('--app-tag <tag...>', 'Qlik Sense app tag(s) to get variables').env('CTRLQ_APP_TAG'))
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
            new Option('--auth-user-dir <directory>', 'user directory for user to connect with')
                .makeOptionMandatory()
                .env('CTRLQ_AUTH_USER_DIR')
        )
        .addOption(
            new Option('--auth-user-id <userid>', 'user ID for user to connect with').makeOptionMandatory().env('CTRLQ_AUTH_USER_ID')
        )
        .addOption(
            new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert').env('CTRLQ_AUTH_TYPE')
        )
        .addOption(
            new Option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)')
                .default('./cert/client.pem')
                .env('CTRLQ_AUTH_CERT_FILE')
        )
        .addOption(
            new Option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)')
                .default('./cert/client_key.pem')
                .env('CTRLQ_AUTH_CERT_KEY_FILE')
        )
        .addOption(
            new Option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)')
                .default('./cert/root.pem')
                .env('CTRLQ_AUTH_ROOT_CERT_FILE')
        )
        .addOption(
            new Option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server').env('CTRLQ_AUTH_JWT')
        )
        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --variable option')
                .choices(['id', 'name'])
                .default('name')
                .env('CTRLQ_ID_TYPE')
        )
        .addOption(
            new Option('--variable <ids...>', 'variables to retrieve. If not specified all variables will be retrieved').env(
                'CTRLQ_VARIABLE'
            )
        )
        .addOption(new Option('--delete-all', 'delete all variables').env('CTRLQ_DELETE_ALL'))
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not delete anything - just show what would be deleted').env('CTRLQ_DRY_RUN')
        );
}
