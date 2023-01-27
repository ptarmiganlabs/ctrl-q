const axios = require('axios');

const { logger } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

function getCustomPropertyIdByName(customPropertyName, options, fileCert, fileCertKey) {
    return new Promise((resolve, reject) => {
        logger.debug(`Looking up ID for custom property named "${customPropertyName}"`);

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/custompropertydefinition',
            filter: encodeURI(`name eq '${customPropertyName}'`),
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.data.length === 1) {
                    logger.verbose(`Successfully found ID ${result.data[0].id} for custom property named "${customPropertyName}"`);
                    // Yes, the the custom property exists
                    resolve(result.data[0].id);
                } else {
                    reject();
                }
            })
            .catch((err) => {
                logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
            });
    });
}

module.exports = {
    getCustomPropertyIdByName,
};
