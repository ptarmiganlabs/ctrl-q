const { Duration } = require('luxon');
const { randomWords } = require('random-words');

const { logger } = require('../../globals');
const { mapTaskExecutionStatus } = require('../util/lookups');

function getSchemaText(incrementOption, incrementDescription) {
    let schemaText = '';

    /**
     * IncrementOption:
        "0: once",
        "1: hourly",
            incrementDescription: Repeat after each 'minutes hours 0 0 '
        "2: daily",
            incrementDescription: Repeat after each '0 0 days 0 '
        "3: weekly",
        "4: monthly" 
     */

    if (incrementOption == 0) {
        schemaText = 'Once';
    } else if (incrementOption == 1) {
        schemaText = 'Hourly';
    } else if (incrementOption == 2) {
        schemaText = 'Daily';
    } else if (incrementOption == 3) {
        schemaText = 'Weekly';
    } else if (incrementOption == 4) {
        schemaText = 'Monthly';
    }

    return schemaText;
}

class QlikSenseTask {
    constructor(task, anonymizeTaskNames) {
        this.taskId = task.id;

        if (anonymizeTaskNames === true) {
            this.taskName = randomWords({ min: 2, max: 5, join: ' ' });
            this.appName = randomWords({ min: 2, max: 5, join: ' ' });
        } else {
            this.taskName = task.name;
            this.appName = task.app.name;
        }
        this.taskEnabled = task.enabled;
        this.appId = task.app.id;
        this.appPublished = task.app.published;
        this.appStream = task.app.published ? task.app.stream.name : '';
        this.taskMaxRetries = task.maxRetries;
        this.taskTimeout = task.taskSessionTimeout;
        this.isPartialReload = task.isPartialReload;
        this.isManuallyTriggered = task.isManuallyTriggered;
        this.taskLastExecutionStartTimestamp =
            task.operational.lastExecutionResult.startTime === '1753-01-01T00:00:00.000Z'
                ? ''
                : task.operational.lastExecutionResult.startTime;
        this.taskLastExecutionStopTimestamp =
            task.operational.lastExecutionResult.stopTime === '1753-01-01T00:00:00.000Z'
                ? ''
                : task.operational.lastExecutionResult.stopTime;
        this.taskLastExecutionDuration = Duration.fromMillis(task.operational.lastExecutionResult.duration).toFormat('h:mm:ss');
        this.taskLastExecutionExecutingNodeName = task.operational.lastExecutionResult.executingNodeName;
        this.taskNextExecutionTimestamp =
            task.operational.nextExecution === '1753-01-01T00:00:00.000Z' ? '' : task.operational.nextExecution;
        this.taskTags = task.tags.map((tag) => tag.name);
        this.taskCustomProperties = task.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);

        if (task?.operational?.lastExecutionResult?.status) {
            this.taskLastStatus = mapTaskExecutionStatus.get(task?.operational?.lastExecutionResult?.status);
        } else {
            this.taskLastStatus = '?';
        }

        this.completeTaskObject = task;
    }

    // Getter method

    // Other methods
}

module.exports = {
    QlikSenseTask,
};
