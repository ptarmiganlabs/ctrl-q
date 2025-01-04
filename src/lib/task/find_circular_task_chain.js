import { catchLog } from '../util/log.js';

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
 * @returns {Array} An array of objects, each with properties (which are all objects):
 * - fromTask: The source node where the circular dependency was detected.
 * - toTask: The target node where the circular dependency was detected.
 * - edge: The edge connecting the two tasks.
 *
 * Returns false if something went wrong.
 */
function recursiveFindCircularTaskChain(taskNetwork, node, visitedNodes, logger) {
    try {
        const circularTaskChain = [];

        // Get downstream nodes. Downstream nodes are identified by node.id === edge.from.
        // The downstream node id is then found in edge.to.
        const downstreamEdges = taskNetwork.edges.filter((edge) => {
            return edge.from === node.id;
        });

        // Any downstream edges found?
        if (downstreamEdges?.length > 0) {
            for (const downstreamEdge of downstreamEdges) {
                // Get downstream node
                const downstreamNode = taskNetwork.nodes.find((n) => n.id === downstreamEdge.to);
                // If the task network is correctly defined in nodes and edges, the downstream node should always be found.
                // If not, there is an error in the task network definition.
                if (downstreamNode === undefined) {
                    logger.error(`DOWNSTREAM NODE NOT FOUND: ${downstreamEdge.to}`);
                    continue;
                }

                // Check if the downstream node has been visited before.
                // If so, a circular dependency has been detected.
                if (visitedNodes.has(downstreamNode.id)) {
                    circularTaskChain.push({ fromTask: node, toTask: downstreamNode, edge: downstreamEdge });
                    return circularTaskChain;
                }

                // Add downstream node to visited nodes.
                // visitedNodes.add(downstreamNode.id);
                visitedNodes.add(node.id);

                // Recursively investigate downstream node.
                const result = recursiveFindCircularTaskChain(taskNetwork, downstreamNode, visitedNodes, logger);

                if (result?.length > 0) {
                    circularTaskChain.push(...result);
                }
            }
        }

        return circularTaskChain;
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
 * @returns {Array} An array of objects representing circular task chains, each with properties:
 * - fromTask: The source node where the circular dependency was detected.
 * - toTask: The target node where the circular dependency was detected.
 * - edge: The edge connecting the two tasks.
 *
 * Returns false if something went wrong.
 */
export function findCircularTaskChains(taskNetwork, logger) {
    const circularTaskChains = [];

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
            // Returns array of zero of more objects describing circular task chains, or false if something went wrong.
            const result = recursiveFindCircularTaskChain(taskNetwork, rootNode, new Set(), logger);

            if (result) {
                circularTaskChains.push(...result);
            } else {
                logger.error('Error when looking for circular task chains in task model');
                return false;
            }
        }

        return circularTaskChains;
    } catch (err) {
        catchLog('FIND CIRCULAR TASK CHAINS', err);
        return false;
    }

    return circularTaskChains;
}
