import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, setTaskCustomPropertyAssertOptions } from '../util/qseow/assert-options.js';
import { setTaskCustomProperty } from '../cmd/qseow/settaskcp.js';

export function setupQseowSetTaskCustomPropertyCommand(qseow) {
    qseow
        .command('task-custom-property-set')
        .description('update a custom property of one or more tasks')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
            setTaskCustomPropertyAssertOptions(options);

            await setTaskCustomProperty(options);
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
            new Option('--virtual-proxy <prefix>', 'Qlik Sense virtual proxy prefix').makeOptionMandatory().env('CTRLQ_VIRTUAL_PROXY')
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
        .addOption(
            new Option('--task-type <type...>', 'type of tasks to list').choices(['reload']).default(['reload']).env('CTRLQ_TASK_TYPE')
        )
        .addOption(new Option('--task-id <ids...>', 'use task IDs to select which tasks to retrieve').env('CTRLQ_TASK_ID'))
        .addOption(new Option('--task-tag <tags...>', 'use tags to select which tasks to retrieve').env('CTRLQ_TASK_TAG'))
        .addOption(
            new Option('--custom-property-name <name>', 'name of custom property that will be updated')
                .makeOptionMandatory()
                .env('CTRLQ_CUSTOM_PROPERTY_NAME')
        )
        .addOption(
            new Option('--custom-property-value <values...>', 'one or more values name of custom property that will be updated')
                .makeOptionMandatory()
                .env('CTRLQ_CUSTOM_PROPERTY_VALUE')
        )
        .addOption(new Option('--overwrite', 'overwrite existing custom property values without asking').env('CTRLQ_OVERWRITE'))
        .addOption(
            new Option('--update-mode <mode>', 'append or replace value(s) to existing custom property')
                .choices(['append', 'replace'])
                .default('append')
                .env('CTRLQ_UPDATE_MODE')
        )
        .addOption(
            new Option('--dry-run', 'do a dry run, i.e. do not modify any reload tasks - just show what would be updated').env(
                'CTRLQ_DRY_RUN'
            )
        );
}
