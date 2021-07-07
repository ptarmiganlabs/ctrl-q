const { Command, Option } = require('commander');
const { logger, appVersion, getLoggingLevel, setLoggingLevel } = require('./globals.js');

const { getMasterDimension } = require('./getdim.js');
const { createMasterDimension } = require('./createdim.js');
const { deleteMasterDimension } = require('./deletedim.js');

const { getMasterMeasure } = require('./getmeasure.js');
const { deleteMasterMeasure } = require('./deletemeasure.js');

const { getBookmark } = require('./getbookmark.js');

const { importFromExcel } = require('./importexcel.js');

const { scrambleField } = require('./scramblefield.js');
const { getScript } = require('./getscript.js');

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
      'This is a command line utility for interacting with Qlik Sense Enterprise on Windows servers.\nAmong other things the tool manipulates master items and scrambles in-app data.'
    );

  // Import dimensions/measures from definitions in Excel file
  program
    .command('importexcel')
    .description('create master items based on definitions in an Excel file')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('itemid=' + options.itemid);
      importFromExcel(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .requiredOption('--file <filename>', 'Excel file containing master item definitions')
    .requiredOption('--sheet <name>', 'name of Excel sheet where dim/measure flag column is found')
    .requiredOption(
      '--columnflag <number>',
      'column number (zero based) where dim/measure flag is found. Use "dim" in that column to create master dimension, "measure" for master measure'
    )
    .requiredOption('--columnname <number>', 'column number (zero based) to use as master item name')
    .requiredOption('--columndescr <number>', 'column number (zero based) to use as master item description', '')
    .requiredOption('--columnlabel <number>', 'column number (zero based) to use as master item label', '')
    .requiredOption('--columnexpr <number>', 'column number (zero based) to use as master item expression')
    .requiredOption('--columntag <number>', 'column number (zero based) to use as master item tags');

  // Get measure command
  program
    .command('getmeasure')
    .description('get info about one or more master measures')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('itemid=' + options.itemid);
      getMasterMeasure(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .option('--itemid <id>', 'master measure to retrieve. If not specified all measures will be retrieved')
    .option('--outputformat <json|table>', 'output format', 'json');

  // Delete measure command
  program
    .command('deletemeasure')
    .description('delete master measure(s)')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('itemid=' + options.itemid);
      deleteMasterMeasure(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .requiredOption('--itemid <id|ids>', 'IDs of master measure(s) to be deleted. Multiple IDs should be comma separated');

  // Get dimension command
  program
    .command('getdim')
    .description('get info about one or more master dimensions')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('itemid=' + options.itemid);
      getMasterDimension(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .option('--itemid <id>', 'master dimension to retrieve. If not specified all dimensions will be retrieved')
    .option('--outputformat <json|table>', 'output format', 'json');

  // Create dimension command
  // program
  //   .command('createdim')
  //   .description('create a new master dimension')
  //   .action(async (options, command) => {
  // logger.verbose('appid=' + options.appid);
  // logger.verbose('itemid=' + options.itemid);
  //     createMasterDimension(options, command);
  //   })
  //   .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
  //   .option('--port <port>', 'Qlik Sense server engine port', '4747')
  //   .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
  //   .requiredOption('--appid <id>', 'Qlik Sense app whose master items should be modified')
  //   .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
  //   .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
  //   .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
  //   .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
  //   .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
  //   .requiredOption('--userdir <directory>', 'user directory for user to connect with')
  //   .requiredOption('--userid <userid>', 'user ID for user to connect with')

  //   .requiredOption('--itemname <name>', 'name of master item to be created')
  //   .requiredOption('--expression <expression>', 'expression to use for new master item')

  // Delete dimension command
  program
    .command('deletedim')
    .description('delete master dimension(s)')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('itemid=' + options.itemid);
      deleteMasterDimension(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .requiredOption('--itemid <id|ids>', 'IDs of master dimension(s) to be deleted. Multiple IDs should be comma separated');

  // Scramble field command
  program
    .command('scramblefield')
    .description('scramble one or more fields in an app. A new app with the scrambled data is created.')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('fieldname=' + options.fieldname);
      scrambleField(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .requiredOption('--fieldname <name|names>', 'name of field(s) to be scrambled. Separate field names with <separator> character/string')
    .requiredOption('--separator <char|string>', 'character or string to be used as separator between field names', ',')
    .requiredOption('--newappname <name>', 'name of new app that will contain scrambled data');

  // Get script command
  program
    .command('getscript')
    .description('get script from Qlik Sense app')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      getScript(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with');

  // Get bookmark command
  program
    .command('getbookmark')
    .description('get info about one or more bookmarks')
    .action(async (options, command) => {
      logger.verbose('appid=' + options.appid);
      logger.verbose('itemid=' + options.itemid);
      getBookmark(options, command);
    })
    .option('--loglevel <level>', 'log level (error, warning, info, verbose, debug, silly). "Info" level is default', 'info')
    .requiredOption('--host <host>', 'Qlik Sense server IP/FQDN')
    .option('--port <port>', 'Qlik Sense server engine port', '4747')
    .option('--schemaversion <string>', 'Qlik Sense engine schema version', '12.612.0')
    .requiredOption('--appid <id>', 'Qlik Sense app ID')
    .requiredOption('--certfile <file>', 'Qlik Sense certificate file (exported from QMC)', './cert/client.pem')
    .requiredOption('--certkeyfile <file>', 'Qlik Sense certificate key file (exported from QMC)', './cert/client_key.pem')
    .requiredOption('--rootcertfile <file>', 'Qlik Sense root certificate file (exported from QMC)', './cert/root.pem')
    .requiredOption('--prefix <prefix>', 'Qlik Sense virtual proxy prefix', '')
    .requiredOption('--secure <true|false>', 'connection to Qlik Sense engine is via https', true)
    .requiredOption('--userdir <directory>', 'user directory for user to connect with')
    .requiredOption('--userid <userid>', 'user ID for user to connect with')

    .option('--itemid <id>', 'bookmark to retrieve. If not specified all bookmarks will be retrieved')
    .option('--outputformat <json|table>', 'output format', 'json');


  // Parse command line params
  let a = await program.parseAsync(process.argv);
})();
