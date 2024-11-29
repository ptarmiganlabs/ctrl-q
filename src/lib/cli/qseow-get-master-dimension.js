import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions } from '../util/qseow/assert-options.js';
import { getMasterDimension } from '../cmd/qseow/getdim.js';

export function setupQseowGetMasterDimensionCommand(qseow) {
    qseow
        .command('master-item-dim-get')
        .description('get info about one or more master dimensions')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);

            getMasterDimension(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(
            new Option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)')
                .default('4747')
                .env('CTRLQ_PORT')
        )
        .addOption(
            new Option('--schema-version <string>', 'Qlik Sense engine schema version').default('12.612.0').env('CTRLQ_SCHEMA_VERSION')
        )
        .addOption(new Option('--app-id <id>', 'Qlik Sense app ID').makeOptionMandatory().env('CTRLQ_APP_ID'))
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
            new Option('--id-type <type>', 'type of identifier passed in the --master-item option')
                .choices(['id', 'name'])
                .default('name')
                .env('CTRLQ_ID_TYPE')
        )
        .addOption(
            new Option('--master-item <ids...>', 'master dimension to retrieve. If not specified all dimensions will be retrieved').env(
                'CTRLQ_MASTER_ITEM'
            )
        )
        .addOption(
            new Option('--output-format <format>', 'output format').choices(['json', 'table']).default('json').env('CTRLQ_OUTPUT_FORMAT')
        );
}
