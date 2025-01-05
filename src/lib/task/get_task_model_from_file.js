import { v4 as uuidv4, validate } from 'uuid';

import { getTaskColumnPosFromHeaderRow, mapTaskType } from '../util/qseow/lookups.js';
import { catchLog } from '../util/log.js';
import { createReloadTaskInQseow, createCompositeEventInQseow } from '../util/qseow/task.js';

export async function extGetTaskModelFromFile(_, tasksFromFile, tagsExisting, cpExisting, options, logger) {
    return new Promise(async (resolve, reject) => {
        try {
            logger.debug('PARSE TASKS FROM FILE: Starting get tasks from data in file');

            _.clear();

            // Figure out which data is in which column
            const taskFileColumnHeaders = getTaskColumnPosFromHeaderRow(tasksFromFile.data[0]);

            // Assign values to columns that were not part of earlier versions of the task file
            // This is to make sure that the code below does not break when reading older versions of the task file
            if (taskFileColumnHeaders.importOptions.pos === -1) {
                // No import options column in file. Add a fake one to make sure code below does not break
                logger.debug('PARSE TASKS FROM FILE: No import options column in file. Adding fake one');
                taskFileColumnHeaders.importOptions.pos = 999;
            }

            // We now have all info about the task. Store it to the internal task data structure
            _.taskNetwork = { nodes: [], edges: [], tasks: [] };
            const nodesWithEvents = new Set();

            // Find max task counter = number of tasks to be imported
            // This can be tricky for Excel files, as these can contain empty rows that are still saved in the file on disk.
            // Somehow we need to determine which rows should be treated as input data.
            // The criteria is that the "Task counter" column should either be a heading (i.e. "Task counter") or a number.
            const taskImportCount = Math.max(
                ...tasksFromFile.data.map((item) => {
                    if (item.length === 0) {
                        // Empty row
                        return -1;
                    }

                    // Is first column empty?
                    if (item[taskFileColumnHeaders.taskCounter.pos] === undefined) {
                        // Empty task counter column
                        return -1;
                    }

                    if (item[taskFileColumnHeaders.taskCounter.pos] === taskFileColumnHeaders.taskCounter.name) {
                        // This is the header row
                        return -1;
                    }

                    // When reading from CSV files all columns will be strings.
                    let taskNum;
                    if (_.options.fileType === 'csv') {
                        taskNum = item[taskFileColumnHeaders.taskCounter.pos];
                    }
                    if (_.options.fileType === 'excel') {
                        taskNum = item[taskFileColumnHeaders.taskCounter.pos];
                    }
                    return taskNum;
                })
            );

            logger.info('-------------------------------------------------------------------');
            logger.info('Creating tasks...');

            // Loop over all tasks in source file
            for (let taskCounter = 1; taskCounter <= taskImportCount; taskCounter += 1) {
                // Get all rows associated with this task
                // One row will contain task data, other rows will contain event data associated with the task.
                const taskRows = tasksFromFile.data.filter((item) => item[taskFileColumnHeaders.taskCounter.pos] === taskCounter);
                logger.debug(
                    `(${taskCounter}) PARSE TASKS FROM FILE: Processing task #${taskCounter} of ${taskImportCount}. Data being used:\n${JSON.stringify(
                        taskRows,
                        null,
                        2
                    )}`
                );

                // Verify that first row contains task data. Following rows should contain event data associated with the task.
                // Valid task types are:
                // - Reload
                // - External program
                if (
                    !taskRows[0][taskFileColumnHeaders.taskType.pos] ||
                    !['reload', 'external program'].includes(taskRows[0][taskFileColumnHeaders.taskType.pos].trim().toLowerCase())
                ) {
                    logger.error(
                        `(${taskCounter}) PARSE TASKS FROM FILE: Incorrect task type "${
                            taskRows[0][taskFileColumnHeaders.taskType.pos]
                        }". Exiting.`
                    );
                    process.exit(1);
                }

                // Handle each task type separately
                // Get task type (lower case) from first row
                const taskType = taskRows[0][taskFileColumnHeaders.taskType.pos].trim().toLowerCase();

                // Reload task
                if (taskType === 'reload') {
                    // Create a fake ID for this task. Used to associate task with schema/composite events
                    const fakeTaskId = `reload-task-${uuidv4()}`;

                    const res = await _.parseReloadTask({
                        taskRows,
                        taskFileColumnHeaders,
                        taskCounter,
                        tagsExisting,
                        cpExisting,
                        fakeTaskId,
                        nodesWithEvents,
                        options,
                    });

                    // Add reload task as node in task network
                    // NB: A top level node is defined as:
                    // 1. A task whose taskID does not show up in the "to" field of any edge.

                    _.taskNetwork.nodes.push({
                        id: res.currentTask.id,
                        metaNode: false,
                        isTopLevelNode: !_.taskNetwork.edges.find((edge) => edge.to === res.currentTask.id),
                        label: res.currentTask.name,
                        enabled: res.currentTask.enabled,

                        completeTaskObject: res.currentTask,

                        // Tabulator columns
                        taskId: res.currentTask.id,
                        taskName: res.currentTask.name,
                        taskEnabled: res.currentTask.enabled,
                        appId: res.currentTask.app.id,
                        appName: 'N/A',
                        appPublished: 'N/A',
                        appStream: 'N/A',
                        taskMaxRetries: res.currentTask.maxRetries,
                        taskLastExecutionStartTimestamp: 'N/A',
                        taskLastExecutionStopTimestamp: 'N/A',
                        taskLastExecutionDuration: 'N/A',
                        taskLastExecutionExecutingNodeName: 'N/A',
                        taskNextExecutionTimestamp: 'N/A',
                        taskLastStatus: 'N/A',
                        taskTags: res.currentTask.tags.map((tag) => tag.name),
                        taskCustomProperties: res.currentTask.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
                    });

                    // We now have a basic task object including tags and custom properties.
                    // Schema events are included but composite events are only partially there, as they may need
                    // IDs of tasks that have not yet been created.
                    // Still, store all info for composite events and then do another loop where those events are created for
                    // tasks for which they are defined.
                    //
                    // The strategey is to first create all tasks, then add composite events.
                    // Only then can we be sure all composite events refer to existing tasks.

                    // Create new or update existing reload task in QSEoW
                    // Should we create a new task?
                    // Controlled by option --update-mode
                    if (_.options.updateMode === 'create') {
                        // Create new task
                        if (_.options.dryRun === false || _.options.dryRun === undefined) {
                            const newTaskId = await createReloadTaskInQseow(res.currentTask, taskCounter, _.options);
                            logger.info(`(${taskCounter}) Created new reload task "${res.currentTask.name}", new task id: ${newTaskId}.`);

                            // Add mapping between fake task ID used when creating task network and actual, newly created task ID
                            _.taskIdMap.set(fakeTaskId, newTaskId);

                            // Add mapping between fake task ID specified in source file and actual, newly created task ID
                            if (res.currentTask.id) {
                                _.taskIdMap.set(res.currentTask.id, newTaskId);
                            }

                            res.currentTask.idRef = res.currentTask.id;
                            res.currentTask.id = newTaskId;

                            await _.addTask('from_file', res.currentTask, false);
                        } else {
                            logger.info(`(${taskCounter}) DRY RUN: Creating reload task in QSEoW "${res.currentTask.name}"`);
                        }
                    } else if (_.options.updateMode === 'update-if-exists') {
                        // Update existing task
                        // TODO
                        // // Verify task ID is a valid UUID
                        // // If it's not a valid UUID, the ID specified in the source file will be treated as a task name
                        // if (!validate(res.currentTask.id)) {
                        //     // eslint-disable-next-line no-await-in-loop
                        //     const task = await getTaskByName(res.currentTask.id);
                        //     if (task) {
                        //         // eslint-disable-next-line no-await-in-loop
                        //         await _.updateReloadTaskInQseow(res.currentTask, taskCounter);
                        //     } else {
                        //         throw new Error(
                        //             `Task "${res.currentTask.id}" does not exist in QSEoW and cannot be updated. ` +
                        //                 'Please specify a valid task ID or task name in the source file.'
                        //         );
                        //     }
                        // } else {
                        //     // Verify task ID exists in QSEoW
                        //     // eslint-disable-next-line no-await-in-loop
                        //     const taskExists = await getTaskById(res.currentTask.id);
                        //     if (!taskExists) {
                        //         throw new Error(
                        //             `Task "${res.currentTask.id}" does not exist in QSEoW and cannot be updated. ` +
                        //                 'Please specify a valid task ID or task name in the source file.'
                        //         );
                        //     } else {
                        //         // eslint-disable-next-line no-await-in-loop
                        //         await _.updateReloadTaskInQseow(res.currentTask, taskCounter);
                        //         logger.info(
                        //             `(${taskCounter}) Updated existing task "${res.currentTask.name}", task id: ${res.currentTask.id}.`
                        //         );
                        //     }
                        // }
                        // logger.info(
                        //     `(${taskCounter}) Updated existing task "${res.currentTask.name}", task id: ${res.currentTask.id}.`
                        // );
                    } else {
                        // Invalid combination of import options
                        throw new Error(
                            `Invalid task update mode. Valid values are "create" and "update-if-exists". You specified "${_.options.updateMode}".`
                        );
                    }
                } else if (taskType === 'external program') {
                    // External program task

                    // Create a fake ID for this task. Used to associate task with schema/composite events
                    const fakeTaskId = `ext-pgm-task-${uuidv4()}`;

                    const res = await _.parseExternalProgramTask({
                        taskRows,
                        taskFileColumnHeaders,
                        taskCounter,
                        tagsExisting,
                        cpExisting,
                        fakeTaskId,
                        nodesWithEvents,
                        options,
                    });

                    // Add external program task as node in task network
                    // NB: A top level node is defined as:
                    // 1. A task whose taskID does not show up in the "to" field of any edge.

                    _.taskNetwork.nodes.push({
                        id: res.currentTask.id,
                        metaNode: false,
                        isTopLevelNode: !_.taskNetwork.edges.find((edge) => edge.to === res.currentTask.id),
                        label: res.currentTask.name,
                        enabled: res.currentTask.enabled,

                        completeTaskObject: res.currentTask,

                        taskTags: res.currentTask.tags.map((tag) => tag.name),
                        taskCustomProperties: res.currentTask.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
                    });

                    // We now have a basic task object including tags and custom properties.
                    // Schema events are included but composite events are only partially there, as they may need
                    // IDs of tasks that have not yet been created.
                    // Still, store all info for composite events and then do another loop where those events are created for
                    // tasks for which they are defined.
                    //
                    // The strategey is to first create all tasks, then add composite events.
                    // Only then can we be sure all composite events refer to existing tasks.

                    // Create new or update existing external program task in QSEoW
                    // Should we create a new task?
                    // Controlled by option --update-mode
                    if (_.options.updateMode === 'create') {
                        // Create new task
                        if (_.options.dryRun === false || _.options.dryRun === undefined) {
                            const newTaskId = await createExternalProgramTaskInQseow(res.currentTask, taskCounter, _.options);
                            logger.info(
                                `(${taskCounter}) Created new external program task "${res.currentTask.name}", new task id: ${newTaskId}.`
                            );

                            // Add mapping between fake task ID used when creating task network and actual, newly created task ID
                            _.taskIdMap.set(fakeTaskId, newTaskId);

                            // Add mapping between fake task ID specified in source file and actual, newly created task ID
                            if (res.currentTask.id) {
                                _.taskIdMap.set(res.currentTask.id, newTaskId);
                            }

                            res.currentTask.idRef = res.currentTask.id;
                            res.currentTask.id = newTaskId;

                            await _.addTask('from_file', res.currentTask, false);
                        } else {
                            logger.info(`(${taskCounter}) DRY RUN: Creating external program task in QSEoW "${res.currentTask.name}"`);
                        }
                    } else if (_.options.updateMode === 'update-if-exists') {
                        // Update existing task
                        // TODO
                        // // Verify task ID is a valid UUID
                        // // If it's not a valid UUID, the ID specified in the source file will be treated as a task name
                        // if (!validate(res.currentTask.id)) {
                        //     // eslint-disable-next-line no-await-in-loop
                        //     const task = await
                    } else {
                        // Invalid combination of import options
                        throw new Error(
                            `Invalid task update mode. Valid values are "create" and "update-if-exists". You specified "${_.options.updateMode}".`
                        );
                    }
                }
            }

            // At this point all tasks have been created or updated in Sense.
            // The tasks' associated composite events have been parsed and are stored in the qlikSenseCompositeEvents object.
            // Time now to create the composite events in Sense.

            // Make sure all composite tasks contain real, valid task UUIDs pointing to previously existing or newly created tasks.
            // Get task IDs for upstream tasks that composite events are connected to via their respective rules.
            // Some rules will point to upstream tasks that are created during this execution of Ctrl-Q, other upstream tasks existed before this execution of Ctrl-Q.
            // Use the task ID map to get the correct task ID for each upstream task.
            _.qlikSenseCompositeEvents.compositeEventList.map((item) => {
                const a = item;

                // Set task ID for the composite event itself, i.e. which task is the event associated with (i.e. the downstream task)
                // Handle different task types differently
                if (item.compositeEvent?.reloadTask?.id) {
                    // Reload task
                    a.compositeEvent.reloadTask.id = _.taskIdMap.get(item.compositeEvent.reloadTask.id);
                } else if (item.compositeEvent?.externalProgramTask?.id) {
                    // External program task
                    a.compositeEvent.externalProgramTask.id = _.taskIdMap.get(item.compositeEvent.externalProgramTask.id);
                }

                // For this composite event, set the correct task id for each each rule.
                // Different properties are used for reload tasks, external program tasks etc.
                // Some rules may be pointing to newly created tasks. These can be looked up in the taskIdMap.
                a.compositeEvent.compositeRules.map((item2) => {
                    const b = item2;

                    // Get triggering/upstream task id
                    const id = _.taskIdMap.get(b.task.id);

                    // If id is not found in the mapping table, it means that the task
                    // referenced by the rule (i.e. the upstream teask) is neither a task
                    // that existed before this execution of Ctrl-Q, nor a task that was
                    // created during this execution of Ctrl-Q.
                    // This is an error - the task ID should exist.
                    // Most likely the error is caused by an invalid value in the "Rule task id"
                    // column in the source file.
                    if (id !== undefined && validate(id) === true) {
                        // Determine what kind of task this is. Options are:
                        // - reload
                        // - external program
                        //
                        // Also need to know if the task is a new task created during this execution of Ctrl-Q or if it's an existing task in Sense.
                        let taskType;
                        if (b.upstreamTaskExistence === 'exists-in-source-file') {
                            const task = _.taskList.find((item3) => item3.taskId === id);
                            taskType = task.taskType;
                            // const { taskType } = _.taskNetwork.nodes.find((node) => node.id === id).completeTaskObject;
                        } else if (b.upstreamTaskExistence === 'exists-in-sense') {
                            const task = _.compositeEventUpstreamTask.find((item4) => item4.id === b.task.id);

                            // Ensure we got a task back
                            if (!task) {
                                logger.error(
                                    `PREPARING COMPOSITE EVENT: Invalid upstream task ID "${b.task.id}" in rule for composite event "${a.compositeEvent.name}". This is an error - that task ID should exist. Existing.`
                                );
                                process.exit(1);
                            }

                            taskType = task.taskType;
                        }

                        // Use mapTaskType to get the string variant of the task type. Convert to lower case.
                        const taskTypeString = mapTaskType.get(taskType).trim().toLowerCase();

                        // Ensure we got a valid task type
                        if (!['reload', 'externalprogram'].includes(taskTypeString)) {
                            logger.error(
                                `PREPARING COMPOSITE EVENT: Invalid task type "${taskTypeString}" for upstream task ID "${b.task.id}" in rule for composite event "${a.compositeEvent.name}". Exiting.`
                            );
                            process.exit(1);
                        }

                        if (taskTypeString === 'reload') {
                            b.reloadTask = { id };
                        } else if (taskTypeString === 'externalprogram') {
                            b.externalProgramTask = { id };
                        }
                    } else if (id === undefined) {
                        // (_.options.dryRun === false || _.options.dryRun === undefined) {
                        logger.error(
                            `PREPARING COMPOSITE EVENT: Invalid upstream task ID "${b.task.id}" in rule for composite event "${a.compositeEvent.name}". Exiting.`
                        );
                        process.exit(1);
                    }
                    return b;
                });
                return a;
            });

            logger.info('-------------------------------------------------------------------');
            logger.info('Creating composite events for the just created tasks...');

            for (const { compositeEvent } of _.qlikSenseCompositeEvents.compositeEventList) {
                if (_.options.dryRun === false || _.options.dryRun === undefined) {
                    await createCompositeEventInQseow(compositeEvent, _.options);
                } else {
                    logger.info(`DRY RUN: Creating composite event "${compositeEvent.name}"`);
                }
            }

            // Add tasks to network array in plain, non-hierarchical format
            _.taskNetwork.tasks = _.taskList;

            resolve(_.taskList);
        } catch (err) {
            catchLog('PARSE TASKS FROM FILE 1', err);

            if (err?.response?.status) {
                logger.error(`Received error ${err.response?.status}/${err.response?.statusText} from QRS API`);
            }
            if (err?.response?.data) {
                logger.error(`Error message from QRS API: ${err.response.data}`);
            }
            if (err?.config?.data) {
                logger.error(`Data sent to Sense: ${JSON.stringify(JSON.parse(err.config.data), null, 2)}}`);
            }
            reject(err);
        }
    });
}
