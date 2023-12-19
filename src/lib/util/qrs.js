const https = require('https');

const { logger, generateXrfKey, readCert } = require('../../globals');

const setupQRSConnection = (options, param) => {
    // eslint-disable-next-line no-unused-vars
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
    // Should cerrificates be used for authentication?
    if (options.authType === 'cert') {
        logger.verbose(`Using certificates for authentication with QRS`);

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            cert: readCert(param.fileCert),
            key: readCert(param.fileCertKey),
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
        // eslint-disable-next-line no-restricted-syntax
        for (const queryParam of param.queryParameters) {
            axiosConfig.url += `&${queryParam.name}=${queryParam.value}`;
        }
    }

    return axiosConfig;
};

module.exports = {
    setupQRSConnection,
};
