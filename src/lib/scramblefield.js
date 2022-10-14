const enigma = require('enigma.js');

const { setupEnigmaConnection } = require('./enigma');
const { logger, setLoggingLevel, isPkg, execPath } = require('../globals');

/**
 *
 * @param {*} options
 */
const scrambleField = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Scramble field');
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

        // Fields to be scrambled are availbel in array options.fieldName;

        if (options.fieldName.length === 0) {
            // No fields specified
            logger.warn('No fields specified, no scrambling of data will be done');
        } else {
            // eslint-disable-next-line no-restricted-syntax
            for (const field of options.fieldName) {
                // TODO make sure field exists before trying to scramble it

                // Scramble field
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const res = await app.scramble(field);
                    logger.info(`Scrambled field "${field}"`);
                } catch (err) {
                    logger.error(`Failed scrambling field "${field}". Please make sure it exists in the app.`);
                }
            }

            // The scrambled data cannot be written back to the original app, it has to be saved to a new app
            const newAppId = await app.saveAs(options.newAppName);
            logger.info(`Scrambled data written to new app "${options.newAppName}" with app ID: ${newAppId}`);

            if ((await session.close()) === true) {
                logger.verbose(`Closed session after managing master items in app ${options.appId} on host ${options.host}`);
            } else {
                logger.error(`Error closing session for app ${options.appId} on host ${options.host}`);
            }
        }
    } catch (err) {
        logger.error(err);
    }
};

module.exports = {
    scrambleField,
};
