import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, taskImportAssertOptions } from '../util/qseow/assert-options.js';
import { importTaskFromFile } from '../cmd/qseow/importtask.js';

export function setupQseowImportTaskFromFileCommand(qseow) {
    qseow
        .command('task-import')
        .description('create tasks based on definitions in a file on disk, optionally also importing apps from QVF files.')
        .action(async (options) => {
            try {
                await qseowSharedParamAssertOptions(options);
                taskImportAssertOptions(options);
                importTaskFromFile(options);
            } catch (err) {
                catchLog('IMPORT TASK 1', err);
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
        .addOption(
            new Option('-t, --file-type <type>', 'source file type').choices(['excel', 'csv']).default('excel').env('CTRLQ_FILE_TYPE')
        )
        .addOption(new Option('--file-name <filename>', 'file containing task definitions').makeOptionMandatory().env('CTRLQ_FILE_NAME'))
        .addOption(new Option('--sheet-name <name>', 'name of Excel sheet where task info is found').env('CTRLQ_SHEET_NAME'))
        .addOption(
            new Option('--update-mode <mode>', 'create new or update existing tasks')
                .choices(['create'])
                .default('create')
                .env('CTRLQ_UPDATE_MODE')
        )
        .addOption(
            new Option('--limit-import-count <number>', 'import at most x number of tasks from the source file. Defaults to 0 = no limit')
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
        .addOption(new Option('--import-app', 'import Sense app QVFs from specified directory').env('CTRLQ_IMPORT_APP'))
        .addOption(
            new Option('--import-app-sheet-name <name>', 'name of Excel sheet where app definitions are found').env(
                'CTRLQ_IMPORT_APP_SHEET_NAME'
            )
        )
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not create any reload tasks - just show what would be done').env('CTRLQ_DRY_RUN')
        );
}
