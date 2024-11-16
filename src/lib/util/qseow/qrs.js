import https from 'node:https';

import { logger, generateXrfKey, readCert } from '../../../globals.js';
import { getCertFilePaths } from '../qseow/cert.js';

// Function to sanitize virtual proxy
export function sanitizeVirtualProxy(virtualProxy) {
    // - Should always start with a /
    // - Should never end with a /
    if (virtualProxy === '') {
        virtualProxy = '/';
    } else {
        if (!virtualProxy.startsWith('/')) {
            virtualProxy = `/${virtualProxy}`;
        }

        // Remove all trailing /
        virtualProxy = virtualProxy.replace(/\/+$/, '');
    }

    return virtualProxy;
}

// Function to set up connection to Qlik Sense Repository Service (QRS)
export function setupQrsConnection(options, param) {
    // Ensure correct auth info is present
    if (options.authType === 'cert') {
        // options.authUserDir and options.authUserId should be set
        if (!options.authUserDir || !options.authUserId) {
            logger.error(`Setting up connection to QRS. Missing user directory and/or user ID. Exiting.`);
            process.exit(1);
        }
    } else if (options.authType === 'jwt') {
        // options.authJwt should be set
        if (!options.authJwt) {
            logger.error(`Setting up connection to QRS. Missing JWT. Exiting.`);
            process.exit(1);
        }
    }

    // Ensure valid http method
    if (
        !param.method ||
        (param.method.toLowerCase() !== 'get' &&
            param.method.toLowerCase() !== 'post' &&
            param.method.toLowerCase() !== 'put' &&
            param.method.toLowerCase() !== 'delete')
    ) {
        logger.error(`Setting up connection to QRS. Invalid http method '${param.method}'. Exiting.`);
        process.exit(1);
    }

    // Port is specified slightly differently for different Ctrl-Q commands
    const port = options.qrsPort === undefined ? options.port : options.qrsPort;

    // Set up Sense repository service configuration
    const xrfKey = generateXrfKey();

    // Sanitize virtual proxy prefix
    // If the virtual proxy proxydoes not start with a slash, add it
    // If the virtual proxy ends with a slash, remove it
    let newVirtualProxy = options.virtualProxy;
    if (options.virtualProxy) {
        newVirtualProxy = options.virtualProxy.replace(/\/$/, '');

        // If the virtual proxy length is longer than 1 and does not start with a slash, add it
        if (newVirtualProxy.length > 1 && !newVirtualProxy.startsWith('/')) {
            newVirtualProxy = `/${newVirtualProxy}`;
        }
    }

    // If param.path starts with a slash, remove it
    let newPath = param.path;
    if (param.path) {
        newPath = param.path.replace(/^\//, '');
    }

    let axiosConfig;
    // Should certificates be used for authentication?
    if (options.authType === 'cert') {
        logger.debug(`Using certificates for authentication with QRS`);
        logger.debug(`QRS host: ${options.host}`);
        logger.debug(`Reject unauthorized certificate: ${options.secure}`);

        // Get certificate paths
        // If specified in the param object, use those paths
        // Otherwise, use the paths from the command line options
        let { fileCert, fileCertKey, fileCertCA } = getCertFilePaths(options);

        // If the paths are specified in the param object, use those paths
        if (param.fileCert) {
            fileCert = param.fileCert;
        }

        if (param.fileCertKey) {
            fileCertKey = param.fileCertKey;
        }

        if (param.fileCertCA) {
            fileCertCA = param.fileCertCA;
        }

        const httpsAgent = new https.Agent({
            rejectUnauthorized: options.secure !== 'false',
            cert: readCert(fileCert),
            key: readCert(fileCertKey),
            ca: readCert(fileCertCA),
        });

        axiosConfig = {
            url: `${newVirtualProxy}/${newPath}?xrfkey=${xrfKey}`,
            method: param.method.toLowerCase(),
            baseURL: `https://${options.host}:${port}`,
            headers: {
                'x-qlik-xrfkey': xrfKey,
                'X-Qlik-User': `UserDirectory=${options.authUserDir};UserId=${options.authUserId}`,
            },
            responseType: 'application/json',
            responseEncoding: 'utf8',
            httpsAgent,
            timeout: 60000,
        };
    } else if (options.authType === 'jwt') {
        logger.verbose(`Using JWT for authentication with QRS`);

        const httpsAgent = new https.Agent({
            // rejectUnauthorized: options.secure !== 'false',
            rejectUnauthorized: false,
        });

        axiosConfig = {
            url: `${newVirtualProxy}/${newPath}?xrfkey=${xrfKey}`,
            method: param.method.toLowerCase(),
            baseURL: `https://${options.host}:${port}`,
            headers: {
                'x-qlik-xrfkey': xrfKey,
                Authorization: `Bearer ${options.authJwt}`,
            },
            responseType: 'application/json',
            responseEncoding: 'utf8',
            httpsAgent,
            timeout: 60000,
        };
    }

    // Add message body (if any)
    if (param.body) {
        axiosConfig.data = param.body;
    }

    // Add extra headers (if any)
    if (param.headers) {
        axiosConfig.headers = { ...axiosConfig.headers, ...param.headers };
    }

    // Add parameters (if any)
    if (param.queryParameters?.length > 0) {
        for (const queryParam of param.queryParameters) {
            axiosConfig.url += `&${queryParam.name}=${queryParam.value}`;
        }
    }

    return axiosConfig;
}
