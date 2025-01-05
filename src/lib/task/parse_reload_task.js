import { validate } from 'uuid';

import { getTagIdByName } from '../util/qseow/tag.js';
import { getAppById } from '../util/qseow/app.js';
import { getCustomPropertyIdByName } from '../util/qseow/customproperties.js';
import { mapTaskType } from '../util/qseow/lookups.js';

export async function extParseReloadTask(_, param, logger) {
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
        if (!_.importedApps) {
            logger.error(
                `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: No apps have been imported, but app "${param.taskRows[0][
                    param.taskFileColumnHeaders.appId.pos
                ].trim()}" has been specified in the task definition file. Exiting.`
            );
            process.exit(1);
        }

        // Has this specific app been imported?
        if (!_.importedApps.appIdMap.has(appIdRaw.toLowerCase())) {
            logger.error(
                `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: App "${param.taskRows[0][
                    param.taskFileColumnHeaders.appId.pos
                ].trim()}" has not been imported, but has been specified in the task definition file. Exiting.`
            );
            process.exit(1);
        }

        appId = _.importedApps.appIdMap.get(appIdRaw.toLowerCase());

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

        const app = await getAppById(appId, param?.options);

        if (!app) {
            logger.error(
                `(${param.taskCounter}) PARSE RELOAD TASK FROM FILE: App with ID "${appId}" not found. This could be because the app was imported but has since been deleted or replaced, for example during app publishing. Don't know how to proceed, exiting.`
            );
            process.exit(1);
        }
    } else if (validate(appIdRaw)) {
        // App ID is a proper UUID. We don't know if the app actually exists though.

        const app = await getAppById(appIdRaw, param?.options);

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

        for (const item of tmpTags) {
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

        for (const item of tmpCustomProperties) {
            const tmpCustomProperty = item
                .split('=')
                .filter((item2) => item2.trim().length !== 0)
                .map((cp) => cp.trim());

            // Do we have two items in the array? First is the custom property name, second is the value
            if (tmpCustomProperty?.length === 2) {
                const customPropertyId = getCustomPropertyIdByName('ReloadTask', tmpCustomProperty[0], param.cpExisting);

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
    currentTask.schemaEvents = _.parseSchemaEvents({
        taskType: 'reload',
        taskRows: param.taskRows,
        taskFileColumnHeaders: param.taskFileColumnHeaders,
        taskCounter: param.taskCounter,
        currentTask,
        fakeTaskId: param.fakeTaskId,
        nodesWithEvents: param.nodesWithEvents,
        options: param?.options,
    });

    // Get composite events for this task
    currentTask.prelCompositeEvents = await _.parseCompositeEvents({
        taskType: 'reload',
        taskRows: param.taskRows,
        taskFileColumnHeaders: param.taskFileColumnHeaders,
        taskCounter: param.taskCounter,
        currentTask,
        fakeTaskId: param.fakeTaskId,
        nodesWithEvents: param.nodesWithEvents,
        options: param?.options,
    });

    return { currentTask, taskCreationOption };
}
