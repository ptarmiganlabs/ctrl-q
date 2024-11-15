import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, getSessionsAssertOptions } from '../util/qseow/assert-options.js';
import getSessions from '../cmd/qseow/getsessions.js';

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
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )

        .requiredOption('--host <host>', 'Qlik Sense host (IP/FQDN) where Qlik Repository Service (QRS) is running')
        .option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242)', '4242')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix to access QRS via', '')
        .requiredOption(
            '--secure <true|false>',
            'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.',
            true
        )

        .option('--session-virtual-proxy <prefix...>', 'one or more Qlik Sense virtual proxies to get sessions for')
        .option(
            '--host-proxy <host...>',
            'Qlik Sense hosts/proxies (IP/FQDN) to get sessions from. Must match the host names of the Sense nodes'
        )
        .option('--qps-port <port>', 'Qlik Sense proxy service (QPS) port (usually 4243)', '4243')

        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .option('--output-format <json|table>', 'output format', 'json')

        .addOption(
            new Option('-s, --sort-by <column>', 'column to sort output table by')
                .choices(['prefix', 'proxyhost', 'proxyname', 'userdir', 'userid', 'username'])
                .default('prefix')
        );
}
