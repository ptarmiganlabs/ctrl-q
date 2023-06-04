const https = require('https');

const { logger, generateXrfKey, readCert } = require('../../globals');

const setupQRSConnection = (options, param) => {
    // eslint-disable-next-line no-unused-vars
    // Ensure valid http method
    if (
        !param.method ||
        (param.method.toLowerCase() !== 'get' && param.method.toLowerCase() !== 'post' && param.method.toLowerCase() !== 'put')
    ) {
        logger.error(`Setting up connection to QRS. Invalid http method '${param.method}'. Exiting.`);
        process.exit(1);
    }

    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        cert: readCert(param.fileCert),
        key: readCert(param.fileCertKey),
    });

    // Port is specified slightly differently for different Ctrl-Q commands
    const port = options.qrsPort === undefined ? options.port : options.qrsPort;

    // Set up Sense repository service configuration
    const xrfKey = generateXrfKey();

    const axiosConfig = {
        url: `${param.path}?xrfkey=${xrfKey}`,
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
        //   passphrase: "YYY"
    };

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
