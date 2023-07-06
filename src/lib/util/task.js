const axios = require('axios');

const { logger, execPath, getCliOptions } = require('../../globals');
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

function getTaskByName(taskName) {
    return new Promise((resolve, reject) => {
        logger.debug(`Get task with name ${taskName}`);

        // Get CLI options
        const cliOptions = getCliOptions();

        // Make sure certificates exist
        const fileCert = path.resolve(execPath, cliOptions.authCertFile);
        const fileCertKey = path.resolve(execPath, cliOptions.authCertKeyFile);

        const axiosConfig = setupQRSConnection(cliOptions, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/task/full',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${taskName}'`) }],
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                const response = JSON.parse(result.data);
                if (response.length === 1 && response.id) {
                    logger.verbose(`Task exists: ID=${response[0].id}. Task name="${response[0].name}"`);
                    // Yes, the task exists
                    resolve(response.id);
                } else if (response.length > 1) {
                    logger.error(`More than one task with name ${taskName} found. Don't know which task to update. Exiting.`);
                    process.exit(1);
                }

                resolve(false);
            })
            .catch((err) => {
                logger.error(`TASK EXIST BY NAME: ${err}`);
            });
    });
}

module.exports = {
    taskExistById,
    getTaskByName,
};
