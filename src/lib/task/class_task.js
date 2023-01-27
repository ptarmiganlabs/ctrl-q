const { Duration } = require('luxon');
const { randomWords } = require('random-words');

const { logger } = require('../../globals');
const { mapTaskExecutionStatus } = require('../util/lookups');
const { getTagIdByName } = require('../util/tag');
const { getCustomPropertyIdByName } = require('../util/customproperties');

class QlikSenseTask {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(source, task, anonymizeTaskNames, options, fileCert, fileCertKey) {
        if (source.toLowerCase() === 'from_qseow') {
            // Data in the "task" parameter was loaded from a Qlik Sense (QSEoW) server
            this.sourceType = 'from_qseow';
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
            this.taskSessionTimeout = task.taskSessionTimeout;
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
            this.taskTags = task.tags;
            this.taskTagsFriendly = task.tags.map((tag) => tag.name);
            this.taskCustomProperties = task.customProperties;
            this.taskCustomPropertiesFriendly = task.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);

            if (task?.operational?.lastExecutionResult?.status) {
                this.taskLastStatus = mapTaskExecutionStatus.get(task?.operational?.lastExecutionResult?.status);
            } else {
                this.taskLastStatus = '?';
            }

            this.completeTaskObject = task;
            logger.debug(`Initialised task object from QSEoW: ${task}`);
        } else if (source.toLowerCase() === 'from_file') {
            // Data in the "task" parameter was loaded from a task definition file on disk
            this.sourceType = 'from_file';
            if (task.taskType === 0) {
                this.taskType = task.taskType;

                if (task.id) {
                    this.taskId = task.id;
                }
                this.taskName = task.name;
                this.taskEnabled = task.enabled;

                this.taskSessionTimeout = task.taskSessionTimeout;
                this.taskMaxRetries = task.maxRetries;
                this.isPartialReload = task.isPartialReload;
                this.isManuallyTriggered = task.isManuallyTriggered;

                this.appId = task.app.id;
                if (anonymizeTaskNames === true) {
                    this.taskName = randomWords({ min: 2, max: 5, join: ' ' });
                    if (task.app.name) {
                        this.appName = randomWords({ min: 2, max: 5, join: ' ' });
                    }
                } else {
                    this.taskName = task.name;
                    if (task.app.name) {
                        this.appName = task.app.name;
                    }
                }

                this.taskTags = task.tags;
                this.taskTagsFriendly = task.tags.map((tag) => tag.name);
                this.taskCustomProperties = task.customProperties;
                this.taskCustomPropertiesFriendly = task.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);

                this.schemaEvents = task.schemaEvents;
                this.compositeEvents = task.compositeEvents;

                this.completeTaskObject = task;
            }
            logger.debug(`Initialised task object from file: ${task}`);
        }
    }

    
}

module.exports = {
    QlikSenseTask,
};
