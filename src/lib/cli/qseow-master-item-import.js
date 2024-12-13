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
            new Option('--log-level <level>', 'log level')
                .choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
                .default('info')
                .env('CTRLQ_LOG_LEVEL')
        )
        .addOption(new Option('--host <host>', 'Qlik Sense server IP/FQDN').makeOptionMandatory().env('CTRLQ_HOST'))
        .addOption(
            new Option('--port <port>', 'Qlik Sense server engine port (usually 4747 for cert auth, 443 for jwt auth)')
                .default('4747')
                .env('CTRLQ_PORT')
        )
        .addOption(
            new Option('--schema-version <string>', 'Qlik Sense engine schema version').default('12.612.0').env('CTRLQ_SCHEMA_VERSION')
        )
        .addOption(new Option('--app-id <id>', 'Qlik Sense app ID').makeOptionMandatory().env('CTRLQ_APP_ID'))
        .addOption(
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix')
                .default('')
                .makeOptionMandatory()
                .env('CTRLQ_VIRTUAL_PROXY')
        )
        .addOption(
            new Option(
                '--secure <true|false>',
                'https connection to Qlik Sense must use correct certificate. Invalid certificates will result in rejected/failed connection.'
            )
                .default(true)
                .makeOptionMandatory()
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
        .addOption(new Option('--file <filename>', 'file containing master item definitions').makeOptionMandatory().env('CTRLQ_FILE'))
        .addOption(
            new Option('--sheet <name>', 'name of Excel sheet where dim/measure flag column is found')
                .makeOptionMandatory()
                .env('CTRLQ_SHEET')
        )
        .addOption(
            new Option(
                '--col-ref-by <reftype>',
                'how to refer to columns in the source file. Options are by name or by position (zero based)'
            )
                .choices(['name', 'position'])
                .default('name')
                .env('CTRLQ_COL_REF_BY')
        )
        .addOption(
            new Option(
                '--col-item-type <column position or name>',
                'column where dim/measure flag is found. Use "dim-single" in that column to create dimension, "dim-drilldown" for drill-down dimension, "measure" for measure'
            )
                .makeOptionMandatory()
                .default('Master item type')
                .env('CTRLQ_COL_ITEM_TYPE')
        )
        .addOption(
            new Option('--col-master-item-name <column position or name>', 'column number (zero based) or name to use as master item name')
                .makeOptionMandatory()
                .default('Master item name')
                .env('CTRLQ_COL_MASTER_ITEM_NAME')
        )
        .addOption(
            new Option(
                '--col-master-item-descr <column position or name>',
                'column number (zero based) or name to use as master item description'
            )
                .makeOptionMandatory()
                .default('Description')
                .env('CTRLQ_COL_MASTER_ITEM_DESCR')
        )
        .addOption(
            new Option(
                '--col-master-item-label <column position or name>',
                'column number (zero based) or name to use as master item label'
            )
                .makeOptionMandatory()
                .default('Label')
                .env('CTRLQ_COL_MASTER_ITEM_LABEL')
        )
        .addOption(
            new Option(
                '--col-master-item-expr <column position or name>',
                'column number (zero based) or name to use as master item expression'
            )
                .makeOptionMandatory()
                .default('Expression')
                .env('CTRLQ_COL_MASTER_ITEM_EXPR')
        )
        .addOption(
            new Option('--col-master-item-tag <column position or name>', 'column number (zero based) or name to use as master item tags')
                .makeOptionMandatory()
                .default('Tag')
                .env('CTRLQ_COL_MASTER_ITEM_TAG')
        )
        .addOption(
            new Option(
                '--col-master-item-color <column position or name>',
                'column number (zero based) or name to use as color for dimensions/measures'
            )
                .makeOptionMandatory()
                .default('Color')
                .env('CTRLQ_COL_MASTER_ITEM_COLOR')
        )
        .addOption(
            new Option(
                '--col-master-item-per-value-color <column position or name>',
                'column number (zero based) or name to use as per-value/segment color for dimensions/measures'
            )
                .makeOptionMandatory()
                .default('Per value color')
                .env('CTRLQ_COL_MASTER_ITEM_PER_VALUE_COLOR')
        )
        .addOption(
            new Option('--sleep-between-imports <milliseconds>', 'sleep this many milliseconds between imports. Set to 0 to disable')
                .makeOptionMandatory()
                .default(1000)
                .env('CTRLQ_SLEEP_BETWEEN_IMPORTS')
        )
        .addOption(
            new Option(
                '--limit-import-count <number>',
                'import at most x number of master items from the Excel file. Defaults to 0 = no limit'
            )
                .makeOptionMandatory()
                .default(0)
                .env('CTRLQ_LIMIT_IMPORT_COUNT')
        )
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not create or update anything - just show what would be done').env(
                'CTRLQ_DRY_RUN'
            )
        );
}
