const mapDaylightSavingTime = new Map([
    [0, 'ObserveDaylightSavingTime'],
    [1, 'PermanentStandardTime'],
    [2, 'PermanentDaylightSavingTime'],
]);

const mapEventType = new Map([
    [0, 'Schema'],
    [1, 'Composite'],
]);

const mapIncrementOption = new Map([
    [0, 'once'],
    [1, 'hourly'],
    [2, 'daily'],
    [3, 'weekly'],
    [4, 'monthly'],
    [5, 'custom'],
]);

const mapRuleState = new Map([
    [0, 'Undefined'],
    [1, 'TaskSuccessful'],
    [2, 'TaskFail'],
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
]);

const mapTaskType = new Map([
    [0, 'Reload'],
    [1, 'ExternalProgram'],
    [2, 'UserSync'],
    [3, 'Distribute'],
]);

module.exports = {
    mapDaylightSavingTime,
    mapEventType,
    mapIncrementOption,
    mapRuleState,
    mapTaskExecutionStatus,
    mapTaskType,
};
