const https = require('https');

const { logger, generateXrfKey, readCert } = require('../../globals');

const setupQRSConnection = (options, param) => {
    // eslint-disable-next-line no-unused-vars
    // new Promise((resolve, _reject) => {
    // Ensure valid http method
    if (!param.method || (param.method.toLowerCase() !== 'get' && param.method.toLowerCase() !== 'post')) {
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
            // 'Content-Type': 'application/json; charset=utf-8',
        },
        responseType: 'application/json',
        httpsAgent,
        timeout: 60000,
        // data: param.body,
        //   passphrase: "YYY"
    };

    if (param.body) {
        axiosConfig.data = param.body;
    }

    if (param.filter?.length > 0) {
        axiosConfig.url += `&filter=${param.filter}`;
    }

    // resolve(axiosConfig);
    return axiosConfig;
    // });
};

module.exports = {
    setupQRSConnection,
};
