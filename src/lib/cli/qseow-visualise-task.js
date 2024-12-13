import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions } from '../util/qseow/assert-options.js';
import { visTask } from '../cmd/qseow/vistask.js';

export function setupQseowVisualiseTaskCommand(qseow) {
    qseow
        .command('task-vis')
        .description('visualise task network')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);

            await visTask(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(
            new Option('--port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)')
                .default('4242')
                .env('CTRLQ_PORT')
        )
        .addOption(
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix')
                .default('')
                .makeOptionMandatory()
                .env('CTRLQ_VIRTUAL_PROXY')
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
        .addOption(
            new Option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server').env('CTRLQ_AUTH_JWT')
        )
        .addOption(new Option('--vis-host <host>', 'host for visualisation server').default('localhost').env('CTRLQ_VIS_HOST'))
        .addOption(new Option('--vis-port <port>', 'port for visualisation server').default('3000').env('CTRLQ_VIS_PORT'));
}
