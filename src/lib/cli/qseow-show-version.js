import { Option } from 'commander';

import { catchLog } from '../util/log.js';

export function setupQseowShowVersionCommand(qseow) {
    qseow
        .command('version')
        .description('show version info')
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        // eslint-disable-next-line no-unused-vars
        .action(async (options) => {
            logger.verbose(`Version: ${appVersion}`);
        });
}
