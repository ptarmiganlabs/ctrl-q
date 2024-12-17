import { v4 as uuidv4, validate } from 'uuid';

import { catchLog } from '../util/log.js';

export async function extGetTaskModelFromQseow(_, logger) {
    logger.debug('GET TASK: Getting task model from QSEoW');

    // Get all tasks from QSEoW
    try {
        logger.verbose(`Getting tasks from QSEoW...`);
        await _.getTasksFromQseow();
    } catch (err) {
        catchLog('GET TASK MODEL FROM QSEOW 1', err);
        return false;
    }

    // Get all schema events from QSEoW
    try {
        logger.verbose(`Getting schema events from QSEoW...`);
        const result1 = await _.qlikSenseSchemaEvents.getSchemaEventsFromQseow();

        logger.silly(`Schema events from QSEoW: ${JSON.stringify(result1, null, 2)}`);
    } catch (err) {
        catchLog('GET TASK MODEL FROM QSEOW 2', err);
        return false;
    }

    // Get all composite events from QSEoW
    try {
        logger.verbose(`Getting composite events from QSEoW...`);
        const result2 = await _.qlikSenseCompositeEvents.getCompositeEventsFromQseow();

        logger.silly(`Composite events from QSEoW: ${JSON.stringify(result2, null, 2)}`);
    } catch (err) {
        catchLog('GET TASK MODEL FROM QSEOW 3', err);
        return false;
    }

    logger.verbose('GET TASK MODEL FROM QSEOW: Done getting task model from QSEoW');

    // Get all top level apps, i.e apps that aren't triggered by any other apps succeeding or failing.
    // They might have scheduled triggers though.
    _.taskNetwork = { nodes: [], edges: [], tasks: [] };
    const nodesWithEvents = new Set();

    // We already have all tasks in plain, non-hierarchical format
    _.taskNetwork.tasks = _.taskList;

    // Add schema edges and start/trigger nodes
    logger.verbose('GET TASK MODEL FROM QSEOW: Adding schema edges and start/trigger nodes to internal task model');
    for (const schemaEvent of _.qlikSenseSchemaEvents.schemaEventList) {
        logger.silly(`Schema event contents: ${JSON.stringify(schemaEvent, null, 2)}`);
        // Schedule is associated with a reload task
        if (schemaEvent.schemaEvent.reloadTask !== null) {
            logger.debug(
                `Processing schema event "${schemaEvent?.schemaEvent?.name}" for reload task "${schemaEvent?.schemaEvent?.reloadTask?.name}" (${schemaEvent?.schemaEvent?.reloadTask?.id})`
            );

            // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
            const nodeId = `node-${uuidv4()}`;
            _.taskNetwork.nodes.push({
                id: nodeId,
                metaNodeType: 'schedule', // Meta nodes are not Sense tasks, but rather nodes representing task-like properties (e.g. a starting point for a reload chain)
                metaNode: true,
                isTopLevelNode: true,
                label: schemaEvent.schemaEvent.name,
                enabled: schemaEvent.schemaEvent.enabled,
                taskType: 'reloadTask',

                completeSchemaEvent: schemaEvent.schemaEvent,
            });

            _.taskNetwork.edges.push({
                from: nodeId,
                to: schemaEvent.schemaEvent.reloadTask.id,
            });

            // Keep a note that this node has associated events
            nodesWithEvents.add(schemaEvent.schemaEvent.reloadTask.id);
        } else if (schemaEvent.schemaEvent.externalProgramTask !== null) {
            // Schedule is associated with an external program task
            logger.debug(
                `Processing schema event "${schemaEvent?.schemaEvent?.name}" for external program task "${schemaEvent?.schemaEvent?.reloadTask?.name}" (${schemaEvent?.schemaEvent?.externalProgramTask?.id})`
            );

            // Add schema trigger nodes. These represent the implicit starting nodes that a schema event really are
            const nodeId = `node-${uuidv4()}`;
            _.taskNetwork.nodes.push({
                id: nodeId,
                metaNodeType: 'schedule', // Meta nodes are not Sense tasks, but rather nodes representing task-like properties (e.g. a starting point for a reload chain)
                metaNode: true,
                isTopLevelNode: true,
                label: schemaEvent.schemaEvent.name,
                enabled: schemaEvent.schemaEvent.enabled,
                taskType: 'externalProgramTask',

                completeSchemaEvent: schemaEvent.schemaEvent,
            });

            _.taskNetwork.edges.push({
                from: nodeId,
                to: schemaEvent.schemaEvent.externalProgramTask.id,
            });

            // Keep a note that this node has associated events
            nodesWithEvents.add(schemaEvent.schemaEvent.externalProgramTask.id);
        }
    }

    // Add composite events
    logger.verbose('GET TASK MODEL FROM QSEOW: Adding composite events to internal task model');
    for (const compositeEvent of _.qlikSenseCompositeEvents.compositeEventList) {
        logger.silly(`Composite event contents: ${JSON.stringify(compositeEvent, null, 2)}`);

        if (compositeEvent?.compositeEvent?.reloadTask) {
            logger.debug(
                `Processing composite event "${compositeEvent?.compositeEvent?.name}" for reload task "${compositeEvent?.compositeEvent?.reloadTask?.name}" (${compositeEvent?.compositeEvent?.reloadTask?.id})`
            );
        } else if (compositeEvent?.compositeEvent?.externalProgramTask) {
            logger.debug(
                `Processing composite event "${compositeEvent?.compositeEvent?.name}" for external program task "${compositeEvent?.compositeEvent?.externalProgramTask?.name}" (${compositeEvent?.compositeEvent?.externalProgramTask?.id})`
            );
        } else if (compositeEvent?.compositeEvent?.userSyncTask) {
            logger.debug(
                `Processing composite event "${compositeEvent?.compositeEvent?.name}" for user sync task "${compositeEvent?.compositeEvent?.userSyncTask?.name}" (${compositeEvent?.compositeEvent?.userSyncTask?.id})`
            );
        }

        if (compositeEvent.compositeEvent.reloadTask !== null) {
            // Current composite event triggers a reload task
            logger.debug(
                `Current composite event triggers a reload task. Processing composite event "${compositeEvent?.compositeEvent?.name}" for reload task "${compositeEvent?.compositeEvent?.reloadTask?.name}" (${compositeEvent?.compositeEvent?.reloadTask?.id})`
            );

            if (compositeEvent.compositeEvent.reloadTask.id === undefined || compositeEvent.compositeEvent.reloadTask.id === null) {
                logger.warn(`Composite event "${compositeEvent.compositeEvent.name}" has no reload task ID associated with it.`);
            } else if (compositeEvent.compositeEvent.compositeRules.length === 1) {
                // This trigger has exactly ONE upstream task
                // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish
                if (validate(compositeEvent.compositeEvent.compositeRules[0]?.reloadTask?.id)) {
                    logger.verbose(
                        `Composite event "${compositeEvent.compositeEvent.name}" has a reload task triggered by reload task with ID=${compositeEvent.compositeEvent.compositeRules[0].reloadTask.id}.`
                    );

                    _.taskNetwork.edges.push({
                        from: compositeEvent.compositeEvent.compositeRules[0].reloadTask.id,
                        fromTaskType: 'Reload',

                        to: compositeEvent.compositeEvent.reloadTask.id,
                        toTaskType: 'Reload',

                        completeCompositeEvent: compositeEvent.compositeEvent,
                        rule: compositeEvent.compositeEvent.compositeRules,
                        // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                        // color: edgeColor,
                        // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                        // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                        // label: compositeEvent.compositeEvent.name,
                    });

                    // Keep a note that this node has associated events
                    nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].reloadTask.id);
                    nodesWithEvents.add(compositeEvent.compositeEvent.reloadTask.id);
                } else if (validate(compositeEvent.compositeEvent.compositeRules[0]?.externalProgramTask?.id)) {
                    logger.verbose(
                        `Composite event "${compositeEvent?.compositeEvent?.name}" has a reload task triggered by external program task with ID=${compositeEvent.compositeEvent.compositeRules[0]?.externalProgramTask?.id}.`
                    );

                    _.taskNetwork.edges.push({
                        from: compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id,
                        fromTaskType: 'ExternalProgram',

                        to: compositeEvent.compositeEvent.reloadTask.id,
                        toTaskType: 'Reload',

                        completeCompositeEvent: compositeEvent.compositeEvent,
                        rule: compositeEvent.compositeEvent.compositeRules,
                        // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                        // color: edgeColor,
                        // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                        // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                        // label: compositeEvent.compositeEvent.name,
                    });

                    // Keep a note that this node has associated events
                    nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id);
                    nodesWithEvents.add(compositeEvent.compositeEvent.reloadTask.id);
                }
            } else {
                // There are more than one task involved in triggering a downstream task.
                // Insert a proxy node that represents a Qlik Sense composite event
                logger.verbose(
                    `Composite event "${compositeEvent?.compositeEvent?.name}" is triggerer by ${compositeEvent?.compositeEvent?.compositeRules.length} upstream tasks.`
                );

                // TODO
                const nodeId = `node-${uuidv4()}`;
                _.taskNetwork.nodes.push({
                    id: nodeId,
                    label: compositeEvent.compositeEvent.name,
                    enabled: true,
                    metaNodeType: 'composite',
                    metaNode: true,
                });
                nodesWithEvents.add(nodeId);

                // Add edges from upstream tasks to the new meta node
                for (const rule of compositeEvent.compositeEvent.compositeRules) {
                    if (validate(rule?.reloadTask?.id)) {
                        // Upstream task is a reload task
                        logger.debug(
                            `Composite event "${compositeEvent.compositeEvent.name}" is triggered by reload task with ID=${rule.reloadTask.id}.`
                        );

                        _.taskNetwork.edges.push({
                            from: rule.reloadTask.id,
                            fromTaskType: 'Reload',
                            to: nodeId,
                            toTaskType: 'Composite',

                            // TODO Correct? Or should it be at next edges.push?
                            completeCompositeEvent: compositeEvent.compositeEvent,
                            rule,
                        });
                    } else if (validate(rule?.externalProgramTask?.id)) {
                        // Upstream task is an external program task
                        logger.debug(
                            `Composite event "${compositeEvent.compositeEvent.name}" is triggered by external program task with ID=${rule.externalProgramTask.id}.`
                        );

                        _.taskNetwork.edges.push({
                            from: rule.externalProgramTask.id,
                            fromTaskType: 'ExternalProgram',
                            to: nodeId,
                            toTaskType: 'Composite',

                            // TODO Correct? Or should it be at next edges.push?
                            completeCompositeEvent: compositeEvent.compositeEvent,
                            rule,
                        });
                    } else {
                        logger.warn(
                            `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is not of a supported task type (reload task, external program task).`
                        );
                    }
                }

                // Add edge from new meta node to current node
                logger.debug(
                    `Added edge from composite event meta node "${nodeId}" to reload task ID=${compositeEvent.compositeEvent.reloadTask.id}.`
                );

                _.taskNetwork.edges.push({
                    from: nodeId,
                    to: compositeEvent.compositeEvent.reloadTask.id,
                });
            }
        } else if (compositeEvent.compositeEvent.externalProgramTask !== null) {
            // Current composite event triggers an external program task
            logger.debug(
                `Composite event "${compositeEvent.compositeEvent.name}" triggers an external program task "${compositeEvent.compositeEvent.externalProgramTask.name}" (${compositeEvent.compositeEvent.externalProgramTask.id}).`
            );

            if (
                compositeEvent.compositeEvent.externalProgramTask.id === undefined ||
                compositeEvent.compositeEvent.externalProgramTask.id === null
            ) {
                logger.warn(`Composite event "${compositeEvent.compositeEvent.name}" has no external program task ID associated with it.`);
            } else if (compositeEvent.compositeEvent.compositeRules.length === 1) {
                // This trigger has exactly ONE upstream task
                // For triggers with >1 upstream task we want an extra meta node to represent the waiting of all upstream tasks to finish
                logger.verbose(`Composite event "${compositeEvent.compositeEvent.name}" has exactly one upstream task.`);

                if (validate(compositeEvent.compositeEvent.compositeRules[0]?.reloadTask?.id)) {
                    logger.verbose(
                        `Composite event "${compositeEvent?.compositeEvent?.name}" has an external program task triggered by reload task with ID=${compositeEvent.compositeEvent.compositeRules[0]?.reloadTask?.id}.`
                    );

                    _.taskNetwork.edges.push({
                        from: compositeEvent.compositeEvent.compositeRules[0].reloadTask.id,
                        fromTaskType: 'Reload',

                        to: compositeEvent.compositeEvent.externalProgramTask.id,
                        toTaskType: 'ExternalProgram',

                        completeCompositeEvent: compositeEvent.compositeEvent,
                        rule: compositeEvent.compositeEvent.compositeRules,
                        // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                        // color: edgeColor,
                        // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                        // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                        // label: compositeEvent.compositeEvent.name,
                    });
                    // Keep a note that this node has associated events
                    nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].reloadTask.id);
                    nodesWithEvents.add(compositeEvent.compositeEvent.externalProgramTask.id);
                } else if (validate(compositeEvent.compositeEvent.compositeRules[0]?.externalProgramTask?.id)) {
                    logger.verbose(
                        `Composite event "${compositeEvent.compositeEvent.name}" has an external program task triggered by external program task with ID=${compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id}.`
                    );

                    _.taskNetwork.edges.push({
                        from: compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id,
                        fromTaskType: 'ExternalProgram',

                        to: compositeEvent.compositeEvent.externalProgramTask.id,
                        toTaskType: 'ExternalProgram',

                        completeCompositeEvent: compositeEvent.compositeEvent,
                        rule: compositeEvent.compositeEvent.compositeRules,
                        // color: compositeEvent.compositeEvent.enabled ? '#9FC2F7' : '#949298',
                        // color: edgeColor,
                        // dashes: compositeEvent.compositeEvent.enabled ? false : [15, 15],
                        // title: compositeEvent.compositeEvent.name + '<br>' + 'asdasd',
                        // label: compositeEvent.compositeEvent.name,
                    });

                    // Keep a note that this node has associated events
                    nodesWithEvents.add(compositeEvent.compositeEvent.compositeRules[0].externalProgramTask.id);
                    nodesWithEvents.add(compositeEvent.compositeEvent.externalProgramTask.id);
                } else {
                    logger.warn(`Composite event "${compositeEvent.compositeEvent.name}" is triggered by an unsupported task type.`);
                }
            } else {
                // There are more than one task involved in triggering a downstream task.
                // Insert a proxy node that represents a Qlik Sense composite event
                logger.verbose(
                    `Composite event "${compositeEvent?.compositeEvent?.name}" has ${compositeEvent?.compositeEvent?.compositeRules.length} upstream tasks.`
                );

                const nodeId = `node-${uuidv4()}`;
                _.taskNetwork.nodes.push({
                    id: nodeId,
                    label: compositeEvent.compositeEvent.name,
                    enabled: true,
                    metaNodeType: 'composite',
                    metaNode: true,
                });
                nodesWithEvents.add(nodeId);

                // Add edges from upstream tasks to the new meta node
                for (const rule of compositeEvent.compositeEvent.compositeRules) {
                    if (validate(rule?.reloadTask?.id)) {
                        // Upstream task is a reload task
                        logger.debug(
                            `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is a reload task with ID=${rule.reloadTask.id}.`
                        );

                        _.taskNetwork.edges.push({
                            from: rule.reloadTask.id,
                            fromTaskType: 'Reload',
                            to: nodeId,
                            toTaskType: 'Composite',

                            // TODO Correct? Or should it be at next edges.push?
                            completeCompositeEvent: compositeEvent.compositeEvent,
                            rule,
                        });
                    } else if (validate(rule?.externalProgramTask?.id)) {
                        // Upstream task is an external program task
                        logger.debug(
                            `Upstream task for composite event "${compositeEvent.compositeEvent.name}" is an external program task with ID=${rule.externalProgramTask.id}.`
                        );

                        _.taskNetwork.edges.push({
                            from: rule.externalProgramTask.id,
                            fromTaskType: 'ExternalProgram',
                            to: nodeId,
                            toTaskType: 'Composite',

                            // TODO Correct? Or should it be at next edges.push?
                            completeCompositeEvent: compositeEvent.compositeEvent,
                            rule,
                        });
                    } else {
                        logger.warn(
                            `Upstream task for composite event "${compositeEvent?.compositeEvent?.name}" is not of a supported task type (reload task, external program task).`
                        );
                    }
                }

                // Add edge from new meta node to current node
                logger.debug(
                    `Added edge from new meta composite event node "${nodeId}" to reload task ID=${compositeEvent.compositeEvent?.reloadTask?.id}.`
                );

                if (compositeEvent.compositeEvent?.reloadTask) {
                    _.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.compositeEvent.reloadTask.id,
                    });
                } else if (compositeEvent.compositeEvent?.externalProgramTask) {
                    _.taskNetwork.edges.push({
                        from: nodeId,
                        to: compositeEvent.compositeEvent.externalProgramTask.id,
                    });
                }
            }
        }
    }

    // Add all Sense tasks as nodes in task network
    // NB: A top level node is defined as:
    // 1. A task whose taskID does not show up in the "to" field of any edge.

    for (const node of _.taskList) {
        if (node.completeTaskObject.schemaPath === 'ReloadTask') {
            _.taskNetwork.nodes.push({
                id: node.taskId,
                metaNode: false,
                isTopLevelNode: !_.taskNetwork.edges.find((edge) => edge.to === node.taskId),
                label: node.taskName,
                enabled: node.taskEnabled,

                completeTaskObject: node.completeTaskObject,

                // Tabulator columns
                taskId: node.taskId,
                taskName: node.taskName,
                taskEnabled: node.taskEnabled,
                appId: node.appId,
                appName: node.appName,
                appPublished: node.appPublished,
                appStream: node.appStream,
                taskMaxRetries: node.taskMaxRetries,
                taskLastExecutionStartTimestamp: node.taskLastExecutionStartTimestamp,
                taskLastExecutionStopTimestamp: node.taskLastExecutionStopTimestamp,
                taskLastExecutionDuration: node.taskLastExecutionDuration,
                taskLastExecutionExecutingNodeName: node.taskLastExecutionExecutingNodeName,
                taskNextExecutionTimestamp: node.taskNextExecutionTimestamp,
                taskLastStatus: node.taskLastStatus,
                taskTags: node.completeTaskObject.tags.map((tag) => tag.name),
                taskCustomProperties: node.completeTaskObject.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
            });
        } else if (node.completeTaskObject.schemaPath === 'ExternalProgramTask') {
            _.taskNetwork.nodes.push({
                id: node.taskId,
                metaNode: false,
                isTopLevelNode: !_.taskNetwork.edges.find((edge) => edge.to === node.taskId),
                label: node.taskName,
                enabled: node.taskEnabled,

                completeTaskObject: node.completeTaskObject,

                // Tabulator columns
                taskId: node.taskId,
                taskName: node.taskName,
                taskEnabled: node.taskEnabled,

                path: node.path,
                parameters: node.parameters,
                taskMaxRetries: node.taskMaxRetries,
                taskLastExecutionStartTimestamp: node.taskLastExecutionStartTimestamp,
                taskLastExecutionStopTimestamp: node.taskLastExecutionStopTimestamp,
                taskLastExecutionDuration: node.taskLastExecutionDuration,
                taskLastExecutionExecutingNodeName: node.taskLastExecutionExecutingNodeName,
                taskNextExecutionTimestamp: node.taskNextExecutionTimestamp,
                taskLastStatus: node.taskLastStatus,
                taskTags: node.completeTaskObject.tags.map((tag) => tag.name),
                taskCustomProperties: node.completeTaskObject.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`),
            });
        }
    }
    return _.taskNetwork;
}
