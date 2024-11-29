import { Option } from 'commander';

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
            logger.info(`Version: ${appVersion}`);
        });
}
