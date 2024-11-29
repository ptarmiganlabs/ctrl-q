import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, deleteSessionsAssertOptions } from '../util/qseow/assert-options.js';
import { deleteSessions } from '../cmd/qseow/deletesessions.js';

export function setupQseowDeleteProxySessionsCommand(qseow) {
    qseow
        .command('session-delete')
        .description('delete proxy session(s) on a specific virtual proxy and proxy service')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
            await deleteSessionsAssertOptions(options);

            deleteSessions(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(
            new Option('--host <host>', 'Qlik Sense host (IP/FQDN) where Qlik Repository Service (QRS) is running')
                .makeOptionMandatory()
                .env('CTRLQ_HOST')
        )
        .addOption(
            new Option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242)').default('4242').env('CTRLQ_QRS_PORT')
        )
        .addOption(
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix to access QRS via')
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
        .addOption(new Option('--session-id <id...>', 'session IDs to delete').makeOptionMandatory().env('CTRLQ_SESSION_ID'))
        .addOption(
            new Option('--session-virtual-proxy <prefix>', 'Qlik Sense virtual proxy (prefix) to delete proxy session(s) on')
                .makeOptionMandatory()
                .default('')
                .env('CTRLQ_SESSION_VIRTUAL_PROXY')
        )
        .addOption(
            new Option(
                '--host-proxy <host>',
                'Qlik Sense proxy (IP/FQDN) where sessions should be deleted. Must match the host name of a Sense node'
            )
                .makeOptionMandatory()
                .env('CTRLQ_HOST_PROXY')
        )
        .addOption(
            new Option('--qps-port <port>', 'Qlik Sense proxy service (QPS) port (usually 4243)').default('4243').env('CTRLQ_QPS_PORT')
        )
        .addOption(
            new Option('--auth-user-dir <directory>', 'user directory for user to connect with')
                .makeOptionMandatory()
                .env('CTRLQ_AUTH_USER_DIR')
        )
        .addOption(
            new Option('--auth-user-id <userid>', 'user ID for user to connect with').makeOptionMandatory().env('CTRLQ_AUTH_USER_ID')
        )
        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert').env('CTRLQ_AUTH_TYPE'))
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
        );
}
