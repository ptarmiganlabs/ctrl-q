const tree = require('text-treeview');
const { table } = require('table');
const { promises: Fs } = require('fs');
const xlsx = require('node-xlsx').default;
const { stringify } = require('csv-stringify/sync');
const yesno = require('yesno');

const { logger, setLoggingLevel, isPkg, execPath, verifyFileExists } = require('../../globals');
const { QlikSenseTasks } = require('./class_alltasks');
const { mapEventType, mapIncrementOption, mapDaylightSavingTime, mapRuleState } = require('../lookups');

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
        // eslint-disable-next-line no-restricted-syntax
        for (const prop in element) {
            if (prop !== 'text' && prop !== 'children') {
                // eslint-disable-next-line no-param-reassign
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
    if (a.taskName < b.taskName) {
        return -1;
    }
    if (a.taskName > b.taskName) {
        return 1;
    }
    return 0;
}

const getTask = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get tasks');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        // Get reload tasks
        const qlikSenseTasks = new QlikSenseTasks();
        await qlikSenseTasks.init(options);
        await qlikSenseTasks.getTaskModelFromQseow();

        // What should we do with the retrieved task data?
        if (options.outputFormat === 'tree') {
            const taskModel = qlikSenseTasks.taskNetwork;
            let taskTree = [];

            // Get all tasks that have a schedule associated with them
            // Schedules are represented by "meta nodes" that are linked to the task node in Ctrl-Q's internal data model
            // eslint-disable-next-line no-restricted-syntax
            for (const task of taskModel.nodes) {
                if (task.metaNode && task.metaNodeType === 'schedule') {
                    const subTree = qlikSenseTasks.getTaskSubTree(task, 0);
                    subTree[0].isTopLevelNode = true;
                    subTree[0].isScheduled = true;
                    taskTree = taskTree.concat(subTree);
                }
            }

            // Add new top level node with clock/scheduler emoji
            taskTree = [{ text: '⏰', children: taskTree }];

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

            // eslint-disable-next-line no-restricted-syntax
            for (const task of unscheduledTasks) {
                const subTree = qlikSenseTasks.getTaskSubTree(task, 0);
                subTree[0].isTopLevelNode = true;
                subTree[0].isScheduled = false;
                taskTree = taskTree.concat(subTree);
            }

            // Sort array alfabetically
            taskTree.sort(compareTree);

            // Output task tree to correct destination
            if (options.outputDest === 'screen') {
                logger.info(`# top level tasks: ${taskTree.length}`);
                logger.info(`\n${tree(taskTree)}`);
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
                if ((await verifyFileExists(options.outputFileName)) === false) {
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
            }
        } else if (options.outputFormat === 'table') {
            const { tasks } = qlikSenseTasks.taskNetwork;
            const { schemaEventList } = qlikSenseTasks.qlikSenseSchemaEvents;
            const { compositeEventList } = qlikSenseTasks.qlikSenseCompositeEvents;

            let taskTable = [];
            let taskCount = 1;

            // Sort tasks
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
                comptimeconstraint: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails?.find((item) => item === 'comptimeconstraint'))
                ),
                comprule: !!(
                    options.tableDetails === true ||
                    options.tableDetails === '' ||
                    (typeof options.tableDetails === 'object' && options.tableDetails?.find((item) => item === 'comprule'))
                ),
            };

            // eslint-disable-next-line no-restricted-syntax
            for (const task of tasks) {
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

                if (columnBlockShow.common) {
                    tmpRow = [
                        taskCount,
                        'Reload',
                        task.taskName,
                        task.taskId,
                        task.taskEnabled,
                        task.taskTimeout,
                        task.taskMaxRetries,
                        task.appId,
                        task.isPartialReload,
                        task.isManuallyTriggered,
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
                    tmpRow = [task.taskTags.join(' / ')];
                    row = row.concat(tmpRow);
                }

                if (columnBlockShow.customproperty) {
                    tmpRow = [task.taskCustomProperties.join(' / ')];
                    row = row.concat(tmpRow);
                }

                if (options.tableDetails === true || options.tableDetails === '') {
                    tmpRow = Array(14).fill('');
                    row = row.concat(tmpRow);
                } else if (columnBlockShow.schematrigger) {
                    tmpRow = Array(14).fill('');
                    row = row.concat(tmpRow);
                } else if (columnBlockShow.compositetrigger) {
                    tmpRow = Array(7).fill('');
                    row = row.concat(tmpRow);
                }

                if (columnBlockShow.comptimeconstraint) {
                    tmpRow = Array(4).fill('');
                    row = row.concat(tmpRow);
                }

                if (columnBlockShow.comprule) {
                    tmpRow = Array(4).fill('');
                    row = row.concat(tmpRow);
                }

                // Add main task info to  table
                taskTable = taskTable.concat([row]);

                // Find all triggers for this task
                const schemaEventsForThisTask = schemaEventList.filter((item) => item.schemaEvent?.reloadTask?.id === task.taskId);
                const compositeEventsForThisTask = compositeEventList.filter((item) => item.compositeEvent?.reloadTask?.id === task.taskId);

                // Write schema events to table
                if (columnBlockShow.schematrigger) {
                    // eslint-disable-next-line no-restricted-syntax
                    for (const event of schemaEventsForThisTask) {
                        row = [taskCount, 'Reload'];

                        if (columnBlockShow.common) {
                            tmpRow = [...Array(8).fill('')];
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

                        if (columnBlockShow.schematrigger || columnBlockShow.compositetrigger) {
                            // Include general event columns if schema or composite columns should be shown
                            tmpRow = [eventCount, mapEventType.get(event.schemaEvent.eventType)];
                            row = row.concat(tmpRow);
                        }

                        if (columnBlockShow.schematrigger) {
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
                        }

                        if (columnBlockShow.comptimeconstraint) {
                            tmpRow = Array(4).fill('');
                            row = row.concat(tmpRow);
                        }

                        if (columnBlockShow.comprule) {
                            tmpRow = Array(4).fill('');
                            row = row.concat(tmpRow);
                        }

                        taskTable = taskTable.concat([row]);

                        eventCount += 1;
                    }
                }

                if (columnBlockShow.compositetrigger || columnBlockShow.comptimeconstraint || columnBlockShow.comprule) {
                    // eslint-disable-next-line no-restricted-syntax
                    for (const event of compositeEventsForThisTask) {
                        row = [taskCount, 'Reload'];

                        if (columnBlockShow.common) {
                            tmpRow = [...Array(8).fill('')];
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
                        tmpRow = [eventCount, mapEventType.get(event.compositeEvent.eventType)];
                        row = row.concat(tmpRow);
                        // }

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

                        if (columnBlockShow.comptimeconstraint) {
                            // Composite task time constraints
                            tmpRow = [
                                event.compositeEvent.timeConstraint.seconds,
                                event.compositeEvent.timeConstraint.minutes,
                                event.compositeEvent.timeConstraint.hours,
                                event.compositeEvent.timeConstraint.days,
                            ];
                            row = row.concat(tmpRow);
                        }

                        if (columnBlockShow.comprule) {
                            tmpRow = Array(4).fill('');
                            row = row.concat(tmpRow);
                        }

                        taskTable = taskTable.concat([row]);

                        // Add all composite rules to table
                        let ruleCount = 1;

                        if (columnBlockShow.comprule) {
                            // eslint-disable-next-line no-restricted-syntax
                            for (const rule of event.compositeEvent.compositeRules) {
                                row = [taskCount, 'Reload'];

                                if (columnBlockShow.common) {
                                    tmpRow = [...Array(8).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                if (columnBlockShow.lastexecution) {
                                    tmpRow = [...Array(5).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                // if (
                                //     options.tableDetails === true ||
                                //     options.tableDetails?.find((item) => item === 'schematrigger') ||
                                //     options.tableDetails?.find((item) => item === 'compositetrigger')
                                // ) {
                                // Include general event columns if schema or composite columns should be shown
                                tmpRow = [eventCount, mapEventType.get(event.compositeEvent.eventType)];
                                row = row.concat(tmpRow);
                                // }

                                if (columnBlockShow.schematrigger) {
                                    tmpRow = [...Array(12).fill('')];
                                    row = row.concat(tmpRow);
                                } else if (columnBlockShow.compositetrigger) {
                                    tmpRow = [...Array(5).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                if (columnBlockShow.comptimeconstraint) {
                                    // Composite task time constraints
                                    tmpRow = [...Array(4).fill('')];
                                    row = row.concat(tmpRow);
                                }

                                if (columnBlockShow.comprule) {
                                    // Composite rules
                                    tmpRow = [ruleCount, mapRuleState.get(rule.ruleState), rule.reloadTask.name, rule.reloadTask.id];
                                    row = row.concat(tmpRow);
                                }

                                taskTable = taskTable.concat([row]);

                                ruleCount += 1;
                            }
                        }

                        eventCount += 1;
                    }
                }

                taskCount += 1;
            }

            // Add column headers
            let headerRow = ['Task\ncounter', 'Task type'];

            if (columnBlockShow.common) {
                headerRow = headerRow.concat([
                    'Task name',
                    'Task id',
                    'Task\nenabled',
                    'Task\ntimeout',
                    'Task\nretries',
                    'App id',
                    'Partial\nreload',
                    'Manually\ntriggered',
                ]);
            }

            if (columnBlockShow.lastexecution) {
                headerRow = headerRow.concat(['Task\nstatus', 'Task started', 'Task ended', 'Task duration', 'Task\nexecutedon node']);
            }

            if (columnBlockShow.tag) {
                headerRow = headerRow.concat(['Tags']);
            }

            if (columnBlockShow.customproperty) {
                headerRow = headerRow.concat(['Custom properties']);
            }

            if (columnBlockShow.schematrigger || columnBlockShow.compositetrigger) {
                headerRow = headerRow.concat([
                    'Event\ncounter',
                    'Event type',
                    'Event name',
                    'Event\nenabled',
                    'Event\ncreated date',
                    'Event\nmodified date',
                    'Event\nmodified by',
                ]);
            }

            if (columnBlockShow.schematrigger) {
                headerRow = headerRow.concat([
                    'Schema\nincrement option',
                    'Schema\nincrement description',
                    'Daylight savings time',
                    'Schema start',
                    'Schema expiration',
                    'Schema\nfilter description',
                    'Schema\ntime zone',
                ]);
            }

            if (columnBlockShow.comptimeconstraint) {
                headerRow = headerRow.concat([
                    'Time contstraint\nseconds',
                    'Time contstraint\nminutes',
                    'Time contstraint\nhours',
                    'Time contstraint\ndays',
                ]);
            }

            if (columnBlockShow.comprule) {
                headerRow = headerRow.concat(['Rule\ncount', 'Rule\nstate', 'Rule\ntask name', 'Rule\ntask id']);
            }

            consoleTableConfig.header = {
                alignment: 'left',
                content: `# top level tasks: ${taskTable.length - 1}`,
                // content: `\x1b[32;1m# top level tasks: ${taskTable.length}`,
            };
            taskTable.unshift(headerRow);

            if (options.outputDest === 'screen') {
                logger.info(`# top level tasks: ${taskTable.length - 1}`);
                logger.info(`\n${table(taskTable, consoleTableConfig)}`);
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
                if ((await verifyFileExists(options.outputFileName)) === false) {
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
            }
        }
    } catch (err) {
        logger.error(`GET TASK: ${err.stack}`);
    }
};

module.exports = {
    getTask,
};
