import SenseUtilities from 'enigma.js/sense-utilities.js';
import WebSocket from 'ws';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import upath from 'upath';
import { logger, execPath, readCert } from '../../../globals.js';

export const setupEnigmaConnection = async (options, sessionId) => {
    logger.debug('Prepping for Enigma connection...');

    // Set up enigma.js configuration
    let schemaFile;
    let a;
    let b;
    let c;

    logger.debug(`Enigma.js schema version: ${options.schemaVersion}`);

    // Are we running as a packaged app?
    if (process.pkg) {
        schemaFile = `./node_modules/enigma.js/schemas/${options.schemaVersion}.json`;
        logger.debug(`Enigma.js schema file: ${schemaFile}`);

        // Yes, we are running as a packaged app
        // Get path to JS file const
        a = process.pkg.defaultEntrypoint;
        logger.debug(`APPDUMP schema path a: ${a}`);

        // Strip off the filename
        b = upath.dirname(a);
        logger.debug(`APPDUMP schema path b: ${b}`);

        // Add path to package.json file
        c = upath.join(b, schemaFile);
        logger.debug(`APPDUMP schema path c: ${c}`);
    } else {
        schemaFile = `../node_modules/enigma.js/schemas/${options.schemaVersion}.json`;
        logger.debug(`Enigma.js schema file: ${schemaFile}`);

        // No, we are running as native Node.js
        // Get path to JS file
        a = fileURLToPath(import.meta.url);
        logger.debug(`APPDUMP schema path a: ${a}`);

        // Strip off the filename
        b = upath.dirname(a);
        logger.debug(`APPDUMP schema path b: ${b}`);

        // Add path to package.json file
        c = upath.join(b, '..', '..', schemaFile);
        logger.debug(`APPDUMP schema path c: ${c}`);
    }

    logger.verbose(`APPDUMP: Using engine schema in file: ${c}`);
    const qixSchema = JSON.parse(readFileSync(c));

    // eslint-disable-next-line global-require, import/no-dynamic-require
    // const qixSchema = require(`enigma.js/schemas/${options.schemaVersion}`);

    let enigmaConfig;
    // Should certificates be used for authentication?
    if (options.authType === 'cert') {
        logger.verbose(`Using certificates for authentication with Enigma`);

        logger.verbose('Verify that cert files exists');
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        if (!fileCert || !fileCertKey) {
            logger.error(`Certificate file(s) not found when setting up Enigma connection`);
            process.exit(1);
        }

        // Set up Enigma configuration
        // buildUrl docs: https://github.com/qlik-oss/enigma.js/blob/master/docs/api.md#senseutilitiesbuildurlconfig
        enigmaConfig = {
            schema: qixSchema,
            url: SenseUtilities.buildUrl({
                host: options.host,
                port: options.enginePort !== undefined ? options.enginePort : options.port,
                prefix: options.virtualProxy,
                route: 'app/engineData',
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
            protocol: { delta: true },
        };
    } else if (options.authType === 'jwt') {
        logger.verbose(`Using JWT for authentication with Enigma`);

        try {
            logger.verbose('Building Enigma config using sessionId: ', sessionId);

            // Set up Enigma configuration
            // buildUrl docs: https://github.com/qlik-oss/enigma.js/blob/master/docs/api.md#senseutilitiesbuildurlconfig
            enigmaConfig = {
                schema: qixSchema,
                url: SenseUtilities.buildUrl({
                    host: options.host,
                    port: options.enginePort !== undefined ? options.enginePort : options.port,
                    prefix: options.virtualProxy,
                    route: 'app/engineData',
                    secure: options.secure,
                    appId: options.appId,
                    ttl: 5,
                    identity: sessionId || undefined,
                }),
                createSocket: (url) =>
                    new WebSocket(url, {
                        headers: {
                            Authorization: `Bearer ${options.authJwt}`,
                        },
                        rejectUnauthorized: false,
                    }),
                protocol: { delta: true },
            };
        } catch (err) {
            logger.error(`Error when setting up Enigma connection: ${err}`);
            process.exit(1);
        }
    }

    return enigmaConfig;
};

// Function to add logging of session's websocket traffic
export const addTrafficLogging = (session, options) => {
    session.on('notification:*', (eventName, data) => {
        // console.log(`SESSION EVENT=${eventName}: `, data);

        if (eventName === 'EVENT=OnAuthenticationInformation') {
            // Authentication successful
            logger.verbose(`Session event "${eventName}": ${JSON.stringify(data, null, 2)}`);
        } else if (eventName === 'OnConnected') {
            // Session created
            logger.verbose(`Session event "${eventName}": ${JSON.stringify(data, null, 2)}`);
        } else if (eventName === 'OnMaxParallelSessionsExceeded') {
            // Too many concurrent sessions
            logger.error(`Session event "${eventName}": ${JSON.stringify(data, null, 2)}`);
        } else {
            logger.verbose(`Session event "${eventName}": ${JSON.stringify(data, null, 2)}`);
        }
    });

    session.on('closed', (code, message) => {
        logger.verbose(`Session closed`);
        // logger.verbose (`Session closed, code=${code}, message="${message}"`);
        // console.log(JSON.stringify(code, null, 2));
    });

    session.on('opened', (code, message) => {
        logger.verbose(`SESSION opened, code=${code}, message="${message}"`);
    });

    if (options.logLevel === 'silly') {
        session.on('traffic:sent', (data) => console.log('sent:', data));

        session.on('traffic:received', (data) => {
            console.log('received:', data);
            if (data?.result?.qReturn) {
                console.log(`qReturn: ${JSON.stringify(data.result.qReturn, null, 2)}`);
            }

            if (data?.result?.qInfo) {
                console.log(`qInfo: ${JSON.stringify(data.result.qInfo, null, 2)}`);
            }

            if (data?.change?.length > 1) {
                console.log(`change length > 1: ${JSON.stringify(data.change, null, 2)}`);

                console.log('received:', data);
                if (data?.result?.qReturn) {
                    console.log(`qReturn: ${JSON.stringify(data.result.qReturn, null, 2)}`);
                }

                if (data?.result?.qInfo) {
                    console.log(`qInfo: ${JSON.stringify(data.result.qInfo, null, 2)}`);
                }
            }
        });

        session.on('notification:*', (eventName, data) => {
            console.log(`SESSION EVENT=${eventName}: `, data);
        });

        session.on('closed', (code, message) => {
            console.log(`SESSION CLOSED, code=${code}, message="${message}"`);
            process.exit(1);
        });
    }
};
