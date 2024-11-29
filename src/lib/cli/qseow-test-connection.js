import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions } from '../util/qseow/assert-options.js';
import { testConnection } from '../cmd/qseow/testconnection.js';

export function setupQseowTestConnectionCommand(qseow) {
    qseow
        .command('connection-test')
        .description('test connection to Qlik Sense server.')
        .action(async (options) => {
            try {
                await qseowSharedParamAssertOptions(options);
                await testConnection(options);
            } catch (err) {
                catchLog('CONNECTION TEST', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(new Option('--port <port>', 'Qlik Sense proxy service port').default('4242').env('CTRLQ_PORT'))
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
                .env('CTRLQ_SECURE')
        )
        .addOption(new Option('--auth-user-dir <directory>', 'user directory for user to connect with').env('CTRLQ_USER_DIR'))
        .addOption(new Option('--auth-user-id <userid>', 'user ID for user to connect with').env('CTRLQ_USER_ID'))
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
        .addOption(
            new Option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server').env('CTRLQ_AUTH_JWT')
        );
}
