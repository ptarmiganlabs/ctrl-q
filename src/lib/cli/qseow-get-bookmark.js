import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, getBookmarkAssertOptions } from '../util/qseow/assert-options.js';
import { getBookmark } from '../cmd/qseow/getbookmark.js';

export function setupQseowGetBookmarkCommand(qseow) {
    qseow
        .command('bookmark-get')
        .description('get info about one or more bookmarks')
        .action(async (options) => {
            await qseowSharedParamAssertOptions(options);
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
}
