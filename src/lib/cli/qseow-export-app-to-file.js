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
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(
            new Option('--port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)')
                .default('4242')
                .env('CTRLQ_PORT')
        )
        .addOption(
            new Option('--schema-version <string>', 'Qlik Sense engine schema version').default('12.612.0').env('CTRLQ_SCHEMA_VERSION')
        )
        .addOption(
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix')
                .makeOptionMandatory()
                .default('')
                .env('CTRLQ_VIRTUAL_PROXY')
        )
        .addOption(
            new Option(
                '--secure <true|false>',
                'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.'
            )
                .makeOptionMandatory()
                .default(true)
                .env('CTRLQ_SECURE')
        )
        .addOption(
            new Option('--auth-user-dir <directory>', 'user directory for user to connect with').makeOptionMandatory().env('CTRLQ_USER_DIR')
        )
        .addOption(new Option('--auth-user-id <userid>', 'user ID for user to connect with').makeOptionMandatory().env('CTRLQ_USER_ID'))
        .addOption(
            new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert').env('CTRLQ_AUTH_TYPE')
        )
        .addOption(
            new Option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)')
                .default('./cert/client.pem')
                .env('CTRLQ_CERT_FILE')
        )
        .addOption(
            new Option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)')
                .default('./cert/client_key.pem')
                .env('CTRLQ_CERT_KEY_FILE')
        )
        .addOption(
            new Option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)')
                .default('./cert/root.pem')
                .env('CTRLQ_ROOT_CERT_FILE')
        )
        .addOption(new Option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server').env('CTRLQ_JWT'))
        .addOption(new Option('--app-id <ids...>', 'use app IDs to select which apps to export').env('CTRLQ_APP_ID'))
        .addOption(new Option('--app-tag <tags...>', 'use app tags to select which apps to export').env('CTRLQ_APP_TAG'))
        .addOption(new Option('--app-published', 'export all published apps').default(false).env('CTRLQ_APP_PUBLISHED'))
        .addOption(
            new Option('--output-dir <directory>', 'relative or absolute path in which QVF files should be stored')
                .default('qvf-export')
                .env('CTRLQ_OUTPUT_DIR')
        )
        .addOption(
            new Option('--qvf-name-format <format...>', 'structure of QVF file name format')
                .choices(['app-id', 'app-name', 'export-date', 'export-time'])
                .default(['app-name'])
                .env('CTRLQ_QVF_NAME_FORMAT')
        )
        .addOption(
            new Option('--qvf-name-separator <separator>', 'character used to separate parts of the QVF file name')
                .choices(['-', '--', '_', '__'])
                .default('_')
                .env('CTRLQ_QVF_NAME_SEPARATOR')
        )
        .addOption(new Option('--qvf-overwrite', 'overwrite existing QVF files without asking').env('CTRLQ_QVF_OVERWRITE'))
        .addOption(
            new Option('--exclude-app-data <true|false>', 'exclude or include app data in QVF file')
                .default(true)
                .env('CTRLQ_EXCLUDE_APP_DATA')
        )
        .addOption(
            new Option('--limit-export-count <number>', 'export at most x number of apps. Defaults to 0 = no limit')
                .default(0)
                .env('CTRLQ_LIMIT_EXPORT_COUNT')
        )
        .addOption(
            new Option(
                '--sleep-app-export <milliseconds>',
                'Wait this long before continuing after each app has been exported. Defaults to 1000 = 1 second'
            )
                .default(1000)
                .env('CTRLQ_SLEEP_APP_EXPORT')
        )
        .addOption(
            new Option('--metadata-file-create', 'create a separate file with information about all exported apps').env(
                'CTRLQ_METADATA_FILE_CREATE'
            )
        )
        .addOption(
            new Option('--metadata-file-name <name>', 'file name to store app metadata in')
                .default('app_export.xlsx')
                .env('CTRLQ_METADATA_FILE_NAME')
        )
        .addOption(
            new Option('--metadata-file-format <format>', 'file type/format')
                .choices(['excel'])
                .default('excel')
                .env('CTRLQ_METADATA_FILE_FORMAT')
        )
        .addOption(
            new Option('--metadata-file-overwrite', 'overwrite app metadata file without asking').env('CTRLQ_METADATA_FILE_OVERWRITE')
        )
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not export any apps - just show what would be done').env('CTRLQ_DRY_RUN')
        );
}
