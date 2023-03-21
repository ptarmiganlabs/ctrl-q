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

    // Set up Sense repository service configuration
    const xrfKey = generateXrfKey();

    const axiosConfig = {
        url: `${param.path}?xrfkey=${xrfKey}`,
        method: param.method.toLowerCase(),
        baseURL: `https://${options.host}:${options.port}`,
        headers: {
            'x-qlik-xrfkey': xrfKey,
            'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_api',
            // 'Accept': 'application/json',
            // 'Content-Type': 'application/json; charset=utf-8',
        },
        // responseType: 'application/json',
        responseType: 'application/json',
        responseEncoding: 'utf8',
        httpsAgent,
        timeout: 60000,
        //   passphrase: "YYY"
        // validateStatus(status) {
        //     // if this function returns true, exception is not thrown, so
        //     // in simplest case just return true to handle status checks externally.
        //     if (status === 429 || status === 200 || status === 201) {
        //         return true;
        //     }
        //     return false;
        // },

        // backoffType: 'exponential',
        // onRetryAttempt: (err) => {
        //     const cfg = rax.getConfig(err);
        //     const status = err.response.status;
        //     console.log(`🔄 [${status}] Retry attempt #${cfg.currentRetryAttempt}`);
        // },
    };

    // Add message body (if any)
    if (param.body) {
        axiosConfig.data = param.body;
    }

    // Add extra headers (if any)
    if (param.headers?.length > 0) {
        // eslint-disable-next-line no-restricted-syntax
        for (const item of param.headers) {
            axiosConfig.headers[item.name] = item.value;
        }
    }

    // Add parameters (if any)
    if (param.queryParameters?.length > 0) {
        // eslint-disable-next-line no-restricted-syntax
        for (const queryParam of param.queryParameters) {
            axiosConfig.url += `&${queryParam.name}=${queryParam.value}`;
        }
    }

    // if (param.filter?.length > 0) {
    //     axiosConfig.url += `&filter=${param.filter}`;
    //     firstParam = false;
    // }

    return axiosConfig;
};

module.exports = {
    setupQRSConnection,
};
