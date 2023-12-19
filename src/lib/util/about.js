const axios = require('axios');
const path = require('path');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

function getAboutFromQseow(options) {
    return new Promise((resolve, reject) => {
        logger.verbose(`Getting about info from QSEoW...`);

        // Should cerrificates be used for authentication?
        let axiosConfig;
        if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: '/qrs/about',
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/about',
            });
        }

        logger.debug(`About to get about info from QSEoW`);

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200) {
                    const response = JSON.parse(result.data);
                    logger.debug(`Successfully retrieved about info from QSEoW`);
                    // Yes, the tag exists
                    resolve(response);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`GET ABOUT INFO: ${err}`);
            });
    });
}

module.exports = {
    getAboutFromQseow,
};
