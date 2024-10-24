import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qscloudSharedParamAssertOptions } from '../util/qscloud/assert-options.js';
import qscloudTestConnection from '../cmd/qscloud/testconnection.js';

export function setupQscloudTestConnectionCommand(qsCloud) {
    qsCloud
        .command('connection-test')
        .description('test connection to Qlik Sense Cloud.')
        .action(async (options) => {
            // SHow app version
            logger.info(`App version: ${appVersion}`);

            try {
                await qscloudSharedParamAssertOptions(options);
                const res = qscloudTestConnection(options);
                logger.debug(`QS CLOUD CONNECTION TEST: Result: ${res}`);
            } catch (err) {
                catchLog('QS CLOUD CONNECTION TEST', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption(
            '--tenant-url <url>',
            'URL or host of Qlik Sense cloud tenant. Example: "https://tenant.eu.qlikcloud.com" or "tenant.eu.qlikcloud.com"'
        )
        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['apikey']).default('apikey'))
        .requiredOption('--apikey <key>', 'API key used to access the Sense APIs')

        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server');
}
