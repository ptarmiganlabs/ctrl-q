/* eslint-disable no-console */
const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma');
const { logger, setLoggingLevel } = require('../globals');

/**
 *
 * @param {*} options
 * @param {*} command
 */
const getScript = async (options, command) => {
    try {
        // Set log level
        setLoggingLevel(options.loglevel);

        logger.verbose('Get app script');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Configure Enigma.js
        const configEnigma = setupEnigmaConnection(options);

        const session = enigma.create(configEnigma);
        if (options.loglevel === 'silly') {
            session.on('traffic:sent', (data) => console.log('sent:', data));
            session.on('traffic:received', (data) => console.log('received:', data));
        }
        const global = await session.open();

        const engineVersion = await global.engineVersion();
        logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

        const app = await global.openDoc(options.appid, '', '', '', false);
        logger.verbose(`Opened app ${options.appid}.`);

        // Get app script
        const appScript = await app.getScriptEx();

        if (appScript) {
            logger.info('----- Script metadata -----');
            logger.info(`App id: ${options.appid}`);
            logger.info(`Created date: ${appScript.qMeta.createdDate}`);
            logger.info(`Modified date: ${appScript.qMeta.modifiedDate}`);
            logger.info('----- End script metadata -----');
            console.log(`${appScript.qScript}`);
        } else {
            logger.error(`Failed getting script for app ${options.appid}`);
        }

        if ((await session.close()) === true) {
            logger.verbose(`Closed session after retrieving script from app ${options.appid} on host ${options.host}`);
        } else {
            logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
        }
    } catch (err) {
        logger.error(`GET SCRIPT: ${err}`);
    }
};

module.exports = {
    getScript,
};
