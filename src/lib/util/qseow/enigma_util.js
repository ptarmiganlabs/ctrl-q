import SenseUtilities from 'enigma.js/sense-utilities.js';
import WebSocket from 'ws';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import upath from 'upath';
import sea from 'node:sea';

import { logger, readCert, isSea } from '../../../globals.js';
import { getCertFilePaths } from '../../util/qseow/cert.js';

/**
 * Retrieves the Enigma.js schema JSON based on the provided options.
 *
 * @param {Object} options - Configuration options.
 *   - `schemaVersion`: The desired schema version to load.
 *
 * @returns {Object} The parsed Enigma.js schema JSON.
 *
 * @throws Will terminate the process with an error message if the schema version is unsupported or if an error occurs during file retrieval.
 */
const getEnigmaSchema = (options) => {
    // Array of supported schema versions
    const supportedSchemaVersions = ['12.170.2', '12.612.0', '12.936.0', '12.1306.0', '12.1477.0', '12.1657.0', '12.1823.0', '12.2015.0'];

    let qixSchemaJson;
    try {
        // Check if the specified schema version is supported
        if (!supportedSchemaVersions.includes(options.schemaVersion)) {
            logger.error(`Unsupported schema version specified: ${options.schemaVersion}`);

            // Show supported schema versions
            logger.error(`Supported schema versions: ${supportedSchemaVersions.join(', ')}`);

            logger.error(`Exiting...`);
            process.exit(1);
        }

        // Are we running as a packaged app?
        if (isSea) {
            // Load schema file
            qixSchemaJson = sea.getAsset(`enigma_schema_${options.schemaVersion}.json`, 'utf8');
        } else {
            // No, we are running as native Node.js
            const schemaFile = `../node_modules/enigma.js/schemas/${options.schemaVersion}.json`;
            logger.debug(`Enigma.js schema file: ${schemaFile}`);

            // Get path to JS file
            const a = fileURLToPath(import.meta.url);
            logger.debug(`APPDUMP schema path a: ${a}`);

            // Strip off the filename
            const b = upath.dirname(a);
            logger.debug(`APPDUMP schema path b: ${b}`);

            // Add path to package.json file
            const c = upath.join(b, '..', '..', '..', schemaFile);
            logger.debug(`APPDUMP schema path c: ${c}`);

            qixSchemaJson = readFileSync(c);
        }
    } catch (err) {
        logger.error(`Error when getting Enigma schema: ${err}`);
        process.exit(1);
    }

    const qixSchema = JSON.parse(qixSchemaJson);
    logger.debug(`Enigma.js schema: ${qixSchema}`);

    return qixSchema;
};

/**
 * Set up an Enigma connection.
 *
 * @param {Object} options - Global options. Properties used:
 *   - `host`: Qlik Sense server host.
 *   - `port`: Qlik Sense server port.
 *   - `enginePort`: Qlik Sense engine port.
 *   - `virtualProxy`: Qlik Sense virtual proxy.
 *   - `secure`: Whether to use SSL/TLS.
 *   - `appId`: Qlik Sense app ID.
 *   - `authType`: Authentication type, either 'cert' or 'jwt'.
 *   - `authUserDir`: User directory for authentication.
 *   - `authUserId`: User ID for authentication.
 *   - `authCertFile`: Path to client certificate file.
 *   - `authCertKeyFile`: Path to client certificate key file.
 *   - `authCertCAFile`: Path to CA certificate file.
 *   - `authJwt`: JWT for authentication.
 *   - `schemaVersion`: Enigma.js schema version.
 * @param {string} [sessionId] - Session ID for JWT authentication.
 * @returns {Object} Enigma.js configuration.
 */
export const setupEnigmaConnection = (options, sessionId) => {
    logger.debug('Prepping for Enigma connection...');

    // Set up enigma.js configuration
    logger.debug(`Enigma.js schema version: ${options.schemaVersion}`);
    const qixSchema = getEnigmaSchema(options);

    let enigmaConfig;
    // Should certificates be used for authentication?
    if (options.authType === 'cert') {
        logger.verbose(`Using certificates for authentication with Enigma`);

        // Get certificate paths
        const { fileCert, fileCertKey, fileCertCA } = getCertFilePaths(options);

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
                    ca: [readCert(fileCertCA)],
                    headers: {
                        'X-Qlik-User': `UserDirectory=${encodeURIComponent(options.authUserDir)};UserId=${encodeURIComponent(
                            options.authUserId
                        )}`,
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

/**
 * Add websocket traffic logging to an Enigma.js session.
 *
 * @param {Object} session - Enigma.js session.
 * @param {Object} options - Global options. Properties used:
 *   - `logLevel`: Log level.
 */
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
