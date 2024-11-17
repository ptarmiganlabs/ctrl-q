import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, appExportAssertOptions } from '../util/qseow/assert-options.js';
import { exportAppToFile } from '../cmd/qseow/exportapp.js';

export function setupQseowExportAppCommand(qseow) {
    qseow
        .command('app-export')
        .description('export Qlik Sense apps to QVF files on disk.')
        .action(async (options) => {
            try {
                await qseowSharedParamAssertOptions(options);
                await appExportAssertOptions(options);
                exportAppToFile(options);
            } catch (err) {
                catchLog('EXPORT APP', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption(
            '--secure <true|false>',
            'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.',
            true
        )
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server')

        .option('--app-id <ids...>', 'use app IDs to select which apps to export')
        .option('--app-tag <tags...>', 'use app tags to select which apps to export')
        .requiredOption('--app-published', 'export all published apps ', false)

        .requiredOption('--output-dir <directory>', 'relative or absolut path in which QVF files should be stored.', 'qvf-export')
        .addOption(
            new Option('--qvf-name-format <format...>', 'structure of QVF file name format')
                .choices(['app-id', 'app-name', 'export-date', 'export-time'])
                .default(['app-name'])
        )
        .addOption(
            new Option('--qvf-name-separator <separator>', 'character used to separate parts of the QVF file name')
                .choices(['-', '--', '_', '__'])
                .default('_')
        )
        .option('--qvf-overwrite', 'overwrite existing QVF files without asking')

        .requiredOption('--exclude-app-data <true|false>', 'exclude or include app data in QVF file', true)
        .requiredOption('--limit-export-count <number>', 'export at most x number of apps. Defaults to 0 = no limit', 0)
        .requiredOption(
            '--sleep-app-export <milliseconds>',
            'Wait this long before continuing after each app has been exported. Defaults to 1000 = 1 second',
            1000
        )

        // Export of app metadata
        .option('--metadata-file-create', 'create a separate file with information about all exported apps')
        .addOption(new Option('--metadata-file-name <name>', 'file name to store app metadata in').default('app_export.xlsx'))
        .addOption(new Option('--metadata-file-format <format>', 'file type/format').choices(['excel']).default('excel'))
        .option('--metadata-file-overwrite', 'overwrite app metadata file without asking')

        .option('--dry-run', 'do a dry run, i.e. do not export any apps - just show what would be done');
}
