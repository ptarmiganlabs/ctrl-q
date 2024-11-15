import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, setTaskCustomPropertyAssertOptions } from '../util/qseow/assert-options.js';
import setTaskCustomProperty from '../cmd/qseow/settaskcp.js';

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
}
