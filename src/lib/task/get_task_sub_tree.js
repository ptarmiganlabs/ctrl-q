import { catchLog } from '../util/log.js';
import { mapRuleState } from '../util/qseow/lookups.js';

/**
 * Function to get a subtree of a task tree from a given task.
 *
 * @param {object} _ - QlikSenseTasks object. Corresponds to the 'this' keyword in a class.
 * @param {object} task - Task object
 * @param {number} parentTreeLevel - Tree level of the parent task
 * @param {object} parentTask - Parent task object
 * @param {object} logger - Logger object
 *
 * @returns {array} Array of task objects in the subtree
 */
export function extGetTaskSubTree(_, task, parentTreeLevel, parentTask, logger) {
    try {
        const self = _;

        if (!task || !task?.id) {
            logger.debug('Task parameter empty or does not include a task ID');
        }

        // Were we called from top-level?
        if (parentTreeLevel === 0) {
            // Set up new data structure for detecting cicrular task trees
            _.taskCyclicVisited = new Set();
            _.taskCyclicStack = new Set();
        }

        const newTreeLevel = parentTreeLevel + 1;
        let subTree = [];

        logger.debug(
            `GET TASK SUBTREE: Meta node type: ${task.metaNodeType}, task type: ${task.taskType}, tree level: ${newTreeLevel}, task name: ${task.taskName}`
        );

        // Does this node (=task) have any downstream connections?
        const downstreamTasks = self.taskNetwork.edges.filter((edge) => edge.from === task.id);

        let kids = [];
        const validDownstreamTasks = [];
        for (const downstreamTask of downstreamTasks) {
            logger.debug(`GET TASK SUBTREE: Processing downstream task: ${downstreamTask.to}. Current/source task: ${downstreamTask.from}`);
            if (downstreamTask.to !== undefined) {
                // Get downstream task object
                const tmp = self.taskNetwork.nodes.find((el) => el.id === downstreamTask.to);

                if (!tmp) {
                    logger.warn(
                        `Downstream task "${downstreamTask.to}" in task tree not found. Current/source task: ${downstreamTask.from}`
                    );
                    kids = [
                        {
                            id: task.id,
                        },
                    ];
                } else {
                    // Keep track of this downstream task
                    validDownstreamTasks.push({ sourceTask: task, downstreamTask: tmp });

                    // Don't check for cyclic task relationships yet, as that could trigger if two or more sibling tasks are triggered from the same source task.
                }
            }
        }

        // Now that all downstream tasks have been retrieved, we can check if there are any general issues with those tasks
        // Examples are cyclic task tree relationships, multiple downstream tasks with the same ID etc.

        // Check for downstream tasks with the same ID and same relationship with parent task (e.g. on-success or on-failure)
        // downstreamTasks is an array of all downstream tasks from the current task. Properties are (the ones relevant here)
        // - from: Source task/node ID
        // - fromTaskType: Source task/node type. "Reload" or "ExternalProgram"
        // - to: Destination task/node ID
        // - toTaskType: Destination task/node type. "Reload", "ExternalProgram" or "Composite"
        // - rule: Array of rules for the relationship between source and destination task. "on-success", "on-failure" etc. Properties for each object are
        //   - id: Rule ID
        //   - ruleState: Rule state/type. 1 = TaskSuccessful, 2 = TaskFail. mapRuleState.get(ruleState) gives the string representation of the rule state, given the number.

        // Check if there are multiple downstream tasks with the same ID and same relationship with the parent task.
        // The relationship is the same if rule.ruleState is the same for two downstream tasks with the same ID.
        // If there are, log a warning.
        const duplicateDownstreamTasks = [];
        for (const downstreamTask of downstreamTasks) {
            // Are there any rules?
            // downstreamTask.rule is an array of rules. Properties are
            // - id: Rule ID
            // - ruleState: Rule state/type. 1 = TaskSuccessful, 2 = TaskFail. mapRuleState.get(ruleState) gives the string representation of the rule state, given the number.
            if (downstreamTask.rule) {
                // Filter out downstream tasks with the same ID and the same rule state
                const tmp = downstreamTasks.filter((el) => {
                    const sameDest = el.to === downstreamTask.to;

                    // Same rule state?
                    // el.rule can be either an array or an object. If it's an object, convert it to an array.
                    if (!Array.isArray(el.rule)) {
                        el.rule = [el.rule];
                    }

                    // Is one of the rule's ruleState properties the same as one or more of downstreamTask.rule[].ruleState?
                    const sameRuleState = el.rule.some((rule) => {
                        return downstreamTask.rule.some((rule2) => {
                            return rule.ruleState === rule2.ruleState;
                        });
                    });

                    return sameDest && sameRuleState;
                });

                if (tmp.length > 1) {
                    // Look up current and downstream task objects
                    const currentTask = self.taskNetwork.nodes.find((el) => el.id === task.id);
                    const downstreamTask = self.taskNetwork.nodes.find((el) => el.id === tmp[0].to);

                    // Get the rule state that is shared between the downstream tasks and the parent task
                    const ruleState = mapRuleState.get(tmp[0].rule[0].ruleState);

                    // Log warning unless this parent/child relationship is already in the list of duplicate downstream tasks
                    if (
                        !duplicateDownstreamTasks.some(
                            (el) => el[0].to === tmp[0].to && el[0].rule[0].ruleState === tmp[0].rule[0].ruleState
                        )
                    ) {
                        logger.warn(
                            `Multiple downstream tasks (${tmp.length}) with the same ID and the same trigger relationship "${ruleState}" with the parent task.`
                        );
                        logger.warn(`   Parent task     : ${currentTask.completeTaskObject.name}`);
                        logger.warn(`   Downstream task : ${downstreamTask.completeTaskObject.name}`);
                    }

                    duplicateDownstreamTasks.push(tmp);
                }
            }
        }

        // Check if there are any cyclic task tree relationships
        // If there are none, we can add the downstream tasks to the tree
        // First make sure all downstream task IDs are unique. Remove duplicates.
        const uniqueDownstreamTasks = Array.from(new Set(validDownstreamTasks.map((a) => a.downstreamTask.id))).map((id) => {
            return validDownstreamTasks.find((a) => a.downstreamTask.id === id);
        });

        for (const uniqueDownstreamTask of uniqueDownstreamTasks) {
            if (_.taskCyclicStack.has(uniqueDownstreamTask.downstreamTask.id)) {
                // Cyclic dependency detected
                if (parentTask) {
                    // Log warning
                    logger.warn(`Cyclic dependency detected in task tree. Won't go deeper.`);
                    logger.warn(`   From task : [${uniqueDownstreamTask.sourceTask.id}] "${uniqueDownstreamTask.sourceTask.taskName}"`);
                    logger.warn(
                        `   To task   : [${uniqueDownstreamTask.downstreamTask.id}] "${uniqueDownstreamTask.downstreamTask.taskName}"`
                    );

                    // Add node indicating cyclic dependency
                    kids = kids.concat([
                        {
                            id: task.id,
                            text: ` ==> !!! Cyclic dependency detected from task "${uniqueDownstreamTask.sourceTask.taskName}" to "${uniqueDownstreamTask.downstreamTask.taskName}"`,
                        },
                    ]);
                } else {
                    // Log warning when there is no parent task (should not happen?)
                    logger.warn(`Cyclic dependency detected in task tree. No parent task detected. Won't go deeper.`);
                }
            } else {
                _.taskCyclicStack.add(uniqueDownstreamTask.downstreamTask.id);
                const tmp3 = extGetTaskSubTree(
                    _,
                    uniqueDownstreamTask.downstreamTask,
                    newTreeLevel,
                    uniqueDownstreamTask.sourceTask,
                    logger
                );
                _.taskCyclicStack.delete(uniqueDownstreamTask.downstreamTask.id);
                kids = kids.concat(tmp3);
            }
        }

        // Only push real Sense tasks to the tree (don't include meta nodes)
        if (!task.metaNodeType) {
            if (kids && kids.length > 0) {
                subTree = {
                    id: task.id,
                    children: kids,
                };
            } else {
                subTree = {
                    id: task.id,
                };
            }

            if (_.options.treeIcons) {
                if (task.taskLastStatus === 'FinishedSuccess') {
                    subTree.text = `✅ ${task.taskName}`;
                    // subTree.text = _.options.textColor ? `✅ \x1b[0m${task.taskName}\x1b[0m` : `✅ ${task.taskName}`;
                } else if (task.taskLastStatus === 'FinishedFail') {
                    subTree.text = `❌ ${task.taskName}`;
                } else if (task.taskLastStatus === 'Skipped') {
                    subTree.text = `🚫 ${task.taskName}`;
                } else if (task.taskLastStatus === 'Aborted') {
                    subTree.text = `🛑 ${task.taskName}`;
                } else if (task.taskLastStatus === 'Never started') {
                    subTree.text = `💤 ${task.taskName}`;
                } else {
                    subTree.text = `❔ ${task.taskName}`;
                }
            } else {
                subTree.text = task.taskName;
            }

            if (_.options.treeDetails === true) {
                // All task details should be included
                if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                    if (_.options.textColor === 'yes') {
                        subTree.text += ` \x1b[2mTask id: \x1b[3m${task.id}\x1b[0;2m, Last start/stop: \x1b[3m${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}\x1b[0;2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m, App name: \x1b[3m${task.appName}\x1b[0;2m, App stream: \x1b[3m${task.appStream}\x1b[0;2m\x1b[0m`;
                    } else {
                        subTree.text += ` Task id: ${task.id}, Last start/stop: ${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}, Next start: ${task.taskNextExecutionTimestamp}, App name: ${task.appName}, App stream: ${task.appStream}`;
                    }
                } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                    if (_.options.textColor === 'yes') {
                        subTree.text += ` \x1b[2m--EXTERNAL PROGRAM--Task id: \x1b[3m${task.id}\x1b[0;2m, Last start/stop: \x1b[3m${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}\x1b[0;2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m, Path: \x1b[3m${task.path}\x1b[0;2m, Parameters: \x1b[3m${task.parameters}\x1b[0;2m\x1b[0m`;
                    } else {
                        subTree.text += `--EXTERNAL PROGRAM--Task id: ${task.id}, Last start/stop: ${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}, Next start: ${task.taskNextExecutionTimestamp}, path: ${task.path}, Parameters: ${task.oarameters}`;
                    }
                }
            } else if (_.options.treeDetails) {
                // Some task details should be included
                if (_.options.treeDetails.find((item) => item === 'taskid')) {
                    subTree.text +=
                        _.options.textColor === 'yes' ? `\x1b[2m, Task id: \x1b[3m${task.id}\x1b[0;2m\x1b[0m` : `, Task id: ${task.id}`;
                }
                if (_.options.treeDetails.find((item) => item === 'laststart')) {
                    subTree.text +=
                        _.options.textColor === 'yes'
                            ? `\x1b[2m, Last start: \x1b[3m${task.taskLastExecutionStartTimestamp}\x1b[0;2m\x1b[0m`
                            : `, Last start: ${task.taskLastExecutionStartTimestamp}`;
                }
                if (_.options.treeDetails.find((item) => item === 'laststop')) {
                    subTree.text +=
                        _.options.textColor === 'yes'
                            ? `\x1b[2m, Last stop: \x1b[3m${task.taskLastExecutionStopTimestamp}\x1b[0;2m\x1b[0m`
                            : `, Last stop: ${task.taskLastExecutionStopTimestamp}`;
                }
                if (_.options.treeDetails.find((item) => item === 'nextstart')) {
                    subTree.text +=
                        _.options.textColor === 'yes'
                            ? `\x1b[2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m\x1b[0m`
                            : `, Next start: ${task.taskNextExecutionTimestamp}`;
                }
                if (_.options.treeDetails.find((item) => item === 'appname')) {
                    if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                        subTree.text +=
                            _.options.textColor === 'yes'
                                ? `\x1b[2m, App name: \x1b[3m${task.appName}\x1b[0;2m\x1b[0m`
                                : `, App name: ${task.appName}`;
                    } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                        subTree.text +=
                            _.options.textColor === 'yes' ? `\x1b[2m, Path: \x1b[3m${task.path}\x1b[0;2m\x1b[0m` : `, Path: ${task.path}`;
                    }
                }
                if (_.options.treeDetails.find((item) => item === 'appstream')) {
                    if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                        subTree.text +=
                            _.options.textColor === 'yes'
                                ? `\x1b[2m, App stream: \x1b[3m${task.appStream}\x1b[0;2m\x1b[0m`
                                : `, App stream: ${task.appStream}`;
                    } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                        subTree.text +=
                            _.options.textColor === 'yes'
                                ? `\x1b[2m, Parameters: \x1b[3m${task.parameters}\x1b[0;2m\x1b[0m`
                                : `, Parameters: ${task.parameters}`;
                    }
                }
            }

            // Tabulator columns
            subTree.taskId = task.taskId;
            subTree.taskName = task.taskName;
            subTree.taskEnabled = task.taskEnabled;
            subTree.appId = task.appId;
            subTree.appName = task.appName;
            subTree.appPublished = task.appPublished;
            subTree.appStream = task.appStream;
            subTree.taskMaxRetries = task.taskMaxRetries;
            subTree.taskLastExecutionStartTimestamp = task.taskLastExecutionStartTimestamp;
            subTree.taskLastExecutionStopTimestamp = task.taskLastExecutionStopTimestamp;
            subTree.taskLastExecutionDuration = task.taskLastExecutionDuration;
            subTree.taskLastExecutionExecutingNodeName = task.taskLastExecutionExecutingNodeName;
            subTree.taskNextExecutionTimestamp = task.taskNextExecutionTimestamp;
            subTree.taskLastStatus = task.taskLastStatus;
            subTree.taskTags = task.completeTaskObject.tags.map((tag) => tag.name);
            subTree.taskCustomProperties = task.completeTaskObject.customProperties.map((el) => `${el.definition.name}=${el.value}`);
            subTree.completeTaskObject = task.completeTaskObject;

            if (newTreeLevel === 1) {
                subTree = [subTree];
            }
        } else {
            subTree = kids;
        }

        return subTree;
        // console.log('subTree: ' + JSON.stringify(subTree));
    } catch (err) {
        catchLog('GET TASK SUBTREE (tree)', err);
        return false;
    }
}
