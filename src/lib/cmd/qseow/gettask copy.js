import tree from 'text-treeview';
import { table } from 'table';
import { promises as Fs } from 'node:fs';
import xlsx from 'node-xlsx';
import { stringify } from 'csv-stringify';
import yesno from 'yesno';
import { logger, setLoggingLevel, isSea, execPath, verifyFileSystemExists } from '../../../globals.js';
import { QlikSenseTasks } from '../../task/class_alltasks.js';
import { mapEventType, mapIncrementOption, mapDaylightSavingTime, mapRuleState } from '../../util/qseow/lookups.js';
import { getTagsFromQseow } from '../../util/qseow/tag.js';
import { catchLog } from '../../util/log.js';

const consoleTableConfig = {
    border: {
        topBody: `─`,
        topJoin: `┬`,
        topLeft: `┌`,
        topRight: `┐`,

        bottomBody: `─`,
        bottomJoin: `┴`,
        bottomLeft: `└`,
        bottomRight: `┘`,

        bodyLeft: `│`,
        bodyRight: `│`,
        bodyJoin: `│`,

        joinBody: `─`,
        joinLeft: `├`,
        joinRight: `┤`,
        joinJoin: `┼`,
    },
    columns: {
        // 3: { width: 40 },
        // 4: { width: 40 },
        // 5: { width: 40 },
        // 6: { width: 40 },
        // 9: { width: 40 },
    },
};

// Only keep "text" and "children" properties
function cleanupTaskTree(taskTree) {
    taskTree.forEach((element) => {
        for (const prop in element) {
            if (prop !== 'text' && prop !== 'children') {
                delete element[prop];
            } else if (typeof element[prop] === 'object') {
                cleanupTaskTree(element[prop]);
            }
        }
    });
}

// Used to sort task trees
function compareTree(a, b) {
    if (a.text < b.text) {
        return -1;
    }
    if (a.text > b.text) {
        return 1;
    }
    return 0;
}

// Used to sort task tables
function compareTable(a, b) {
    if (`${a.completeTaskObject.schemaPath}|${a.taskName}` < `${b.completeTaskObject.schemaPath}|${b.taskName}`) {
        return -1;
    }
    if (`${a.completeTaskObject.schemaPath}|${a.taskName}` > `${b.completeTaskObject.schemaPath}|${b.taskName}`) {
        return 1;
    }
    // if (a.taskName < b.taskName) {
    //     return -1;
    // }
    // if (a.taskName > b.taskName) {
    //     return 1;
    // }
    return 0;
}

