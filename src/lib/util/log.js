import { logger, appVersion, isPkg, execPath } from '../../globals.js';

const logStartupInfo = (options, cmd, cmdDesc) => {
    logger.info('-----------------------------------------------------------');
    logger.info('| Ctrl-Q');
    logger.info('| ');
    logger.info(`| Version      : ${appVersion}`);
    logger.info(`| Log level    : ${options.logLevel}`);
    logger.info(`| `);
    logger.info(`| Command      : ${cmd}`);
    logger.info(`|              : ${cmdDesc}`);
    logger.info(`| `);
    logger.info(`| Run Ctrl-Q with the '--help' option to see a list of all available options for this command.`);
    logger.info(`| `);
    logger.info(`| https://github.com/ptarmiganlabs/ctrl-q`);
    logger.info('----------------------------------------------------------');
    logger.info(``);
    logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
    logger.verbose(`Ctrl-Q was started from ${execPath}`);
    logger.verbose(`Options: ${JSON.stringify(options, null, 2)}`);
    logger.verbose(``);
};

export default logStartupInfo;
