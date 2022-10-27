const axios = require('axios');
const path = require('path');

// const { promises: Fs } = require('fs');
// const yesno = require('yesno');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('../util/qrs');
const { getCertFilePaths } = require('../util/cert');
// const { QlikSenseTasks } = require('./class_alltasks');
// const { mapEventType, mapIncrementOption, mapDaylightSavingTime, mapRuleState } = require('../util/lookups');

// https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
function uniqByTaskId(a) {
    const seen = new Set();
    return a.filter((item) => {
        const k = item.id;
        return seen.has(k) ? false : seen.add(k);
    });
}

const getCustomProperty = async (options) => {
    let cp;

    try {
        // Get cert files
        const certFilesFullPath = await getCertFilePaths(options);

        // Build QRS query string using custom property name
        const filter = encodeURIComponent(`name eq '${options.customPropertyName}'`);

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert: certFilesFullPath.fileCert,
            fileCertKey: certFilesFullPath.fileCertKey,
            path: '/qrs/CustomPropertyDefinition/full',
            filter,
        });

        // Query QRS for tasks based on task IDs
        const result = await axios.request(axiosConfig);
        logger.debug(`GET CUSTOM PROPERTY: Result=result.status`);
        if (JSON.parse(result.data).length > 0) {
            // Custom property found
            cp = JSON.parse(result.data);
        } else {
            cp = false;
        }
    } catch (err) {
        logger.error(`GET TASK QRS (ID): ${err.stack}`);
    }
    return cp;
};

const getTasksFromQseow = async (options) => {
    let taskList;

    try {
        // Get QRS certificates
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        //
        // Build QRS query string using task IDs
        let filter = '';
        if (options.taskId && options?.taskId.length >= 1) {
            // At least one task ID specified
            filter += encodeURIComponent(`id eq ${options.taskId[0]}`);
        }
        if (options.taskId && options?.taskId.length >= 2) {
            // Add remaining task IDs, if any
            for (let i = 1; i < options.taskId.length; i += 1) {
                filter += encodeURIComponent(` or id eq ${options.taskId[i]}`);
            }
            logger.debug(`GET TASK 1: QRS query filter: ${filter}`);
        }

        let axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/reloadtask/full',
            filter,
        });

        // Query QRS for tasks based on task IDs
        let result = await axios.request(axiosConfig);
        logger.debug(`GET TASK: Result=result.status`);
        let tmpTaskList = JSON.parse(result.data);

        //
        // Build QRS query string using task tags
        filter = '';
        if (options.taskTag && options?.taskTag.length >= 1) {
            // At least one task tag specified
            filter += encodeURIComponent(`tags.name eq '${options.taskTag[0]}'`);
        }
        if (options.taskTag && options?.taskTag.length >= 2) {
            // Add remaining task tags, if any
            for (let i = 1; i < options.taskTag.length; i += 1) {
                filter += encodeURIComponent(` or tags.name eq '${options.taskTag[i]}'`);
            }
            logger.debug(`GET TASK 2: QRS query filter: ${filter}`);
        }

        axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/reloadtask/full',
            filter,
        });

        // Query QRS for tasks based on task IDs
        result = await axios.request(axiosConfig);
        logger.debug(`GET TASK: Result=result.status`);
        if (result.data.length > 0) {
            tmpTaskList = tmpTaskList.concat(JSON.parse(result.data));
        }

        // Remove duplicates from task list
        taskList = uniqByTaskId(tmpTaskList);
        logger.debug(`GET TASK 3: List of tasks: ${JSON.stringify(taskList)}`);
    } catch (err) {
        logger.error(`GET TASK QRS (ID): ${err.stack}`);
    }
    return taskList;
};

const updateReloadTask = async (options, payload) => {
    try {
        // Get cert files
        const certFilesFullPath = await getCertFilePaths(options);

        const axiosConfig = setupQRSConnection(options, {
            method: 'post',
            fileCert: certFilesFullPath.fileCert,
            fileCertKey: certFilesFullPath.fileCertKey,
            path: '/qrs/reloadtask/update',
            body: payload,
        });

        // Update reload task
        const result = await axios.request(axiosConfig);
        logger.debug(`UPDATE RELOAD TASK CUSTOM PROPERTY: Result=${result.status}`);
    } catch (err) {
        logger.error(`GET TASK QRS (ID): ${err.stack}`);
        return false;
    }
    return true;
};

module.exports = {
    getCustomProperty,
    getTasksFromQseow,
    updateReloadTask,
};
