const SenseUtilities = require('enigma.js/sense-utilities');
const WebSocket = require('ws');
const path = require('path');

const { logger, execPath, readCert } = require('../../globals');

const setupEnigmaConnection = async (options) => {
    logger.debug('Prepping for Enigma connection...');

    logger.verbose('Verify that cert files exists');

    const fileCert = path.resolve(execPath, options.authCertFile);
    const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const qixSchema = require(`enigma.js/schemas/${options.schemaVersion}`);

    return {
        schema: qixSchema,
        url: SenseUtilities.buildUrl({
            host: options.host,
            port: options.enginePort !== undefined ? options.enginePort : options.port,
            prefix: options.virtualProxy,
            secure: options.secure,
            appId: options.appId,
        }),
        createSocket: (url) =>
            new WebSocket(url, {
                key: readCert(fileCertKey),
                cert: readCert(fileCert),
                headers: {
                    'X-Qlik-User': `UserDirectory=${options.authUserDir};UserId=${options.authUserId}`,
                },
                rejectUnauthorized: false,
            }),
    };
};

module.exports = {
    setupEnigmaConnection,
};
