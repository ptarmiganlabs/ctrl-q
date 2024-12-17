import { getTagIdByName } from '../util/qseow/tag.js';
import { getCustomPropertyIdByName } from '../util/qseow/customproperties.js';

export async function extParseExternalProgramTask(_, options, logger) {
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
                const customPropertyId = getCustomPropertyIdByName('ExternalProgramTask', tmpCustomProperty[0], param.cpExisting);

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
        taskType: 'external program',
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
        taskType: 'external program',
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
