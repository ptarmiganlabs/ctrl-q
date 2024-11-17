import yesno from 'yesno';
import { logger } from '../../../globals.js';
import { getCustomProperty, getTasksFromQseow, updateReloadTask } from '../../task/task_qrs.js';
import { catchLog } from '../../util/log.js';

const updateTask = async (options, customPropertyDef, task) =>
    new Promise(async (resolve, reject) => {
        logger.info(`Starting updating custom property "${options.customPropertyName}" of task "${task.name}" with ID=${task.id}`);

        const newPayload = {
            task: {
                id: task.id,
                createdDate: task.createdDate,
                modifiedDate: task.modifiedDate,
                modifiedByUserName: task.modifiedByUserName,
                customProperties: task?.customProperties.map((item) => ({
                    definition: { id: item.definition.id, name: item.definition.name },
                    value: item.value,
                })),
                app: task.app,
                isManuallyTriggered: task.isManuallyTriggered,
                operational: task.operational,
                isPartialReload: task.isPartialReload,
                name: task.name,
                taskType: task.taskType,
                enabled: task.enabled,
                taskSessionTimeout: task.taskSessionTimeout,
                maxRetries: task.maxRetries,
                tags: task.tags,
                privileges: task.privileges,
                schemaPath: task.schemaPath,
            },
            compositeEventsToDelete: [],
            schemaEventsToDelete: [],
            compositeEvents: [],
            schemaEvents: [],
        };

        // Does the task already have values in the CP that is to be updated?
        if (task.customProperties.find((item) => item.definition.name === options.customPropertyName)) {
            // Custom property already exists/is set to some value for this task

            // Should new values be replacing or appended to existing values?
            if (options.updateMode === 'append') {
                for (const newCpValue of options.customPropertyValue) {
                    // Don't append a value if it's already set for the custom property
                    if (!newPayload.task?.customProperties?.find((item) => item.value === newCpValue))
                        newPayload.task?.customProperties?.push({
                            definition: { id: customPropertyDef[0].id, name: customPropertyDef[0].name },
                            value: newCpValue,
                        });
                }
            } else if (options.updateMode === 'replace') {
                // First copy all existing CP values that should not be replaced to the new payload
                const cp = newPayload.task?.customProperties.filter(
                    (existingCustomProperty) => existingCustomProperty.definition.name !== options.customPropertyName
                );
                newPayload.task.customProperties = cp;

                // Now add the new CP values
                for (const newCpValue of options.customPropertyValue) {
                    newPayload.task?.customProperties?.push({
                        definition: { id: customPropertyDef[0].id, name: customPropertyDef[0].name },
                        value: newCpValue,
                    });
                }
            }

            let updateResult = false;

            // Update task
            if (!options.overwrite) {
                let ok;
                logger.info();
                if (options.updateMode === 'replace') {
                    ok = await yesno({
                        question: `                               Replace current values in custom property "${options.customPropertyName}" with new ones? (y/n)`,
                    });
                } else if (options.updateMode === 'append') {
                    ok = await yesno({
                        question: `                               Append new values to custom property "${options.customPropertyName}"? (y/n)`,
                    });
                }
                logger.info();

                if (ok === true) {
                    // Yes, write CP values to QRS
                    logger.debug(`SET RELOAD TASK CP: Update payload for task ${task.id}: ${JSON.stringify(newPayload, null, 2)}`);

                    if (options.dryRun === undefined || options.dryRun === false) {
                        updateResult = await updateReloadTask(options, newPayload);
                    } else {
                        logger.info(`DRY RUN: Update of task custom property ${task.customPropertyName} would happen here.`);
                    }
                } else {
                    logger.info(`Did not update task "${task.name}"`);
                }
            } else if (options.dryRun === undefined || options.dryRun === false) {
                updateResult = await updateReloadTask(options, newPayload);
            } else {
                logger.info(`DRY RUN: Update of task custom property ${task.customPropertyName} would happen here.`);
            }

            if (updateResult) {
                logger.info(`   ...Custom property "${options.customPropertyName}" on task "${task.name}" successfully updated.`);
                resolve();
                return;
            }
            if (options.dryRun) {
                resolve();
                return;
            }

            logger.error(`   ...Custom property "${options.customPropertyName}" on task "${task.name}" could not be updated.`);
            reject();
        } else {
            // Custom property does NOT already have the custom property set for this task.

            // Add CP values to task
            for (const newCpValue of options.customPropertyValue) {
                newPayload.task?.customProperties?.push({
                    definition: { id: customPropertyDef[0].id, name: customPropertyDef[0].name },
                    value: newCpValue,
                });
            }

            // Update task
            logger.debug(`SET RELOAD TASK CP: Update payload for task ${task.id}: ${JSON.stringify(newPayload, null, 2)}`);
            const updateResult = await updateReloadTask(options, newPayload);

            if (updateResult) {
                logger.info(`   ...Custom property "${options.customPropertyName}" on task "${task.name}" successfully updated.`);
                resolve();
                return;
            }
            logger.error(`   ...Custom property "${options.customPropertyName}" on task "${task.name}" could not be updated.`);
            reject();
        }
    });

export async function setTaskCustomProperty(options) {
    try {
        // == Meta code ==
        // - Get definition for the custom property that should be updated
        // - Assert
        //   - Does the specified CP exist for reload tasks?
        //   - Are the specified CP values valid, i.e. are they defined for the CP in question?
        // - Get list of all tasks that should be updated
        //   - Tasks specified by zero or more task IDs
        //   - Tasks specified by zero or more task tags
        // - Loop over all tasks
        //   - Does the task already have values in the specified CP?
        //     - No: Build new payload and write to QRS API. Take --update-mode into account (can be append or replace)
        //     - Yes: Is --overwrite specified?
        //       - No: Skip update and log warning
        //       - Yes: Build new payload and write to QRS API.

        // Get custom property definition
        const customPropertyDef = await getCustomProperty(options);
        if (!customPropertyDef) {
            logger.error(`Can't find custom property "${options.customPropertyName}". Exiting.`);
            process.exit(1);
        }

        // Ensure the provided custom property exists for reload tasks
        if (!customPropertyDef[0]?.objectTypes.find((item) => item === 'ReloadTask')) {
            logger.error(`Custom property "${options.customPropertyName}" is not configured to be used with reload tasks. Exiting.`);
            process.exit(1);
        }

        // Ensure that the new CP values are among the CP's choiceValues
        for (const newCPValue of options.customPropertyValue) {
            if (!customPropertyDef[0].choiceValues.find((item) => item === newCPValue)) {
                // An invalud custom property value detected
                logger.error(`Value "${newCPValue}" is not valid for custom property "${options.customPropertyName}". Exiting.`);
                process.exit(1);
            }
        }

        // Get tasks
        const taskList = await getTasksFromQseow(options);

        if (taskList === undefined) {
            logger.error(`No details for specified tasks found in Qlik Sense`);
        } else {
            // Log which tasks will be processed
            logger.info(`Number of tasks that will be updated: ${taskList.length}`);

            for (const task of taskList) {
                logger.info(``);
                logger.info(`-----------------------------------------------------------`);
                logger.info(`Processing task "${task.name}" with ID=${task.id}`);

                const res = await updateTask(options, customPropertyDef, task);
                logger.debug(`Custom property update result: ${res}`);
            }

            return true;
        }
    } catch (err) {
        catchLog(`SET RELOAD TASK CP`, err);
        return false;
    }
}
