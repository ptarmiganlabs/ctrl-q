import { Option } from 'commander';

import { catchLog } from '../util/log.js';
import { qseowSharedParamAssertOptions, taskGanttAssertOptions } from '../util/qseow/assert-options.js';
import { taskGantt } from '../cmd/qseow/taskgantt.js';
import { SELECTABLE_SOURCES, DEFAULT_HISTORY_DIR } from '../task-gantt/options.js';
import { TASK_TYPE_CODES } from '../task-gantt/model/lanes.js';

export function setupQseowTaskGanttCommand(qseow) {
    qseow
        // Hidden until the command is complete
        .command('task-gantt', { hidden: true })
        .description('show reload task executions over time in a Gantt chart, to find reload congestion')
        .action(async (options, command) => {
            try {
                await qseowSharedParamAssertOptions(options);
                // Lists in environment variables arrive as one string; options.js splits them
                const fromEnv = new Set(Object.keys(options).filter((name) => command.getOptionValueSource(name) === 'env'));
                const config = taskGanttAssertOptions(options, { fromEnv });

                await taskGantt(config);
            } catch (err) {
                catchLog('TASK GANTT', err);
                process.exitCode = 1;
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
            new Option('--qrs-port <port>', 'Qlik Sense repository service (QRS) port (usually 4242 for cert auth, 443 for jwt auth)')
                .default('4242')
                .env('CTRLQ_QRS_PORT')
        )
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
        .addOption(
            new Option('--auth-jwt <jwt>', 'JSON Web Token (JWT) to use for authentication with Qlik Sense server').env('CTRLQ_AUTH_JWT')
        )
        .addOption(
            new Option('--lookback <duration>', 'how far back to show task executions, e.g. 12h, 7d or 4w (max 90d)')
                .default('7d')
                .env('CTRLQ_LOOKBACK')
        )
        .addOption(
            new Option(
                '--sources <names...>',
                `where to get task execution history from: ${SELECTABLE_SOURCES.join(', ')}. QRS is always used.`
            )
                .default(SELECTABLE_SOURCES)
                .env('CTRLQ_SOURCES')
        )
        .addOption(
            new Option('--poll-interval <seconds>', 'how often to check Sense for new task executions; 0 turns live updates off')
                .default('15')
                .env('CTRLQ_POLL_INTERVAL')
        )
        .addOption(
            new Option('--history-dir <directory>', 'directory where Ctrl-Q keeps the task execution history it has seen')
                .default(DEFAULT_HISTORY_DIR)
                .env('CTRLQ_HISTORY_DIR')
        )
        .addOption(
            new Option('--history-retention-days <days>', 'delete history files older than this')
                .default('90')
                .env('CTRLQ_HISTORY_RETENTION_DAYS')
        )
        .addOption(
            new Option('--task-type <types...>', `type of tasks to show lanes for: ${Object.keys(TASK_TYPE_CODES).join(', ')}`)
                .default(['reload', 'ext-program'])
                .env('CTRLQ_TASK_TYPE')
        )
        .addOption(
            new Option(
                '--task-id <ids...>',
                'show lanes only for these tasks (plus any matched by the other filters), if they are of a --task-type type'
            ).env('CTRLQ_TASK_ID')
        )
        .addOption(new Option('--task-tag <tags...>', 'show lanes for tasks with any of these tags').env('CTRLQ_TASK_TAG'))
        .addOption(new Option('--app-id <ids...>', 'show lanes for tasks of these apps').env('CTRLQ_APP_ID'))
        .addOption(new Option('--app-tag <tags...>', 'show lanes for tasks of apps with any of these tags').env('CTRLQ_APP_TAG'))
        .addOption(new Option('--vis-host <host>', 'host for the web page server').default('localhost').env('CTRLQ_VIS_HOST'))
        .addOption(new Option('--vis-port <port>', 'port for the web page server').default('3001').env('CTRLQ_TASK_GANTT_VIS_PORT'))
        .addOption(
            new Option(
                '--vis-allow-remote [true|false]',
                'allow --vis-host to be a non-loopback address; the page is then protected by a random access token'
            ).env('CTRLQ_VIS_ALLOW_REMOTE')
        );
}
