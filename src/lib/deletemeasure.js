'use strict';

const enigma = require('enigma.js');
const { setupEnigmaConnection } = require('./enigma.js');
const { logger, setLoggingLevel } = require('../globals.js');

/**
 * 
 * @param {*} options 
 * @param {*} command 
 */
const deleteMasterMeasure = async (options, command) => {
  try {
    // Set log level
    setLoggingLevel(options.loglevel);

    logger.verbose('Delete master measure(s)');
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

    // Create array of measures to be deleted
    let deleteItems = options.itemid.split(',');
    deleteItems = deleteItems.map((item) => item.trim());

    for (const item of deleteItems) {
      const res = await app.destroyMeasure(item);
      if (res !== true) {
        logger.error(`Failed deleting measure with id ${item} in app ${options.appid}`);
      }else {
        logger.verbose(`Deleted measure with id ${item}`);
      }
    }

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
  deleteMasterMeasure,
};
