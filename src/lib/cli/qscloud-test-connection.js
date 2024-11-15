import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qscloudSharedParamAssertOptions } from '../util/qscloud/assert-options.js';
import { qscloudTestConnection } from '../cmd/qscloud/testconnection.js';

export function setupQscloudTestConnectionCommand(qsCloud) {
    qsCloud
        .command('connection-test')
        .description('test connection to Qlik Sense Cloud.')
        .action(async (options) => {
            try {
                await qscloudSharedParamAssertOptions(options);

                await qscloudTestConnection(options);
            } catch (err) {
                catchLog('QS CLOUD CONNECTION TEST', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )

        .requiredOption('--tenant-host <host>', 'Host of Qlik Sense cloud tenant. Example: "tenant.eu.qlikcloud.com"')
        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['apikey']).default('apikey'))
        .requiredOption('--apikey <key>', 'API key used to access the Sense APIs');
}
