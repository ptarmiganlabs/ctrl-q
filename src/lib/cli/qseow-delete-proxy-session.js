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

        .option('--session-id <id...>', 'session IDs to delete')
        .requiredOption('--session-virtual-proxy <prefix>', 'Qlik Sense virtual proxy (prefix) to delete proxy session(s) on', '')
        .requiredOption(
            '--host-proxy <host>',
            'Qlik Sense proxy (IP/FQDN) where sessions should be deleted. Must match the host name of a Sense node'
        )
        .option('--qps-port <port>', 'Qlik Sense proxy service (QPS) port (usually 4243)', '4243')

        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem');
}
