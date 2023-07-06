const axios = require('axios');
const path = require('path');
const { validate } = require('uuid');

const { logger, execPath, getCliOptions } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

async function taskExistById(taskId, optionsParam) {
    try {
        logger.debug(`Checking if task with ID ${taskId} exists`);

        // Did we get any options as parameter?
        let options;
        if (!optionsParam) {
            // Get CLI options
            options = getCliOptions();
        } else {
            options = optionsParam;
        }

        // Is the task ID a valid GUID?
        if (!validate(taskId)) {
            logger.error(`TASK EXIST BY ID: Task ID ${taskId} is not a valid GUID.`);

            return false;
        }

        // Make sure certificates exist
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        // const filter = encodeURI(`name eq '👍😎 updateSheetThumbnail'`);
        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/task',
            queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
        });

        const result = await axios.request(axiosConfig);
        logger.debug(`TASK EXIST BY ID: Result=${result.status}`);

        if (result.status === 200) {
            const tasks = JSON.parse(result.data);
            logger.debug(`TASK EXIST BY ID: Task details: ${JSON.stringify(tasks)}`);

            if (tasks.length === 1 && tasks[0].id) {
                // Yes, the task exists
                logger.verbose(`Task exists: ID=${tasks[0].id}. Task name="${tasks[0].name}"`);

                return true;
            }

            if (tasks.length > 1) {
                logger.error(`More than one task with ID ${taskId} found. Should not be possible. Exiting.`);
                process.exit(1);
            } else {
                return false;
            }
        }

        return false;
    } catch (err) {
        logger.error(`TASK EXIST BY ID: ${err}`);

        // Show stack trace if available
        if (err.stack) {
            logger.error(`TASK EXIST BY ID:\n  ${err.stack}`);
        }

        return false;
    }
}

async function getTaskByName(taskName, optionsParam) {
    try {
        logger.debug(`Get task with name ${taskName}`);

        // Did we get any options as parameter?
        let options;
        if (!optionsParam) {
            // Get CLI options
            options = getCliOptions();
        } else {
            options = optionsParam;
        }

        // Make sure certificates exist
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/task/full',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${taskName}'`) }],
        });

        const result = await axios.request(axiosConfig);
        logger.debug(`GET TASK BY NAME: Result=${result.status}`);

        if (result.status === 200) {
            const tasks = JSON.parse(result.data);
            logger.debug(`GET TASK BY NAME: Task details: ${JSON.stringify(tasks)}`);

            if (tasks.length === 1 && tasks[0].id) {
                // Yes, the task exists
                logger.verbose(`Task exists: ID=${tasks[0].id}. Task name="${tasks[0].name}"`);

                return tasks[0];
            }

            if (tasks.length > 1) {
                logger.warn(`More than one task with name ${taskName} found.`);
            }
        }
        return false;
    } catch (err) {
        logger.error(`GET TASK BY NAME: ${err}`);

        // Show stack trace if available
        if (err.stack) {
            logger.error(`GET TASK BY NAME:\n  ${err.stack}`);
        }

        return false;
    }
}

async function getTaskById(taskId, optionsParam) {
    try {
        logger.debug(`Get task with ID ${taskId}`);

        // Did we get any options as parameter?
        let options;
        if (!optionsParam) {
            // Get CLI options
            options = getCliOptions();
        } else {
            options = optionsParam;
        }

        // Is the task ID a valid GUID?
        if (!validate(taskId)) {
            logger.error(`GET TASK BY ID: Task ID ${taskId} is not a valid GUID.`);

            return false;
        }

        // Make sure certificates exist
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: `/qrs/task/full`,
            queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
        });

        const result = await axios.request(axiosConfig);
        logger.debug(`GET TASK BY ID: Result=${result.status}`);

        if (result.status === 200) {
            const tasks = JSON.parse(result.data);
            logger.debug(`GET TASK BY ID: Task details: ${JSON.stringify(tasks)}`);

            if (tasks.length === 1 && tasks[0].id) {
                // Yes, the task exists
                logger.verbose(`Task exists: ID=${tasks[0].id}. Task name="${tasks[0].name}"`);

                return tasks[0];
            }

            if (tasks.length > 1) {
                logger.error(`More than one task with ID ${taskId} found. Should not be possible. Exiting.`);
                process.exit(1);
            }
        }

        return false;
    } catch (err) {
        logger.error(`GET TASK BY ID: ${err}`);

        // Show stack trace if available
        if (err.stack) {
            logger.error(`GET TASK BY ID:\n  ${err.stack}`);
        }

        return false;
    }
}

module.exports = {
    taskExistById,
    getTaskByName,
    getTaskById,
};