// CLI command: qseow get-task
// Options are assumed to be verified before calling this function
export async function getTask(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.verbose('Get tasks');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        let returnValue = false;

        // Get all tags
        const tags = await getTagsFromQseow(options);

        // Get reload and external program tasks
        const qlikSenseTasks = new QlikSenseTasks();
        await qlikSenseTasks.init(options);
        const res1 = await qlikSenseTasks.getTaskModelFromQseow();
        if (!res1) {
            logger.error('Failed to get task model from QSEoW');
            return false;
        }

        logger.info('');
        logger.info(`Parsing ${qlikSenseTasks.taskNetwork.nodes.length} tasks in task model...`);

        // What should we do with the retrieved task data?
        if (options.outputFormat === 'tree') {
            const taskModel = qlikSenseTasks.taskNetwork;
            let taskTree = [];

            // Get all tasks that have a schedule associated with them
            // Schedules are represented by "meta nodes" that are linked to the task node in Ctrl-Q's internal data model
            // There is one meta-node per schema trigger, meaning that a task with several schema triggers will have several top-level meta nodes.
            // We only want the task to show up once in the tree, so we have do de-duplicate the top level task nodes.
            const topLevelTasksWithSchemaTriggers = taskModel.nodes.filter((node) => {
                if (node.metaNode && node.metaNodeType === 'schedule') {
                    return true;
                }
                // Exclude all non-meta nodes
                return false;
            });

            // Remove all duplicates from the topLevelTasksWithSchemaTriggers array.
            // Use completeSchemaEvent.reloadTask.id as the key to determine if the task is a duplicate or not.
            const topLevelTasksWithSchemaTriggersUnique = topLevelTasksWithSchemaTriggers.filter((task, index, self) => {
                // Handle reload tasks, external program tasks
                if (task.completeSchemaEvent.reloadTask) {
                    return (
                        index === self.findIndex((t) => t.completeSchemaEvent?.reloadTask?.id === task.completeSchemaEvent.reloadTask.id)
                    );
                }
                if (task.completeSchemaEvent.externalProgramTask) {
                    return (
                        index ===
                        self.findIndex(
                            (t) => t.completeSchemaEvent?.externalProgramTask?.id === task.completeSchemaEvent.externalProgramTask.id
                        )
                    );
                }
                return false;
            });

            // Sort the array alfabetically, using the task name as the key
            // Task name is found in either completeSchemaEvent.externalProgramTask.name or completeSchemaEvent.reloadTask.name
            topLevelTasksWithSchemaTriggersUnique.sort((a, b) => {
                if (a.completeSchemaEvent.reloadTask) {
                    if (b.completeSchemaEvent.reloadTask) {
                        if (a.completeSchemaEvent.reloadTask.name < b.completeSchemaEvent.reloadTask.name) {
                            return -1;
                        }
                        if (a.completeSchemaEvent.reloadTask.name > b.completeSchemaEvent.reloadTask.name) {
                            return 1;
                        }
                    } else if (b.completeSchemaEvent.externalProgramTask) {
                        if (a.completeSchemaEvent.reloadTask.name < b.completeSchemaEvent.externalProgramTask.name) {
                            return -1;
                        }
                        if (a.completeSchemaEvent.reloadTask.name > b.completeSchemaEvent.externalProgramTask.name) {
                            return 1;
                        }
                    }
                }
                if (a.completeSchemaEvent.externalProgramTask) {
                    if (b.completeSchemaEvent.externalProgramTask) {
                        if (a.completeSchemaEvent.externalProgramTask.name < b.completeSchemaEvent.externalProgramTask.name) {
                            return -1;
                        }
                        if (a.completeSchemaEvent.externalProgramTask.name > b.completeSchemaEvent.externalProgramTask.name) {
                            return 1;
                        }
                    } else if (b.completeSchemaEvent.reloadTask) {
                        if (a.completeSchemaEvent.externalProgramTask.name < b.completeSchemaEvent.reloadTask.name) {
                            return -1;
                        }
                        if (a.completeSchemaEvent.externalProgramTask.name > b.completeSchemaEvent.reloadTask.name) {
                            return 1;
                        }
                    }
                }
                return 0;
            });

            for (const task of topLevelTasksWithSchemaTriggersUnique) {
                if (task.metaNode && task.metaNodeType === 'schedule') {
                    const subTree = qlikSenseTasks.getTaskSubTree(task, 0, null);
                    subTree[0].isTopLevelNode = true;
                    subTree[0].isScheduled = true;
                    taskTree = taskTree.concat(subTree);
                }
            }

            // Add new top level node with clock/scheduler emoji, if tree icons are enabled
            if (options.treeIcons) {
                taskTree = [{ text: '⏰ --==| Scheduled tasks |==--', children: taskTree }];
            } else {
                taskTree = [{ text: '--==| Scheduled tasks |==--', children: taskTree }];
            }

            // Add unscheduled tasks that are also top level tasks.
            const unscheduledTasks = qlikSenseTasks.taskNetwork.nodes.filter((node) => {
                if (!node.metaNode && node.isTopLevelNode) {
                    const a = !taskTree.some((el) => {
                        const b = el.taskId === node.id;
                        return b;
                    });
                    return a;
                }
                // Don't include meta nodes
                return false;
            });

            // Sort unscheduled tasks alfabetically
            // Use taskName as the key
            unscheduledTasks.sort((a, b) => {
                if (a.taskName < b.taskName) {
                    return -1;
                }
                if (a.taskName > b.taskName) {
                    return 1;
                }
                return 0;
            });

            for (const task of unscheduledTasks) {
                const subTree = qlikSenseTasks.getTaskSubTree(task, 0, null);
                subTree[0].isTopLevelNode = true;
                subTree[0].isScheduled = false;
                taskTree = taskTree.concat(subTree);
            }

            // Output task tree to correct destination
            if (options.outputDest === 'screen') {
                logger.info(``);
                logger.info(`# top-level rows in tree: ${taskTree.length}`);
                logger.info(`\n${tree(taskTree)}`);
                returnValue = true;
            } else if (options.outputDest === 'file') {
                logger.verbose(`Writing task tree to disk file "${options.outputFileName}"`);
                let buffer;
                if (options.outputFileFormat === 'json') {
                    // Only keep the text and children properties of the tree object
                    cleanupTaskTree(taskTree);

                    // Format JSON nicely
                    buffer = JSON.stringify(taskTree, null, 4);
                } else {
                    logger.error(`Output file format "${options.outputFileFormat}" not supported for task trees. Exiting.`);
                    process.exit(1);
                }

                // Check if file exists
                if ((await verifyFileSystemExists(options.outputFileName, true)) === false) {
                    // File doesn't exist
                } else if (!options.outputFileOverwrite) {
                    // Target file exist. Ask if user wants to overwrite
                    logger.info();
                    const ok = await yesno({
                        question: `                                  Destination file "${options.outputFileName}" exists. Do you want to overwrite it? (y/n)`,
                    });
                    logger.info();
                    if (ok === false) {
                        logger.info('❌ Not overwriting existing output file. Exiting.');
                        process.exit(1);
                    }
                } else if (options.outputFileOverwrite) {
                    // File exists and force overwrite is set
                    logger.info(`❗️ Existing output file will be replaced.`);
                }
                logger.info(`✅ Writing task tree to disk file "${options.outputFileName}".`);
                await Fs.writeFile(options.outputFileName, buffer);
                returnValue = true;
            }
        } else if (options.outputFormat === 'table') {
            const { tasks } = qlikSenseTasks.taskNetwork;
            const { schemaEventList } = qlikSenseTasks.qlikSenseSchemaEvents;
            const { compositeEventList } = qlikSenseTasks.qlikSenseCompositeEvents;

            let taskTable = [];
            let taskCount = 1;

            // Sort tasks, group by task type
            tasks.sort(compareTable);

            // Determine which column blocks should be included in table
            const columnBlockShow = {
                common: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails.find((item) => item === 'common'))
                ),
                lastexecution: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails.find((item) => item === 'lastexecution'))
                ),
                tag: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails.find((item) => item === 'tag'))
                ),
                customproperty: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails.find((item) => item === 'customproperty'))
                ),
                schematrigger: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails?.find((item) => item === 'schematrigger'))
                ),
                compositetrigger: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails?.find((item) => item === 'compositetrigger'))
                ),
            };

            for (const task of tasks) {
                if (
                    (options.taskType?.find((item) => item === 'reload') && task.completeTaskObject.schemaPath === 'ReloadTask') ||
                    (options.taskType?.find((item) => item === 'ext-program') &&
                        task.completeTaskObject.schemaPath === 'ExternalProgramTask')
                ) {
                    let row = [];
                    let tmpRow = [];
                    let eventCount = 1;

                    // Get icon for task status
                    let taskStatus = '';
                    if (task.taskLastStatus) {
                        if (task.taskLastStatus === 'FinishedSuccess') {
                            taskStatus = `✅ ${task.taskLastStatus}`;
                        } else if (task.taskLastStatus === 'FinishedFail') {
                            taskStatus = `❌ ${task.taskLastStatus}`;
                        } else if (task.taskLastStatus === 'Skipped') {
                            taskStatus = `🚫 ${task.taskLastStatus}`;
                        } else if (task.taskLastStatus === 'Aborted') {
                            taskStatus = `🛑 ${task.taskLastStatus}`;
                        } else if (task.taskLastStatus === 'Never started') {
                            taskStatus = `💤 ${task.taskLastStatus}`;
                        } else {
                            taskStatus = `❔ ${task.taskLastStatus}`;
                        }
                    }

                    if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                        row = [taskCount, 'Reload'];
                    } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                        row = [taskCount, 'External program'];
                    }

                    if (columnBlockShow.common) {
                        tmpRow = [
                            task.taskName,
                            task.taskId,
                            task.taskEnabled,
                            task.taskSessionTimeout,
                            task.taskMaxRetries,
                            task.appId ? task.appId : '',
                            task.isPartialReload ? task.isPartialReload : '',
                            task.isManuallyTriggered ? task.isManuallyTriggered : '',
                            task.path ? task.path : '',
                            task.parameters ? task.parameters : '',
                        ];
                        row = row.concat(tmpRow);
                    }

                    if (columnBlockShow.lastexecution) {
                        tmpRow = [
                            taskStatus,
                            task.taskLastExecutionStartTimestamp,
                            task.taskLastExecutionStopTimestamp,
                            task.taskLastExecutionDuration,
                            task.taskLastExecutionExecutingNodeName,
                        ];
                        row = row.concat(tmpRow);
                    }

                    if (columnBlockShow.tag) {
                        tmpRow = [task.taskTags.map((item) => item.name).join(' / ')];
                        row = row.concat(tmpRow[0]);
                    }

                    if (columnBlockShow.customproperty) {
                        tmpRow = [task.taskCustomProperties.map((item) => `${item.definition.name}=${item.value}`).join(' / ')];
                        row = row.concat(tmpRow[0]);
                    }

                    // If complete details are requested, or if schema or composite columns are requested, add empty columns for general event info
                    if (
                        options.tableDetails === true ||
                        options.tableDetails === '' ||
                        columnBlockShow.schematrigger ||
                        columnBlockShow.compositetrigger
                    ) {
                        tmpRow = Array(7).fill('');
                        row = row.concat(tmpRow);
                    }

                    // If complete details are requested, or if schema columns are requested, add empty columns for schema event info
                    if (columnBlockShow.schematrigger) {
                        tmpRow = Array(7).fill('');
                        row = row.concat(tmpRow);
                    }

                    // If complete details are requested, or if composite columns are requested, add empty columns for composite event info
                    if (columnBlockShow.compositetrigger) {
                        tmpRow = Array(8).fill('');
                        row = row.concat(tmpRow);
                    }

                    // Add main task info to  table
                    taskTable = taskTable.concat([row]);

                    // Find all schema events for this task
                    const schemaEventsForThisTask = schemaEventList.filter((item) => {
                        if (item.schemaEvent?.reloadTask?.id === task.taskId) {
                            return true;
                        }
                        if (item.schemaEvent?.externalProgramTask?.id === task.taskId) {
                            return true;
                        }
                        return false;
                    });

                    // Find all composite events for this task
                    const compositeEventsForThisTask = compositeEventList.filter((item) => {
                        if (item.compositeEvent?.reloadTask?.id === task.taskId) {
                            return true;
                        }
                        if (item.compositeEvent?.externalProgramTask?.id === task.taskId) {
                            return true;
                        }
                        return false;
                    });

                    // Write schema events to table
                    if (columnBlockShow.schematrigger) {
                        for (const event of schemaEventsForThisTask) {
                            row = [taskCount, ''];

                            if (columnBlockShow.common) {
                                tmpRow = [...Array(10).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.lastexecution) {
                                tmpRow = [...Array(5).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.tag) {
                                tmpRow = [...Array(1).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.customproperty) {
                                tmpRow = [...Array(1).fill('')];
                                row = row.concat(tmpRow);
                            }

                            // Include general event columns if schema or composite columns should be shown
                            tmpRow = [eventCount, mapEventType.get(event.schemaEvent.eventType)];
                            row = row.concat(tmpRow);

                            tmpRow = [
                                event.schemaEvent.name,
                                event.schemaEvent.enabled,
                                event.schemaEvent.createdDate,
                                event.schemaEvent.modifiedDate,
                                event.schemaEvent.modifiedByUserName,

                                mapIncrementOption.get(event.schemaEvent.incrementOption),
                                event.schemaEvent.incrementDescription,
                                mapDaylightSavingTime.get(event.schemaEvent.daylightSavingTime),
                                event.schemaEvent.startDate,
                                event.schemaEvent.expirationDate,
                                event.schemaEvent.schemaFilterDescription[0],
                                event.schemaEvent.timeZone,
                            ];
                            row = row.concat(tmpRow);

                            if (columnBlockShow.compositetrigger) {
                                tmpRow = Array(8).fill('');
                                row = row.concat(tmpRow);
                            }

                            taskTable = taskTable.concat([row]);

                            eventCount += 1;
                        }
                    }

                    // Write composite events to table
                    if (columnBlockShow.compositetrigger) {
                        for (const event of compositeEventsForThisTask) {
                            row = [taskCount, ''];

                            if (columnBlockShow.common) {
                                tmpRow = [...Array(10).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.lastexecution) {
                                tmpRow = [...Array(5).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.tag) {
                                tmpRow = [...Array(1).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.customproperty) {
                                tmpRow = [...Array(1).fill('')];
                                row = row.concat(tmpRow);
                            }

                            // Include general event columns
                            tmpRow = [eventCount, mapEventType.get(event.compositeEvent.eventType)];
                            row = row.concat(tmpRow);

                            if (columnBlockShow.compositetrigger) {
                                tmpRow = [
                                    event.compositeEvent.name,
                                    event.compositeEvent.enabled,
                                    event.compositeEvent.createdDate,
                                    event.compositeEvent.modifiedDate,
                                    event.compositeEvent.modifiedByUserName,
                                ];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.schematrigger) {
                                tmpRow = [...Array(7).fill('')];
                                row = row.concat(tmpRow);
                            }

                            if (columnBlockShow.compositetrigger) {
                                // Composite task time constraints
                                tmpRow = [
                                    event.compositeEvent.timeConstraint.seconds,
                                    event.compositeEvent.timeConstraint.minutes,
                                    event.compositeEvent.timeConstraint.hours,
                                    event.compositeEvent.timeConstraint.days,
                                    '',
                                    '',
                                    '',
                                    '',
                                ];
                                row = row.concat(tmpRow);
                            }

                            taskTable = taskTable.concat([row]);

                            // Add all composite rules to table
                            let ruleCount = 1;

                            for (const rule of event.compositeEvent.compositeRules) {
                                row = [taskCount, ''];

                                if (columnBlockShow.common) {
                                    tmpRow = [...Array(10).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                if (columnBlockShow.lastexecution) {
                                    tmpRow = [...Array(5).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                if (columnBlockShow.tag) {
                                    tmpRow = [...Array(1).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                if (columnBlockShow.customproperty) {
                                    tmpRow = [...Array(1).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                // Include general event columns
                                tmpRow = [eventCount, '', '', '', '', '', ''];
                                row = row.concat(tmpRow);

                                if (columnBlockShow.schematrigger) {
                                    // Add empty columns for schema event info
                                    tmpRow = [...Array(7).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                // Is it a reload task or external program task?
                                if (rule.reloadTask) {
                                    tmpRow = [
                                        '',
                                        '',
                                        '',
                                        '',
                                        ruleCount,
                                        mapRuleState.get(rule.ruleState),
                                        rule.reloadTask.name,
                                        rule.reloadTask.id,
                                    ];
                                } else if (rule.externalProgramTask) {
                                    tmpRow = [
                                        '',
                                        '',
                                        '',
                                        '',
                                        ruleCount,
                                        mapRuleState.get(rule.ruleState),
                                        rule.externalProgramTask.name,
                                        rule.externalProgramTask.id,
                                    ];
                                }

                                row = row.concat(tmpRow);

                                taskTable = taskTable.concat([row]);

                                ruleCount += 1;
                            }

                            eventCount += 1;
                        }
                    }

                    taskCount += 1;
                } else {
                    logger.debug(`Skipped task "${task.taskName}" due to incorrect task type`);
                }
            }

            // Add column headers
            let headerRow = ['Task counter', 'Task type'];

            if (columnBlockShow.common) {
                headerRow = headerRow.concat([
                    'Task name',
                    'Task id',
                    'Task enabled',
                    'Task timeout',
                    'Task retries',
                    'App id',
                    'Partial reload',
                    'Manually triggered',
                    'Ext program path',
                    'Ext program parameters',
                ]);
            }

            if (columnBlockShow.lastexecution) {
                headerRow = headerRow.concat(['Task status', 'Task started', 'Task ended', 'Task duration', 'Task executedon node']);
            }

            if (columnBlockShow.tag) {
                headerRow = headerRow.concat(['Tags']);
            }

            if (columnBlockShow.customproperty) {
                headerRow = headerRow.concat(['Custom properties']);
            }

            if (columnBlockShow.schematrigger || columnBlockShow.compositetrigger) {
                headerRow = headerRow.concat([
                    'Event counter',
                    'Event type',
                    'Event name',
                    'Event enabled',
                    'Event created date',
                    'Event modified date',
                    'Event modified by',
                ]);
            }

            if (columnBlockShow.schematrigger) {
                headerRow = headerRow.concat([
                    'Schema increment option',
                    'Schema increment description',
                    'Daylight savings time',
                    'Schema start',
                    'Schema expiration',
                    'Schema filter description',
                    'Schema time zone',
                ]);
            }

            if (columnBlockShow.compositetrigger) {
                headerRow = headerRow.concat([
                    'Time contstraint seconds',
                    'Time contstraint minutes',
                    'Time contstraint hours',
                    'Time contstraint days',
                    'Rule counter',
                    'Rule state',
                    'Rule task name',
                    'Rule task id',
                ]);
            }

            consoleTableConfig.header = {
                alignment: 'left',
                content: `# reload tasks: ${taskTable.filter((task) => task[1] === 'Reload').length}, # external program tasks: ${
                    taskTable.filter((task) => task[1] === 'External program').length
                }, # rows in table: ${taskTable.length}`,
            };

            taskTable.unshift(headerRow);

            if (options.outputDest === 'screen') {
                logger.info(`# rows in table: ${taskTable.length - 1}`);
                logger.info(`# reload tasks in table: ${taskTable.filter((task) => task[1] === 'Reload').length}`);
                logger.info(`# external program tasks in table: ${taskTable.filter((task) => task[1] === 'External program').length}`);
                logger.info(`\n${table(taskTable, consoleTableConfig)}`);
                returnValue = true;
            } else if (options.outputDest === 'file') {
                logger.verbose(`Writing task table to disk file "${options.outputFileName}"`);
                let buffer;
                if (options.outputFileFormat === 'excel') {
                    // Save to Excel file
                    buffer = xlsx.build([{ name: 'Ctrl-Q task export', data: taskTable }]);
                } else if (options.outputFileFormat === 'csv') {
                    // Remove newlines in column names
                    taskTable[0] = taskTable[0].map((item) => item.replace('\n', ' '));

                    // Create CSV string
                    buffer = stringify(taskTable);
                } else if (options.outputFileFormat === 'json') {
                    // Remove newlines in column names
                    taskTable[0] = taskTable[0].map((item) => item.replace('\n', ' '));

                    // Format JSON nicely
                    buffer = JSON.stringify(taskTable, null, 4);
                }

                // Check if file exists
                if ((await verifyFileSystemExists(options.outputFileName, true)) === false) {
                    // File doesn't exist
                } else if (!options.outputFileOverwrite) {
                    // Target file exist. Ask if user wants to overwrite
                    logger.info();
                    const ok = await yesno({
                        question: `                                  Destination file "${options.outputFileName}" exists. Do you want to overwrite it? (y/n)`,
                    });
                    logger.info();
                    if (ok === false) {
                        logger.info('❌ Not overwriting existing output file. Exiting.');
                        process.exit(1);
                    }
                } else if (options.outputFileOverwrite) {
                    // File exists and force overwrite is set
                    logger.info(`❗️ Existing output file will be replaced.`);
                }
                logger.info(`✅ Writing task table to disk file "${options.outputFileName}".`);
                await Fs.writeFile(options.outputFileName, buffer);
                returnValue = true;
            }
        }
        return returnValue;
    } catch (err) {
        catchLog('Get task', err);
        return false;
    }
}
