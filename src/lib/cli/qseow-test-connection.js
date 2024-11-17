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
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense proxy service port', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption(
            '--secure <true|false>',
            'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.',
            true
        )
        .option('--auth-user-dir <directory>', 'user directory for user to connect with')
        .option('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server');
}
