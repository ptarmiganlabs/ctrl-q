import { Command, Option } from 'commander';
import { logger, appVersion, setLoggingLevel, setCliOptions } from './globals.js';
import { catchLog, logStartupInfo } from './lib/util/log.js';

// const { createUserActivityCustomProperty } = require('./lib/createuseractivitycp');

import getMasterDimension from './lib/cmd/getdim.js';

import deleteMasterDimension from './lib/cmd/deletedim.js';
import getMasterMeasure from './lib/cmd/getmeasure.js';
import deleteMasterMeasure from './lib/cmd/deletemeasure.js';
import getVariable from './lib/cmd/getvariable.js';
import deleteVariable from './lib/cmd/deletevariable.js';
import getBookmark from './lib/cmd/getbookmark.js';
import importMasterItemFromFile from './lib/cmd/import-masteritem-excel.js';
import scrambleField from './lib/cmd/scramblefield.js';
import getScript from './lib/cmd/getscript.js';
import getTask from './lib/cmd/gettask.js';
import setTaskCustomProperty from './lib/cmd/settaskcp.js';
import importTaskFromFile from './lib/cmd/importtask.js';
import importAppFromFile from './lib/cmd/importapp.js';
import exportAppToFile from './lib/cmd/exportapp.js';
import testConnection from './lib/cmd/testconnection.js';
import visTask from './lib/cmd/vistask.js';
import getSessions from './lib/cmd/getsessions.js';
import deleteSessions from './lib/cmd/deletesessions.js';

