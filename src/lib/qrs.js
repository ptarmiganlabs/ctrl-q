const https = require('https');

const { logger, generateXrfKey, readCert } = require('../globals');

const setupQRSConnection = (options, param) => {
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        cert: readCert(param.fileCert),
        key: readCert(param.fileCertKey),
    });

    // Set up Sense repository service configuration
    const xrfKey = generateXrfKey();

    const axiosConfig = {
        url: `${param.path}?xrfkey=${xrfKey}`,
        method: 'get',
        baseURL: `https://${options.host}:${options.port}`,
        headers: {
            'x-qlik-xrfkey': xrfKey,
            'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_api',
        },
        responseType: 'application/json',
        httpsAgent,
        timeout: 60000,
        //   passphrase: "YYY"
    };

    if (param.filter?.length > 0) {
        axiosConfig.url += `&filter=${param.filter}`;
    }

    return axiosConfig;
};

module.exports = {
    setupQRSConnection,
};
