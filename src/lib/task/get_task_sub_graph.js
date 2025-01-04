import { catchLog } from '../util/log.js';
import { mapTaskType, mapRuleState } from '../util/qseow/lookups.js';

/**
 * Function to get a subgraph of a task network/graph.
 *
 * @param {object} _ - QlikSenseTasks object. Corresponds to the 'this' keyword in a class.
 * @param {object} node - Node object
 * @param {number} parentTreeLevel - Tree level of the parent task. 0 = top level
 * @param {object} parentNode - Parent node object
 * @param {object} logger - Logger object
 *
 * @returns {object} Object with three properties: nodes, edges and tasks.
 * - nodes is an array of node objects in the subgraph
 * - edges is an array of edge objects in the subgraph
 * - tasks is an array of task objects in the subgraph
 */
export function extGetTaskSubGraph(_, node, parentTreeLevel, parentNode, logger) {
    try {
        if (!node || !node?.id) {
            logger.debug('Node parameter empty or does not include a node ID');
        }

        let subGraphNodes = [];
        let subGraphEdges = [];
        let subGraphTasks = [];

        // Were we called from top-level?
        if (parentTreeLevel === 0) {
            // Set up new data structure for detecting cicrular task chains
            _.taskCyclicStack = new Set();
        }

        const newTreeLevel = parentTreeLevel + 1;

        if (node.metaNode === true) {
            // Meta node (e.g. schedule, composite task)
            logger.debug(`GET TASK SUBGRAPH: Meta node type: ${node.metaNodeType}, tree level: ${newTreeLevel}, node id: ${node.id}`);

            // Add meta node to subGraphNodes
            subGraphNodes.push(node);
        } else {
            // Get task associated with node, using node/task ID as key (if it's a regular task node, not a meta node)
            const task = _.taskNetwork.tasks.find((el) => el.taskId === node.id);
            if (!task || task === undefined) {
                0;
                logger.warn(`Task not found for node ID: ${node.id}`);
            } else {
                subGraphNodes.push(node);
                subGraphTasks.push(task);
                // Not sure yet if we should add the edge to subGraphEdges, there may or may not be downstream node(s)
                // Thus wait until we know if there are downstream nodes before adding the edge
            }

            logger.debug(
                `GET TASK SUBGRAPH: Task type: ${mapTaskType.get(task.taskType)}, tree level: ${newTreeLevel}, task id: ${task.taskId}, task name: ${task.taskName}`
            );
        }

        // Does this node have any downstream connections?
        const edgesToDownstreamNodes = _.taskNetwork.edges.filter((edge) => edge.from === node.id);

        // Keep track of downstream nodes and their associated edge from the current node
        // Array of objects with properties
        // - sourceNode: Current node object
        // - downstreamNode: Downstream node object
        // - edge: Edge object between sourceNode and edgeDownstreamNode
        const validDownstreamNodes = [];
        for (const edgeToDownstreamNode of edgesToDownstreamNodes) {
            logger.debug(
                `GET TASK SUBGRAPH: Processing downstream node: ${edgeToDownstreamNode.to}. Current/source node: ${edgeToDownstreamNode.from}`
            );
            if (edgeToDownstreamNode.to !== undefined) {
                // Get downstream node object
                const downstreamNode = _.taskNetwork.nodes.find((el) => el.id === edgeToDownstreamNode.to);

                if (!downstreamNode) {
                    logger.warn(
                        `Downstream node "${edgeToDownstreamNode.to}" in task network not found. Current/source node: ${edgeToDownstreamNode.from}`
                    );
                } else {
                    // Keep track of this downstream node and the associated edge
                    validDownstreamNodes.push({ sourceNode: node, downstreamNode: downstreamNode, edge: edgeToDownstreamNode });

                    // Don't check for cyclic task relationships yet, as that could trigger if two or more sibling tasks are triggered from the same source task.
                }
            }
        }

        // Now that all downstream nodes have been retrieved, we can check if there are any general issues with those nodes.
        // Examples are cyclic task tree relationships, multiple downstream tasks with the same ID etc.

        // Check for downstream nodes with the same ID and same relationship with parent node (e.g. on-success or on-failure)
        // edgesToDownstreamNodes is an array of all downstream nodes from the current node. Properties are (the ones relevant here)
        // - from: Source node ID
        // - fromTaskType: Source node type. "Reload" or "ExternalProgram"
        // - to: Destination node ID
        // - toTaskType: Destination node type. "Reload", "ExternalProgram" or "Composite"
        // - rule: Array of rules for the relationship between source and destination node. "on-success", "on-failure" etc. Properties for each object are
        //   - id: Rule ID
        //   - ruleState: Rule state/type. 1 = TaskSuccessful, 2 = TaskFail. mapRuleState.get(ruleState) gives the string representation of the rule state, given the number.

        // Check if there are multiple downstream nodes with the same ID and same relationship with the parent node.
        // The relationship is the same if rule.ruleState is the same for two downstream nodes with the same ID.
        // If there are, log a warning.
        const duplicateDownstreamNodes = [];
        for (const edgeToDownstreamNode of edgesToDownstreamNodes) {
            // Are there any rules?
            // edgeToDownstreamNode.rule is an array of rules. Properties are
            // - id: Rule ID
            // - ruleState: Rule state/type. 1 = TaskSuccessful, 2 = TaskFail. mapRuleState.get(ruleState) gives the string representation of the rule state, given the number.
            if (edgeToDownstreamNode.rule) {
                // Filter out downstream nodes with the same ID and the same rule state
                const tmp = edgesToDownstreamNodes.filter((el) => {
                    const sameDest = el.to === edgeToDownstreamNode.to;

                    // Same rule state?
                    // el.rule can be either an array or an object. If it's an object, convert it to an array.
                    if (!Array.isArray(el.rule)) {
                        el.rule = [el.rule];
                    }

                    // Is one of the rule's ruleState properties the same as one or more of edgeToDownstreamNode.rule[].ruleState?
                    const sameRuleState = el.rule.some((rule) => {
                        return edgeToDownstreamNode.rule.some((rule2) => {
                            return rule.ruleState === rule2.ruleState;
                        });
                    });

                    return sameDest && sameRuleState;
                });

                if (tmp.length > 1) {
                    // Look up current and downstream node objects
                    const currentNode = _.taskNetwork.nodes.find((el) => el.id === edgeToDownstreamNode.from);
                    const edgeDownstreamNode = _.taskNetwork.nodes.find((el) => el.id === tmp[0].to);

                    // Get the rule state that is shared between the downstream tasks and the parent task
                    const ruleState = mapRuleState.get(tmp[0].rule[0].ruleState);

                    // Log warning unless this parent/child relationship is already in the list of duplicate downstream tasks
                    if (
                        !duplicateDownstreamNodes.some(
                            (el) => el[0].to === tmp[0].to && el[0].rule[0].ruleState === tmp[0].rule[0].ruleState
                        )
                    ) {
                        logger.warn(
                            `Multiple downstream nodes (${tmp.length}) with the same ID and the same trigger relationship "${ruleState}" with the parent node.`
                        );
                        logger.warn(`   Parent node     : ${currentNode.completeTaskObject.name}`);
                        logger.warn(`   Downstream node : ${edgeDownstreamNode.completeTaskObject.name}`);
                    }

                    duplicateDownstreamNodes.push(tmp);

                    // Update edge in main task network to reflect that there are multiple downstream nodes with the same ID and the same relationship
                    _.taskNetwork.edges = _.taskNetwork.edges.map((el) => {
                        if (el.from === edgeToDownstreamNode.from && el.to === edgeToDownstreamNode.to) {
                            return {
                                ...el,
                                edgeCount: tmp.length,
                            };
                        }
                        return el;
                    });
                } else {
                    // No duplicate downstream nodes
                    // Update edge in main task network to reflect that there are no multiple downstream nodes with the same ID and the same relationship
                    _.taskNetwork.edges = _.taskNetwork.edges.map((el) => {
                        if (el.from === edgeToDownstreamNode.from && el.to === edgeToDownstreamNode.to) {
                            return {
                                ...el,
                                edgeCount: 1,
                            };
                        }
                        return el;
                    });
                }
            }
        }

        // Check if there are any cyclic node relationships
        // If there are none, we can add the downstream node to the graph

        // First make sure all downstream node IDs are unique. Remove duplicates.
        const uniqueDownstreamNodes = Array.from(new Set(validDownstreamNodes.map((a) => a.downstreamNode.id))).map((id) => {
            return validDownstreamNodes.find((a) => a.downstreamNode.id === id);
        });

        for (const uniqueDownstreamNode of uniqueDownstreamNodes) {
            if (_.taskCyclicStack.has(uniqueDownstreamNode.downstreamNode.id)) {
                // Cyclic dependency detected
                if (parentNode) {
                    // Log verbose info
                    logger.info(`Cyclic dependency detected in task network. Won't go deeper.`);
                    logger.verbose(`   From task : [${uniqueDownstreamNode.sourceNode.id}] "${uniqueDownstreamNode.sourceNode.taskName}"`);
                    logger.verbose(
                        `   To task   : [${uniqueDownstreamNode.downstreamNode.id}] "${uniqueDownstreamNode.downstreamNode.taskName}"`
                    );

                    // Add edge, but don't add downstream node, and don't go deeper as this is a cyclic dependency
                    subGraphEdges.push(uniqueDownstreamNode.edge);
                } else {
                    // Log warning when there is no parent task (should not happen?)
                    logger.warn(`Cyclic dependency detected in task tree. No parent task detected. Won't go deeper.`);
                }
            } else {
                // No cyclic dependency detected

                // Add downstream node to stack
                // uniqueDownstreamNode is an object with properties
                // - sourceNode: Current node object
                // - downstreamNode: Downstream node object
                // - edge: Edge object between sourceNode and edgeDownstreamNode
                _.taskCyclicStack.add(uniqueDownstreamNode.downstreamNode.id);

                // // Add node to subGraphNodes
                // subGraphNodes.push(uniqueDownstreamNode.downstreamNode);

                // Add edge to downstream node to subGraphEdges
                subGraphEdges.push(uniqueDownstreamNode.edge);

                // // Add task to subGraphTasks
                // subGraphTasks.push(task);

                // Examine downstream node
                const tmp3 = extGetTaskSubGraph(_, uniqueDownstreamNode.downstreamNode, newTreeLevel, node, logger);

                // Remove downstream node from stack
                _.taskCyclicStack.delete(uniqueDownstreamNode.downstreamNode.id);

                // Add tmp3.nodes to subGraphNodes
                subGraphNodes = subGraphNodes.concat(...tmp3.nodes);

                // Add tmp3.edges to subGraphEdges
                subGraphEdges = subGraphEdges.concat(...tmp3.edges);

                // Add tmp3.tasks to subGraphTasks
                subGraphTasks = subGraphTasks.concat(...tmp3.tasks);
            }
        }

        // Update edges with information about how many instances of the same edge there are.
        // This has been temporarily stored in the main task network object's edges property.
        // Copy it over to the edges in the subgraphEdges array.
        subGraphEdges = subGraphEdges.map((el) => {
            const edgeCount = _.taskNetwork.edges.find((edge) => edge.from === el.from && edge.to === el.to).edgeCount;
            return {
                ...el,
                edgeCount: edgeCount,
            };
        });

        return {
            nodes: subGraphNodes,
            edges: subGraphEdges,
            tasks: subGraphTasks,
        };
    } catch (err) {
        catchLog('GET TASK SUBGRAPH', err);
        return false;
    }
}
