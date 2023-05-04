const { Command, Option } = require('commander');

const { logger, appVersion, setLoggingLevel } = require('./globals');
const { logStartupInfo } = require('./lib/util/log');

// const { createUserActivityCustomProperty } = require('./lib/createuseractivitycp');

const { getMasterDimension } = require('./lib/cmd/getdim');
const { deleteMasterDimension } = require('./lib/cmd/deletedim');

const { getMasterMeasure } = require('./lib/cmd/getmeasure');
const { deleteMasterMeasure } = require('./lib/cmd/deletemeasure');

const { getBookmark } = require('./lib/cmd/getbookmark');

const { importMasterItemFromFile } = require('./lib/cmd/import-masteritem-excel');

const { scrambleField } = require('./lib/cmd/scramblefield');
const { getScript } = require('./lib/cmd/getscript');

const { getTask } = require('./lib/cmd/gettask');
const { setTaskCustomProperty } = require('./lib/cmd/settaskcp');
const { importTaskFromFile } = require('./lib/cmd/importtask');
const { importAppFromFile } = require('./lib/cmd/importapp');
const { exportAppToFile } = require('./lib/cmd/exportapp');

const {
    sharedParamAssertOptions,
    // userActivityCustomPropertyAssertOptions,
    masterItemImportAssertOptions,
    masterItemMeasureDeleteAssertOptions,
    masterItemDimDeleteAssertOptions,
    masterItemGetAssertOptions,
    getScriptAssertOptions,
    getBookmarkAssertOptions,
    getTaskAssertOptions,
    setTaskCustomPropertyAssertOptions,
    taskImportAssertOptions,
    appImportAssertOptions,
    appExportAssertOptions,
} = require('./lib/util/assert-options');

const program = new Command();

/**
 * Top level async function.
 * Workaround to deal with the fact that Node.js doesn't currently support top level async functions...
 */
