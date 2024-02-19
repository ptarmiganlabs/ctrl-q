import { Duration } from 'luxon';

// const { randomWords } = require('random-words');

import { logger } from '../../globals.js';

import { mapTaskExecutionStatus } from '../util/lookups.js';

// const randomWords2 = (...args) => import('random-words').then(({ default: randomWords }) => randomWords(...args));

class QlikSenseTask {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(source, task, anonymizeTaskNames, options, fileCert, fileCertKey) {
        // Dynamically import random-words to get arouond the fact it is import-only
        const randomWords = (await import('random-words')).default;

        if (source.toLowerCase() === 'from_qseow') {
            // Data in the "task" parameter was loaded from a Qlik Sense (QSEoW) server
            if (task.schemaPath === 'ReloadTask') {
                this.sourceType = 'from_qseow';

                if (task.id) {
                    this.taskId = task.id;
                }

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
                this.taskType = 0;
                logger.silly(`Initialised reload task object from QSEoW: ${JSON.stringify(task)}`);
            } else if (task.schemaPath === 'ExternalProgramTask') {
                this.sourceType = 'from_qseow';
                this.taskId = task.id;

                this.path = task.path;
                this.parameters = task.parameters;

                if (anonymizeTaskNames === true) {
                    this.taskName = randomWords({ min: 2, max: 5, join: ' ' });
                } else {
                    this.taskName = task.name;
                }
                this.taskEnabled = task.enabled;
                this.taskMaxRetries = task.maxRetries;
                this.taskSessionTimeout = task.taskSessionTimeout;

                this.taskLastExecutionStartTimestamp =
                    task?.operational?.lastExecutionResult?.startTime === '1753-01-01T00:00:00.000Z'
                        ? ''
                        : task?.operational?.lastExecutionResult?.startTime;
                this.taskLastExecutionStopTimestamp =
                    task?.operational?.lastExecutionResult?.stopTime === '1753-01-01T00:00:00.000Z'
                        ? ''
                        : task?.operational?.lastExecutionResult?.stopTime;
                this.taskLastExecutionDuration = Duration.fromMillis(task?.operational?.lastExecutionResult?.duration).toFormat('h:mm:ss');
                this.taskLastExecutionExecutingNodeName = task?.operational?.lastExecutionResult?.executingNodeName;
                this.taskNextExecutionTimestamp =
                    task?.operational?.nextExecution === '1753-01-01T00:00:00.000Z' ? '' : task?.operational?.nextExecution;

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
                this.taskType = 1;
                logger.silly(`Initialised external program task object from QSEoW: ${JSON.stringify(task)}`);
            }
        } else if (source.toLowerCase() === 'from_file') {
            // Data in the "task" parameter was loaded from a task definition file on disk
            if (task.schemaPath === 'ReloadTask') {
                this.sourceType = 'from_file';

                if (task.id) {
                    this.taskId = task.id;
                }

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

                this.taskEnabled = task.enabled;
                this.appId = task.app.id;
                this.appPublished = task.app.published;
                this.appStream = task.app.published ? task.app.stream.name : '';
                this.taskMaxRetries = task.maxRetries;
                this.taskSessionTimeout = task.taskSessionTimeout;
                this.isPartialReload = task.isPartialReload;
                this.isManuallyTriggered = task.isManuallyTriggered;

                this.taskTags = task.tags;
                this.taskTagsFriendly = task.tags.map((tag) => tag.name);
                this.taskCustomProperties = task.customProperties;
                this.taskCustomPropertiesFriendly = task.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);

                this.schemaEvents = task.schemaEvents;
                this.compositeEvents = task.compositeEvents;

                this.completeTaskObject = task;
                this.taskType = 0;
                logger.silly(`Initialised task object from file: ${JSON.stringify(task)}`);
            } else if (task.schemaPath === 'ExternalProgramTask') {
                this.sourceType = 'from_file';
                this.taskId = task.id;

                this.path = task.path;
                this.parameters = task.parameters;

                if (anonymizeTaskNames === true) {
                    this.taskName = randomWords({ min: 2, max: 5, join: ' ' });
                } else {
                    this.taskName = task.name;
                }
                this.taskEnabled = task.enabled;
                this.taskMaxRetries = task.maxRetries;
                this.taskSessionTimeout = task.taskSessionTimeout;

                this.taskTags = task.tags;
                this.taskTagsFriendly = task.tags.map((tag) => tag.name);
                this.taskCustomProperties = task.customProperties;
                this.taskCustomPropertiesFriendly = task.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);

                this.completeTaskObject = task;
                this.taskType = 1;
                logger.silly(`Initialised external program task object from file: ${JSON.stringify(task)}`);
            }
        }
    }
}

export default QlikSenseTask;
