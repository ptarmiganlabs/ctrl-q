export async function extParseCompositeEvents(_, param, logger) {
    // Get all composite events for this task
    //
    // Composite events
    // - Consists of one main row defining the event, followed by one or more rows defining the composite event rules.
    // - The main row is followed by one or more rows defining the composite event rules
    // - All rows associated with a composite event share the same value in the "Event counter" column
    // - Each composite event rule row has a unique value in the "Rule counter" column
    const prelCompositeEvents = [];

    // Get all "main rows" of all composite events in this task
    const compositeEventRows = param.taskRows.filter(
        (item) =>
            item[param.taskFileColumnHeaders.eventType.pos] &&
            item[param.taskFileColumnHeaders.eventType.pos].trim().toLowerCase() === 'composite'
    );
    if (!compositeEventRows || compositeEventRows?.length === 0) {
        logger.verbose(`(${param.taskCounter}) PARSE COMPOSITE EVENT: No composite events for task "${param.currentTask.name}"`);
    } else {
        logger.verbose(
            `(${param.taskCounter}) PARSE COMPOSITE EVENT: ${compositeEventRows.length} composite event(s) for task "${param.currentTask.name}"`
        );

        // Loop over all composite events, adding them and their event rules
        for (const compositeEventRow of compositeEventRows) {
            // Get value in "Event counter" column for this composite event, then get array of all associated event rules
            const compositeEventCounter = compositeEventRow[param.taskFileColumnHeaders.eventCounter.pos];
            const compositeEventRules = param.taskRows.filter(
                (item) =>
                    item[param.taskFileColumnHeaders.eventCounter.pos] === compositeEventCounter &&
                    item[param.taskFileColumnHeaders.ruleCounter.pos] > 0
            );

            // Create an object using same format that the Sense API uses for composite events
            // Add task type specific properties in later step
            const compositeEvent = {
                timeConstraint: {
                    days: compositeEventRow[param.taskFileColumnHeaders.timeConstraintDays.pos],
                    hours: compositeEventRow[param.taskFileColumnHeaders.timeConstraintHours.pos],
                    minutes: compositeEventRow[param.taskFileColumnHeaders.timeConstraintMinutes.pos],
                    seconds: compositeEventRow[param.taskFileColumnHeaders.timeConstraintSeconds.pos],
                },
                compositeRules: [],
                name: compositeEventRow[param.taskFileColumnHeaders.eventName.pos],
                enabled: compositeEventRow[param.taskFileColumnHeaders.eventEnabled.pos],
                eventType: mapEventType.get(compositeEventRow[param.taskFileColumnHeaders.eventType.pos]),
                schemaPath: 'CompositeEvent',
            };

            if (param.taskType === 'reload') {
                compositeEvent.reloadTask = {
                    id: param.fakeTaskId,
                };
            } else if (param.taskType === 'external program') {
                compositeEvent.externalProgramTask = {
                    id: param.fakeTaskId,
                };
            } else {
                logger.error(`(${param.taskCounter}) PARSE COMPOSITE EVENT: Incorrect task type "${param.taskType}". Exiting.`);
                process.exit(1);
            }

            // Add rules
            for (const rule of compositeEventRules) {
                // Does the upstream task pointed to by the composite rule exist?
                // If it *does* exist it means it's a real, existing task in QSEoW that should be used.
                // If it is not a valid guid or does not exist, it's (best case) a referefence to some other task in the task definitions file.
                // If the task pointed to by the rule doesn't exist in Sense and doesn't point to some other task in the file, an error should be shown.
                if (validate(rule[param.taskFileColumnHeaders.ruleTaskId.pos])) {
                    // The rule points to an valid UUID. It should exist, otherwise it's an error

                    const taskExists = await taskExistById(rule[param.taskFileColumnHeaders.ruleTaskId.pos], _.options);

                    if (taskExists) {
                        // Add task ID to mapping table that will be used later when building the composite event data structures
                        // In this case we're adding a task ID that maps to itself, indicating that it's a task that already exists in QSEoW.
                        _.taskIdMap.set(rule[param.taskFileColumnHeaders.ruleTaskId.pos], rule[param.taskFileColumnHeaders.ruleTaskId.pos]);
                    } else {
                        // The task pointed to by the composite event rule does not exist
                        logger.error(
                            `(${param.taskCounter}) PARSE COMPOSITE EVENT: Task "${
                                rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                            }" does not exist. Exiting.`
                        );
                        process.exit(1);
                    }
                } else {
                    logger.verbose(
                        `(${param.taskCounter}) PARSE COMPOSITE EVENT: "${
                            rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                        }" is not a valid UUID`
                    );
                }

                // Save composite event rule.
                // Also add the upstream task id to the correct property in the rule object, depending on task type

                let upstreamTask;
                let upstreamTaskExistence;
                // First get upstream task type
                // Two options:
                // 1. The rule's task ID is a valid GUID. Get the associated task's metadata from Sense, if the task exists
                // 2. The rule's task ID is not a valid GUID. It's a reference to a task that is created during this execution of Ctrl-Q.
                if (!validate(rule[param.taskFileColumnHeaders.ruleTaskId.pos])) {
                    // The rule's task ID is not a valid GUID. It's a reference to a task that is created during this execution of Ctrl-Q.
                    // Add the task ID to the mapping table, indicating that it's a task that is created during this execution of Ctrl-Q.

                    // // Check if the task ID already exists in the mapping table
                    // if (_.taskIdMap.has(rule[param.taskFileColumnHeaders.ruleTaskId.pos])) {
                    //     // The task ID already exists in the mapping table. This means that the task has already been created during this execution of Ctrl-Q.
                    //     // This is not allowed. The task ID must be unique.
                    //     logger.error(
                    //         `(${param.taskCounter}) PARSE TASKS FROM FILE: Task ID "${
                    //             rule[param.taskFileColumnHeaders.ruleTaskId.pos]
                    //         }" already exists in mapping table. This is not allowed. Exiting.`
                    //     );
                    //     process.exit(1);
                    // }

                    // // Add task ID to mapping table
                    // _.taskIdMap.set(rule[param.taskFileColumnHeaders.ruleTaskId.pos], `fake-task-${uuidv4()}`);

                    upstreamTaskExistence = 'exists-in-source-file';
                } else {
                    upstreamTask = await getTaskById(rule[param.taskFileColumnHeaders.ruleTaskId.pos], param?.options);

                    // Save upstream task in shared task list
                    _.compositeEventUpstreamTask.push(upstreamTask);

                    upstreamTaskExistence = 'exists-in-sense';
                }

                if (upstreamTaskExistence === 'exists-in-source-file') {
                    // Upstream task is a task that is created during this execution of Ctrl-Q
                    // We don't yet know what task ID it will get in Sense, so we'll have to find this when creating composite events later
                    compositeEvent.compositeRules.push({
                        upstreamTaskExistence,
                        ruleState: mapRuleState.get(rule[param.taskFileColumnHeaders.ruleState.pos]),
                        task: {
                            id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                        },
                    });
                } else if (mapTaskType.get(upstreamTask.taskType).toLowerCase() === 'reload') {
                    // Upstream task is a reload task
                    compositeEvent.compositeRules.push({
                        upstreamTaskExistence,
                        ruleState: mapRuleState.get(rule[param.taskFileColumnHeaders.ruleState.pos]),
                        task: {
                            id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                        },
                        reloadTask: {
                            id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                        },
                    });
                } else if (mapTaskType.get(upstreamTask.taskType).toLowerCase() === 'externalprogram') {
                    // Upstream task is an external program task
                    compositeEvent.compositeRules.push({
                        upstreamTaskExistence,
                        ruleState: mapRuleState.get(rule[param.taskFileColumnHeaders.ruleState.pos]),
                        task: {
                            id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                        },
                        externalProgramTask: {
                            id: rule[param.taskFileColumnHeaders.ruleTaskId.pos],
                        },
                    });
                }
            }

            _.qlikSenseCompositeEvents.addCompositeEvent(compositeEvent);

            // Add composite event to network representation of tasks
            if (compositeEvent.compositeRules.length === 1) {
                // This trigger has exactly ONE upstream task
                // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish

                if (param.taskType === 'reload') {
                    // Add edge from upstream task to current task, taking into account task type
                    _.taskNetwork.edges.push({
                        from: compositeEvent.compositeRules[0].task.id,
                        to: compositeEvent.reloadTask.id,

                        completeCompositeEvent: compositeEvent,
                        rule: compositeEvent.compositeRules,
                        // color: compositeEvent.enabled ? '#9FC2F7' : '#949298',
                        // color: edgeColor,
                        // dashes: compositeEvent.enabled ? false : [15, 15],
                        // title: compositeEvent.name + '<br>' + 'asdasd',
                        // label: compositeEvent.name,
                    });

                    // Keep a note that this node has associated events
                    param.nodesWithEvents.add(compositeEvent.compositeRules[0].task.id);
                    param.nodesWithEvents.add(compositeEvent.reloadTask.id);
                } else if (param.taskType === 'external program') {
                    // Add edge from upstream task to current task, taking into account task type
                    _.taskNetwork.edges.push({
                        from: compositeEvent.compositeRules[0].task.id,
                        to: compositeEvent.externalProgramTask.id,

                        completeCompositeEvent: compositeEvent,
                        rule: compositeEvent.compositeRules,
                    });
                    // Keep a note that this node has associated events
                    param.nodesWithEvents.add(compositeEvent.compositeRules[0].task.id);
                    param.nodesWithEvents.add(compositeEvent.externalProgramTask.id);
                }
            } else {
                // There are more than one task involved in triggering a downstream task.
                // Insert a proxy node that represents a Qlik Sense composite event

                const nodeId = `composite-event-${uuidv4()}`;
                _.taskNetwork.nodes.push({
                    id: nodeId,
                    label: '',
                    enabled: true,
                    metaNodeType: 'composite',
                    metaNode: true,
                });
                param.nodesWithEvents.add(nodeId);

                // Add edges from upstream tasks to the new meta node
                for (const rule of compositeEvent.compositeRules) {
                    _.taskNetwork.edges.push({
                        from: rule.task.id,
                        to: nodeId,

                        completeCompositeEvent: compositeEvent,
                        rule,
                    });
                }

                // Add edge from new meta node to current node, taking into account task type
                if (param.taskType === 'reload') {
                    _.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.reloadTask.id,
                    });
                } else if (param.taskType === 'external program') {
                    _.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.externalProgramTask.id,
                    });
                }
            }

            // Add this composite event to the current task
            prelCompositeEvents.push(compositeEvent);
        }
    }

    return prelCompositeEvents;
}
