export function extSaveTaskModelToQseow(_, options, logger) {
    return new Promise(async (resolve, reject) => {
        try {
            logger.debug('SAVE TASKS TO QSEOW: Starting save tasks to QSEoW');

            for (const task of this.taskList) {
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
                    const axiosConfig = setupQrsConnection(options, {
                        method: 'post',
                        path: '/qrs/reloadtask/create',
                        body,
                    });

                    try {
                        axios.request(axiosConfig).then((result) => {
                            logger.info(`SAVE TASK TO QSEOW: Task name: "${task.taskName}", Result: ${result.status}/${result.statusText}`);
                            if (result.status === 201) {
                                resolve2();
                            } else {
                                reject2();
                            }
                        });
                    } catch (err) {
                        catchLog('SAVE TASK TO QSEOW 1', err);
                        reject2();
                    }
                });
                logger.debug(`SAVE TASK TO QSEOW: Done saving task "${task.taskName}"`);
            }
            resolve();
        } catch (err) {
            catchLog('SAVE TASK TO QSEOW 2', err);
            reject(err);
        }
    });
}
