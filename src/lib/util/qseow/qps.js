import https from 'node:https';
import { logger, generateXrfKey, readCert } from '../../../globals.js';

const setupQPSConnection = (options, param) => {
    // eslint-disable-next-line no-unused-vars
    // Ensure valid http method
    if (!param.method || (param.method.toLowerCase() !== 'get' && param.method.toLowerCase() !== 'delete')) {
        logger.error(`Setting up connection to QPS. Invalid http method '${param.method}'. Exiting.`);
        process.exit(1);
    }

    // Port is specified slightly differently for different Ctrl-Q commands
    const port = options.qpsPort === undefined ? options.port : options.qpsPort;

    // Get key for protecting against cross-site request forgery
    const xrfKey = generateXrfKey();

    let axiosConfig;

    // Use cerrificates be used for authentication
    if (options.authType === 'cert') {
        logger.debug(`Using certificates for authentication with QPS`);
        logger.debug(`QPS host: ${options.hostProxy}`);
        logger.debug(`Reject unauthorized certificate: ${!!options.secure}`);

        const httpsAgent = new https.Agent({
            rejectUnauthorized: options.secure !== 'false',
            cert: readCert(param.fileCert),
            key: readCert(param.fileCertKey),
            ca: readCert(param.fileCertCA),
        });

        axiosConfig = {
            url: `${param.path}?xrfkey=${xrfKey}`,
            method: param.method.toLowerCase(),
            baseURL: `https://${param.hostProxy}:${port}`,
            headers: {
                'x-qlik-xrfkey': xrfKey,
                'X-Qlik-User': `UserDirectory=${options.authUserDir};UserId=${options.authUserId}`,
            },
            responseType: 'application/json',
            responseEncoding: 'utf8',
            httpsAgent,
            timeout: 60000,
        };

        // If param.sessionCookie is set, add it to the headers
        if (param.sessionCookie) {
            axiosConfig.headers[param.sessionCookie.cookieName] = param.sessionCookie.cookieValue;
        }
    } else {
        // Report error
        logger.error(`Setting up connection to QPS. Invalid authentication type '${options.authType}'. Exiting.`);

        // Throw error
        throw new Error(`Setting up connection to QPS. Invalid authentication type '${options.authType}'`);
    }

    // Add message body (if any)
    // if (param.body) {
    //     axiosConfig.data = param.body;
    // }

    // Add extra headers (if any)
    if (param.headers) {
        axiosConfig.headers = { ...axiosConfig.headers, ...param.headers };
    }

    // Add parameters (if any)
    if (param.queryParameters?.length > 0) {
        // eslint-disable-next-line no-restricted-syntax
        for (const queryParam of param.queryParameters) {
            axiosConfig.url += `&${queryParam.name}=${queryParam.value}`;
        }
    }

    return axiosConfig;
};

export default setupQPSConnection;
