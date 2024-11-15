import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, getTaskAssertOptions } from '../util/qseow/assert-options.js';
import getTask from '../cmd/qseow/gettask.js';

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
            getTaskAssertOptions(newOptions);

            // If --output-format=table and --task-type is not specified, default to ['reload', 'ext-program']
            if (newOptions.outputFormat === 'table' && !newOptions.taskType) {
                newOptions.taskType = ['reload', 'ext-program'];
            }

            getTask(newOptions);
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

        .addOption(new Option('--task-type <type...>', 'type of tasks to include').choices(['reload', 'ext-program']))
        .option('--task-id <ids...>', 'use task IDs to select which tasks to retrieve. Only allowed when --output-format=table')
        .option('--task-tag <tags...>', 'use tags to select which tasks to retrieve. Only allowed when --output-format=table')

        .addOption(new Option('--output-format <format>', 'output format').choices(['table', 'tree']).default('tree'))
        .addOption(new Option('--output-dest <dest>', 'where to send task info').choices(['screen', 'file']).default('screen'))
        .addOption(new Option('--output-file-name <name>', 'file name to store task info in').default(''))
        .addOption(new Option('--output-file-format <format>', 'file type/format').choices(['excel', 'csv', 'json']).default('excel'))
        .option('--output-file-overwrite', 'overwrite output file without asking')

        .addOption(new Option('--text-color <show>', 'use colored text in task views').choices(['yes', 'no']).default('yes'))

        .option('--tree-icons', 'display task status icons in tree view')
        .addOption(
            new Option('--tree-details [detail...]', 'display details for each task in tree view')
                .choices(['taskid', 'laststart', 'laststop', 'nextstart', 'appname', 'appstream'])
                .default('')
        )

        .addOption(
            new Option(
                '--table-details [detail...]',
                'which aspects of tasks should be included in table view. Not choosing any details will show all'
            )
                .choices(['common', 'lastexecution', 'tag', 'customproperty', 'schematrigger', 'compositetrigger'])
                .default('')
        );
}
