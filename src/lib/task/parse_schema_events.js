import { mapIncrementOption, mapEventType, mapDaylightSavingTime } from '../util/qseow/lookups.js';

export function extParseSchemaEvents(_, param, logger) {
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

            _.qlikSenseSchemaEvents.addSchemaEvent(schemaEvent);

            // Add schema event to network representation of tasks
            // Create an id for this node
            const nodeId = `schema-event-${uuidv4()}`;

            // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
            _.taskNetwork.nodes.push({
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
                _.taskNetwork.edges.push({
                    from: nodeId,
                    to: schemaEvent.reloadTask.id,
                });

                // Keep a note that this node has associated events
                param.nodesWithEvents.add(schemaEvent.reloadTask.id);

                // Remove reference to task ID
                delete schemaEvent.reloadTask.id;
                delete schemaEvent.reloadTask;
            } else if (param.taskType === 'external program') {
                _.taskNetwork.edges.push({
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
