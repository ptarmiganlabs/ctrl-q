const axios = require('axios');

const { logger } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

function taskExistById(taskId, options, fileCert, fileCertKey) {
    return new Promise((resolve, reject) => {
        logger.debug(`Checking if task with ID ${taskId} exists`);

        // const filter = encodeURI(`name eq '👍😎 updateSheetThumbnail'`);
        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/task',
            queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                const response = JSON.parse(result.data);
                if (response.length === 1) {
                    logger.verbose(`Task exists: ID=${response[0].id}. Task name="${response[0].name}"`);
                    // Yes, the task exists
                    resolve(true);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`TASK EXIST BY ID: ${err}`);
            });
    });
}

module.exports = {
    taskExistById,
};
