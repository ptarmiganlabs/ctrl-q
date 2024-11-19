import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, masterItemImportAssertOptions } from '../util/qseow/assert-options.js';
import { importMasterItemFromFile } from '../cmd/qseow/import-masteritem-excel.js';

export function setupQseowMasterItemImportCommand(qseow) {
    qseow
        .command('master-item-import')
        .description('create master items based on definitions in a file on disk')
        .action(async (options) => {
            try {
                await qseowSharedParamAssertOptions(options);
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
}
