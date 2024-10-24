import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, appImportAssertOptions } from '../util/qseow/assert-options.js';
import importAppFromFile from '../cmd/qseow/importtask.js';

export function setupQseowImportAppFromFileCommand(qseow) {
    qseow
        .command('app-import')
        .description('import apps/upload QVF files on disk to Sense based on definitions in Excel file.')
        .action(async (options) => {
            try {
                await qseowSharedParamAssertOptions(options);
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
}
