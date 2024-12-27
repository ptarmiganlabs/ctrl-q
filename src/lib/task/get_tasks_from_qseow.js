import axios from 'axios';

import { catchLog } from '../util/log.js';
import { setupQrsConnection } from '../util/qseow/qrs.js';

export async function extGetTasksFromQseow(_, logger) {
    return new Promise(async (resolve, reject) => {
        // try {
        logger.debug('GET TASKS FROM QSEOW: Starting get reload tasks from QSEoW');

        let filter = '';

        // Should we get all tasks?
        if (_.options.getAllTasks === true) {
            // No task filters specified
            filter = '';
        } else if (_.options.outputFormat === 'tree') {
            // When visualising tasks as a tree, we need to get all tasks
            filter = '';
        } else if (_.options.outputFormat !== 'tree') {
            // Are there any task filters specified?
            // If so, build a query string

            // Don't add task id and tag filtering if the output is a task tree

            // Add task id(s) to query string
            if (_.options.taskId && _.options?.taskId.length >= 1) {
                // At least one task ID specified
                // Add first task ID
                filter += encodeURIComponent(`(id eq ${_.options.taskId[0]}`);
            }
            if (_.options.taskId && _.options?.taskId.length >= 2) {
                // Add remaining task IDs, if any
                for (let i = 1; i < _.options.taskId.length; i += 1) {
                    filter += encodeURIComponent(` or id eq ${_.options.taskId[i]}`);
                }
            }

            // Add closing parenthesis
            if (_.options.taskId && _.options?.taskId.length >= 1) {
                filter += encodeURIComponent(')');
            }
            logger.debug(`GET TASKS FROM QSEOW: QRS query filter (incl ids): ${filter}`);

            // Add task tag(s) to query string
            if (_.options.taskTag && _.options?.taskTag.length >= 1) {
                // At least one task ID specified
                if (filter.length >= 1) {
                    // We've previously added some task ids
                    // Add first task tag
                    filter += encodeURIComponent(` or (tags.name eq '${_.options.taskTag[0]}'`);
                } else {
                    // No task ids added yet
                    // Add first task tag
                    filter += encodeURIComponent(`(tags.name eq '${_.options.taskTag[0]}'`);
                }
            }
            if (_.options.taskTag && _.options?.taskTag.length >= 2) {
                // Add remaining task tags, if any
                for (let i = 1; i < _.options.taskTag.length; i += 1) {
                    filter += encodeURIComponent(` or tags.name eq '${_.options.taskTag[i]}'`);
                }
            }

            // Add closing parenthesis
            if (_.options.taskTag && _.options?.taskTag.length >= 1) {
                filter += encodeURIComponent(')');
            }
        }

        logger.debug(`GET TASKS FROM QSEOW: QRS query filter (incl ids, tags): ${filter}`);

        let axiosConfig;
        let tasks = [];
        let result;

        try {
            // Get reload tasks
            if (filter === '') {
                axiosConfig = setupQrsConnection(_.options, {
                    method: 'get',
                    path: '/qrs/reloadtask/full',
                });
            } else {
                axiosConfig = setupQrsConnection(_.options, {
                    method: 'get',
                    path: '/qrs/reloadtask/full',
                    queryParameters: [{ name: 'filter', value: filter }],
                });
            }

            result = await axios.request(axiosConfig);
            logger.debug(`GET RELOAD TASK: Result=result.status`);

            tasks = tasks.concat(JSON.parse(result.data));
            logger.verbose(`GET RELOAD TASK: # tasks: ${tasks.length}`);
        } catch (err) {
            catchLog('GET TASKS FROM QSEOW 1', err);
            reject(err);
        }
        try {
            // Get external program tasks
            if (filter === '') {
                axiosConfig = setupQrsConnection(_.options, {
                    method: 'get',
                    path: '/qrs/externalprogramtask/full',
                });
            } else {
                axiosConfig = setupQrsConnection(_.options, {
                    method: 'get',
                    path: '/qrs/externalprogramtask/full',
                    queryParameters: [{ name: 'filter', value: filter }],
                });
            }

            result = await axios.request(axiosConfig);
            logger.debug(`GET EXT PROGRAM TASK: Result=result.status`);

            tasks = tasks.concat(JSON.parse(result.data));
            logger.verbose(`GET EXT PROGRAM TASK: # tasks: ${tasks.length}`);
        } catch (err) {
            catchLog('GET EXTERNAL PROGRAM TASKS FROM QSEOW 1', err);
            reject(err);
        }

        // TODO
        // Determine whether task name anonymisation should be done
        const anonymizeTaskNames = false;

        _.clear();
        for (let i = 0; i < tasks.length; i += 1) {
            if (tasks[i].schemaPath === 'ReloadTask' || tasks[i].schemaPath === 'ExternalProgramTask') {
                _.addTask('from_qseow', tasks[i], anonymizeTaskNames);
            }
        }
        resolve(_.taskList);
    });
}
