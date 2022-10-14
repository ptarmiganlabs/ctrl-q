const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma');
const { logger, setLoggingLevel, isPkg, execPath } = require('../globals');

/**
 *
 * @param {*} options
 */
const getScript = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.verbose('Get app script');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Configure Enigma.js
        const configEnigma = setupEnigmaConnection(options);

        const session = enigma.create(configEnigma);
        if (options.logLevel === 'silly') {
            // eslint-disable-next-line no-console
            session.on('traffic:sent', (data) => console.log('sent:', data));
            // eslint-disable-next-line no-console
            session.on('traffic:received', (data) => console.log('received:', data));
        }
        const global = await session.open();

        const engineVersion = await global.engineVersion();
        logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

        const app = await global.openDoc(options.appId, '', '', '', false);
        logger.verbose(`Opened app ${options.appId}.`);

        // Get app script
        const appScript = await app.getScriptEx();

        if (appScript) {
            logger.info('----- Script metadata -----');
            logger.info(`App id: ${options.appId}`);
            logger.info(`Created date: ${appScript.qMeta.createdDate}`);
            logger.info(`Modified date: ${appScript.qMeta.modifiedDate}`);
            logger.info('----- End script metadata -----');
            logger.info(`\n${appScript.qScript}`);
        } else {
            logger.error(`Failed getting script for app ${options.appId}`);
        }

        if ((await session.close()) === true) {
            logger.verbose(`Closed session after retrieving script from app ${options.appId} on host ${options.host}`);
        } else {
            logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
        }
    } catch (err) {
        logger.error(`GET SCRIPT: ${err}`);
    }
};

module.exports = {
    getScript,
};
