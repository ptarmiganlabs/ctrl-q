const axios = require('axios');
const path = require('path');
const nanoid = require('nanoid');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('../util/qrs');
const { QlikSenseTask } = require('./class_task');
const { QlikSenseSchemaEvents } = require('./class_allschemaevents');
const { QlikSenseCompositeEvents } = require('./class_allcompositeevents');

// function getSchemaText(incrementOption, incrementDescription) {
//     let schemaText = '';

//     /**
//      * IncrementOption:
//         "0: once",
//         "1: hourly",
//             incrementDescription: Repeat after each 'minutes hours 0 0 '
//         "2: daily",
//             incrementDescription: Repeat after each '0 0 days 0 '
//         "3: weekly",
//         "4: monthly"
//      */

//     if (incrementOption === 0) {
//         schemaText = 'Once';
//     } else if (incrementOption === 1) {
//         schemaText = 'Hourly';
//     } else if (incrementOption === 2) {
//         schemaText = 'Daily';
//     } else if (incrementOption === 3) {
//         schemaText = 'Weekly';
//     } else if (incrementOption === 4) {
//         schemaText = 'Monthly';
//     }

//     return schemaText;
// }

class QlikSenseTasks {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options) {
        try {
            this.taskList = [];
            this.options = options;

            // Make sure certificates exist
            this.fileCert = path.resolve(execPath, options.authCertFile);
            this.fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            this.qlikSenseSchemaEvents = new QlikSenseSchemaEvents();
            await this.qlikSenseSchemaEvents.init(options);

            this.qlikSenseCompositeEvents = new QlikSenseCompositeEvents();
            await this.qlikSenseCompositeEvents.init(options);
        } catch (err) {
            logger.error(`QS TASK: ${err}`);
        }
    }

    getTask(taskId) {
        if (taskId === undefined || taskId === null) {
            return false;
        }
        const task = this.taskList.find((el) => el.taskId === taskId);

        logger.debug(`GET TASK: taskID=${taskId}: ${JSON.stringify(task)}`);
        return task;
    }

    clear() {
        this.taskList = [];
    }

    // Add new task
    addTask(task, anonymizeTaskNames) {
        const newTask = new QlikSenseTask(task, anonymizeTaskNames);
        this.taskList.push(newTask);
    }

    getTasksFromQseow() {
        return new Promise((resolve, reject) => {
            try {
                logger.debug('GET TASK: Starting get tasks from QSEoW');

                // Are there any task filters specified?
                // If so, build a query string
                let filter = '';
                if (this.options.taskId && this.options?.taskId.length >= 1) {
                    // At least one task ID specified
                    filter += encodeURIComponent(`id eq ${this.options.taskId[0]}`);
                }
                if (this.options.taskId && this.options?.taskId.length >= 2) {
                    // Add remaining task IDs, if any
                    for (let i = 1; i < this.options.taskId.length; i += 1) {
                        filter += encodeURIComponent(` or id eq ${this.options.taskId[i]}`);
                    }
                    logger.debug(`GET TASK: QRS query filter: ${filter}`);
                }

                const axiosConfig = setupQRSConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/reloadtask/full',
                    filter,
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        logger.debug(`GET TASK: Result=result.status`);
                        // const tasks = JSON.parse(result.data);
                        const tasks = result.data;
                        logger.info(`GET TASK: # tasks: ${tasks.length}`);

                        // TODO
                        // Determine whether task name anonymisation should be done
                        const anonymizeTaskNames = false;
                        // if (
                        //     settingsFile.hasConfigValue('settings.anonymizeTaskNames.enable') &&
                        //     configFile.settings.anonymizeTaskNames.enable == true
                        // ) {
                        //     anonymizeTaskNames = true;
                        // }

                        this.clear();
                        for (let i = 0; i < tasks.length; i += 1) {
                            if (tasks[i].taskType === 0) {
                                this.addTask(tasks[i], anonymizeTaskNames);
                            }
                        }
                        resolve(this.taskList);
                    })
                    .catch((err) => {
                        logger.error(`GET QS TASK 1: ${err}`);
                        reject(err);
                    });
            } catch (err) {
                logger.error(`GET QS TASK 2: ${err}`);
                reject(err);
            }
        });
    }

    getTaskSubTree(task, parentTreeLevel) {
        try {
            const self = this;

            const newTreeLevel = parentTreeLevel + 1;
            let subTree = [];

            // Does this node (=task) have any downstream connections?
            const downstreamTasks = self.taskNetwork.edges.filter((edge) => edge.from === task.id);

            let kids = [];
            // eslint-disable-next-line no-restricted-syntax
            for (const downstreamTask of downstreamTasks) {
                if (downstreamTask.to !== undefined) {
                    // Get downstream task object
                    const tmp = self.taskNetwork.nodes.find((el) => el.id === downstreamTask.to);
                    const tmp3 = self.getTaskSubTree(tmp, newTreeLevel);
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

                if (this.options.treeIcons) {
                    if (task.taskLastStatus === 'FinishedSuccess') {
                        subTree.text = `✅ ${task.taskName}`;
                        // subTree.text = this.options.textColor ? `✅ \x1b[0m${task.taskName}\x1b[0m` : `✅ ${task.taskName}`;
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

                if (this.options.treeDetails === true) {
                    if (this.options.textColor === 'yes') {
                        subTree.text += ` \x1b[2mTask id: \x1b[3m${task.id}\x1b[0;2m, Last start/stop: \x1b[3m${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}\x1b[0;2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m, App name: \x1b[3m${task.appName}\x1b[0;2m, App stream: \x1b[3m${task.appStream}\x1b[0;2m\x1b[0m`;
                    } else {
                        subTree.text += ` Task id: ${task.id}, Last start/stop: ${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}, Next start: ${task.taskNextExecutionTimestamp}, App name: ${task.appName}, App stream: ${task.appStream}`;
                    }
                } else if (this.options.treeDetails) {
                    if (this.options.treeDetails.find((item) => item === 'taskid')) {
                        subTree.text +=
                            this.options.textColor === 'yes'
                                ? `\x1b[2m, Task id: \x1b[3m${task.id}\x1b[0;2m\x1b[0m`
                                : `, Task id: ${task.id}`;
                    }
                    if (this.options.treeDetails.find((item) => item === 'laststart')) {
                        subTree.text +=
                            this.options.textColor === 'yes'
                                ? `\x1b[2m, Last start: \x1b[3m${task.taskLastExecutionStartTimestamp}\x1b[0;2m\x1b[0m`
                                : `, Last start: ${task.taskLastExecutionStartTimestamp}`;
                    }
                    if (this.options.treeDetails.find((item) => item === 'laststop')) {
                        subTree.text +=
                            this.options.textColor === 'yes'
                                ? `\x1b[2m, Last stop: \x1b[3m${task.taskLastExecutionStopTimestamp}\x1b[0;2m\x1b[0m`
                                : `, Last stop: ${task.taskLastExecutionStopTimestamp}`;
                    }
                    if (this.options.treeDetails.find((item) => item === 'nextstart')) {
                        subTree.text +=
                            this.options.textColor === 'yes'
                                ? `\x1b[2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m\x1b[0m`
                                : `, Next start: ${task.taskNextExecutionTimestamp}`;
                    }
                    if (this.options.treeDetails.find((item) => item === 'appname')) {
                        subTree.text +=
                            this.options.textColor === 'yes'
                                ? `\x1b[2m, App name: \x1b[3m${task.appName}\x1b[0;2m\x1b[0m`
                                : `, App name: ${task.appName}`;
                    }
                    if (this.options.treeDetails.find((item) => item === 'appstream')) {
                        subTree.text +=
                            this.options.textColor === 'yes'
                                ? `\x1b[2m, App stream: \x1b[3m${task.appStream}\x1b[0;2m\x1b[0m`
                                : `, App stream: ${task.appStream}`;
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
            logger.error(`GET TASK SUBTREE: ${err}`);
            return false;
        }
    }

    getTaskSubTable(task, parentTreeLevel) {
        try {
            const self = this;

            const newTreeLevel = parentTreeLevel + 1;
            let subTree = [];

            // Does this node (=task) have any downstream connections?
            const downstreamTasks = self.taskNetwork.edges.filter((edge) => edge.from === task.id);
            // console.log('downStreamTasks 1: ' + JSON.stringify(downstreamTasks));
            let kids = [];
            // eslint-disable-next-line no-restricted-syntax
            for (const downstreamTask of downstreamTasks) {
                if (downstreamTask.to !== undefined) {
                    // Get downstream task object
                    const tmp = self.taskNetwork.nodes.find((el) => el.id === downstreamTask.to);
                    const tmp3 = self.getTaskSubTable(tmp, newTreeLevel);
                    kids = kids.concat([tmp3]);
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

                subTree.text = task.taskName;

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

                // if (_.has(task, 'completeTaskObject.operational.lastExecutionResult.status')) {
                //   // let a = task.operational.lastExecutionResult.status;
                //   let b = g.g.taskExecutionStatusLookup.filter((el) => {
                //     return el.status === task.operational.lastExecutionResult.status;
                //   });
                //   subTree.taskLastStatus = b[0].desc;
                // } else {
                //   subTree.taskLastStatus = '?';
                // }
                if (newTreeLevel <= 2) {
                    subTree = kids.concat([[newTreeLevel, task.taskName, task.taskId, task.taskEnabled]]);
                } else {
                    subTree = kids.concat([[newTreeLevel, '--'.repeat(newTreeLevel - 2) + task.taskName, task.taskId, task.taskEnabled]]);
                }
            } else {
                subTree = kids;
            }

            return subTree;
        } catch (err) {
            logger.error(`GET TASK SUBTREE: ${err}`);
            return null;
        }
    }

    getTableTaskTable() {
        return new Promise((resolve, reject) => {
            try {
                if (this.taskNetwork === undefined && this.taskList === undefined) {
                    resolve(null);
                } else {
                    const tableTaskBasic = this.taskNetwork ? this.taskNetwork.tasks : null;

                    resolve(tableTaskBasic);
                }
            } catch (err) {
                logger.error(`GET TASK TABLE: ${err}`);
                reject();
            }
        });
    }

    getTaskModelFromQseow() {
        return new Promise((resolve, reject) => {
            try {
                logger.debug('GET TASK: Getting task model from QSEoW');

                // g.g.qlikSenseTasks.clear();
                // g.g.qlikSenseSchemaEvents.clear();
                // g.g.qlikSenseCompositeEvents.clear();

                this.getTasksFromQseow()
                    .then((result1) => this.qlikSenseSchemaEvents.getSchemaEventsFromQseow())
                    .then((result2) => this.qlikSenseCompositeEvents.getCompositeEventsFromQseow())
                    .then((result3) => {
                        logger.verbose('GET TASK: Done getting task model from QSEoW');

                        // Get all top level apps, i.e apps that aren't triggered by any other apps succeeding or failing.
                        // They might have scheduled triggers though.
                        this.taskNetwork = { nodes: [], edges: [], tasks: [] };
                        const nodesWithEvents = new Set();

                        // We already have all tasks in plain, non-hierarchical format
                        this.taskNetwork.tasks = this.taskList;

                        // Add schema edges and start/trigger nodes
                        // eslint-disable-next-line no-restricted-syntax
                        for (const schemaEvent of this.qlikSenseSchemaEvents.schemaEventList) {
                            // Only include task schedules
                            if (schemaEvent.schemaEvent.reloadTask !== null) {
                                // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
                                const nodeId = nanoid.nanoid();
                                this.taskNetwork.nodes.push({
                                    id: nodeId,
                                    metaNodeType: 'schedule', // Meta nodes are not Sense tasks, but rather nodes representing task-like properties (e.g. a starting point for a reload chain)
                                    metaNode: true,
                                    isTopLevelNode: true,
                                    label: schemaEvent.schemaEvent.name,
                                    enabled: schemaEvent.schemaEvent.enabled,

                                    completeSchemaEvent: schemaEvent.schemaEvent,
                                });

                                this.taskNetwork.edges.push({
                                    from: nodeId,
                                    to: schemaEvent.schemaEvent.reloadTask.id,
                                });

                                // Keep a note that this node has associated events
                                nodesWithEvents.add(schemaEvent.schemaEvent.reloadTask.id);
                            }
                        }

                        // Add composite events
                        // eslint-disable-next-line no-restricted-syntax
                        for (const compositeEvent of this.qlikSenseCompositeEvents.compositeEventList) {
                            // Only include events relating to reload tasks
                            if (compositeEvent.compositeEvent.reloadTask != null) {
                                if (compositeEvent.compositeEvent.compositeRules.length === 1) {
                                    // This trigger has exactly ONE upstream task
                                    // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish

                                    this.taskNetwork.edges.push({
                                        from: compositeEvent.compositeEvent.compositeRules[0].reloadTask.id,
                                        to: compositeEvent.compositeEvent.reloadTask.id,

                                        completeCompositeEvent: compositeEvent.compositeEvent,
                                        rule: compositeEvent.compositeEvent.compositeRules,
                                        // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                                        // color: edgeColor,
                                        // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                                        // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                                        // label: compositeEvent.compositeEvent.name,
                                    });

                                    // Keep a note that this node has associated events
                                    nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].reloadTask.id);
                                    nodesWithEvents.add(compositeEvent.compositeEvent.reloadTask.id);
                                } else {
                                    // There are more than one task involved in triggering a downstream task.
                                    // Insert a proxy node that represents a Qlik Sense compositive event

                                    // TODO
                                    const nodeId = nanoid.nanoid();
                                    this.taskNetwork.nodes.push({
                                        id: nodeId,
                                        label: '',
                                        enabled: true,
                                        metaNodeType: 'composite',
                                        metaNode: true,
                                    });
                                    nodesWithEvents.add(nodeId);

                                    // Add edges from upstream tasks to the new meta node
                                    // eslint-disable-next-line no-restricted-syntax
                                    for (const rule of compositeEvent.compositeEvent.compositeRules) {
                                        this.taskNetwork.edges.push({
                                            from: rule.reloadTask.id,
                                            to: nodeId,

                                            // TODO Correct? Or should it be at next edges.push?
                                            completeCompositeEvent: compositeEvent.compositeEvent,
                                            rule,
                                        });
                                    }

                                    // Add edge from new meta node to current node
                                    this.taskNetwork.edges.push({
                                        from: nodeId,
                                        to: compositeEvent.compositeEvent.reloadTask.id,
                                    });
                                }
                            }
                        }

                        // A top level node is defined as:
                        // 1. A task whose taskID does not show up in the "to" field of any edge.

                        // eslint-disable-next-line no-restricted-syntax
                        for (const node of this.taskList) {
                            this.taskNetwork.nodes.push({
                                id: node.taskId,
                                metaNode: false,
                                isTopLevelNode: !this.taskNetwork.edges.find((edge) => edge.to === node.taskId),
                                label: node.taskName,
                                enabled: node.taskEnabled,

                                completeTaskObject: node.completeTaskObject,

                                // Tabulator columns
                                taskId: node.taskId,
                                taskName: node.taskName,
                                taskEnabled: node.taskEnabled,
                                appId: node.appId,
                                appName: node.appName,
                                appPublished: node.appPublished,
                                appStream: node.appStream,
                                taskMaxRetries: node.taskMaxRetries,
                                taskLastExecutionStartTimestamp: node.taskLastExecutionStartTimestamp,
                                taskLastExecutionStopTimestamp: node.taskLastExecutionStopTimestamp,
                                taskLastExecutionDuration: node.taskLastExecutionDuration,
                                taskLastExecutionExecutingNodeName: node.taskLastExecutionExecutingNodeName,
                                taskNextExecutionTimestamp: node.taskNextExecutionTimestamp,
                                taskLastStatus: node.taskLastStatus,
                                taskTags: node.completeTaskObject.tags.map((tag) => tag.name),
                                taskCustomProperties: node.completeTaskObject.customProperties.map(
                                    (cp) => `${cp.definition.name}=${cp.value}`
                                ),
                            });
                        }
                        resolve(this.taskNetwork);
                    })
                    .catch((err) => {
                        logger.error(`GET TASK MODEL 1: ${err}`);
                        reject(err);
                    });
            } catch (err) {
                logger.error(`GET TASK MODEL 2: ${err}`);
                reject(err);
            }
        });
    }
}

module.exports = {
    QlikSenseTasks,
};
