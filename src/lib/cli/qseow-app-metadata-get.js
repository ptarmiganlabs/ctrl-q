/**
 * @fileoverview CLI command definition for extracting metadata from Qlik Sense apps.
 *
 * Defines the command-line interface for the `qseow app-metadata-get` command
 * using Commander.js.
 *
 * @module cli/qseow-app-metadata-get
 */

import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, getAppMetadataAssertOptions } from '../util/qseow/assert-options.js';
import { getAppMetadata } from '../cmd/qseow/app-metadata-get.js';

/**
 * Configures the app-metadata-get command with Commander.js.
 *
 * @param {Object} qseow - Parent commander object
 * @returns {Object} The configured commander object
 */
export function setupAppMetadataGetCommand(qseow) {
    qseow
        .command('app-metadata-get')
        .description('Get metadata from Qlik Sense apps')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
            getAppMetadataAssertOptions(options);

            getAppMetadata(options);
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
                .env('CTRLQ_ENGINE_PORT')
        )
        .addOption(
            new Option('--schema-version <string>', 'Qlik Sense engine schema version').default('12.612.0').env('CTRLQ_SCHEMA_VERSION')
        )
        .addOption(
            new Option('--app-id <id>', 'Qlik Sense app ID. If not specified, get all apps or apps matching --app-tag.').env('CTRLQ_APP_ID')
        )
        .addOption(new Option('--app-tag <tag>', 'Get apps having this tag. Can be specified multiple times.').env('CTRLQ_APP_TAG'))
        .addOption(
            new Option('--open-without-data <true|false>', 'open app without data')
                .choices(['true', 'false'])
                .default('true')
                .env('CTRLQ_OPEN_WITHOUT_DATA')
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
            new Option('--output-format <format>', 'Output file format').choices(['json', 'qvd']).default('json').env('CTRLQ_OUTPUT_FORMAT')
        )
        .addOption(
            new Option('--output-count <count>', 'Number of output files')
                .choices(['single', 'multiple'])
                .default('multiple')
                .env('CTRLQ_OUTPUT_COUNT')
        )
        .addOption(
            new Option('--output-dest <dest>', 'where to send app metadata')
                .choices(['screen', 'file'])
                .default('file')
                .env('CTRLQ_OUTPUT_DEST')
        )
        .addOption(
            new Option('--output-detail <detail>', 'level of detail when sending to screen')
                .choices(['summary', 'full', 'both'])
                .default('full')
                .env('CTRLQ_OUTPUT_DETAIL')
        )
        .addOption(
            new Option('--create-intel-file <true|false>', 'Create separate intel file')
                .choices(['true', 'false'])
                .default('true')
                .env('CTRLQ_CREATE_INTEL_FILE')
        )
        .addOption(
            new Option('--output-file-name <name>', 'Base file name for output files').default('app-metadata').env('CTRLQ_OUTPUT_FILE_NAME')
        )
        .addOption(
            new Option('--intel-file-name <name>', 'Base file name for intel files')
                .default('app-metadata-intel')
                .env('CTRLQ_INTEL_FILE_NAME')
        )
        .addOption(
            new Option(
                '--limit-app-count <number>',
                'Get at most x number of apps. Only relevant when --app-id is not specified. Defaults to 0 = no limit'
            )
                .default(0)
                .env('CTRLQ_LIMIT_APP_COUNT')
        )
        .addOption(new Option('--output-dir <dir>', 'Output directory for files').default('.').env('CTRLQ_OUTPUT_DIR'))
        .addOption(
            new Option('--sleep-between-apps <milliseconds>', 'sleep this many milliseconds between apps. Set to 0 to disable')
                .default(1000)
                .env('CTRLQ_SLEEP_BETWEEN_APPS')
        );
}
