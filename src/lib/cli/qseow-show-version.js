import { Option } from 'commander';

export function setupQseowShowVersionCommand(qseow) {
    qseow
        .command('version')
        .description('show version info')
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .action(async (options) => {
            logger.verbose(`Version: ${appVersion}`);
        });
}
