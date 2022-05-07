const SenseUtilities = require('enigma.js/sense-utilities');
const WebSocket = require('ws');
const fs = require('fs-extra');
const path = require('path');

const { logger } = require('../globals');

/**
 * Helper function to read the contents of the certificate files:
 * @param {*} filename
 * @returns
 */
const readCert = (filename) => fs.readFileSync(filename);

/**
 *
 * @param {*} options
 * @param {*} command
 * @returns
 */
const setupEnigmaConnection = (options) => {
    logger.debug('Prepping for Enigma connection...');

    // eslint-disable-next-line global-require
    const qixSchema = require(`enigma.js/schemas/${options.schemaversion}`);

    return {
        schema: qixSchema,
        url: SenseUtilities.buildUrl({
            host: options.host,
            port: options.port,
            prefix: options.prefix,
            secure: options.secure,
            appId: options.appid,
        }),
        createSocket: (url) =>
            new WebSocket(url, {
                key: readCert(path.resolve(__dirname, options.certkeyfile)),
                cert: readCert(path.resolve(__dirname, options.certfile)),
                headers: {
                    'X-Qlik-User': `UserDirectory=${options.userdir};UserId=${options.userid}`,
                },
                rejectUnauthorized: false,
            }),
    };
};

module.exports = {
    setupEnigmaConnection,
};
