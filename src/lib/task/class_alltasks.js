const axios = require('axios');
const path = require('path');
const { v4: uuidv4, validate } = require('uuid');
const internal = require('stream');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('../util/qrs');
const {
    mapTaskType,
    mapDaylightSavingTime,
    mapEventType,
    mapIncrementOption,
    mapRuleState,
    getColumnPosFromHeaderRow,
} = require('../util/lookups');
const { QlikSenseTask } = require('./class_task');
const { QlikSenseSchemaEvents } = require('./class_allschemaevents');
const { QlikSenseCompositeEvents } = require('./class_allcompositeevents');
const { getTagIdByName } = require('../util/tag');
const { getCustomPropertyIdByName } = require('../util/customproperties');
const { taskExistById } = require('../util/task');
const { getAppById } = require('../util/app');

class QlikSenseTasks {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options, importedApps) {
        try {
            this.options = options;
            this.importedApps = importedApps;

            this.taskList = [];

            // Map that will map fake task IDs (used in source file) with real task IDs after tasks have been created in Sense
            this.taskIdMap = new Map();

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
    async addTask(source, task, anonymizeTaskNames) {
        const newTask = new QlikSenseTask();
        await newTask.init(source, task, anonymizeTaskNames, this.options, this.fileCert, this.fileCertKey);
        this.taskList.push(newTask);
    }

    async getTaskModelFromFile(tasksFromFile, tagsExisting, cpExisting) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('PARSE TASKS FROM FILE: Starting get tasks from data in file');

                this.clear();

                // Figure out which data is in which column
                const taskFileColumnHeaders = getColumnPosFromHeaderRow(tasksFromFile.data[0]);

                // We now have all info about the task. Store it to the internal task data structure
                this.taskNetwork = { nodes: [], edges: [], tasks: [] };
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

                        if (item[taskFileColumnHeaders.taskCounter.pos] === taskFileColumnHeaders.taskCounter.name) {
                            // This is the header row
                            return -1;
                        }

                        // When reading from CSV files all columns will be strings.
                        let taskNum;
                        if (this.options.fileType === 'csv') {
                            taskNum = item[taskFileColumnHeaders.taskCounter.pos];
                        }
                        if (this.options.fileType === 'excel') {
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

                    // Create a fake ID for this task. Used to associate task with schema/composite events
                    const fakeTaskId = `reload-task-${uuidv4()}`;

                    let currentTask = null;
                    // Get task specific data for the current task
                    // The row containing task data will have a "Reload" in the task type column
                    const taskData = taskRows.filter(
                        (item) =>
                            item[taskFileColumnHeaders.taskType.pos] &&
                            item[taskFileColumnHeaders.taskType.pos].trim().toLowerCase() === 'reload'
                    );
                    if (taskData?.length !== 1) {
                        logger.error(`(${taskCounter}) PARSE TASKS FROM FILE: Incorrect task input data:\n${JSON.stringify(taskRows)}`);
                        process.exit(1);
                    } else {
                        // Create task object using same structure as results from QRS API

                        // Determine if the task is associated with an app that existed before Ctrl-Q was started, or
                        // an app that's been imported as part of this Ctrl-Q execution.
                        // Possible values for the app ID column:
                        // - newapp-<app counter> (app has been imported as part of this Ctrl-Q execution)
                        // - <app ID> A real, existing app ID. I.e. the app existed before Ctrl-Q was started.
                        let appId;
                        if (taskData[0][taskFileColumnHeaders.appId.pos].trim().substring(0, 7).toLowerCase() === 'newapp-') {
                            appId = this.importedApps.appIdMap.get(taskData[0][taskFileColumnHeaders.appId.pos].trim().toLowerCase());

                            // Ensure the app exists
                            // Reasons for the app not existing could be:
                            // - The app was imported but has since been deleted or replaced. This could happen if the app-import step has several
                            //   apps that are published-replaced or deleted-published to the same stream. In that case only the last published app will be present

                            if (appId === undefined) {
                                logger.error(
                                    `(${taskCounter}) PARSE TASKS FROM FILE: Cannot figure out which Sense app "${taskData[0][
                                        taskFileColumnHeaders.appId.pos
                                    ].trim()}" belongs to. App with ID "${taskData[0][taskFileColumnHeaders.appId.pos]}" not found.`
                                );

                                logger.error(
                                    `(${taskCounter}) PARSE TASKS FROM FILE: This could be because the app was imported but has since been deleted or replaced, for example during app publishing. Don't know how to proceed, exiting.`
                                );

                                process.exit(1);
                            }

                            // eslint-disable-next-line no-await-in-loop
                            const app = await getAppById(appId);

                            if (!app) {
                                logger.error(
                                    `(${taskCounter}) PARSE TASKS FROM FILE: App with ID "${appId}" not found. This could be because the app was imported but has since been deleted or replaced, for example during app publishing. Don't know how to proceed, exiting.`
                                );
                                process.exit(1);
                            }
                        } else {
                            appId = taskData[0][taskFileColumnHeaders.appId.pos];
                        }

                        currentTask = {
                            id: taskData[0][taskFileColumnHeaders.taskId.pos],
                            name: taskData[0][taskFileColumnHeaders.taskName.pos],
                            taskType: mapTaskType.get(taskData[0][taskFileColumnHeaders.taskType.pos]),
                            enabled: taskData[0][taskFileColumnHeaders.taskEnabled.pos],
                            taskSessionTimeout: taskData[0][taskFileColumnHeaders.taskSessionTimeout.pos],
                            maxRetries: taskData[0][taskFileColumnHeaders.taskMaxRetries.pos],
                            isManuallyTriggered: taskData[0][taskFileColumnHeaders.isManuallyTriggered.pos],
                            isPartialReload: taskData[0][taskFileColumnHeaders.isPartialReload.pos],
                            app: {
                                id: appId,
                                // name: taskData[0][taskFileColumnHeaders.appName.pos],
                            },
                            tags: [],
                            customProperties: [],
                            schemaPath: 'ReloadTask',
                            schemaEvents: [],
                            compositeEvents: [],
                            prelCompositeEvents: [],
                        };

                        // Add tags to task object
                        if (taskData[0][taskFileColumnHeaders.taskTags.pos]) {
                            const tmpTags = taskData[0][taskFileColumnHeaders.taskTags.pos]
                                .split('/')
                                .filter((item) => item.trim().length !== 0)
                                .map((item) => item.trim());

                            // eslint-disable-next-line no-restricted-syntax
                            for (const item of tmpTags) {
                                // eslint-disable-next-line no-await-in-loop
                                const tagId = await getTagIdByName(item, tagsExisting);
                                currentTask.tags.push({
                                    id: tagId,
                                    name: item,
                                });
                            }
                        }

                        // Add custom properties to task object
                        if (taskData[0][taskFileColumnHeaders.taskCustomProperties.pos]) {
                            const tmpCustomProperties = taskData[0][taskFileColumnHeaders.taskCustomProperties.pos]
                                .split('/')
                                .filter((item) => item.trim().length !== 0)
                                .map((cp) => cp.trim());

                            // eslint-disable-next-line no-restricted-syntax
                            for (const item of tmpCustomProperties) {
                                const tmpCustomProperty = item
                                    .split('=')
                                    .filter((item2) => item2.trim().length !== 0)
                                    .map((cp) => cp.trim());

                                if (tmpCustomProperty?.length === 2) {
                                    // eslint-disable-next-line no-await-in-loop
                                    const customPropertyId = await getCustomPropertyIdByName(
                                        'ReloadTask',
                                        tmpCustomProperty[0],
                                        cpExisting
                                    );

                                    currentTask.customProperties.push({
                                        definition: {
                                            id: customPropertyId,
                                            name: tmpCustomProperty[0].trim(),
                                        },
                                        value: tmpCustomProperty[1].trim(),
                                    });
                                }
                            }
                        }
                    }

                    // Get schema events for this task, storing the info using the same strcture as returned from QRS API
                    const schemaEventRows = taskRows.filter(
                        (item) =>
                            item[taskFileColumnHeaders.eventType.pos] &&
                            item[taskFileColumnHeaders.eventType.pos].trim().toLowerCase() === 'schema'
                    );
                    if (!schemaEventRows || schemaEventRows?.length === 0) {
                        logger.verbose(`(${taskCounter}) PARSE TASKS FROM FILE: No schema events for task "${currentTask.name}"`);
                    } else {
                        logger.verbose(
                            `(${taskCounter}) PARSE TASKS FROM FILE: ${schemaEventRows.length} schema event(s) for task "${currentTask.name}"`
                        );

                        // Add schema edges and start/trigger nodes
                        // eslint-disable-next-line no-restricted-syntax
                        for (const schemaEventRow of schemaEventRows) {
                            // Create object using same format that Sense uses for schema events
                            const schemaEvent = {
                                enabled: schemaEventRow[taskFileColumnHeaders.eventEnabled.pos],
                                eventType: mapEventType.get(schemaEventRow[taskFileColumnHeaders.eventType.pos]),
                                name: schemaEventRow[taskFileColumnHeaders.eventName.pos],
                                daylightSavingTime: mapDaylightSavingTime.get(
                                    schemaEventRow[taskFileColumnHeaders.daylightSavingsTime.pos]
                                ),
                                timeZone: schemaEventRow[taskFileColumnHeaders.schemaTimeZone.pos],
                                startDate: schemaEventRow[taskFileColumnHeaders.schemaStart.pos],
                                expirationDate: schemaEventRow[taskFileColumnHeaders.scheamExpiration.pos],
                                schemaFilterDescription: [schemaEventRow[taskFileColumnHeaders.schemaFilterDescription.pos]],
                                incrementDescription: schemaEventRow[taskFileColumnHeaders.schemaIncrementDescription.pos],
                                incrementOption: mapIncrementOption.get(schemaEventRow[taskFileColumnHeaders.schemaIncrementOption.pos]),
                                reloadTask: {
                                    id: fakeTaskId,
                                },
                                schemaPath: 'SchemaEvent',
                            };

                            this.qlikSenseSchemaEvents.addSchemaEvent(schemaEvent);

                            // Add schema event to network representation of tasks
                            // Create an id for this node
                            const nodeId = `schema-event-${uuidv4()}`;

                            // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
                            this.taskNetwork.nodes.push({
                                id: nodeId,
                                metaNodeType: 'schedule', // Meta nodes are not Sense tasks, but rather nodes representing task-like properties (e.g. a starting point for a reload chain)
                                metaNode: true,
                                isTopLevelNode: true,
                                label: schemaEvent.name,
                                enabled: schemaEvent.enabled,

                                completeSchemaEvent: schemaEvent,
                            });

                            this.taskNetwork.edges.push({
                                from: nodeId,
                                to: schemaEvent.reloadTask.id,
                            });

                            // Keep a note that this node has associated events
                            nodesWithEvents.add(schemaEvent.reloadTask.id);

                            // Add this schema event to the current task
                            // Remove reference to task ID first though
                            delete schemaEvent.reloadTask.id;
                            delete schemaEvent.reloadTask;
                            currentTask.schemaEvents.push(schemaEvent);
                        }
                    }

                    // Get composite events for this task
                    // NB: This will only get the main row for each composite event.
                    // Each such main row is followed by one or more event rule rows, that each share the same value in the "Event counter" column
                    const compositeEventRows = taskRows.filter(
                        (item) =>
                            item[taskFileColumnHeaders.eventType.pos] &&
                            item[taskFileColumnHeaders.eventType.pos].trim().toLowerCase() === 'composite'
                    );
                    if (!compositeEventRows || compositeEventRows?.length === 0) {
                        logger.verbose(`(${taskCounter}) PARSE TASKS FROM FILE: No composite events for task "${currentTask.name}"`);
                    } else {
                        logger.verbose(
                            `(${taskCounter}) PARSE TASKS FROM FILE: ${compositeEventRows.length} composite event(s) for task "${currentTask.name}"`
                        );

                        // Loop over all composite events, adding them and their event rules
                        // eslint-disable-next-line no-restricted-syntax
                        for (const compositeEventRow of compositeEventRows) {
                            // Get value in "Event counter" column for this composite event, then get array of all associated event rules
                            const compositeEventCounter = compositeEventRow[taskFileColumnHeaders.eventCounter.pos];
                            const compositeEventRules = taskRows.filter(
                                (item) =>
                                    item[taskFileColumnHeaders.eventCounter.pos] === compositeEventCounter &&
                                    item[taskFileColumnHeaders.ruleCounter.pos] > 0
                            );

                            // Create an object using same format that the Sense API uses for composite events
                            const compositeEvent = {
                                timeConstraint: {
                                    days: compositeEventRow[taskFileColumnHeaders.timeConstraintDays.pos],
                                    hours: compositeEventRow[taskFileColumnHeaders.timeConstraintHours.pos],
                                    minutes: compositeEventRow[taskFileColumnHeaders.timeConstraintMinutes.pos],
                                    seconds: compositeEventRow[taskFileColumnHeaders.timeConstraintSeconds.pos],
                                },
                                compositeRules: [],
                                name: compositeEventRow[taskFileColumnHeaders.eventName.pos],
                                enabled: compositeEventRow[taskFileColumnHeaders.eventEnabled.pos],
                                eventType: mapEventType.get(compositeEventRow[taskFileColumnHeaders.eventType.pos]),
                                reloadTask: {
                                    id: fakeTaskId,
                                },
                                schemaPath: 'CompositeEvent',
                            };

                            // Add rules
                            // eslint-disable-next-line no-restricted-syntax
                            for (const rule of compositeEventRules) {
                                // Does the upstream task pointed to by the composite rule exist?
                                // If it *does* exist it means it's a real, existing task in QSEoW that should be used.
                                // If it is not a valid guid or does not exist, it's (best case) a referefence to some other task in the task definitions file.
                                // If the task pointed to by the rule doesn't exist in Sense and doesn't point to some other task in the file, an error should be shown.
                                if (validate(rule[taskFileColumnHeaders.ruleTaskId.pos])) {
                                    // eslint-disable-next-line no-await-in-loop
                                    const taskExists = await taskExistById(
                                        rule[taskFileColumnHeaders.ruleTaskId.pos],
                                        this.options,
                                        this.fileCert,
                                        this.fileCertKey
                                    );

                                    if (taskExists) {
                                        // Add task ID to mapping table that will be used later when building the composite event data structures
                                        // In this case we're adding a task ID that maps to itself, indicating that it's a task that already exists in QSEoW.
                                        this.taskIdMap.set(
                                            rule[taskFileColumnHeaders.ruleTaskId.pos],
                                            rule[taskFileColumnHeaders.ruleTaskId.pos]
                                        );
                                    }
                                } else {
                                    logger.verbose(
                                        `(${taskCounter}) ANALYZE COMPOSITE EVENT: "${
                                            rule[taskFileColumnHeaders.ruleTaskId.pos]
                                        }" is not a valid UUID`
                                    );
                                }

                                compositeEvent.compositeRules.push({
                                    // id: ,
                                    ruleState: mapRuleState.get(rule[taskFileColumnHeaders.ruleState.pos]),
                                    reloadTask: {
                                        id: rule[taskFileColumnHeaders.ruleTaskId.pos],
                                    },
                                });
                            }

                            this.qlikSenseCompositeEvents.addCompositeEvent(compositeEvent);

                            // Add schema event to network representation of tasks
                            if (compositeEvent.compositeRules.length === 1) {
                                // This trigger has exactly ONE upstream task
                                // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish

                                this.taskNetwork.edges.push({
                                    from: compositeEvent.compositeRules[0].reloadTask.id,
                                    to: compositeEvent.reloadTask.id,

                                    completeCompositeEvent: compositeEvent,
                                    rule: compositeEvent.compositeRules,
                                    // color: compositeEvent.enabled ? '#9FC2F7' : '#949298',
                                    // color: edgeColor,
                                    // dashes: compositeEvent.enabled ? false : [15, 15],
                                    // title: compositeEvent.name + '<br>' + 'asdasd',
                                    // label: compositeEvent.name,
                                });

                                // Keep a note that this node has associated events
                                nodesWithEvents.add(compositeEvent.compositeRules[0].reloadTask.id);
                                nodesWithEvents.add(compositeEvent.reloadTask.id);
                            } else {
                                // There are more than one task involved in triggering a downstream task.
                                // Insert a proxy node that represents a Qlik Sense composite event

                                const nodeId = `composite-event-${uuidv4()}`;
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
                                for (const rule of compositeEvent.compositeRules) {
                                    this.taskNetwork.edges.push({
                                        from: rule.reloadTask.id,
                                        to: nodeId,

                                        completeCompositeEvent: compositeEvent,
                                        rule,
                                    });
                                }

                                // Add edge from new meta node to current node
                                this.taskNetwork.edges.push({
                                    from: nodeId,
                                    to: compositeEvent.reloadTask.id,
                                });
                            }

                            // Add this composite event to the current task
                            currentTask.prelCompositeEvents.push(compositeEvent);
                        }
                    }

                    // Add task as node in task network
                    // NB: A top level node is defined as:
                    // 1. A task whose taskID does not show up in the "to" field of any edge.

                    // eslint-disable-next-line no-restricted-syntax
                    this.taskNetwork.nodes.push({
                        id: currentTask.id,
                        metaNode: false,
                        isTopLevelNode: !this.taskNetwork.edges.find((edge) => edge.to === currentTask.taskId),
                        label: currentTask.name,
                        enabled: currentTask.enabled,

                        completeTaskObject: currentTask,

                        // Tabulator columns
                        taskId: currentTask.id,
                        taskName: currentTask.name,
                        taskEnabled: currentTask.enabled,
                        appId: currentTask.app.id,
                        appName: 'N/A',
                        appPublished: 'N/A',
                        appStream: 'N/A',
                        taskMaxRetries: currentTask.maxRetries,
                        taskLastExecutionStartTimestamp: 'N/A',
                        taskLastExecutionStopTimestamp: 'N/A',
                        taskLastExecutionDuration: 'N/A',
                        taskLastExecutionExecutingNodeName: 'N/A',
                        taskNextExecutionTimestamp: 'N/A',
                        taskLastStatus: 'N/A',
                        taskTags: currentTask.tags.map((tag) => tag.name),
                        taskCustomProperties: currentTask.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
                    });

                    // We now have a basic task object including tags and custom properties.
                    // Schema events are included but composite events are only partially there, as they may need
                    // IDs of tasks that have not yet been created.
                    // Still, store all info for composite evets and then do another loop where those events are created for
                    // tasks for which they are defined.
                    //
                    // The strategey is to first create all tasks, then add composite events.
                    // Only then can we be sure all composite events refer to existing tasks.

                    // Create reload task in QSEoW
                    if (this.options.dryRun === false || this.options.dryRun === undefined) {
                        // eslint-disable-next-line no-await-in-loop
                        const newTaskId = await this.createReloadTaskInQseow(currentTask, taskCounter);
                        logger.info(`(${taskCounter}) Created new task "${currentTask.name}", new task id: ${newTaskId}.`);

                        // Add mapping between fake task ID used when creating task network and actual, newly created task ID
                        this.taskIdMap.set(fakeTaskId, newTaskId);

                        // Add mapping between fake task ID specified in source file and actual, newly created task ID
                        if (currentTask.id) {
                            this.taskIdMap.set(currentTask.id, newTaskId);
                        }

                        currentTask.idRef = currentTask.id;
                        currentTask.id = newTaskId;

                        // eslint-disable-next-line no-await-in-loop
                        await this.addTask('from_file', currentTask, false);
                    } else {
                        logger.info(`(${taskCounter}) DRY RUN: Creating reload task in QSEoW "${currentTask.name}"`);
                    }
                }

                // Get task IDs for upstream tasks that composite task events are connected to
                this.qlikSenseCompositeEvents.compositeEventList.map((item) => {
                    const a = item;
                    a.compositeEvent.reloadTask.id = this.taskIdMap.get(item.compositeEvent.reloadTask.id);

                    a.compositeEvent.compositeRules.map((item2) => {
                        const b = item2;
                        const id = this.taskIdMap.get(item2.reloadTask.id);
                        if (id !== undefined && validate(id) === true) {
                            b.reloadTask.id = id;
                        } else if (this.options.dryRun === false || this.options.dryRun === undefined) {
                            logger.error(
                                `PREPARING COMPOSITE EVENT: Invalid upstream task ID "${b.reloadTask.id}" in rule for composite event "${a.compositeEvent.name}" `
                            );
                            b.reloadTask.id = null;
                        }
                        return b;
                    });
                    return a;
                });

                // Loop over all composite events in the source file, create missing ones where needed
                logger.info('-------------------------------------------------------------------');
                logger.info('Creating composite events for the just created tasks...');

                // eslint-disable-next-line no-restricted-syntax
                for (const { compositeEvent } of this.qlikSenseCompositeEvents.compositeEventList) {
                    if (this.options.dryRun === false || this.options.dryRun === undefined) {
                        // eslint-disable-next-line no-await-in-loop
                        await this.createCompositeEventInQseow(compositeEvent);
                    } else {
                        logger.info(`DRY RUN: Creating composite event "${compositeEvent.name}"`);
                    }
                }

                // Add tasks to network array in plain, non-hierarchical format
                this.taskNetwork.tasks = this.taskList;

                resolve(this.taskList);
            } catch (err) {
                if (err.response?.status) {
                    logger.error(`Received error ${err.response?.status}/${err.response?.statusText} from QRS API`);
                }
                if (err.response.data) {
                    logger.error(`Error message from QRS API: ${err.response.data}`);
                }
                if (err.config.data) {
                    logger.error(`Data sent to Sense: ${JSON.stringify(JSON.parse(err.config.data), null, 2)}}`);
                }
                logger.error(`PARSE TASKS FROM FILE 1: ${err}`);
                reject(err);
            }
            // return null;
        });
    }

    createCompositeEventInQseow(newCompositeEvent) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('CREATE COMPOSITE EVENT IN QSEOW: Starting');

                // Build a body for the API call
                const body = newCompositeEvent;

                // Save task to QSEoW
                const axiosConfig = setupQRSConnection(this.options, {
                    method: 'post',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/compositeevent',
                    body,
                });

                logger.debug(`/qrs/compositevent body: ${JSON.stringify(body, null, 2)}`);

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        if (result.status === 201) {
                            const response = JSON.parse(result.data);
                            logger.info(
                                `CREATE COMPOSITE EVENT IN QSEOW: Event name="${newCompositeEvent.name}" for task ID ${response.reloadTask.id}. Result: ${result.status}/${result.statusText}.`
                            );
                            resolve(response.id);
                        } else {
                            reject();
                        }
                    })
                    .catch((err) => {
                        logger.error(`CREATE COMPOSITE EVENT IN QSEOW 1: ${err}`);
                    });
            } catch (err) {
                logger.error(`CREATE COMPOSITE EVENT IN QSEOW 2: ${err}`);
                reject(err);
            }
        });
    }

    createReloadTaskInQseow(newTask, taskCounter) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug(`(${taskCounter}) CREATE RELOAD TASK IN QSEOW: Starting`);

                // Build a body for the API call
                const body = {
                    task: {
                        app: {
                            id: newTask.app.id,
                        },
                        name: newTask.name,
                        isManuallyTriggered: newTask.isManuallyTriggered,
                        isPartialReload: newTask.isPartialReload,
                        taskType: newTask.taskType,
                        enabled: newTask.enabled,
                        taskSessionTimeout: newTask.taskSessionTimeout,
                        maxRetries: newTask.maxRetries,
                        tags: newTask.tags,
                        customProperties: newTask.customProperties,
                        schemaPath: 'ReloadTask',
                    },
                    schemaEvents: newTask.schemaEvents,
                };

                // Save task to QSEoW
                const axiosConfig = setupQRSConnection(this.options, {
                    method: 'post',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/reloadtask/create',
                    body,
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        const response = JSON.parse(result.data);

                        logger.debug(
                            `(${taskCounter}) CREATE RELOAD TASK IN QSEOW: "${newTask.name}", new task id: ${response.id}. Result: ${result.status}/${result.statusText}.`
                        );

                        if (result.status === 201) {
                            resolve(response.id);
                        } else {
                            reject();
                        }
                    })
                    .catch((err) => {
                        logger.error(`CREATE RELOAD TASK IN QSEOW 1: ${err}`);
                        reject(err);
                    });
            } catch (err) {
                logger.error(`CREATE RELOAD TASK IN QSEOW 2: ${err}`);
                reject(err);
            }
        });
    }

    saveTaskModelToQseow() {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('SAVE TASKS TO QSEOW: Starting save tasks to QSEoW');

                // eslint-disable-next-line no-restricted-syntax
                for (const task of this.taskList) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((resolve2, reject2) => {
                        // Build a body for the API call
                        const body = {
                            task: {
                                app: {
                                    id: task.appId,
                                },
                                name: task.taskName,
                                isManuallyTriggered: task.isManuallyTriggered,
                                isPartialReload: task.isPartialReload,
                                taskType: task.taskType,
                                enabled: task.taskEnabled,
                                taskSessionTimeout: task.taskSessionTimeout,
                                maxRetries: task.taskMaxRetries,
                                tags: task.taskTags,
                                customProperties: task.taskCustomProperties,
                                schemaPath: 'ReloadTask',
                            },
                            schemaEvents: task.schemaEvents,
                            compositeEvents: task.compositeEvents,
                        };

                        // Save task to QSEoW
                        const axiosConfig = setupQRSConnection(this.options, {
                            method: 'post',
                            fileCert: this.fileCert,
                            fileCertKey: this.fileCertKey,
                            path: '/qrs/reloadtask/create',
                            body,
                        });

                        try {
                            axios.request(axiosConfig).then((result) => {
                                logger.info(
                                    `SAVE TASK TO QSEOW: Task name: "${task.taskName}", Result: ${result.status}/${result.statusText}`
                                );
                                if (result.status === 201) {
                                    resolve2();
                                } else {
                                    reject2();
                                }
                            });
                        } catch (err) {
                            logger.error(`SAVE TASK TO QSEOW 2: ${err}`);
                            reject2();
                        }
                    });
                    logger.debug(`SAVE TASK TO QSEOW: Done saving task "${task.taskName}"`);
                }
                resolve();
            } catch (err) {
                logger.error(`SAVE TASK TO QSEOW 3: ${err}`);
                reject(err);
            }
        });
    }

    async getTasksFromQseow() {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            // try {
            logger.debug('GET TASK: Starting get reload tasks from QSEoW');

            let filter = '';

            // Are there any task filters specified?
            // If so, build a query string

            // Add task id(s) to query string
            if (this.options.taskId && this.options?.taskId.length >= 1) {
                // At least one task ID specified
                // Add first task ID
                filter += encodeURIComponent(`(id eq ${this.options.taskId[0]}`);
            }
            if (this.options.taskId && this.options?.taskId.length >= 2) {
                // Add remaining task IDs, if any
                for (let i = 1; i < this.options.taskId.length; i += 1) {
                    filter += encodeURIComponent(` or id eq ${this.options.taskId[i]}`);
                }
            }

            // Add closing parenthesis
            if (this.options.taskId && this.options?.taskId.length >= 1) {
                filter += encodeURIComponent(')');
            }
            logger.debug(`GET TASK: QRS query filter (incl ids): ${filter}`);

            // Add task tag(s) to query string
            if (this.options.taskTag && this.options?.taskTag.length >= 1) {
                // At least one task ID specified
                if (filter.length >= 1) {
                    // We've previously added some task ids
                    // Add first task tag
                    filter += encodeURIComponent(` or (tags.name eq '${this.options.taskTag[0]}'`);
                } else {
                    // No task ids added yet
                    // Add first task tag
                    filter += encodeURIComponent(`(tags.name eq '${this.options.taskTag[0]}'`);
                }
            }
            if (this.options.taskTag && this.options?.taskTag.length >= 2) {
                // Add remaining task tags, if any
                for (let i = 1; i < this.options.taskTag.length; i += 1) {
                    filter += encodeURIComponent(` or tags.name eq '${this.options.taskTag[i]}'`);
                }
            }

            // Add closing parenthesis
            if (this.options.taskTag && this.options?.taskTag.length >= 1) {
                filter += encodeURIComponent(')');
            }
            logger.debug(`GET TASK: QRS query filter (incl ids, tags): ${filter}`);

            let axiosConfig;
            let tasks = [];

            if (this.options.taskType.find((item) => item === 'reload')) {
                if (filter === '') {
                    axiosConfig = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        path: '/qrs/reloadtask/full',
                    });
                } else {
                    axiosConfig = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        path: '/qrs/reloadtask/full',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                }

                const result = await axios.request(axiosConfig);
                logger.debug(`GET RELOAD TASK: Result=result.status`);

                tasks = tasks.concat(JSON.parse(result.data));
                logger.verbose(`GET RELOAD TASK: # tasks: ${tasks.length}`);
            }

            // Get external program tasks
            if (this.options.taskType.find((item) => item === 'ext-program')) {
                if (filter === '') {
                    axiosConfig = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        path: '/qrs/externalprogramtask/full',
                    });
                } else {
                    axiosConfig = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        path: '/qrs/externalprogramtask/full',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                }

                const result = await axios.request(axiosConfig);
                logger.debug(`GET EXT PROGRAM TASK: Result=result.status`);

                tasks = tasks.concat(JSON.parse(result.data));
                logger.verbose(`GET EXT PROGRAM TASK: # tasks: ${tasks.length}`);
            }

            // TODO
            // Determine whether task name anonymisation should be done
            const anonymizeTaskNames = false;

            this.clear();
            for (let i = 0; i < tasks.length; i += 1) {
                if (tasks[i].schemaPath === 'ReloadTask' || tasks[i].schemaPath === 'ExternalProgramTask') {
                    this.addTask('from_qseow', tasks[i], anonymizeTaskNames);
                }
            }
            resolve(this.taskList);
            // } catch (err) {
            //     logger.error(`GET QS TASK 2: ${err}`);
            //     reject(err);
            // }
        });
    }

    getTaskSubTree(task, parentTreeLevel) {
        try {
            const self = this;

            const newTreeLevel = parentTreeLevel + 1;
            let subTree = [];

            // Does this node (=task) have any downstream connections?
            const downstreamTasks = self.taskNetwork.edges.filter((edge) => {
                if (!task || !task?.id) {
                    console.log('s');
                }

                return edge.from === task.id;
            });

            let kids = [];
            // eslint-disable-next-line no-restricted-syntax
            for (const downstreamTask of downstreamTasks) {
                if (downstreamTask.to !== undefined) {
                    // Get downstream task object
                    const tmp = self.taskNetwork.nodes.find((el) => el.id === downstreamTask.to);

                    if (!tmp) {
                        logger.warn(`Downstream task in task tree not found. From: ${downstreamTask.from}, to: ${downstreamTask.to} `);
                        kids = [
                            {
                                id: task.id,
                            },
                        ];
                    } else {
                        const tmp3 = self.getTaskSubTree(tmp, newTreeLevel);
                        kids = kids.concat(tmp3);
                    }
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
                    // All task details should be included
                    if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                        if (this.options.textColor === 'yes') {
                            subTree.text += ` \x1b[2mTask id: \x1b[3m${task.id}\x1b[0;2m, Last start/stop: \x1b[3m${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}\x1b[0;2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m, App name: \x1b[3m${task.appName}\x1b[0;2m, App stream: \x1b[3m${task.appStream}\x1b[0;2m\x1b[0m`;
                        } else {
                            subTree.text += ` Task id: ${task.id}, Last start/stop: ${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}, Next start: ${task.taskNextExecutionTimestamp}, App name: ${task.appName}, App stream: ${task.appStream}`;
                        }
                    } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                        if (this.options.textColor === 'yes') {
                            subTree.text += ` \x1b[2m--EXTERNAL PROGRAM--Task id: \x1b[3m${task.id}\x1b[0;2m, Last start/stop: \x1b[3m${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}\x1b[0;2m, Next start: \x1b[3m${task.taskNextExecutionTimestamp}\x1b[0;2m, Path: \x1b[3m${task.path}\x1b[0;2m, Parameters: \x1b[3m${task.parameters}\x1b[0;2m\x1b[0m`;
                        } else {
                            subTree.text += `--EXTERNAL PROGRAM--Task id: ${task.id}, Last start/stop: ${task.taskLastExecutionStartTimestamp}/${task.taskLastExecutionStopTimestamp}, Next start: ${task.taskNextExecutionTimestamp}, path: ${task.path}, Parameters: ${task.oarameters}`;
                        }
                    }
                } else if (this.options.treeDetails) {
                    // Some task details should be included
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
                        if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                            subTree.text +=
                                this.options.textColor === 'yes'
                                    ? `\x1b[2m, App name: \x1b[3m${task.appName}\x1b[0;2m\x1b[0m`
                                    : `, App name: ${task.appName}`;
                        } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                            subTree.text +=
                                this.options.textColor === 'yes'
                                    ? `\x1b[2m, Path: \x1b[3m${task.path}\x1b[0;2m\x1b[0m`
                                    : `, Path: ${task.path}`;
                        }
                    }
                    if (this.options.treeDetails.find((item) => item === 'appstream')) {
                        if (task.completeTaskObject.schemaPath === 'ReloadTask') {
                            subTree.text +=
                                this.options.textColor === 'yes'
                                    ? `\x1b[2m, App stream: \x1b[3m${task.appStream}\x1b[0;2m\x1b[0m`
                                    : `, App stream: ${task.appStream}`;
                        } else if (task.completeTaskObject.schemaPath === 'ExternalProgramTask') {
                            subTree.text +=
                                this.options.textColor === 'yes'
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
            logger.error(`GET TASK SUBTREE: ${err.stack}`);
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

    async getTaskModelFromQseow() {
        // return new Promise((resolve, reject) => {
        // try {
        logger.debug('GET TASK: Getting task model from QSEoW');

        await this.getTasksFromQseow();
        const result1 = await this.qlikSenseSchemaEvents.getSchemaEventsFromQseow();
        const result2 = await this.qlikSenseCompositeEvents.getCompositeEventsFromQseow();
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
            logger.silly(`Schema event contents: ${JSON.stringify(schemaEvent, null, 2)}`);
            // Schedule is associated with a reload task
            if (schemaEvent.schemaEvent.reloadTask !== null) {
                logger.debug(
                    `Processing schema event "${schemaEvent?.schemaEvent?.name}" for reload task "${schemaEvent?.schemaEvent?.reloadTask?.name}" (${schemaEvent?.schemaEvent?.reloadTask?.id})`
                );

                // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
                const nodeId = `node-${uuidv4()}`;
                this.taskNetwork.nodes.push({
                    id: nodeId,
                    metaNodeType: 'schedule', // Meta nodes are not Sense tasks, but rather nodes representing task-like properties (e.g. a starting point for a reload chain)
                    metaNode: true,
                    isTopLevelNode: true,
                    label: schemaEvent.schemaEvent.name,
                    enabled: schemaEvent.schemaEvent.enabled,
                    taskType: 'reloadTask',

                    completeSchemaEvent: schemaEvent.schemaEvent,
                });

                this.taskNetwork.edges.push({
                    from: nodeId,
                    to: schemaEvent.schemaEvent.reloadTask.id,
                });

                // Keep a note that this node has associated events
                nodesWithEvents.add(schemaEvent.schemaEvent.reloadTask.id);
            } else if (schemaEvent.schemaEvent.externalProgramTask !== null) {
                // Schedule is associated with an external program task
                logger.debug(
                    `Processing schema event "${schemaEvent?.schemaEvent?.name}" for external program task "${schemaEvent?.schemaEvent?.reloadTask?.name}" (${schemaEvent?.schemaEvent?.externalProgramTask?.id})`
                );

                // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
                const nodeId = `node-${uuidv4()}`;
                this.taskNetwork.nodes.push({
                    id: nodeId,
                    metaNodeType: 'schedule', // Meta nodes are not Sense tasks, but rather nodes representing task-like properties (e.g. a starting point for a reload chain)
                    metaNode: true,
                    isTopLevelNode: true,
                    label: schemaEvent.schemaEvent.name,
                    enabled: schemaEvent.schemaEvent.enabled,
                    taskType: 'externalProgramTask',

                    completeSchemaEvent: schemaEvent.schemaEvent,
                });

                this.taskNetwork.edges.push({
                    from: nodeId,
                    to: schemaEvent.schemaEvent.externalProgramTask.id,
                });

                // Keep a note that this node has associated events
                nodesWithEvents.add(schemaEvent.schemaEvent.externalProgramTask.id);
            }
        }

        // Add composite events
        // eslint-disable-next-line no-restricted-syntax
        for (const compositeEvent of this.qlikSenseCompositeEvents.compositeEventList) {
            logger.silly(`Composite event contents: ${JSON.stringify(compositeEvent, null, 2)}`);
            if (compositeEvent?.compositeEvent?.reloadTask) {
                logger.debug(
                    `Processing composite event "${compositeEvent?.compositeEvent?.name}" for reload task "${compositeEvent?.compositeEvent?.reloadTask?.name}" (${compositeEvent?.compositeEvent?.reloadTask?.id})`
                );
            } else if (compositeEvent?.compositeEvent?.externalProgramTask) {
                logger.debug(
                    `Processing composite event "${compositeEvent?.compositeEvent?.name}" for external program task "${compositeEvent?.compositeEvent?.externalProgramTask?.name}" (${compositeEvent?.compositeEvent?.externalProgramTask?.id})`
                );
            } else if (compositeEvent?.compositeEvent?.userSyncTask) {
                logger.debug(
                    `Processing composite event "${compositeEvent?.compositeEvent?.name}" for user sync task "${compositeEvent?.compositeEvent?.userSyncTask?.name}" (${compositeEvent?.compositeEvent?.userSyncTask?.id})`
                );
            }

            if (compositeEvent.compositeEvent.reloadTask !== null) {
                // Current composite event triggers a reload task

                if (compositeEvent.compositeEvent.reloadTask.id === undefined || compositeEvent.compositeEvent.reloadTask.id === null) {
                    logger.warn(`Composite event "${compositeEvent.compositeEvent.name}" has no reload task ID associated with it.`);
                } else if (compositeEvent.compositeEvent.compositeRules.length === 1) {
                    // This trigger has exactly ONE upstream task
                    // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish
                    if (validate(compositeEvent.compositeEvent.compositeRules[0].reloadTask.id)) {
                        logger.verbose(
                            `Composite event "${compositeEvent.compositeEvent.name}" has a reload task triggered by reload task with ID=${compositeEvent.compositeEvent.compositeRules[0].reloadTask.id}.`
                        );

                        this.taskNetwork.edges.push({
                            from: compositeEvent.compositeEvent.compositeRules[0].reloadTask.id,
                            fromTaskType: 'Reload',

                            to: compositeEvent.compositeEvent.reloadTask.id,
                            toTaskType: 'Reload',

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
                    } else if (validate(compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id)) {
                        logger.verbose(
                            `Composite event "${compositeEvent.compositeEvent.name}" has a reload task triggered by external program task with ID=${compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id}.`
                        );

                        this.taskNetwork.edges.push({
                            from: compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id,
                            fromTaskType: 'ExternalProgram',

                            to: compositeEvent.compositeEvent.reloadTask.id,
                            toTaskType: 'Reload',

                            completeCompositeEvent: compositeEvent.compositeEvent,
                            rule: compositeEvent.compositeEvent.compositeRules,
                            // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                            // color: edgeColor,
                            // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                            // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                            // label: compositeEvent.compositeEvent.name,
                        });

                        // Keep a note that this node has associated events
                        nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id);
                        nodesWithEvents.add(compositeEvent.compositeEvent.reloadTask.id);
                    }
                } else {
                    // There are more than one task involved in triggering a downstream task.
                    // Insert a proxy node that represents a Qlik Sense composite event

                    // TODO
                    const nodeId = `node-${uuidv4()}`;
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
                        if (validate(rule.reloadTask.id)) {
                            // Upstream task is a reload task
                            this.taskNetwork.edges.push({
                                from: rule.reloadTask.id,
                                fromTaskType: 'Reload',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else if (validate(rule.externalProgramTask.id)) {
                            // Upstream task is an external program task
                            this.taskNetwork.edges.push({
                                from: rule.reloadTask.id,
                                fromTaskType: 'ExternalProgram',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else {
                            logger.warn(
                                `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is not of a supported task type (reload task, external program task).`
                            );
                        }
                    }

                    // Add edge from new meta node to current node
                    this.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.compositeEvent.reloadTask.id,
                    });
                }
            } else if (compositeEvent.compositeEvent.externalProgramTask !== null) {
                // Current composite event triggers an external program task

                if (
                    compositeEvent.compositeEvent.externalProgramTask.id === undefined ||
                    compositeEvent.compositeEvent.externalProgramTask.id === null
                ) {
                    logger.warn(
                        `Composite event "${compositeEvent.compositeEvent.name}" has no external program task ID associated with it.`
                    );
                } else if (compositeEvent.compositeEvent.compositeRules.length === 1) {
                    // This trigger has exactly ONE upstream task
                    // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish
                    if (validate(compositeEvent.compositeEvent.compositeRules[0].reloadTask.id)) {
                        logger.verbose(
                            `Composite event "${compositeEvent.compositeEvent.name}" has an external program task triggered by reload task with ID=${compositeEvent.compositeEvent.compositeRules[0].reloadTask.id}.`
                        );

                        this.taskNetwork.edges.push({
                            from: compositeEvent.compositeEvent.compositeRules[0].reloadTask.id,
                            fromTaskType: 'Reload',

                            to: compositeEvent.compositeEvent.externalProgramTask.id,
                            toTaskType: 'ExternalProgram',

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
                    } else if (validate(compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id)) {
                        logger.verbose(
                            `Composite event "${compositeEvent.compositeEvent.name}" has an external program task triggered by external program task with ID=${compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id}.`
                        );

                        this.taskNetwork.edges.push({
                            from: compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id,
                            fromTaskType: 'ExternalProgram',

                            to: compositeEvent.compositeEvent.externalProgramTask.id,
                            toTaskType: 'ExternalProgram',

                            completeCompositeEvent: compositeEvent.compositeEvent,
                            rule: compositeEvent.compositeEvent.compositeRules,
                            // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                            // color: edgeColor,
                            // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                            // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                            // label: compositeEvent.compositeEvent.name,
                        });

                        // Keep a note that this node has associated events
                        nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id);
                        nodesWithEvents.add(compositeEvent.compositeEvent.reloadTask.id);
                    }
                } else {
                    // There are more than one task involved in triggering a downstream task.
                    // Insert a proxy node that represents a Qlik Sense composite event

                    const nodeId = `node-${uuidv4()}`;
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
                        if (validate(rule.reloadTask.id)) {
                            // Upstream task is a reload task
                            this.taskNetwork.edges.push({
                                from: rule.reloadTask.id,
                                fromTaskType: 'Reload',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else if (validate(rule.externalProgramTask.id)) {
                            // Upstream task is an external program task
                            this.taskNetwork.edges.push({
                                from: rule.reloadTask.id,
                                fromTaskType: 'ExternalProgram',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else {
                            logger.warn(
                                `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is not of a supported task type (reload task, external program task).`
                            );
                        }
                    }

                    // Add edge from new meta node to current node
                    this.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.compositeEvent.reloadTask.id,
                    });
                }
            }
        }

        // Add all Sense tasks as nodes in task network
        // NB: A top level node is defined as:
        // 1. A task whose taskID does not show up in the "to" field of any edge.

        // eslint-disable-next-line no-restricted-syntax
        for (const node of this.taskList) {
            if (node.completeTaskObject.schemaPath === 'ReloadTask') {
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
                    taskCustomProperties: node.completeTaskObject.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
                });
            } else if (node.completeTaskObject.schemaPath === 'ExternalProgramTask') {
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

                    path: node.path,
                    parameters: node.parameters,
                    taskMaxRetries: node.taskMaxRetries,
                    taskLastExecutionStartTimestamp: node.taskLastExecutionStartTimestamp,
                    taskLastExecutionStopTimestamp: node.taskLastExecutionStopTimestamp,
                    taskLastExecutionDuration: node.taskLastExecutionDuration,
                    taskLastExecutionExecutingNodeName: node.taskLastExecutionExecutingNodeName,
                    taskNextExecutionTimestamp: node.taskNextExecutionTimestamp,
                    taskLastStatus: node.taskLastStatus,
                    taskTags: node.completeTaskObject.tags.map((tag) => tag.name),
                    taskCustomProperties: node.completeTaskObject.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
                });
            }
        }
        return this.taskNetwork;
        // resolve(this.taskNetwork);
    }
}

module.exports = {
    QlikSenseTasks,
};
