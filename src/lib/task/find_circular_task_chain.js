import { catchLog } from '../util/log.js';
import { mapTaskType, mapRuleState } from '../util/qseow/lookups.js';

/**
 * Recursively detect circular task chains starting from a given task node.
 * For the provided node, get all downstream nodes and associated edges, then recursively investigate each of those downstream nodes.
 * Examine the network top down, from current node to downstream node(s).
 *
 * @param {object} taskNetwork - Complete task network object with properties:
 * - nodes: An array of task nodes.
 * - edges: An array of task edges.
 * - tasks: An array of task objects.
 * @param {object} node - Task node object to start the search from.
 * @param {Set} visitedNodes - Set of node IDs that have been visited.
 * @param {object} logger - Logger object for logging information.
 *
 * @returns {Object} An object with properties:
 * - circularTaskChains: An array of objects representing circular task chains. Each object has properties:
 *   - fromTask: The source node where the circular dependency was detected.
 *   - toTask: The target node where the circular dependency was detected.
 *   - edge: The edge connecting the two tasks.
 * - duplicateEdges: An array of objects representing edges with multiple downstream nodes with the same ID
 *   and the same relationship with the parent node. I.e. duplicate composite triggers.
 *
 * Returns false if something went wrong.
 */
function recursiveFindCircularTaskChain(taskNetwork, node, visitedNodes, logger) {
    try {
        const circularTaskChains = [];
        const duplicateDownstreamNodes = [];

        // Get edges to downstream nodes. Downstream nodes are identified by node.id === edge.from.
        // The downstream node id is then found in edge.to.
        const edgesToDownstreamNodes = taskNetwork.edges.filter((edge) => {
            return edge.from === node.id;
        });

        // Any downstream edges found?
        if (edgesToDownstreamNodes?.length > 0) {
            // ----- Look for duplicate edges -----
            for (const edgeToDownstreamNode of edgesToDownstreamNodes) {
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
                        const currentNode = taskNetwork.nodes.find((el) => el.id === edgeToDownstreamNode.from);
                        const edgeDownstreamNode = taskNetwork.nodes.find((el) => el.id === tmp[0].to);

                        // Get the rule state that is shared between the downstream tasks and the parent task
                        const ruleState = mapRuleState.get(tmp[0].rule[0].ruleState);

                        duplicateDownstreamNodes.push({
                            parentNode: currentNode,
                            downstreamNode: edgeDownstreamNode,
                            ruleState: ruleState,
                            duplicateEdgeCount: tmp.length,
                        });

                        // Update edge in main task network to reflect that there are multiple downstream nodes with the same ID and the same relationship
                        taskNetwork.edges = taskNetwork.edges.map((el) => {
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
                        taskNetwork.edges = taskNetwork.edges.map((el) => {
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

            // ----- Look for circular dependencies -----

            // Make sure edges to downstream nodes are unique, i.e. remove duplicates.
            // Duplicates are identified by edgesToDownstreamNodes[].to properties being the same.
            const uniqueEdgesToDownstreamNodes = Array.from(new Set(edgesToDownstreamNodes.map((edge) => edge.to))).map((to) => {
                return edgesToDownstreamNodes.find((edge) => edge.to === to);
            });

            for (const edgeToDownstreamNode of uniqueEdgesToDownstreamNodes) {
                // Get downstream node
                const downstreamNode = taskNetwork.nodes.find((n) => n.id === edgeToDownstreamNode.to);

                // If the task network is correctly defined in nodes and edges, the downstream node should always be found.
                // If not, there is an error in the task network definition.
                if (downstreamNode === undefined) {
                    logger.error(`DOWNSTREAM NODE NOT FOUND: ${edgeToDownstreamNode.to}`);
                    continue;
                }

                // Check if the downstream node has been visited before.
                // If so, a circular dependency has been detected.
                if (visitedNodes.has(downstreamNode.id)) {
                    circularTaskChains.push({ fromTask: node, toTask: downstreamNode, edge: edgeToDownstreamNode });
                    return { circularTaskChains: circularTaskChains, duplicateEdges: duplicateDownstreamNodes };
                }

                // Add downstream node to visited nodes.
                visitedNodes.add(node.id);

                // Recursively investigate downstream node.
                const result = recursiveFindCircularTaskChain(taskNetwork, downstreamNode, visitedNodes, logger);

                // Remove downstream node from visited nodes.
                visitedNodes.delete(node.id);

                if (!result) {
                    logger.error('Error when looking for circular task chains in task model');
                    return false;
                }

                if (result.circularTaskChains.length > 0) {
                    circularTaskChains.push(...result.circularTaskChains);
                }

                if (result.duplicateEdges.length > 0) {
                    duplicateDownstreamNodes.push(...result.duplicateEdges);
                }
            }
        }

        return { circularTaskChains: circularTaskChains, duplicateEdges: duplicateDownstreamNodes };
    } catch (err) {
        catchLog('FIND CIRCULAR TASK CHAINS', err);
        return false;
    }
}

/**
 * Detect circular task chains within the task network.
 *
 * @param {object} taskNetwork - Task network object with properties:
 * - nodes: An array of task nodes.
 * - edges: An array of task edges.
 * - tasks: An array of task objects.
 * @param {object} logger - Logger object for logging information.
 * @returns {object} An object with properties:
 * - circularTaskChains: An array of objects representing circular task chains. Each object has properties:
 *   - fromTask: The source node where the circular dependency was detected.
 *   - toTask: The target node where the circular dependency was detected.
 *   - edge: The edge connecting the two tasks.
 * - duplicateEdges: An array of objects representing edges with multiple downstream nodes with the same ID
 *   and the same relationship with the parent node. I.e. duplicate composite triggers.
 *
 * Returns false if something went wrong.
 */
export function findCircularTaskChains(taskNetwork, logger) {
    const circularTaskChains = [];
    const duplicateEdges = [];

    try {
        // Get all root nodes in task network.
        // Root nodes are nodes meeting either of the following criteria:
        // - node's isTopLevelNode property is true.
        const rootNodes = taskNetwork.nodes.filter((node) => node.isTopLevelNode);

        if (!rootNodes) {
            logger.error('Could not find root nodes in task model');
            return false;
        }

        // Log number of root nodes found.
        logger.info(`Found ${rootNodes.length} root nodes in task model`);

        // For each root node, find circular task chains.
        // Add all found circular task chains to the circularTaskChains array
        for (const rootNode of rootNodes) {
            // Returns an object with properties:
            // - circularTaskChains: An array of zero of more objects describing circular task chains
            // - duplicateEdges: An array of zero or more objects describing duplicate edges
            //
            // Returns false if something went wrong.
            const result = recursiveFindCircularTaskChain(taskNetwork, rootNode, new Set(), logger);

            if (result) {
                circularTaskChains.push(...result.circularTaskChains);
                duplicateEdges.push(...result.duplicateEdges);
            } else {
                logger.error('Error when looking for circular task chains in task model');
                return false;
            }
        }

        return { circularTaskChains: circularTaskChains, duplicateEdges: duplicateEdges };
    } catch (err) {
        catchLog('FIND CIRCULAR TASK CHAINS', err);
        return false;
    }
}
