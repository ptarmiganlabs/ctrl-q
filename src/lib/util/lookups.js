const mapDaylightSavingTime = new Map([
    [0, 'ObserveDaylightSavingTime'],
    [1, 'PermanentStandardTime'],
    [2, 'PermanentDaylightSavingTime'],
    ['ObserveDaylightSavingTime', 0],
    ['PermanentStandardTime', 1],
    ['PermanentDaylightSavingTime', 2],
]);

const mapEventType = new Map([
    [0, 'Schema'],
    [1, 'Composite'],
    ['Schema', 0],
    ['Composite', 1],
]);

const mapIncrementOption = new Map([
    [0, 'once'],
    [1, 'hourly'],
    [2, 'daily'],
    [3, 'weekly'],
    [4, 'monthly'],
    [5, 'custom'],
    ['once', 0],
    ['hourly', 1],
    ['daily', 2],
    ['weekly', 3],
    ['monthly', 4],
    ['custom', 5],
]);

const mapRuleState = new Map([
    [0, 'Undefined'],
    [1, 'TaskSuccessful'],
    [2, 'TaskFail'],
    ['Undefined', 0],
    ['TaskSuccessful', 1],
    ['TaskFail', 2],
]);

const mapTaskExecutionStatus = new Map([
    [0, 'NeverStarted'],
    [1, 'Triggered'],
    [2, 'Started'],
    [3, 'Queued'],
    [4, 'AbortInitiated'],
    [5, 'Aborting'],
    [6, 'Aborted'],
    [7, 'FinishedSuccess'],
    [8, 'FinishedFail'],
    [9, 'Skipped'],
    [10, 'Retry'],
    [11, 'Error'],
    [12, 'Reset'],
    ['NeverStarted', 0],
    ['Triggered', 1],
    ['Started', 2],
    ['Queued', 3],
    ['AbortInitiated', 4],
    ['Aborting', 5],
    ['Aborted', 6],
    ['FinishedSuccess', 7],
    ['FinishedFail', 8],
    ['Skipped', 9],
    ['Retry', 10],
    ['Error', 11],
    ['Reset', 11],
]);

const mapTaskType = new Map([
    [0, 'Reload'],
    [1, 'ExternalProgram'],
    [2, 'UserSync'],
    [3, 'Distribute'],
    ['Reload', 0],
    ['ExternalProgram', 1],
    ['UserSync', 2],
    ['Distribute', 3],
]);

// Used to find the column position in the source csv/Excel file containing the task definition
// position=999 may be set later in the code and  means that a certain column is not present in the source file.
// It is then up to the code to handle this situation.
const taskFileColumnHeaders = {
    taskCounter: { name: 'Task counter', pos: -1 },
    taskType: { name: 'Task type', pos: -1 },
    taskName: { name: 'Task name', pos: -1 },
    // taskRefId: { name: 'Reference task id', pos: -1 },
    taskId: { name: 'Task id', pos: -1 },
    importOptions: { name: 'Import options', pos: -1 },
    taskEnabled: { name: 'Task enabled', pos: -1 },
    taskSessionTimeout: { name: 'Task timeout', pos: -1 },
    taskMaxRetries: { name: 'Task retries', pos: -1 },

    appId: { name: 'App id', pos: -1 },
    appName: { name: 'App name', pos: -1 },
    isPartialReload: { name: 'Partial reload', pos: -1 },
    isManuallyTriggered: { name: 'Manually triggered', pos: -1 },

    taskStatus: { name: 'Task status', pos: -1 },
    taskStarted: { name: 'Task started', pos: -1 },
    taskEnded: { name: 'Task ended', pos: -1 },
    taskDuration: { name: 'Task duration', pos: -1 },
    taskExecutionNode: { name: 'Task executedon node', pos: -1 },

    extPgmPath: { name: 'Ext program path', pos: -1 },
    extPgmParam: { name: 'Ext program parameters', pos: -1 },

    taskTags: { name: 'Tags', pos: -1 },
    taskCustomProperties: { name: 'Custom properties', pos: -1 },

    eventCounter: { name: 'Event counter', pos: -1 },
    eventType: { name: 'Event type', pos: -1 },
    eventName: { name: 'Event name', pos: -1 },
    eventEnabled: { name: 'Event enabled', pos: -1 },
    eventCreatedDate: { name: 'Event created date', pos: -1 },
    eventModifiedDate: { name: 'Event modified date', pos: -1 },
    eventModifiedBy: { name: 'Event modified by', pos: -1 },

    schemaIncrementOption: { name: 'Schema increment option', pos: -1 },
    schemaIncrementDescription: { name: 'Schema increment description', pos: -1 },
    daylightSavingsTime: { name: 'Daylight savings time', pos: -1 },
    schemaStart: { name: 'Schema start', pos: -1 },
    scheamExpiration: { name: 'Schema expiration', pos: -1 },
    schemaFilterDescription: { name: 'Schema filter description', pos: -1 },
    schemaTimeZone: { name: 'Schema time zone', pos: -1 },

    timeConstraintSeconds: { name: 'Time contstraint seconds', pos: -1 },
    timeConstraintMinutes: { name: 'Time contstraint minutes', pos: -1 },
    timeConstraintHours: { name: 'Time contstraint hours', pos: -1 },
    timeConstraintDays: { name: 'Time contstraint days', pos: -1 },
    ruleCounter: { name: 'Rule counter', pos: -1 },
    ruleState: { name: 'Rule state', pos: -1 },
    ruleTaskName: { name: 'Rule task name', pos: -1 },
    ruleTaskId: { name: 'Rule task id', pos: -1 },
};

