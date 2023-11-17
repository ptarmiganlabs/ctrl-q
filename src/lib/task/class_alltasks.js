const axios = require('axios');
const path = require('path');
const { v4: uuidv4, validate } = require('uuid');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('../util/qrs');
const {
    mapTaskType,
    mapDaylightSavingTime,
    mapEventType,
    mapIncrementOption,
    mapRuleState,
    getTaskColumnPosFromHeaderRow,
} = require('../util/lookups');
const { QlikSenseTask } = require('./class_task');
const { QlikSenseSchemaEvents } = require('./class_allschemaevents');
const { QlikSenseCompositeEvents } = require('./class_allcompositeevents');
const { getTagIdByName } = require('../util/tag');
const { getCustomPropertyIdByName } = require('../util/customproperties');
const { taskExistById } = require('../util/task');
const { getAppById } = require('../util/app');
const { getTaskById, getTaskByName } = require('../util/task');

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
            this.compositeEventUpstreamTask = [];

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
        this.compositeEventUpstreamTask = [];
    }

    // Add new task
    async addTask(source, task, anonymizeTaskNames) {
        const newTask = new QlikSenseTask();
        await newTask.init(source, task, anonymizeTaskNames, this.options, this.fileCert, this.fileCertKey);
        this.taskList.push(newTask);
    }

    // Function to parse the rows associated with a specific reload task in the source file
    // Properties in the param object:
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - tagsExisting: Array of existing tags in QSEoW
    // - cpExisting: Array of existing custom properties in QSEoW
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    //
    // Returns:
    // Object with two properties:
    // - currentTask: Object containing task data
    // - taskCreationOption: Task creation option. Possible values: "if-exists-add-another", "if-exists-update-existing"
    async parseReloadTask(param) {
        let currentTask = null;
        let taskCreationOption;

        // Create task object using same structure as results from QRS API

        // Determine if the task is associated with an app that existed before Ctrl-Q was started, or
        // an app that's been imported as part of this Ctrl-Q execution.
        // Possible values for the app ID column:
        // - newapp-<app counter> (app has been imported as part of this Ctrl-Q execution)
        // - <app ID> A real, existing app ID. I.e. the app existed before Ctrl-Q was started.
        const appIdRaw = param.taskRows[0][param.taskFileColumnHeaders.appId.pos].trim();
        let appId;

        if (appIdRaw.substring(0, 7).toLowerCase() === 'newapp-') {
            // App ID starts with "newapp-". This means the app been imported as part of this Ctrl-Q session
            // No guarantee that it is the case though. Maybe no apps were imported, or maybe the app specified for this very task was not imported

            // Have ANY apps been imported?
            if (!this.importedApps) {
                logger.error(
                    `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: No apps have been imported, but app "${param.taskRows[0][
                        param.taskFileColumnHeaders.appId.pos
                    ].trim()}" has been specified in the task definition file. Exiting.`
                );
                process.exit(1);
            }

            // Has this specific app been imported?
            if (!this.importedApps.appIdMap.has(appIdRaw.toLowerCase())) {
                logger.error(
                    `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: App "${param.taskRows[0][
                        param.taskFileColumnHeaders.appId.pos
                    ].trim()}" has not been imported, but has been specified in the task definition file. Exiting.`
                );
                process.exit(1);
            }

            appId = this.importedApps.appIdMap.get(appIdRaw.toLowerCase());

            // Ensure the app exists
            // Reasons for the app not existing could be:
            // - The app was imported but has since been deleted or replaced. This could happen if the app-import step has several
            //   apps that are published-replaced or deleted-published to the same stream. In that case only the last published app will be present

            if (appId === undefined) {
                logger.error(
                    `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: Cannot figure out which Sense app "${param.taskRows[0][
                        param.taskFileColumnHeaders.appId.pos
                    ].trim()}" belongs to. App with ID "${appIdRaw}" not found.`
                );

                logger.error(
                    `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: This could be because the app was imported but has since been deleted or replaced, for example during app publishing. Don't know how to proceed, exiting.`
                );

                process.exit(1);
            }

            // eslint-disable-next-line no-await-in-loop
            const app = await getAppById(appId);

            if (!app) {
                logger.error(
                    `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: App with ID "${appId}" not found. This could be because the app was imported but has since been deleted or replaced, for example during app publishing. Don't know how to proceed, exiting.`
                );
                process.exit(1);
            }
        } else if (validate(appIdRaw)) {
            // App ID is a proper UUID. We don't know if the app actually exists though.

            // eslint-disable-next-line no-await-in-loop
            const app = await getAppById(appIdRaw);

            if (!app) {
                logger.error(
                    `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: App with ID "${appIdRaw}" not found. This could be because the app was imported but has since been deleted or replaced, for example during app publishing. Don't know how to proceed, exiting.`
                );
                process.exit(1);
            }

            appId = appIdRaw;
        } else {
            logger.error(`(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: Incorrect app ID "${appIdRaw}". Exiting.`);
            process.exit(1);
        }

        if (param.taskFileColumnHeaders.importOptions.pos === 999) {
            // No task creation options column in the file
            // Use the default task creation option
            taskCreationOption = 'if-exists-update-existing';
        } else {
            // Task creation options column exists in the file
            // Use the value from the file
            taskCreationOption = param.taskRows[0][param.taskFileColumnHeaders.importOptions.pos];
        }

        // Ensure task creation option is valid. Allow empty option
        if (
            taskCreationOption &&
            taskCreationOption.trim() !== '' &&
            !['if-exists-add-another', 'if-exists-update-existing'].includes(taskCreationOption)
        ) {
            logger.error(
                `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: Incorrect task creation option "${taskCreationOption}". Exiting.`
            );
            process.exit(1);
        }

        currentTask = {
            id: param.taskRows[0][param.taskFileColumnHeaders.taskId.pos],
            name: param.taskRows[0][param.taskFileColumnHeaders.taskName.pos],
            taskType: mapTaskType.get(param.taskRows[0][param.taskFileColumnHeaders.taskType.pos]),
            enabled: param.taskRows[0][param.taskFileColumnHeaders.taskEnabled.pos],
            taskSessionTimeout: param.taskRows[0][param.taskFileColumnHeaders.taskSessionTimeout.pos],
            maxRetries: param.taskRows[0][param.taskFileColumnHeaders.taskMaxRetries.pos],
            isManuallyTriggered: param.taskRows[0][param.taskFileColumnHeaders.isManuallyTriggered.pos],
            isPartialReload: param.taskRows[0][param.taskFileColumnHeaders.isPartialReload.pos],
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
        if (param.taskRows[0][param.taskFileColumnHeaders.taskTags.pos]) {
            const tmpTags = param.taskRows[0][param.taskFileColumnHeaders.taskTags.pos]
                .split('/')
                .filter((item) => item.trim().length !== 0)
                .map((item) => item.trim());

            // eslint-disable-next-line no-restricted-syntax
            for (const item of tmpTags) {
                // eslint-disable-next-line no-await-in-loop
                const tagId = await getTagIdByName(item, param.tagsExisting);
                currentTask.tags.push({
                    id: tagId,
                    name: item,
                });
            }
        }

        // Add custom properties to task object
        if (param.taskRows[0][param.taskFileColumnHeaders.taskCustomProperties.pos]) {
            const tmpCustomProperties = param.taskRows[0][param.taskFileColumnHeaders.taskCustomProperties.pos]
                .split('/')
                .filter((item) => item.trim().length !== 0)
                .map((cp) => cp.trim());

            // eslint-disable-next-line no-restricted-syntax
            for (const item of tmpCustomProperties) {
                const tmpCustomProperty = item
                    .split('=')
                    .filter((item2) => item2.trim().length !== 0)
                    .map((cp) => cp.trim());

                // Do we have two items in the array? First is the custom property name, second is the value
                if (tmpCustomProperty?.length === 2) {
                    // eslint-disable-next-line no-await-in-loop
                    const customPropertyId = await getCustomPropertyIdByName('ReloadTask', tmpCustomProperty[0], param.cpExisting);

                    // If previous call returned false, it means the custom property does not exist in Sense
                    // or cannot be used with this task type. In that case, skip it.
                    if (customPropertyId) {
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

        // Get schema events for this task, storing the info using the same structure as returned from QRS API
        currentTask.schemaEvents = this.parseSchemaEvents({
            taskType: 'reload',
            taskRows: param.taskRows,
            taskFileColumnHeaders: param.taskFileColumnHeaders,
            taskCounter: param.taskCounter,
            currentTask,
            fakeTaskId: param.fakeTaskId,
            nodesWithEvents: param.nodesWithEvents,
        });

        // Get composite events for this task
        currentTask.prelCompositeEvents = await this.parseCompositeEvents({
            taskType: 'reload',
            taskRows: param.taskRows,
            taskFileColumnHeaders: param.taskFileColumnHeaders,
            taskCounter: param.taskCounter,
            currentTask,
            fakeTaskId: param.fakeTaskId,
            nodesWithEvents: param.nodesWithEvents,
        });

        return { currentTask, taskCreationOption };
    }

    // Function to parse the rows associated with a specific external program task in the source file
    // Properties in the param object:
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - tagsExisting: Array of existing tags in QSEoW
    // - cpExisting: Array of existing custom properties in QSEoW
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    //
    // Returns:
    // Object with two properties:
    // - currentTask: Object containing task data
    // - taskCreationOption: Task creation option. Possible values: "if-exists-add-another", "if-exists-update-existing"
    async parseExternalProgramTask(param) {
        let currentTask = null;
        let taskCreationOption;

        // Create task object using same structure as results from QRS API

        // Get task import options
        if (param.taskFileColumnHeaders.importOptions.pos === 999) {
            // No task creation options column in the file
            // Use the default task creation option
            taskCreationOption = 'if-exists-update-existing';
        } else {
            // Task creation options column exists in the file
            // Use the value from the file
            taskCreationOption = param.taskRows[0][param.taskFileColumnHeaders.importOptions.pos];
        }

        // Ensure task creation option is valid. Allow empty option
        if (
            taskCreationOption &&
            taskCreationOption.trim() !== '' &&
            !['if-exists-add-another', 'if-exists-update-existing'].includes(taskCreationOption)
        ) {
            logger.error(
                `(${param.taskCounter}) PARSE EXTERNAL PROGRAM TASK FROM FILE: Incorrect task creation option "${taskCreationOption}". Exiting.`
            );
            process.exit(1);
        }

        currentTask = {
            id: param.taskRows[0][param.taskFileColumnHeaders.taskId.pos],
            name: param.taskRows[0][param.taskFileColumnHeaders.taskName.pos],
            taskType: mapTaskType.get(param.taskRows[0][param.taskFileColumnHeaders.taskType.pos]),
            enabled: param.taskRows[0][param.taskFileColumnHeaders.taskEnabled.pos],
            taskSessionTimeout: param.taskRows[0][param.taskFileColumnHeaders.taskSessionTimeout.pos],
            maxRetries: param.taskRows[0][param.taskFileColumnHeaders.taskMaxRetries.pos],

            path: param.taskRows[0][param.taskFileColumnHeaders.extPgmPath.pos],
            parameters: param.taskRows[0][param.taskFileColumnHeaders.extPgmParam.pos],

            tags: [],
            customProperties: [],

            schemaPath: 'ExternalProgramTask',
            schemaEvents: [],
            compositeEvents: [],
            prelCompositeEvents: [],
        };

        // Add tags to task object
        if (param.taskRows[0][param.taskFileColumnHeaders.taskTags.pos]) {
            const tmpTags = param.taskRows[0][param.taskFileColumnHeaders.taskTags.pos]
                .split('/')
                .filter((item) => item.trim().length !== 0)
                .map((item) => item.trim());

            // eslint-disable-next-line no-restricted-syntax
            for (const item of tmpTags) {
                // eslint-disable-next-line no-await-in-loop
                const tagId = await getTagIdByName(item, param.tagsExisting);
                currentTask.tags.push({
                    id: tagId,
                    name: item,
                });
            }
        }

        // Add custom properties to task object
        if (param.taskRows[0][param.taskFileColumnHeaders.taskCustomProperties.pos]) {
            const tmpCustomProperties = param.taskRows[0][param.taskFileColumnHeaders.taskCustomProperties.pos]
                .split('/')
                .filter((item) => item.trim().length !== 0)
                .map((cp) => cp.trim());

            // eslint-disable-next-line no-restricted-syntax
            for (const item of tmpCustomProperties) {
                const tmpCustomProperty = item
                    .split('=')
                    .filter((item2) => item2.trim().length !== 0)
                    .map((cp) => cp.trim());

                // Do we have two items in the array? First is the custom property name, second is the value
                if (tmpCustomProperty?.length === 2) {
                    // eslint-disable-next-line no-await-in-loop
                    const customPropertyId = await getCustomPropertyIdByName('ExternalProgramTask', tmpCustomProperty[0], param.cpExisting);

                    // If previous call returned false, it means the custom property does not exist in Sense
                    // or cannot be used with this task type. In that case, skip it.
                    if (customPropertyId) {
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

        // Get schema events for this task, storing the info using the same structure as returned from QRS API
        currentTask.schemaEvents = this.parseSchemaEvents({
            taskType: 'external program',
            taskRows: param.taskRows,
            taskFileColumnHeaders: param.taskFileColumnHeaders,
            taskCounter: param.taskCounter,
            currentTask,
            fakeTaskId: param.fakeTaskId,
            nodesWithEvents: param.nodesWithEvents,
        });

        // Get composite events for this task
        currentTask.prelCompositeEvents = await this.parseCompositeEvents({
            taskType: 'external program',
            taskRows: param.taskRows,
            taskFileColumnHeaders: param.taskFileColumnHeaders,
            taskCounter: param.taskCounter,
            currentTask,
            fakeTaskId: param.fakeTaskId,
            nodesWithEvents: param.nodesWithEvents,
        });

        return { currentTask, taskCreationOption };
    }

    // Function to get schema events for a specific task
    // Parameters:
    // - taskType: Type of task. Possible values: "reload", "external program"
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - currentTask: Object containing task data
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    parseSchemaEvents(param) {
        // Get schema events for this task, storing the info using the same structure as returned from QRS API
        const prelSchemaEvents = [];

        const schemaEventRows = param.taskRows.filter(
            (item) =>
                item[param.taskFileColumnHeaders.eventType.pos] &&
                item[param.taskFileColumnHeaders.eventType.pos].trim().toLowerCase() === 'schema'
        );
        if (!schemaEventRows || schemaEventRows?.length === 0) {
            logger.verbose(`(${param.taskCounter}) PARSE SCHEMA EVENT: No schema events for task "${param.currentTask.name}"`);
        } else {
            logger.verbose(
                `(${param.taskCounter}) PARSE SCHEMA EVENT: ${schemaEventRows.length} schema event(s) for task "${param.currentTask.name}"`
            );

            // Add schema edges and start/trigger nodes
            // eslint-disable-next-line no-restricted-syntax
            for (const schemaEventRow of schemaEventRows) {
                // Create object using same format that Sense uses for schema events
                const schemaEvent = {
                    enabled: schemaEventRow[param.taskFileColumnHeaders.eventEnabled.pos],
                    eventType: mapEventType.get(schemaEventRow[param.taskFileColumnHeaders.eventType.pos]),
                    name: schemaEventRow[param.taskFileColumnHeaders.eventName.pos],
                    daylightSavingTime: mapDaylightSavingTime.get(schemaEventRow[param.taskFileColumnHeaders.daylightSavingsTime.pos]),
                    timeZone: schemaEventRow[param.taskFileColumnHeaders.schemaTimeZone.pos],
                    startDate: schemaEventRow[param.taskFileColumnHeaders.schemaStart.pos],
                    expirationDate: schemaEventRow[param.taskFileColumnHeaders.scheamExpiration.pos],
                    schemaFilterDescription: [schemaEventRow[param.taskFileColumnHeaders.schemaFilterDescription.pos]],
                    incrementDescription: schemaEventRow[param.taskFileColumnHeaders.schemaIncrementDescription.pos],
                    incrementOption: mapIncrementOption.get(schemaEventRow[param.taskFileColumnHeaders.schemaIncrementOption.pos]),
                    schemaPath: 'SchemaEvent',
                };

                if (param.taskType === 'reload') {
                    schemaEvent.reloadTask = {
                        id: param.fakeTaskId,
                    };
                } else if (param.taskType === 'external program') {
                    schemaEvent.externalProgramTask = {
                        id: param.fakeTaskId,
                    };
                } else {
                    logger.error(`(${param.taskCounter}) PARSE SCHEMA EVENT: Incorrect task type "${param.taskType}". Exiting.`);
                    process.exit(1);
                }

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

                // Add edge from schema trigger node to current task, taking into account task type
                if (param.taskType === 'reload') {
                    this.taskNetwork.edges.push({
                        from: nodeId,
                        to: schemaEvent.reloadTask.id,
                    });

                    // Keep a note that this node has associated events
                    param.nodesWithEvents.add(schemaEvent.reloadTask.id);

                    // Remove reference to task ID
                    delete schemaEvent.reloadTask.id;
                    delete schemaEvent.reloadTask;
                } else if (param.taskType === 'external program') {
                    this.taskNetwork.edges.push({
                        from: nodeId,
                        to: schemaEvent.externalProgramTask.id,
                    });

                    // Keep a note that this node has associated events
                    param.nodesWithEvents.add(schemaEvent.externalProgramTask.id);

                    // Remove reference to task ID
                    delete schemaEvent.externalProgramTask.id;
                    delete schemaEvent.externalProgramTask;
                }

                // Add this schema event to the current task
                prelSchemaEvents.push(schemaEvent);
            }
        }

        return prelSchemaEvents;
    }

    // Function to get composite events for a specific task
    // Function is async as it may need to check if the upstream task pointed to by the composite event exists in Sense

    // Parameters (all properties in the param object):
    // - taskType: Type of task. Possible values: "reload", "external program"
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - currentTask: Object containing task data
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    async parseCompositeEvents(param) {
        // Get all composite events for this task
        //
        // Composite events
        // - Consists of one main row defining the event, followed by one or more rows defining the composite event rules.
        // - The main row is followed by one or more rows defining the composite event rules
        // - All rows associated with a composite event share the same value in the "Event counter" column
        // - Each composite event rule row has a unique value in the "Rule counter" column
        const prelCompositeEvents = [];

        // Get all "main rows" of all composite events in this task
        const compositeEventRows = param.taskRows.filter(
            (item) =>
                item[param.taskFileColumnHeaders.eventType.pos] &&
                item[param.taskFileColumnHeaders.eventType.pos].trim().toLowerCase() === 'composite'
        );
        if (!compositeEventRows || compositeEventRows?.length === 0) {
            logger.verbose(`(${param.taskCounter}) PARSE COMPOSITE EVENT: No composite events for task "${param.currentTask.name}"`);
        } else {
            logger.verbose(
                `(${param.taskCounter}) PARSE COMPOSITE EVENT: ${compositeEventRows.length} composite event(s) for task "${param.currentTask.name}"`
            );

            // Loop over all composite events, adding them and their event rules
            // eslint-disable-next-line no-restricted-syntax
            for (const compositeEventRow of compositeEventRows) {
                // Get value in "Event counter" column for this composite event, then get array of all associated event rules
                const compositeEventCounter = compositeEventRow[param.taskFileColumnHeaders.eventCounter.pos];
                const compositeEventRules = param.taskRows.filter(
                    (item) =>
                        item[param.taskFileColumnHeaders.eventCounter.pos] === compositeEventCounter &&
                        item[param.taskFileColumnHeaders.ruleCounter.pos] > 0
                );

                // Create an object using same format that the Sense API uses for composite events
                // Add task type specific properties in later step
                const compositeEvent = {
                    timeConstraint: {
                        days: compositeEventRow[param.taskFileColumnHeaders.timeConstraintDays.pos],
                        hours: compositeEventRow[param.taskFileColumnHeaders.timeConstraintHours.pos],
                        minutes: compositeEventRow[param.taskFileColumnHeaders.timeConstraintMinutes.pos],
                        seconds: compositeEventRow[param.taskFileColumnHeaders.timeConstraintSeconds.pos],
                    },
                    compositeRules: [],
                    name: compositeEventRow[param.taskFileColumnHeaders.eventName.pos],
                    enabled: compositeEventRow[param.taskFileColumnHeaders.eventEnabled.pos],
                    eventType: mapEventType.get(compositeEventRow[param.taskFileColumnHeaders.eventType.pos]),
                    schemaPath: 'CompositeEvent',
                };

                if (param.taskType === 'reload') {
                    compositeEvent.reloadTask = {
                        id: param.fakeTaskId,
                    };
                } else if (param.taskType === 'external program') {
                    compositeEvent.externalProgramTask = {
                        id: param.fakeTaskId,
                    };
                } else {
                    logger.error(`(${param.taskCounter}) PARSE COMPOSITE EVENT: Incorrect task type "${param.taskType}". Exiting.`);
                    process.exit(1);
                }

                // Add rules
                // eslint-disable-next-line no-restricted-syntax
                for (const rule of compositeEventRules) {
                    // Does the upstream task pointed to by the composite rule exist?
                    // If it *does* exist it means it's a real, existing task in QSEoW that should be used.
                    // If it is not a valid guid or does not exist, it's (best case) a referefence to some other task in the task definitions file.
                    // If the task pointed to by the rule doesn't exist in Sense and doesn't point to some other task in the file, an error should be shown.
                    if (validate(rule[param.taskFileColumnHeaders.ruleTaskId.pos])) {
                        // The rule points to an valid UUID. It should exist, otherwise it's an error

                        // eslint-disable-next-line no-await-in-loop
                        const taskExists = await taskExistById(rule[param.taskFileColumnHeaders.ruleTaskId.pos], this.options);

                        if (taskExists) {
                            // Add task ID to mapping table that will be used later when building the composite event data structures
                            // In this case we're adding a task ID that maps to itself, indicating that it's a task that already exists in QSEoW.
                            this.taskIdMap.set(
                                rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                                rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                            );
                        } else {
                            // The task pointed to by the composite event rule does not exist
                            logger.error(
                                `(${param.taskCounter}) PARSE COMPOSITE EVENT: Task "${
                                    rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                                }" does not exist. Exiting.`
                            );
                            process.exit(1);
                        }
                    } else {
                        logger.verbose(
                            `(${param.taskCounter}) PARSE COMPOSITE EVENT: "${
                                rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                            }" is not a valid UUID`
                        );
                    }

                    // Save composite event rule.
                    // Also add the upstream task id to the correct property in the rule object, depending on task type

                    let upstreamTask;
                    let upstreamTaskExistence;
                    // First get upstream task type
                    // Two options:
                    // 1. The rule's task ID is a valid GUID. Get the associated task's metadata from Sense, if the task exists
                    // 2. The rule's task ID is not a valid GUID. It's a reference to a task that is created during this execution of Ctrl-Q.
                    if (!validate(rule[param.taskFileColumnHeaders.ruleTaskId.pos])) {
                        // The rule's task ID is not a valid GUID. It's a reference to a task that is created during this execution of Ctrl-Q.
                        // Add the task ID to the mapping table, indicating that it's a task that is created during this execution of Ctrl-Q.

                        // // Check if the task ID already exists in the mapping table
                        // if (this.taskIdMap.has(rule[param.taskFileColumnHeaders.ruleTaskId.pos])) {
                        //     // The task ID already exists in the mapping table. This means that the task has already been created during this execution of Ctrl-Q.
                        //     // This is not allowed. The task ID must be unique.
                        //     logger.error(
                        //         `(${param.taskCounter}) PARSE TASKS FROM FILE: Task ID "${
                        //             rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                        //         }" already exists in mapping table. This is not allowed. Exiting.`
                        //     );
                        //     process.exit(1);
                        // }

                        // // Add task ID to mapping table
                        // this.taskIdMap.set(rule[param.taskFileColumnHeaders.ruleTaskId.pos], `fake-task-${uuidv4()}`);

                        upstreamTaskExistence = 'exists-in-source-file';
                    } else {
                        // eslint-disable-next-line no-await-in-loop
                        upstreamTask = await getTaskById(rule[param.taskFileColumnHeaders.ruleTaskId.pos]);

                        // Save upstream task in shared task list
                        this.compositeEventUpstreamTask.push(upstreamTask);

                        upstreamTaskExistence = 'exists-in-sense';
                    }

                    if (upstreamTaskExistence === 'exists-in-source-file') {
                        // Upstream task is a task that is created during this execution of Ctrl-Q
                        // We don't yet know what task ID it will get in Sense, so we'll have to find this when creating composite events later
                        compositeEvent.compositeRules.push({
                            upstreamTaskExistence,
                            ruleState: mapRuleState.get(rule[param.taskFileColumnHeaders.ruleState.pos]),
                            task: {
                                id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                            },
                        });
                    } else if (mapTaskType.get(upstreamTask.taskType).toLowerCase() === 'reload') {
                        // Upstream task is a reload task
                        compositeEvent.compositeRules.push({
                            upstreamTaskExistence,
                            ruleState: mapRuleState.get(rule[param.taskFileColumnHeaders.ruleState.pos]),
                            task: {
                                id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                            },
                            reloadTask: {
                                id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                            },
                        });
                    } else if (mapTaskType.get(upstreamTask.taskType).toLowerCase() === 'externalprogram') {
                        // Upstream task is an external program task
                        compositeEvent.compositeRules.push({
                            upstreamTaskExistence,
                            ruleState: mapRuleState.get(rule[param.taskFileColumnHeaders.ruleState.pos]),
                            task: {
                                id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                            },
                            externalProgramTask: {
                                id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                            },
                        });
                    }
                }

                this.qlikSenseCompositeEvents.addCompositeEvent(compositeEvent);

                // Add composite event to network representation of tasks
                if (compositeEvent.compositeRules.length === 1) {
                    // This trigger has exactly ONE upstream task
                    // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish

                    if (param.taskType === 'reload') {
                        // Add edge from upstream task to current task, taking into account task type
                        this.taskNetwork.edges.push({
                            from: compositeEvent.compositeRules[0].task.id,
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
                        param.nodesWithEvents.add(compositeEvent.compositeRules[0].task.id);
                        param.nodesWithEvents.add(compositeEvent.reloadTask.id);
                    } else if (param.taskType === 'external program') {
                        // Add edge from upstream task to current task, taking into account task type
                        this.taskNetwork.edges.push({
                            from: compositeEvent.compositeRules[0].task.id,
                            to: compositeEvent.externalProgramTask.id,

                            completeCompositeEvent: compositeEvent,
                            rule: compositeEvent.compositeRules,
                        });
                        // Keep a note that this node has associated events
                        param.nodesWithEvents.add(compositeEvent.compositeRules[0].task.id);
                        param.nodesWithEvents.add(compositeEvent.externalProgramTask.id);
                    }
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
                    param.nodesWithEvents.add(nodeId);

                    // Add edges from upstream tasks to the new meta node
                    // eslint-disable-next-line no-restricted-syntax
                    for (const rule of compositeEvent.compositeRules) {
                        this.taskNetwork.edges.push({
                            from: rule.task.id,
                            to: nodeId,

                            completeCompositeEvent: compositeEvent,
                            rule,
                        });
                    }

                    // Add edge from new meta node to current node, taking into account task type
                    if (param.taskType === 'reload') {
                        this.taskNetwork.edges.push({
                            from: nodeId,
                            to: compositeEvent.reloadTask.id,
                        });
                    } else if (param.taskType === 'external program') {
                        this.taskNetwork.edges.push({
                            from: nodeId,
                            to: compositeEvent.externalProgramTask.id,
                        });
                    }
                }

                // Add this composite event to the current task
                prelCompositeEvents.push(compositeEvent);
            }
        }

        return prelCompositeEvents;
    }

    // Function to read task definitions from disk file (CSV or Excel)
    // Parameters:
    // - tasksFromFile: Object containing data read from file
    // - tagsExisting: Array of existing tags in QSEoW
    // - cpExisting: Array of existing custom properties in QSEoW
    async getTaskModelFromFile(tasksFromFile, tagsExisting, cpExisting) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('PARSE TASKS FROM FILE: Starting get tasks from data in file');

                this.clear();

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

                        // eslint-disable-next-line no-await-in-loop
                        const res = await this.parseReloadTask({
                            taskRows,
                            taskFileColumnHeaders,
                            taskCounter,
                            tagsExisting,
                            cpExisting,
                            fakeTaskId,
                            nodesWithEvents,
                        });

                        // Add reload task as node in task network
                        // NB: A top level node is defined as:
                        // 1. A task whose taskID does not show up in the "to" field of any edge.

                        // eslint-disable-next-line no-restricted-syntax
                        this.taskNetwork.nodes.push({
                            id: res.currentTask.id,
                            metaNode: false,
                            isTopLevelNode: !this.taskNetwork.edges.find((edge) => edge.to === res.currentTask.id),
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
                        if (this.options.updateMode === 'create') {
                            // Create new task
                            if (this.options.dryRun === false || this.options.dryRun === undefined) {
                                // eslint-disable-next-line no-await-in-loop
                                const newTaskId = await this.createReloadTaskInQseow(res.currentTask, taskCounter);
                                logger.info(
                                    `(${taskCounter}) Created new reload task "${res.currentTask.name}", new task id: ${newTaskId}.`
                                );

                                // Add mapping between fake task ID used when creating task network and actual, newly created task ID
                                this.taskIdMap.set(fakeTaskId, newTaskId);

                                // Add mapping between fake task ID specified in source file and actual, newly created task ID
                                if (res.currentTask.id) {
                                    this.taskIdMap.set(res.currentTask.id, newTaskId);
                                }

                                res.currentTask.idRef = res.currentTask.id;
                                res.currentTask.id = newTaskId;

                                // eslint-disable-next-line no-await-in-loop
                                await this.addTask('from_file', res.currentTask, false);
                            } else {
                                logger.info(`(${taskCounter}) DRY RUN: Creating reload task in QSEoW "${res.currentTask.name}"`);
                            }
                        } else if (this.options.updateMode === 'update-if-exists') {
                            // Update existing task
                            // TODO
                            // // Verify task ID is a valid UUID
                            // // If it's not a valid UUID, the ID specified in the source file will be treated as a task name
                            // if (!validate(res.currentTask.id)) {
                            //     // eslint-disable-next-line no-await-in-loop
                            //     const task = await getTaskByName(res.currentTask.id);
                            //     if (task) {
                            //         // eslint-disable-next-line no-await-in-loop
                            //         await this.updateReloadTaskInQseow(res.currentTask, taskCounter);
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
                            //         await this.updateReloadTaskInQseow(res.currentTask, taskCounter);
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
                                `Invalid task update mode. Valid values are "create" and "update-if-exists". You specified "${this.options.updateMode}".`
                            );
                        }
                    } else if (taskType === 'external program') {
                        // External program task

                        // Create a fake ID for this task. Used to associate task with schema/composite events
                        const fakeTaskId = `ext-pgm-task-${uuidv4()}`;

                        // eslint-disable-next-line no-await-in-loop
                        const res = await this.parseExternalProgramTask({
                            taskRows,
                            taskFileColumnHeaders,
                            taskCounter,
                            tagsExisting,
                            cpExisting,
                            fakeTaskId,
                            nodesWithEvents,
                        });

                        // Add external program task as node in task network
                        // NB: A top level node is defined as:
                        // 1. A task whose taskID does not show up in the "to" field of any edge.

                        // eslint-disable-next-line no-restricted-syntax
                        this.taskNetwork.nodes.push({
                            id: res.currentTask.id,
                            metaNode: false,
                            isTopLevelNode: !this.taskNetwork.edges.find((edge) => edge.to === res.currentTask.id),
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
                        if (this.options.updateMode === 'create') {
                            // Create new task
                            if (this.options.dryRun === false || this.options.dryRun === undefined) {
                                // eslint-disable-next-line no-await-in-loop
                                const newTaskId = await this.createExternalProgramTaskInQseow(res.currentTask, taskCounter);
                                logger.info(
                                    `(${taskCounter}) Created new external program task "${res.currentTask.name}", new task id: ${newTaskId}.`
                                );

                                // Add mapping between fake task ID used when creating task network and actual, newly created task ID
                                this.taskIdMap.set(fakeTaskId, newTaskId);

                                // Add mapping between fake task ID specified in source file and actual, newly created task ID
                                if (res.currentTask.id) {
                                    this.taskIdMap.set(res.currentTask.id, newTaskId);
                                }

                                res.currentTask.idRef = res.currentTask.id;
                                res.currentTask.id = newTaskId;

                                // eslint-disable-next-line no-await-in-loop
                                await this.addTask('from_file', res.currentTask, false);
                            } else {
                                logger.info(`(${taskCounter}) DRY RUN: Creating external program task in QSEoW "${res.currentTask.name}"`);
                            }
                        } else if (this.options.updateMode === 'update-if-exists') {
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
                                `Invalid task update mode. Valid values are "create" and "update-if-exists". You specified "${this.options.updateMode}".`
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
                this.qlikSenseCompositeEvents.compositeEventList.map((item) => {
                    const a = item;

                    // Set task ID for the composite event itself, i.e. which task is the event associated with (i.e. the downstream task)
                    // Handle different task types differently
                    if (item.compositeEvent?.reloadTask?.id) {
                        // Reload task
                        a.compositeEvent.reloadTask.id = this.taskIdMap.get(item.compositeEvent.reloadTask.id);
                    } else if (item.compositeEvent?.externalProgramTask?.id) {
                        // External program task
                        a.compositeEvent.externalProgramTask.id = this.taskIdMap.get(item.compositeEvent.externalProgramTask.id);
                    }

                    // For this composite event, set the correct task id for each each rule.
                    // Different properties are used for reload tasks, external program tasks etc.
                    // Some rules may be pointing to newly created tasks. These can be looked up in the taskIdMap.
                    a.compositeEvent.compositeRules.map((item2) => {
                        const b = item2;

                        // Get triggering/upstream task id
                        const id = this.taskIdMap.get(b.task.id);

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
                                const task = this.taskList.find((item3) => item3.taskId === id);
                                taskType = task.taskType;
                                // const { taskType } = this.taskNetwork.nodes.find((node) => node.id === id).completeTaskObject;
                            } else if (b.upstreamTaskExistence === 'exists-in-sense') {
                                // eslint-disable-next-line no-await-in-loop
                                const task = this.compositeEventUpstreamTask.find((item4) => item4.id === b.task.id);

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
                        // (this.options.dryRun === false || this.options.dryRun === undefined) {
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
                if (err?.response?.status) {
                    logger.error(`Received error ${err.response?.status}/${err.response?.statusText} from QRS API`);
                }
                if (err?.response?.data) {
                    logger.error(`Error message from QRS API: ${err.response.data}`);
                }
                if (err?.config?.data) {
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

                            if (response?.reloadTask) {
                                logger.info(
                                    `CREATE COMPOSITE EVENT IN QSEOW: Event name="${newCompositeEvent.name}" for task ID ${response.reloadTask.id}. Result: ${result.status}/${result.statusText}.`
                                );
                            } else if (response?.externalProgramTask) {
                                logger.info(
                                    `CREATE COMPOSITE EVENT IN QSEOW: Event name="${newCompositeEvent.name}" for task ID ${response.externalProgramTask.id}. Result: ${result.status}/${result.statusText}.`
                                );
                            }

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

    // Function to create new reload task in QSEoW
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
                        taskType: 0,
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

    // Function to create new external program task in QSEoW
    // Parameters:
    // - newTask: Object containing task data
    // - taskCounter: Task counter, unique for each task in the source file
    createExternalProgramTaskInQseow(newTask, taskCounter) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug(`(${taskCounter}) CREATE EXTERNAL PROGRAM TASK IN QSEOW: Starting`);

                // Build a body for the API call
                const body = {
                    task: {
                        name: newTask.name,
                        taskType: 1,
                        enabled: newTask.enabled,
                        taskSessionTimeout: newTask.taskSessionTimeout,
                        maxRetries: newTask.maxRetries,
                        path: newTask.path,
                        parameters: newTask.parameters,
                        tags: newTask.tags,
                        customProperties: newTask.customProperties,
                        schemaPath: 'ExternalProgramTask',
                    },
                    schemaEvents: newTask.schemaEvents,
                };

                // Save task to QSEoW
                const axiosConfig = setupQRSConnection(this.options, {
                    method: 'post',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/externalprogramtask/create',
                    body,
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        const response = JSON.parse(result.data);

                        logger.debug(
                            `(${taskCounter}) CREATE EXTERNAL PROGRAM TASK IN QSEOW: "${newTask.name}", new task id: ${response.id}. Result: ${result.status}/${result.statusText}.`
                        );

                        if (result.status === 201) {
                            resolve(response.id);
                        } else {
                            reject();
                        }
                    })
                    .catch((err) => {
                        logger.error(`CREATE EXTERNAL PROGRAM TASK IN QSEOW 1: ${err}`);
                        reject(err);
                    });
            } catch (err) {
                logger.error(`CREATE EXTERNAL PROGRAM TASK IN QSEOW 2: ${err}`);
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
                            logger.error(`SAVE TASK TO QSEOW 1: ${err}`);
                            reject2();
                        }
                    });
                    logger.debug(`SAVE TASK TO QSEOW: Done saving task "${task.taskName}"`);
                }
                resolve();
            } catch (err) {
                logger.error(`SAVE TASK TO QSEOW 2: ${err}`);
                reject(err);
            }
        });
    }

    async getTasksFromQseow() {
        // eslint-disable-next-line no-async-promise-executor, no-unused-vars
        return new Promise(async (resolve, reject) => {
            // try {
            logger.debug('GET TASKS FROM QSEOW: Starting get reload tasks from QSEoW');

            let filter = '';

            // Are there any task filters specified?
            // If so, build a query string

            // Don't add task id and tag filtering if the output is a task tree
            if (this.options.outputFormat !== 'tree') {
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
                logger.debug(`GET TASKS FROM QSEOW: QRS query filter (incl ids): ${filter}`);

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
            }

            logger.debug(`GET TASKS FROM QSEOW: QRS query filter (incl ids, tags): ${filter}`);

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
        });
    }

    getTaskSubTree(task, parentTreeLevel) {
        try {
            const self = this;

            if (!task || !task?.id) {
                logger.debug('Task parameter empty or does not include a task ID');
            }

            const newTreeLevel = parentTreeLevel + 1;
            let subTree = [];

            // Debug
            logger.debug(
                `GET TASK SUBTREE: Meta node type: ${task.metaNodeType}, task type: ${task.taskType}, tree level: ${newTreeLevel}, task name: ${task.taskName}`
            );

            // Does this node (=task) have any downstream connections?
            const downstreamTasks = self.taskNetwork.edges.filter((edge) => edge.from === task.id);

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
            logger.error(`GET TASK SUBTREE (tree): ${err.stack}`);
            return false;
        }
    }

    getTaskSubTable(task, parentTreeLevel) {
        try {
            const self = this;

            const newTreeLevel = parentTreeLevel + 1;
            let subTree = [];

            // Debug
            // logger.debug(`GET TASK SUBTABLE: Tree level: ${newTreeLevel}, task name: ${task.taskName}`);

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
            logger.error(`GET TASK SUBTREE (table): ${err}`);
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
        logger.debug('GET TASK: Getting task model from QSEoW');

        // Get all tasks from QSEoW
        try {
            logger.verbose(`Getting tasks from QSEoW...`);
            await this.getTasksFromQseow();
        } catch (err) {
            logger.error(`GET TASK MODEL FROM QSEOW 1: ${err}`);
            return false;
        }

        // Get all schema events from QSEoW
        try {
            logger.verbose(`Getting schema events from QSEoW...`);
            const result1 = await this.qlikSenseSchemaEvents.getSchemaEventsFromQseow();

            logger.silly(`Schema events from QSEoW: ${JSON.stringify(result1, null, 2)}`);
        } catch (err) {
            logger.error(`GET TASK MODEL FROM QSEOW 2: ${err}`);
            return false;
        }

        // Get all composite events from QSEoW
        try {
            logger.verbose(`Getting composite events from QSEoW...`);
            const result2 = await this.qlikSenseCompositeEvents.getCompositeEventsFromQseow();

            logger.silly(`Composite events from QSEoW: ${JSON.stringify(result2, null, 2)}`);
        } catch (err) {
            logger.error(`GET TASK MODEL FROM QSEOW 3: ${err}`);
            return false;
        }

        logger.verbose('GET TASK MODEL FROM QSEOW: Done getting task model from QSEoW');

        // Get all top level apps, i.e apps that aren't triggered by any other apps succeeding or failing.
        // They might have scheduled triggers though.
        this.taskNetwork = { nodes: [], edges: [], tasks: [] };
        const nodesWithEvents = new Set();

        // We already have all tasks in plain, non-hierarchical format
        this.taskNetwork.tasks = this.taskList;

        // Add schema edges and start/trigger nodes
        logger.verbose('GET TASK MODEL FROM QSEOW: Adding schema edges and start/trigger nodes to internal task model');
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
        logger.verbose('GET TASK MODEL FROM QSEOW: Adding composite events to internal task model');
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
                logger.debug(
                    `Current composite event triggers a reload task. Processing composite event "${compositeEvent?.compositeEvent?.name}" for reload task "${compositeEvent?.compositeEvent?.reloadTask?.name}" (${compositeEvent?.compositeEvent?.reloadTask?.id})`
                );

                if (compositeEvent.compositeEvent.reloadTask.id === undefined || compositeEvent.compositeEvent.reloadTask.id === null) {
                    logger.warn(`Composite event "${compositeEvent.compositeEvent.name}" has no reload task ID associated with it.`);
                } else if (compositeEvent.compositeEvent.compositeRules.length === 1) {
                    // This trigger has exactly ONE upstream task
                    // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish
                    if (validate(compositeEvent.compositeEvent.compositeRules[0]?.reloadTask?.id)) {
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
                    } else if (validate(compositeEvent.compositeEvent.compositeRules[0]?.externalProgramTask?.id)) {
                        logger.verbose(
                            `Composite event "${compositeEvent?.compositeEvent?.name}" has a reload task triggered by external program task with ID=${compositeEvent.compositeEvent.compositeRules[0]?.externalProgramTask?.id}.`
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
                    logger.verbose(
                        `Composite event "${compositeEvent?.compositeEvent?.name}" is triggerer by ${compositeEvent?.compositeEvent?.compositeRules.length} upstream tasks.`
                    );

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
                        if (validate(rule?.reloadTask?.id)) {
                            // Upstream task is a reload task
                            logger.debug(
                                `Composite event "${compositeEvent.compositeEvent.name}" is triggered by reload task with ID=${rule.reloadTask.id}.`
                            );

                            this.taskNetwork.edges.push({
                                from: rule.reloadTask.id,
                                fromTaskType: 'Reload',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else if (validate(rule?.externalProgramTask?.id)) {
                            // Upstream task is an external program task
                            logger.debug(
                                `Composite event "${compositeEvent.compositeEvent.name}" is triggered by external program task with ID=${rule.externalProgramTask.id}.`
                            );

                            this.taskNetwork.edges.push({
                                from: rule.externalProgramTask.id,
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
                    logger.debug(
                        `Added edge from composite event meta node "${nodeId}" to reload task ID=${compositeEvent.compositeEvent.reloadTask.id}.`
                    );

                    this.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.compositeEvent.reloadTask.id,
                    });
                }
            } else if (compositeEvent.compositeEvent.externalProgramTask !== null) {
                // Current composite event triggers an external program task
                logger.debug(
                    `Composite event "${compositeEvent.compositeEvent.name}" triggers an external program task "${compositeEvent.compositeEvent.externalProgramTask.name}" (${compositeEvent.compositeEvent.externalProgramTask.id}).`
                );

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
                    logger.verbose(`Composite event "${compositeEvent.compositeEvent.name}" has exactly one upstream task.`);

                    if (validate(compositeEvent.compositeEvent.compositeRules[0]?.reloadTask?.id)) {
                        logger.verbose(
                            `Composite event "${compositeEvent?.compositeEvent?.name}" has an external program task triggered by reload task with ID=${compositeEvent.compositeEvent.compositeRules[0]?.reloadTask?.id}.`
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
                        nodesWithEvents.add(compositeEvent.compositeEvent.externalProgramTask.id);
                    } else if (validate(compositeEvent.compositeEvent.compositeRules[0]?.externalProgramTask?.id)) {
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
                        nodesWithEvents.add(compositeEvent.compositeEvent.externalProgramTask.id);
                    } else {
                        logger.warn(`Composite event "${compositeEvent.compositeEvent.name}" is triggered by an unsupported task type.`);
                    }
                } else {
                    // There are more than one task involved in triggering a downstream task.
                    // Insert a proxy node that represents a Qlik Sense composite event
                    logger.verbose(
                        `Composite event "${compositeEvent?.compositeEvent?.name}" has ${compositeEvent?.compositeEvent?.compositeRules.length} upstream tasks.`
                    );

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
                        if (validate(rule?.reloadTask?.id)) {
                            // Upstream task is a reload task
                            logger.debug(
                                `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is a reload task with ID=${rule.reloadTask.id}.`
                            );

                            this.taskNetwork.edges.push({
                                from: rule.reloadTask.id,
                                fromTaskType: 'Reload',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else if (validate(rule?.externalProgramTask?.id)) {
                            // Upstream task is an external program task
                            logger.debug(
                                `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is an external program task with ID=${rule.externalProgramTask.id}.`
                            );

                            this.taskNetwork.edges.push({
                                from: rule.externalProgramTask.id,
                                fromTaskType: 'ExternalProgram',
                                to: nodeId,
                                toTaskType: 'Composite',

                                // TODO Correct? Or should it be at next edges.push?
                                completeCompositeEvent: compositeEvent.compositeEvent,
                                rule,
                            });
                        } else {
                            logger.warn(
                                `Upstream task for composite event "${compositeEvent?.compositeEvent?.name}" is not of a supported task type (reload task, external program task).`
                            );
                        }
                    }

                    // Add edge from new meta node to current node
                    logger.debug(
                        `Added edge from new meta composite event node "${nodeId}" to reload task ID=${compositeEvent.compositeEvent?.reloadTask?.id}.`
                    );

                    if (compositeEvent.compositeEvent?.reloadTask) {
                        this.taskNetwork.edges.push({
                            from: nodeId,
                            to: compositeEvent.compositeEvent.reloadTask.id,
                        });
                    } else if (compositeEvent.compositeEvent?.externalProgramTask) {
                        this.taskNetwork.edges.push({
                            from: nodeId,
                            to: compositeEvent.compositeEvent.externalProgramTask.id,
                        });
                    }
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
    }
}

module.exports = {
    QlikSenseTasks,
};
