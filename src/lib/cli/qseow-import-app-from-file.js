import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, appImportAssertOptions } from '../util/qseow/assert-options.js';
import { importAppFromFile } from '../cmd/qseow/importapp.js';

export function setupQseowImportAppFromFileCommand(qseow) {
    qseow
        .command('app-import')
        .description('import apps/upload QVF files on disk to Sense based on definitions in Excel file.')
        .action(async (options) => {
            try {
                await qseowSharedParamAssertOptions(options);
                appImportAssertOptions(options);
                importAppFromFile(options);
            } catch (err) {
                catchLog('IMPORT APP', err);
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
        .addOption(new Option('-t, --file-type <type>', 'source file type').choices(['excel']).default('excel').env('CTRLQ_FILE_TYPE'))
        .addOption(new Option('--file-name <filename>', 'file containing app definitions').makeOptionMandatory().env('CTRLQ_FILE_NAME'))
        .addOption(
            new Option('--sheet-name <name>', 'name of Excel sheet where app info is found').makeOptionMandatory().env('CTRLQ_SHEET_NAME')
        )
        .addOption(
            new Option('--limit-import-count <number>', 'import at most x number of apps. Defaults to 0 = no limit')
                .makeOptionMandatory()
                .default(0)
                .env('CTRLQ_LIMIT_IMPORT_COUNT')
        )
        .addOption(
            new Option(
                '--sleep-app-upload <milliseconds>',
                'Wait this long before continuing after each app has been uploaded to Sense. Defaults to 1000 = 1 second'
            )
                .makeOptionMandatory()
                .default(1000)
                .env('CTRLQ_SLEEP_APP_UPLOAD')
        )
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not import any apps - just show what would be done').env('CTRLQ_DRY_RUN')
        );
}