const appFileColumnHeaders = {
    appCounter: { name: 'App counter', pos: -1 },
    appName: { name: 'App name', pos: -1 },
    qvfDirectory: { name: 'QVF directory', pos: -1 },
    qvfName: { name: 'QVF name', pos: -1 },
    excludeDataConnections: { name: 'Exclude data connections', pos: -1 },
    appTags: { name: 'App tags', pos: -1 },
    appCustomProperties: { name: 'App custom properties', pos: -1 },
    appOwnerUserDirectory: { name: 'Owner user directory', pos: -1 },
    appOwnerUserId: { name: 'Owner user id', pos: -1 },
    appPublishToStream: { name: 'Publish to stream', pos: -1 },
    appPublishToStreamOption: { name: 'Publish options', pos: -1 },
};

function getTaskColumnPosFromHeaderRow(headerRow) {
    taskFileColumnHeaders.taskCounter.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskCounter.name);
    taskFileColumnHeaders.taskType.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskType.name);
    taskFileColumnHeaders.taskName.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskName.name);
    taskFileColumnHeaders.taskId.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskId.name);
    taskFileColumnHeaders.importOptions.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.importOptions.name);
    taskFileColumnHeaders.taskEnabled.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskEnabled.name);
    taskFileColumnHeaders.taskSessionTimeout.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskSessionTimeout.name);
    taskFileColumnHeaders.taskMaxRetries.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskMaxRetries.name);
    taskFileColumnHeaders.appId.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.appId.name);
    taskFileColumnHeaders.appName.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.appName.name);
    taskFileColumnHeaders.isPartialReload.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.isPartialReload.name);
    taskFileColumnHeaders.isManuallyTriggered.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.isManuallyTriggered.name);
    taskFileColumnHeaders.taskStatus.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskStatus.name);
    taskFileColumnHeaders.taskStarted.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskStarted.name);
    taskFileColumnHeaders.taskEnded.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskEnded.name);
    taskFileColumnHeaders.taskDuration.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskDuration.name);
    taskFileColumnHeaders.taskExecutionNode.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskExecutionNode.name);

    taskFileColumnHeaders.extPgmPath.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.extPgmPath.name);
    taskFileColumnHeaders.extPgmParam.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.extPgmParam.name);

    taskFileColumnHeaders.taskTags.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.taskTags.name);
    taskFileColumnHeaders.taskCustomProperties.pos = headerRow.findIndex(
        (item) => item === taskFileColumnHeaders.taskCustomProperties.name
    );
    taskFileColumnHeaders.eventCounter.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventCounter.name);
    taskFileColumnHeaders.eventType.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventType.name);
    taskFileColumnHeaders.eventName.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventName.name);
    taskFileColumnHeaders.eventEnabled.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventEnabled.name);
    taskFileColumnHeaders.eventCreatedDate.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventCreatedDate.name);
    taskFileColumnHeaders.eventModifiedDate.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventModifiedDate.name);
    taskFileColumnHeaders.eventModifiedBy.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.eventModifiedBy.name);
    taskFileColumnHeaders.schemaIncrementOption.pos = headerRow.findIndex(
        (item) => item === taskFileColumnHeaders.schemaIncrementOption.name
    );
    taskFileColumnHeaders.schemaIncrementDescription.pos = headerRow.findIndex(
        (item) => item === taskFileColumnHeaders.schemaIncrementDescription.name
    );
    taskFileColumnHeaders.daylightSavingsTime.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.daylightSavingsTime.name);
    taskFileColumnHeaders.schemaStart.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.schemaStart.name);
    taskFileColumnHeaders.scheamExpiration.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.scheamExpiration.name);
    taskFileColumnHeaders.schemaFilterDescription.pos = headerRow.findIndex(
        (item) => item === taskFileColumnHeaders.schemaFilterDescription.name
    );
    taskFileColumnHeaders.schemaTimeZone.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.schemaTimeZone.name);
    taskFileColumnHeaders.timeConstraintSeconds.pos = headerRow.findIndex(
        (item) => item === taskFileColumnHeaders.timeConstraintSeconds.name
    );
    taskFileColumnHeaders.timeConstraintMinutes.pos = headerRow.findIndex(
        (item) => item === taskFileColumnHeaders.timeConstraintMinutes.name
    );
    taskFileColumnHeaders.timeConstraintHours.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.timeConstraintHours.name);
    taskFileColumnHeaders.timeConstraintDays.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.timeConstraintDays.name);
    taskFileColumnHeaders.ruleCounter.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.ruleCounter.name);
    taskFileColumnHeaders.ruleState.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.ruleState.name);
    taskFileColumnHeaders.ruleTaskName.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.ruleTaskName.name);
    taskFileColumnHeaders.ruleTaskId.pos = headerRow.findIndex((item) => item === taskFileColumnHeaders.ruleTaskId.name);

    // this.taskFileColumnHeaders = taskFileColumnHeaders;
    return taskFileColumnHeaders;
}