(async () => {
    // Basic app info
    program
        .version(appVersion)
        .description(
            'Ctrl-Q is a command line utility for interacting with client-managed Qlik Sense Enterprise on Windows servers.\nAmong other things the tool does bulk import of apps and tasks, manipulates master items and scrambles in-app data.'
        )
        .hook('preAction', (thisCommand, actionCommand) => {
            const options = actionCommand.opts();

            // Set log level & show startup info
            setLoggingLevel(options.logLevel);
            // eslint-disable-next-line no-underscore-dangle
            logStartupInfo(options, actionCommand._name, actionCommand._description);

            logger.verbose(`About to call action handler for subcommand: ${actionCommand.name()}`);
        });

    // Create custom properties for tracking user activity buckets, i.e. how long ago a user was last active (last login) in Sense
    // program
    //     .command('user-activity-cp-create')
    //     .description(
    //         'create custom property and populate it with values ("activity buckets") indicating how long ago users last logged into Sense'
    //     )
    //     .action(async (options) => {
    //         try {
    //             let optionsLocal = options;
    //             await sharedParamAssertOptions(options);
    //             optionsLocal = userActivityCustomPropertyAssertOptions(options);
    //             createUserActivityCustomProperty(optionsLocal);
    //         } catch (err) {
    //             logger.error(`USER ACTIVITY CP: ${err}`);
    //         }
    //     })
    //     .addOption(
    //         new Option('--log-level <level>', 'log level')
    //             .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
    //             .default('info')
    //     )
    //     .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    //     .option('--port <port>', 'Qlik Sense repository API port', '4242')
    //     .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
    //     .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    //     .option('--auth-user-dir <directory>', 'user directory for user to connect with', 'Internal')
    //     .option('--auth-user-id <userid>', 'user ID for user to connect with', 'sa_repository')

    //     .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
    //     .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    //     .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    //     .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    //     .option('--jwt <JWT>', 'JSON Web Token (JWT) to use for authenticating with Qlik Sense', '')

    //     .requiredOption('--user-directory <name>', 'name of user directory whose users will be updated with activity info')
    //     .requiredOption('--custom-property-name <name>', 'name of custom property that will hold user activity buckets')
    //     .addOption(
    //         new Option('--force <true|false>', 'forcibly overwrite and replace custom property and its values if it already exists')
    //             .choices(['true', 'false'])
    //             .default('false')
    //     )
    //     .option('--activity-buckets <buckets...>', 'custom property values/user activity buckets to be defined. In days.', [
    //         '1',
    //         '7',
    //         '14',
    //         '30',
    //         '90',
    //         '180',
    //         '365',
    //     ]);

    // Import dimensions/measures from definitions in Excel file
    program
        .command('master-item-import')
        .description('create master items based on definitions in a file on disk')
        .action(async (options) => {
            try {
                await sharedParamAssertOptions(options);
                masterItemImportAssertOptions(options);
                importMasterItemFromFile(options);
            } catch (err) {
                logger.error(`IMPORT EXCEL: ${err}`);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('-t, --file-type <type>', 'source file type').choices(['excel']).default('excel'))
        .requiredOption('--file <filename>', 'file containing master item definitions')
        .requiredOption('--sheet <name>', 'name of Excel sheet where dim/measure flag column is found')
        .addOption(
            new Option(
                '--col-ref-by <reftype>',
                'how to refer to columns in the source file. Options are by name or by position (zero based)'
            )
                .choices(['name', 'position'])
                .default('name')
        )
        .requiredOption(
            '--col-item-type <column position or name>',
            'column where dim/measure flag is found. Use "dim" in that column to create master dimension, "measure" for master measure'
        )
        .requiredOption('--col-master-item-name <column position or name>', 'column number (zero based) to use as master item name')
        .requiredOption('--col-master-item-descr <column position or name>', 'column number (zero based) to use as master item description')
        .requiredOption('--col-master-item-label <column position or name>', 'column number (zero based) to use as master item label')
        .requiredOption('--col-master-item-expr <column position or name>', 'column number (zero based) to use as master item expression')
        .requiredOption('--col-master-item-tag <column position or name>', 'column number (zero based) to use as master item tags')

        .requiredOption(
            '--limit-import-count <number>',
            'import at most x number of master items from the Excel file. Defaults to 0 = no limit',
            0
        );

    // Get measure command
    program
        .command('master-item-measure-get')
        .description('get info about one or more master measures')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            masterItemGetAssertOptions(options);

            getMasterMeasure(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']).default('name')
        )
        .option('--master-item <ids...>', 'master measure to retrieve. If not specified all measures will be retrieved')
        .addOption(new Option('--output-format <format>', 'output format').choices(['json', 'table']).default('json'));

    // Delete measure command
    program
        .command('master-item-measure-delete')
        .description('delete master measure(s)')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            masterItemMeasureDeleteAssertOptions(options);

            deleteMasterMeasure(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']))
        .option('--master-item <ids...>', 'names or IDs of master measures to be deleted. Multiple IDs should be space separated')
        .option('--delete-all', 'delete all master measures')
        .option('--dry-run', 'do a dry run, i.e. do not delete anything - just show what would be deleted');

    // Get dimension command
    program
        .command('master-item-dim-get')
        .description('get info about one or more master dimensions')
        .action(async (options) => {
            await sharedParamAssertOptions(options);

            getMasterDimension(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .requiredOption('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .requiredOption('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .requiredOption('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']).default('name')
        )
        .option('--master-item <ids...>', 'master measure to retrieve. If not specified all dimensions will be retrieved')
        .addOption(new Option('--output-format <format>', 'output format').choices(['json', 'table']).default('json'));

    // Delete dimension command
    program
        .command('master-item-dim-delete')
        .description('delete master dimension(s)')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            masterItemDimDeleteAssertOptions(options);

            deleteMasterDimension(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']))
        .option('--master-item <ids...>', 'names or IDs of master dimensions to be deleted. Multiple IDs should be space separated')
        .option('--delete-all', 'delete all master dimensions')
        .option('--dry-run', 'do a dry run, i.e. do not delete anything - just show what would be deleted');

    // Scramble field command
    program
        .command('field-scramble')
        .description('scramble one or more fields in an app. A new app with the scrambled data is created.')
        .action(async (options) => {
            await sharedParamAssertOptions(options);

            scrambleField(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .requiredOption('--field-name <names...>', 'name of field(s) to be scrambled')
        .requiredOption('--new-app-name <name>', 'name of new app that will contain scrambled data');

    // Get script command
    program
        .command('script-get')
        .description('get script from Qlik Sense app')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            getScriptAssertOptions(options);

            getScript(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem');

    // Get bookmark command
    program
        .command('bookmark-get')
        .description('get info about one or more bookmarks')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            getBookmarkAssertOptions(options);

            getBookmark(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--id-type <type>', 'type of bookmark identifier passed in the --bookmark option')
                .choices(['id', 'name'])
                .default('name')
        )
        .option('--bookmark <bookmarks...>', 'bookmark to retrieve. If not specified all bookmarks will be retrieved')
        .option('--output-format <json|table>', 'output format', 'json');

    // Get tasks command
    program
        .command('task-get')
        .description('get info about one or more tasks')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            getTaskAssertOptions(options);

            getTask(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense repository service (QRS) port', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--task-type <type...>', 'type of tasks to list')
                .choices(['reload', 'ext-program'])
                .default(['reload', 'ext-program'])
        )
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
            new Option('--table-details [detail...]', 'which aspects of tasks should be included in table view')
                .choices([
                    'common',
                    'lastexecution',
                    'tag',
                    'customproperty',
                    'schematrigger',
                    'compositetrigger',
                    'comptimeconstraint',
                    'comprule',
                ])
                .default('')
        );

    // Set custom property on tasks command
    program
        .command('task-custom-property-set')
        .description('update a custom property of one or more tasks')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            setTaskCustomPropertyAssertOptions(options);

            await setTaskCustomProperty(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense repository service (QRS) port', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--task-type <type...>', 'type of tasks to list')
                .choices(['reload', 'ext-program'])
                .default(['reload', 'ext-program'])
        )
        .option('--task-id <ids...>', 'use task IDs to select which tasks to retrieve')
        .option('--task-tag <tags...>', 'use tags to select which tasks to retrieve')

        .requiredOption('--custom-property-name <name>', 'name of custom property that will be updated')
        .requiredOption('--custom-property-value <values...>', 'one or more values name of custom property that will be updated')
        .option('--overwrite', 'overwrite existing custom property values without asking')
        .addOption(
            new Option('--update-mode <mode>', 'append or replace value(s) to existing custom property')
                .choices(['append', 'replace'])
                .default('append')
        )
        .option('--dry-run', 'do a dry run, i.e. do not modify any reload tasks - just show what would be updated');

    // Import tasks from definitions in Excel/CSV file
    program
        .command('task-import')
        .description('create tasks based on definitions in a file on disk, optionally also importing apps from QVF files.')
        .action(async (options) => {
            try {
                await sharedParamAssertOptions(options);
                taskImportAssertOptions(options);
                importTaskFromFile(options);
            } catch (err) {
                logger.error(`IMPORT TASK: ${err}`);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('-t, --file-type <type>', 'source file type').choices(['excel', 'csv']).default('excel'))
        .requiredOption('--file-name <filename>', 'file containing task definitions')
        .option('--sheet-name <name>', 'name of Excel sheet where task info is found')

        .addOption(new Option('--update-mode <mode>', 'create new or update existing tasks').choices(['create']).default('create'))

        .requiredOption(
            '--limit-import-count <number>',
            'import at most x number of tasks from the source file. Defaults to 0 = no limit',
            0
        )
        .requiredOption(
            '--sleep-app-upload <milliseconds>',
            'Wait this long before continuing after each app has been uploaded to Sense. Defaults to 1000 = 1 second',
            1000
        )

        .option('--import-app', 'import Sense app QVFs from specified directory')
        .option('--import-app-sheet-name <name>', 'name of Excel sheet where app definitions are found')

        .option('--dry-run', 'do a dry run, i.e. do not create any reload tasks - just show what would be done');

    // Import apps from definitions in Excel file
    program
        .command('app-import')
        .description('import apps/upload QVF files on disk to Sense based on definitions in Excel file.')
        .action(async (options) => {
            try {
                await sharedParamAssertOptions(options);
                appImportAssertOptions(options);
                importAppFromFile(options);
            } catch (err) {
                logger.error(`IMPORT APP: ${err}`);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('-t, --file-type <type>', 'source file type').choices(['excel']).default('excel'))
        .requiredOption('--file-name <filename>', 'file containing app definitions')
        .requiredOption('--sheet-name <name>', 'name of Excel sheet where app info is found')

        .requiredOption('--limit-import-count <number>', 'import at most x number of apps. Defaults to 0 = no limit', 0)
        .requiredOption(
            '--sleep-app-upload <milliseconds>',
            'Wait this long before continuing after each app has been uploaded to Sense. Defaults to 1000 = 1 second',
            1000
        )

        .option('--dry-run', 'do a dry run, i.e. do not import any apps - just show what would be done');

    // Export apps to QVF files
    program
        .command('app-export')
        .description('export Qlik Sense apps to QVF files on disk.')
        .action(async (options) => {
            try {
                await sharedParamAssertOptions(options);
                await appExportAssertOptions(options);
                exportAppToFile(options);
            } catch (err) {
                logger.error(`EXPORT APP: ${err}`);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .option('--app-id <ids...>', 'use app IDs to select which apps to export')
        .option('--app-tag <tags...>', 'use app tags to select which apps to export')

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

    // Parse command line params
    await program.parseAsync(process.argv);
})();
