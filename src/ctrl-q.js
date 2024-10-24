import { Command, Option } from 'commander';
import { logger, appVersion, setLoggingLevel, setCliOptions } from './globals.js';
import { catchLog, logStartupInfo } from './lib/util/log.js';

// Import command setup functions
// QSEoW
import { setupQseowUserActivityCustomPropertyCommand } from './lib/cli/qseow-cp-user-activity-bucket.js';
import { setupQseowMasterItemImportCommand } from './lib/cli/qseow-master-item-import.js';
import { setupQseowGetMasterMeasureCommand } from './lib/cli/qseow-get-master-measure.js';
import { setupQseowDeleteMasterMeasureCommand } from './lib/cli/qseow-delete-master-measure.js';
import { setupQseowGetMasterDimensionCommand } from './lib/cli/qseow-get-master-dimension.js';
import { setupQseowDeleteMasterDimensionCommand } from './lib/cli/qseow-delete-master-dimension.js';
import { setpQseowGetVariableCommand } from './lib/cli/qseow-get-variable.js';
import { setupQseowDeleteVariableCommand } from './lib/cli/qseow-delete-variable.js';
import { setupQseowScrambleFieldCommand } from './lib/cli/qseow-scramble-field.js';
import { setupGetScriptCommand } from './lib/cli/qseow-get-script.js';
import { setupQseowGetBookmarkCommand } from './lib/cli/qseow-get-bookmark.js';
import { setupGetTaskCommand } from './lib/cli/qseow-get-task.js';
import { setupQseowSetTaskCustomPropertyCommand } from './lib/cli/qseow-set-task-cp.js';
import { setupQseowImportTaskFromFileCommand } from './lib/cli/qseow-import-task-from-file.js';
import { setupQseowImportAppFromFileCommand } from './lib/cli/qseow-import-app-from-file.js';
import { setupQseowExportAppCommand } from './lib/cli/qseow-export-app-to-file.js';
import { setupQseowTestConnectionCommand } from './lib/cli/qseow-test-connection.js';
import { setupQseowShowVersionCommand } from './lib/cli/qseow-show-version.js';
import { setupQseowVisualiseTaskCommand } from './lib/cli/qseow-visualise-task.js';
import { setupQseowGetProxySessionsCommand } from './lib/cli/qseow-get-proxy-session.js';
import { setupQseowDeleteProxySessionsCommand } from './lib/cli/qseow-delete-proxy-session.js';
// QS Cloud
import { setupQscloudTestConnectionCommand } from './lib/cli/qscloud-test-connection.js';

const program = new Command();

// Set the name of the program (to be used in help text)
program.name('ctrl-q');

// Set help text to be shown after errors
program.showHelpAfterError('(add --help for additional information about required and optional parameters)');

// Help text configuration
program.configureHelp({
    sortSubcommands: true,
});

/**
 * Top level async function.
 * Workaround to deal with the fact that Node.js doesn't currently support top level async functions...
 */
(async () => {
    // Basic app info
    program
        .version(appVersion)
        .name('ctrl-q')
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

    // --------------------------------------------------------
    // Create a command for QSEoW-related sub-commands
    function createQseowCommands() {
        // Create a new command
        // const qseow = program.command('qseow');
        const qseow = new Command('qseow');

        // Create custom properties for tracking user activity buckets, i.e. how long ago a user was last active (last login) in Sense
        setupQseowUserActivityCustomPropertyCommand(qseow);

        // QSEoW: Import dimensions/measures from definitions in Excel file
        setupQseowMasterItemImportCommand(qseow);

        // QSEoW: Get measure command
        setupQseowGetMasterMeasureCommand(qseow);

        // QSEoW: Delete measure command
        setupQseowDeleteMasterMeasureCommand(qseow);

        // QSEoW: Get dimension command
        setupQseowGetMasterDimensionCommand(qseow);

        // QSEoW: Delete dimension command
        setupQseowDeleteMasterDimensionCommand(qseow);

        // QSEoW: Get variable command
        setpQseowGetVariableCommand(qseow);

        // QSEoW: Delete variable command
        setupQseowDeleteVariableCommand(qseow);

        // QSEoW: Scramble field command
        setupQseowScrambleFieldCommand(qseow);

        // QSEoW: Get script command
        setupGetScriptCommand(qseow);

        // QSEoW: Get bookmark command
        setupQseowGetBookmarkCommand(qseow);

        // QSEoW: Get tasks command
        setupGetTaskCommand(qseow);

        // QSEoW: Set custom property on tasks command
        setupQseowSetTaskCustomPropertyCommand(qseow);

        // QSEoW: Import tasks from definitions in Excel/CSV file
        setupQseowImportTaskFromFileCommand(qseow);

        // QSEoW: Import apps from definitions in Excel file
        setupQseowImportAppFromFileCommand(qseow);

        // QSEoW: Export apps to QVF files
        setupQseowExportAppCommand(qseow);

        // QSEoW: Test connection command
        setupQseowTestConnectionCommand(qseow);

        // QSEoW: Show version command
        setupQseowShowVersionCommand(qseow);

        // QSEoW: Visualise task network
        setupQseowVisualiseTaskCommand(qseow);

        // QSEoW: Get proxy sessions
        setupQseowGetProxySessionsCommand(qseow);

        // QSEoW: Delete proxy sessions
        setupQseowDeleteProxySessionsCommand(qseow);

        return qseow;
    }

    // --------------------------------------------------------
    // Create a command for QS Cloud-related sub-commands
    function createQsCloudCommands() {
        // Create a new command
        const qsCloud = new Command('qscloud');

        // QSEoW: Test connection command
        setupQscloudTestConnectionCommand(qsCloud);

        return qsCloud;
    }

    // Add all command definitions
    program.addCommand(createQseowCommands());
    program.addCommand(createQsCloudCommands());

    // Parse command definitions
    await program.parseAsync(process.argv);
})();