function getAppColumnPosFromHeaderRow(headerRow) {
    appFileColumnHeaders.appCounter.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.appCounter.name);
    appFileColumnHeaders.appName.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.appName.name);
    appFileColumnHeaders.qvfDirectory.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.qvfDirectory.name);
    appFileColumnHeaders.qvfName.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.qvfName.name);
    appFileColumnHeaders.excludeDataConnections.pos = headerRow.findIndex(
        (item) => item === appFileColumnHeaders.excludeDataConnections.name
    );
    appFileColumnHeaders.appTags.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.appTags.name);
    appFileColumnHeaders.appCustomProperties.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.appCustomProperties.name);
    appFileColumnHeaders.appOwnerUserDirectory.pos = headerRow.findIndex(
        (item) => item === appFileColumnHeaders.appOwnerUserDirectory.name
    );
    appFileColumnHeaders.appOwnerUserId.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.appOwnerUserId.name);
    appFileColumnHeaders.appPublishToStream.pos = headerRow.findIndex((item) => item === appFileColumnHeaders.appPublishToStream.name);
    appFileColumnHeaders.appPublishToStreamOption.pos = headerRow.findIndex(
        (item) => item === appFileColumnHeaders.appPublishToStreamOption.name
    );

    return appFileColumnHeaders;
}

module.exports = {
    mapDaylightSavingTime,
    mapEventType,
    mapIncrementOption,
    mapRuleState,
    mapTaskExecutionStatus,
    mapTaskType,
    taskFileColumnHeaders,
    getTaskColumnPosFromHeaderRow,
    getAppColumnPosFromHeaderRow,
};
