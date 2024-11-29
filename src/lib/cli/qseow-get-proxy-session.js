import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, getSessionsAssertOptions } from '../util/qseow/assert-options.js';
import { getSessions } from '../cmd/qseow/getsessions.js';

export function setupQseowGetProxySessionsCommand(qseow) {
    qseow
        .command('session-get')
        .description('get info about proxy sessions on one or more virtual proxies')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
            await getSessionsAssertOptions(options);

            getSessions(options, null);
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
        .addOption(
            new Option('--session-virtual-proxy <prefix...>', 'one or more Qlik Sense virtual proxies to get sessions for').env(
                'CTRLQ_SESSION_VIRTUAL_PROXY'
            )
        )
        .addOption(
            new Option(
                '--host-proxy <host...>',
                'Qlik Sense hosts/proxies (IP/FQDN) to get sessions from. Must match the host names of the Sense nodes'
            ).env('CTRLQ_HOST_PROXY')
        )
        .addOption(
            new Option('--qps-port <port>', 'Qlik Sense proxy service (QPS) port (usually 4243)').default('4243').env('CTRLQ_QPS_PORT')
        )
        .addOption(
            new Option('--auth-user-dir <directory>', 'user directory for user to connect with').makeOptionMandatory().env('CTRLQ_USER_DIR')
        )
        .addOption(new Option('--auth-user-id <userid>', 'user ID for user to connect with').makeOptionMandatory().env('CTRLQ_USER_ID'))
        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert').env('CTRLQ_AUTH_TYPE'))
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
        .addOption(new Option('--output-format <json|table>', 'output format').default('json').env('CTRLQ_OUTPUT_FORMAT'))
        .addOption(
            new Option('-s, --sort-by <column>', 'column to sort output table by')
                .choices(['prefix', 'proxyhost', 'proxyname', 'userdir', 'userid', 'username'])
                .default('prefix')
                .env('CTRLQ_SORT_BY')
        );
}