import {
    sharedParamAssertOptions,
    masterItemImportAssertOptions,
    masterItemMeasureDeleteAssertOptions,
    masterItemDimDeleteAssertOptions,
    masterItemGetAssertOptions,
    variableGetAssertOptions,
    variableDeleteAssertOptions,
    getScriptAssertOptions,
    getBookmarkAssertOptions,
    getTaskAssertOptions,
    setTaskCustomPropertyAssertOptions,
    taskImportAssertOptions,
    appImportAssertOptions,
    appExportAssertOptions,
    getSessionsAssertOptions,
    deleteSessionsAssertOptions,
} from './lib/util/assert-options.js';

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
            `Ctrl-Q is a command line utility for interacting with client-managed Qlik Sense Enterprise on Windows servers.\nAmong other things the tool does bulk import of apps and tasks, manipulates master items and scrambles in-app data.\n\nVersion: ${appVersion}`
        )
        .hook('preAction', (thisCommand, actionCommand) => {
            const options = actionCommand.opts();

            // Store CLI options in global variable
            setCliOptions(options);

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
    //     .requiredOption('--secure <true|false>', 'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.', true)
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
                catchLog('IMPORT EXCEL', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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
            'column where dim/measure flag is found. Use "dim-single" in that column to create dimension, "dim-drilldown" for drill-down dimension, "measure" for measure',
            'Master item type'
        )
        .requiredOption(
            '--col-master-item-name <column position or name>',
            'column number (zero based) or name to use as master item name',
            'Master item name'
        )
        .requiredOption(
            '--col-master-item-descr <column position or name>',
            'column number (zero based) or name to use as master item description',
            'Description'
        )
        .requiredOption(
            '--col-master-item-label <column position or name>',
            'column number (zero based) or name to use as master item label',
            'Label'
        )
        .requiredOption(
            '--col-master-item-expr <column position or name>',
            'column number (zero based) or name to use as master item expression',
            'Expression'
        )
        .requiredOption(
            '--col-master-item-tag <column position or name>',
            'column number (zero based) or name to use as master item tags',
            'Tag'
        )
        .requiredOption(
            '--col-master-item-color <column position or name>',
            'column number (zero based) or name to use as color for dimensions/measures',
            'Color'
        )
        .requiredOption(
            '--col-master-item-per-value-color <column position or name>',
            'column number (zero based) or name to use as per-value/segment color for dimensions/measures',
            'Per value color'
        )

        .requiredOption('--sleep-between-imports <milliseconds>', 'sleep this many milliseconds between imports. Set to 0 to disable', 1000)
        .requiredOption(
            '--limit-import-count <number>',
            'import at most x number of master items from the Excel file. Defaults to 0 = no limit',
            0
        )
        .option('--dry-run', 'do a dry run, i.e. do not create or update anything - just show what would be done');

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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption(
            '--secure <true|false>',
            'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.',
            true
        )
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
        .requiredOption('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .requiredOption('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .requiredOption('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server')

        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']).default('name')
        )
        .option('--master-item <ids...>', 'master dimension to retrieve. If not specified all dimensions will be retrieved')
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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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

        .addOption(new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']))
        .option('--master-item <ids...>', 'names or IDs of master dimensions to be deleted. Multiple IDs should be space separated')
        .option('--delete-all', 'delete all master dimensions')
        .option('--dry-run', 'do a dry run, i.e. do not delete anything - just show what would be deleted');

    // Get variable command
    program
        .command('variable-get')
        .description('get variable definitions in one or more apps')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            variableGetAssertOptions(options);

            getVariable(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--engine-port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4747 for cert auth, 443 for jwt auth)', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .option('--app-id <id...>', 'Qlik Sense app ID(s) to get variables from')
        .option('--app-tag <tag...>', 'Qlik Sense app tag(s) to get variables')
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

        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --variable option').choices(['id', 'name']).default('name')
        )
        .option('--variable <ids...>', 'variables to retrieve. If not specified all variables will be retrieved')
        .addOption(new Option('--output-format <format>', 'output format').choices(['json', 'table']).default('json'));

    // Delete variable command
    program
        .command('variable-delete')
        .description('delete one or more variables in one or more apps')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            variableDeleteAssertOptions(options);

            deleteVariable(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--engine-port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)', '4242')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .option('--app-id <id...>', 'Qlik Sense app ID(s) to get variables from')
        .option('--app-tag <tag...>', 'Qlik Sense app tag(s) to get variables')
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

        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --variable option').choices(['id', 'name']).default('name')
        )
        .option('--variable <ids...>', 'variables to retrieve. If not specified all variables will be retrieved')
        .option('--delete-all', 'delete all variables')
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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server');

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
        .option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)', '4747')
        .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--app-id <id>', 'Qlik Sense app ID')
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
            const newOptions = options;
            // If options.tableDetails is true, it means --table-details was passed as options without any explicit value.
            // This is allowed, but should be interpreted as "all" table details.
            // Make options.tableDetails an array with all possible table details.
            if (options.tableDetails === true) {
                newOptions.tableDetails = ['common', 'lastexecution', 'tag', 'customproperty', 'schematrigger', 'compositetrigger'];
            }

            await sharedParamAssertOptions(newOptions);
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

        .addOption(
            new Option('--task-type <type...>', 'type of tasks to list').choices(['reload']).default(['reload'])
            // .choices(['reload', 'ext-program'])
            // .default(['reload', 'ext-program'])
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
                catchLog('IMPORT TASK 1', err);
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
                catchLog('IMPORT APP', err);
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

    // Test connection command
    program
        .command('connection-test')
        .description('test connection to Qlik Sense server.')
        .action(async (options) => {
            try {
                await sharedParamAssertOptions(options);
                testConnection(options);
            } catch (err) {
                catchLog('CONNECTION TEST', err);
            }
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense proxy service port', '4242')
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
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server');

    // Show version command
    program
        .command('version')
        .description('show version info')
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        // eslint-disable-next-line no-unused-vars
        .action(async (options) => {
            logger.verbose(`Version: ${appVersion}`);
        });

    // Visualise task network
    program
        .command('task-vis')
        .description('visualise task network')
        .action(async (options) => {
            await sharedParamAssertOptions(options);

            await visTask(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)', '4242')
        // .option('--schema-version <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix', '')
        // .requiredOption('--secure <true|false>', 'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert', 'jwt']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
        .option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server')

        // Options for visualisation host
        .option('--vis-host <host>', 'host for visualisation server', 'localhost')
        .option('--vis-port <port>', 'port for visualisation server', '3000');

    // Get proxy sessions
    program
        .command('sessions-get')
        .description('get info about proxy sessions on one or more virtual proxies')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            await getSessionsAssertOptions(options);

            getSessions(options, null);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )

        .requiredOption('--host <host>', 'Qlik Sense host (IP/FQDN) where Qlik Repository Service (QRS) is running')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix to access QRS via', '')
        .option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242)', '4242')

        .option('--session-virtual-proxy <prefix...>', 'one or more Qlik Sense virtual proxies to get sessions for')
        .option(
            '--host-proxy <host...>',
            'Qlik Sense hosts/proxies (IP/FQDN) to get sessions from. Must match the host names of the Sense nodes'
        )
        .option('--qps-port <port>', 'Qlik Sense proxy service (QPS) port (usually 4243)', '4243')

        .requiredOption('--secure <true|false>', 'connection to Qlik Sense repository service is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .option('--output-format <json|table>', 'output format', 'json')

        .addOption(
            new Option('-s, --sort-by <column>', 'column to sort output table by')
                .choices(['prefix', 'proxyhost', 'proxyname', 'userdir', 'userid', 'username'])
                .default('prefix')
        );

    // Delete proxy sessions
    program
        .command('sessions-delete')
        .description('delete proxy session(s) on a specific virtual proxy and proxy service')
        .action(async (options) => {
            await sharedParamAssertOptions(options);
            await deleteSessionsAssertOptions(options);

            deleteSessions(options);
        })
        .addOption(
            new Option('--log-level <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense host (IP/FQDN) where Qlik Repository Service (QRS) is running')
        .requiredOption('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix to access QRS via', '')
        .option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242)', '4242')

        .option('--session-id <id...>', 'session IDs to delete')
        .requiredOption('--session-virtual-proxy <prefix>', 'Qlik Sense virtual proxy (prefix) to delete proxy session(s) on', '')
        .requiredOption(
            '--host-proxy <host>',
            'Qlik Sense proxy (IP/FQDN) where sessions should be deleted. Must match the host name of a Sense node'
        )
        .option('--qps-port <port>', 'Qlik Sense proxy service (QPS) port (usually 4243)', '4243')

        .requiredOption('--secure <true|false>', 'connection to Qlik Sense repository service is via https', true)
        .requiredOption('--auth-user-dir <directory>', 'user directory for user to connect with')
        .requiredOption('--auth-user-id <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--auth-cert-file <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--auth-cert-key-file <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--auth-root-cert-file <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem');

    // .option('--dry-run', 'do a dry run, i.e. do not delete any sessions - just show what would be deleted')

    // Parse command line params
    await program.parseAsync(process.argv);
})();
