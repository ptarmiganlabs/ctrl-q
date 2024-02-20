import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { validate } from 'uuid';
import { logger, execPath, getCliOptions } from '../../globals.js';
import setupQRSConnection from './qrs.js';
import { catchLog } from './log.js';

// Check if a task with a given id exists
// Look for all kinds of tasks, not just reload tasks
export async function taskExistById(taskId, optionsParam) {
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

        // Should cerrificates be used for authentication?
        let axiosConfig;
        if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            // const filter = encodeURI(`name eq '👍😎 updateSheetThumbnail'`);
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: '/qrs/task',
                queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/task',
                queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
            });
        }

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
        catchLog('TASK EXIST BY ID', err);
        return false;
    }
}

// Get task metadata, given a task name
// Returs:
// - false if task does not exist or if multiple tasks with the same name exist
// - task metadata if task exists
export async function getTaskByName(taskName, optionsParam) {
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

        let axiosConfig;
        if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: '/qrs/task/full',
                queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${taskName}'`) }],
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/task/full',
                queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${taskName}'`) }],
            });
        }

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
        catchLog('GET TASK BY NAME', err);
        return false;
    }
}

// Function to get task metadata, given a task ID
// If the task ID is a valid GUID it is assumed to be a task ID that exists in Sense. Report an error if not.
export async function getTaskById(taskId, optionsParam) {
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

        logger.verbose(`GET TASK BY ID: Task ID ${taskId} is a valid GUID. Get associated task from QSEoW.`);

        let axiosConfig;
        if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: `/qrs/task/full`,
                queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: `/qrs/task/full`,
                queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${taskId}`) }],
            });
        }

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
        catchLog('GET TASK BY ID', err);
        return false;
    }
}

// Delete a reload task given its ID
// If the reload task ID is a valid GUID it is assumed to be a reload task ID that exists in Sense. Report an error if not.
export async function deleteReloadTaskById(taskId, optionsParam) {
    try {
        logger.debug(`Delete reload task with ID ${taskId}`);

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
            logger.error(`DELETE RELOAD TASK BY ID: Task ID ${taskId} is not a valid GUID.`);

            return false;
        }

        logger.verbose(`DELETE RELOAD TASK BY ID: Task ID ${taskId} is a valid GUID. Delete associated task from QSEoW.`);

        let axiosConfig;

        if (optionsParam.authType === 'cert') {
            // Expand cert file paths
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            // Make sure certificate files exist on disk
            if (!fs.existsSync(fileCert)) {
                logger.error(`DELETE RELOAD TASK BY ID: Certificate file ${fileCert} does not exist.`);
                return false;
            }

            if (!fs.existsSync(fileCertKey)) {
                logger.error(`DELETE RELOAD TASK BY ID: Certificate key file ${fileCertKey} does not exist.`);
                return false;
            }

            axiosConfig = setupQRSConnection(options, {
                method: 'delete',
                fileCert,
                fileCertKey,
                path: `/qrs/reloadtask/${taskId}`,
            });
        } else if (optionsParam.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'delete',
                path: `/qrs/reloadtask/${taskId}`,
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`DELETE RELOAD TASK BY ID: Result=${result.status}`);

        if (result.status === 204) {
            logger.verbose(`Reload task with ID ${taskId} deleted successfully.`);
            return true;
        }

        return false;
    } catch (err) {
        catchLog('DELETE RELOAD TASK BY ID', err);
        return false;
    }
}

// Delete a external program task given its ID
// If the task ID is a valid GUID it is assumed to be a ext pgm task ID that exists in Sense. Report an error if not.
export async function deleteExternalProgramTaskById(taskId, optionsParam) {
    try {
        logger.debug(`Delete external program task with ID ${taskId}`);

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
            logger.error(`DELETE EXT PGM TASK BY ID: Task ID ${taskId} is not a valid GUID.`);

            return false;
        }

        logger.verbose(`DELETE EXT PGM TASK BY ID: Task ID ${taskId} is a valid GUID. Delete associated task from QSEoW.`);

        let axiosConfig;

        if (optionsParam.authType === 'cert') {
            // Expand cert file paths
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            // Make sure certificate files exist on disk
            if (!fs.existsSync(fileCert)) {
                logger.error(`DELETE EXT PGM TASK BY ID: Certificate file ${fileCert} does not exist.`);
                return false;
            }

            if (!fs.existsSync(fileCertKey)) {
                logger.error(`DELETE EXT PGM TASK BY ID: Certificate key file ${fileCertKey} does not exist.`);
                return false;
            }

            axiosConfig = setupQRSConnection(options, {
                method: 'delete',
                fileCert,
                fileCertKey,
                path: `/qrs/externalprogramtask/${taskId}`,
            });
        } else if (optionsParam.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'delete',
                path: `/qrs/externalprogramtask/${taskId}`,
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`DELETE TASK BY ID: Result=${result.status}`);

        if (result.status === 204) {
            logger.verbose(`External program task with ID ${taskId} deleted successfully.`);
            return true;
        }

        return false;
    } catch (err) {
        catchLog('DELETE EXT PGM TASK BY ID', err);
        return false;
    }
}
