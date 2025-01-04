import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, getTaskAssertOptions } from '../util/qseow/assert-options.js';
import { getTask } from '../cmd/qseow/gettask.js';

export function setupGetTaskCommand(qseow) {
    qseow
        .command('task-get')
        .description('get info about one or more tasks')
        .action(async (options) => {
            const newOptions = options;
            // If options.tableDetails is true, it means --table-details was passed as options without any explicit value.
            // This is allowed, but should be interpreted as "all" table details.
            // Make options.tableDetails an array with all possible table details.
            if (options.tableDetails === true) {
                newOptions.tableDetails = ['common', 'lastexecution', 'tag', 'customproperty', 'schematrigger', 'compositetrigger'];
            }

            await qseowSharedParamAssertOptions(newOptions);
            await getTaskAssertOptions(newOptions);

            // If --output-format=table and --task-type is not specified, default to ['reload', 'ext-program']
            if (newOptions.outputFormat === 'table' && !newOptions.taskType) {
                newOptions.taskType = ['reload', 'ext-program'];
            }

            getTask(newOptions);
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
            new Option('--task-type <type...>', 'type of tasks to include').choices(['reload', 'ext-program']).env('CTRLQ_TASK_TYPE')
        )
        .addOption(new Option('--task-id <ids...>', 'use task IDs to select which tasks to retrieve.').env('CTRLQ_TASK_ID'))
        .addOption(new Option('--task-tag <tags...>', 'use tags to select which tasks to retrieve.').env('CTRLQ_TASK_TAG'))
        .addOption(
            new Option('--output-format <format>', 'output format').choices(['table', 'tree']).default('tree').env('CTRLQ_OUTPUT_FORMAT')
        )
        .addOption(
            new Option('--output-dest <dest>', 'where to send task info')
                .choices(['screen', 'file'])
                .default('screen')
                .env('CTRLQ_OUTPUT_DEST')
        )
        .addOption(new Option('--output-file-name <name>', 'file name to store task info in').default('').env('CTRLQ_OUTPUT_FILE_NAME'))
        .addOption(
            new Option('--output-file-format <format>', 'file type/format')
                .choices(['excel', 'csv', 'json'])
                .default('excel')
                .env('CTRLQ_OUTPUT_FILE_FORMAT')
        )
        .addOption(new Option('--output-file-overwrite', 'overwrite output file without asking').env('CTRLQ_OUTPUT_FILE_OVERWRITE'))
        .addOption(
            new Option('--text-color <show>', 'use colored text in task views')
                .choices(['yes', 'no'])
                .default('yes')
                .env('CTRLQ_TEXT_COLOR')
        )
        .addOption(new Option('--tree-icons', 'display task status icons in tree view').env('CTRLQ_TREE_ICONS'))
        .addOption(
            new Option('--tree-details [detail...]', 'display details for each task in tree view')
                .choices(['taskid', 'laststart', 'laststop', 'nextstart', 'appname', 'appstream'])
                .default('')
                .env('CTRLQ_TREE_DETAILS')
        )
        .addOption(
            new Option(
                '--table-details [detail...]',
                'which aspects of tasks should be included in table view. Not choosing any details will show all'
            )
                .choices(['common', 'lastexecution', 'tag', 'customproperty', 'schematrigger', 'compositetrigger'])
                .default('')
                .env('CTRLQ_TABLE_DETAILS')
        );
}
