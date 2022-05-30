const { Command, Option } = require('commander');
const { logger, appVersion, getLoggingLevel, setLoggingLevel } = require('./globals');

const { getMasterDimension } = require('./lib/getdim');
const { createMasterDimension } = require('./lib/createdim');
const { deleteMasterDimension } = require('./lib/deletedim');

const { getMasterMeasure } = require('./lib/getmeasure');
const { deleteMasterMeasure } = require('./lib/deletemeasure');

const { getBookmark } = require('./lib/getbookmark');

const { importMasterItemFromFile } = require('./lib/importexcel');

const { scrambleField } = require('./lib/scramblefield');
const { getScript } = require('./lib/getscript');

const {
    sharedParamAssertOptions,
    masterItemImportAssertOptions,
    masterItemMeasureDeleteAssertOptions,
    masterItemDimDeleteAssertOptions,
    masterItemGetAssertOptions,
    getScriptAssertOptions,
    getBookmarkAssertOptions,
} = require('./lib/assert-options');

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
            'Ctrl-Q is a command line utility for interacting with client-managed Qlik Sense Enterprise on Windows servers.\nAmong other things the tool manipulates master items and scrambles in-app data.'
        );

    // Import dimensions/measures from definitions in Excel file
    program
        .command('master-item-import')
        .description('create master items based on definitions in an file on disk')
        .action(async (options) => {
            try {
                logger.verbose(`appid=${options.appid}`);
                logger.verbose(`itemid=${options.itemid}`);

                sharedParamAssertOptions(options);
                masterItemImportAssertOptions(options);
                importMasterItemFromFile(options);
            } catch (err) {
                logger.error(`IMPORT EXCEL: ${err}`);
            }
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-t, --file-type <type>', 'source file type').choices(['excel']).default('excel'))
        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('--file-type <type>', 'format of source file').choices(['excel']).default('excel'))
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
            logger.verbose(`appid=${options.appid}`);
            logger.verbose(`itemid=${options.itemid}`);

            sharedParamAssertOptions(options);
            masterItemGetAssertOptions(options);

            getMasterMeasure(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

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
            logger.verbose(`appid=${options.appid}`);
            logger.verbose(`itemid=${options.itemid}`);

            sharedParamAssertOptions(options);
            masterItemMeasureDeleteAssertOptions(options);

            deleteMasterMeasure(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']))
        .option('--master-item <ids...>', 'names or IDs of master measures to be deleted. Multiple IDs should be space separated')
        .option('--delete-all', 'delete all master measures')
        .option('--dry-run', 'do a dry run, i.e. do not delete anything - just show what would be deleted');

    // Get dimension command
    program
        .command('master-item-dim-get')
        .description('get info about one or more master dimensions')
        .action(async (options) => {
            logger.verbose(`appid=${options.appid}`);
            logger.verbose(`itemid=${options.itemid}`);

            sharedParamAssertOptions(options);

            getMasterDimension(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']).default('name')
        )
        .option('--master-item <ids...>', 'master measure to retrieve. If not specified all measures will be retrieved')
        .addOption(new Option('--output-format <format>', 'output format').choices(['json', 'table']).default('json'));

    // Delete dimension command
    program
        .command('master-item-dim-delete')
        .description('delete master dimension(s)')
        .action(async (options) => {
            logger.verbose(`appid=${options.appid}`);
            logger.verbose(`itemid=${options.itemid}`);

            sharedParamAssertOptions(options);
            masterItemDimDeleteAssertOptions(options);

            deleteMasterDimension(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(new Option('--id-type <type>', 'type of identifier passed in the --master-item option').choices(['id', 'name']))
        .option('--master-item <ids...>', 'names or IDs of master dimensions to be deleted. Multiple IDs should be space separated')
        .option('--delete-all', 'delete all master dimensions')
        .option('--dry-run', 'do a dry run, i.e. do not delete anything - just show what would be deleted');

    // Scramble field command
    program
        .command('field-scramble')
        .description('scramble one or more fields in an app. A new app with the scrambled data is created.')
        .action(async (options) => {
            logger.verbose(`appid=${options.appid}`);
            logger.verbose(`fieldname=${options.fieldname}`);

            sharedParamAssertOptions(options);

            scrambleField(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .requiredOption('--field-name <names...>', 'name of field(s) to be scrambled')
        .requiredOption('--new-app-name <name>', 'name of new app that will contain scrambled data');

    // Get script command
    program
        .command('script-get')
        .description('get script from Qlik Sense app')
        .action(async (options) => {
            logger.verbose(`appid=${options.appid}`);

            sharedParamAssertOptions(options);
            getScriptAssertOptions(options);

            getScript(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem');

    // Get bookmark command
    program
        .command('bookmark-get')
        .description('get info about one or more bookmarks')
        .action(async (options) => {
            logger.verbose(`appid=${options.appid}`);
            logger.verbose(`itemid=${options.itemid}`);

            sharedParamAssertOptions(options);
            getBookmarkAssertOptions(options);

            getBookmark(options);
        })
        .addOption(
            new Option('--loglevel <level>', 'log level').choices(['error', 'warning', 'info', 'verbose', 'debug', 'silly']).default('info')
        )
        .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
        .option('--port <port>', 'Qlik Sense server engine port', '4747')
        .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
        .requiredOption('--appid <id>', 'Qlik Sense app ID')
        .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
        .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
        .requiredOption('--userdir <directory>', 'user directory for user to connect with')
        .requiredOption('--userid <userid>', 'user ID for user to connect with')

        .addOption(new Option('-a, --auth-type <type>', 'authentication type').choices(['cert']).default('cert'))
        .option('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
        .option('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
        .option('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')

        .addOption(
            new Option('--id-type <type>', 'type of bookmark identifier passed in the --bookmark option')
                .choices(['id', 'name'])
                .default('name')
        )
        .option('--bookmark <bookmarks...>', 'bookmark to retrieve. If not specified all bookmarks will be retrieved')
        .option('--output-format <json|table>', 'output format', 'json');

    // Parse command line params
    await program.parseAsync(process.argv);
})();
