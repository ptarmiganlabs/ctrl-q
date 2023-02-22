const axios = require('axios');

const { logger } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

function getTagIdByName(tagName, options, fileCert, fileCertKey) {
    return new Promise((resolve, reject) => {
        logger.debug(`Looking up ID for tag named "${tagName}"`);

        // const filter = encodeURI(`name eq '👍😎 updateSheetThumbnail'`);
        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/tag',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${tagName}'`) }],
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.data.length === 1) {
                    logger.verbose(`Successfully found ID ${result.data[0].id} for tag named "${tagName}"`);
                    // Yes, the tag exists
                    resolve(result.data[0].id);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`TAG ID BY NAME: ${err}`);
            });
    });
}

module.exports = {
    getTagIdByName,
};
