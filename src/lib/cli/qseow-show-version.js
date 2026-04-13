import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { appVersion, logger } from '../../globals.js';

export function setupQseowShowVersionCommand(qseow) {
    qseow
        .command('version')
        .description('show version info')
        .addOption(
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .action(async (options) => {
            try {
                logger.info(`Version: ${appVersion}`);
            } catch (err) {
                catchLog('SHOW VERSION', err);
            }
        });
}
