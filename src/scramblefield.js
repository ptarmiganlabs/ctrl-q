'use strict';

const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma.js');
const { logger, setLoggingLevel } = require('./globals.js');

const scrambleField = async (options, command) => {
  try {
    // Set log level
    setLoggingLevel(options.loglevel);

    logger.verbose('Scramble field');
    logger.debug('Options: ' + JSON.stringify(options, null, 2));

    // Configure Enigma.js
    const configEnigma = setupEnigmaConnection(options);

    var session = enigma.create(configEnigma);
    if (options.loglevel == 'silly') {
      session.on('traffic:sent', (data) => console.log('sent:', data));
      session.on('traffic:received', (data) => console.log('received:', data));
    }
    var global = await session.open();

    const engineVersion = await global.engineVersion();
    logger.verbose(`Created session to server ${options.host}, engine version is ${engineVersion.qComponentVersion}.`);

    var app = await global.openDoc(options.appid, '', '', '', false);
    logger.verbose(`Opened app ${options.appid}.`);

    // Create array of fields to be scrambled
    let scrambleFields = options.fieldname.split(options.separator);

    for (const field of scrambleFields) {
      // Scramble field
      const res = await app.scramble(field);
      logger.info(`Scrambled field "${field}"`);
    }

    // The scrambled data cannot be written back to the original app, it has to be saved to a new app
    const newAppId = await app.saveAs(options.newappname);

    if ((await session.close()) == true) {
      logger.verbose(`Closed session after managing master items in app ${options.appid} on host ${options.host}`);
    } else {
      logger.error(`Error closing session for app ${options.appid} on host ${options.host}`);
    }
  } catch (err) {
    logger.error(err);
  }
};

module.exports = {
  scrambleField,
};
