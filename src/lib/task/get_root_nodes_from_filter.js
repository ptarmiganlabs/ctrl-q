export async function extGetRootNodesFromFilter(_, logger) {
    // Ensure task network and options are available
    if (!_.taskNetwork) {
        logger.error('getRootNodesFromFilter: Task network not available. Exiting.');
        return false;
    }

    if (!_.options) {
        logger.error('getRootNodesFromFilter: Options not available. Exiting.');
        return false;
    }

    let rootNodes = [];
    const nodesToVisualize = [];

    // Helper function to find root nodes with circular dependency detection
    function findRootNodesWithCircularCheck(node, visitedNodes = new Set()) {
        if (visitedNodes.has(node.id)) {
            logger.verbose(`Circular dependency detected when looking for root nodes: [${node.id}] "${node.taskName}"`);
            return [];
        }
        visitedNodes.add(node.id);
        return _.findRootNodes(node, visitedNodes);
    }

    // Start by checking if any task id filters are specified
    if (_.options.taskId) {
        // _.options.taskId is an array of task ids
        // Get all matching tasks in task model
        logger.verbose(`Task id filters specified: ${_.options.taskId}`);

        const nodesFiltered = _.taskNetwork.nodes.filter((node) => {
            if (_.options.taskId.includes(node.id)) {
                return true;
            } else {
                return false;
            }
        });

        // Method:
        // 1. For each node in nodesFiltered, find its root node.
        try {
            // Did task filters result in any actual tasks/nodes?
            if (nodesFiltered.length > 0) {
                for (const node of nodesFiltered) {
                    // node can be isolated, i.e. not part of a chain, or part of a chain
                    // If isolated, it is by definition a root node
                    // If part of a chain, it may or may not be a root node

                    // Method to find root node:
                    // 1. Check if node is a top level/root node. isTopLevelNode property is true for root nodes.
                    // 2. Check if node has any upstream nodes.
                    //    1. Recursively investigate upstream nodes until a root node is found.
                    // 3. Save all found root nodes.

                    // Is the node a root node?
                    if (node.isTopLevelNode) {
                        // Add the node to rootNodes
                        rootNodes.push(node);
                    } else {
                        const tmpRootNodes = findRootNodesWithCircularCheck(node);
                        rootNodes.push(...tmpRootNodes);
                    }
                }

                // Set nodesToVisualize to root nodes
                nodesToVisualize.push(...rootNodes);

                logger.verbose(`Found ${rootNodes.length} root nodes in task model via task id filter`);
                // Log root node type, id and if available name
                rootNodes.forEach((node) => {
                    if (node.taskName) {
                        logger.debug(`Root task: [${node.id}] - "${node.taskName}"`);
                    } else if (node.metaNodeType) {
                        logger.debug(`Root meta task: [${node.id}] - "${node.metaNodeType}"`);
                    }
                });
            } else {
                logger.warn('No tasks found matching the specified task id(s)/tag(s). Exiting.');
                return false;
            }
        } catch (error) {
            console.error(error);
            console.error('Error in parseTree()');
        }
    }

    // Any task tag filters specified?
    if (_.options.taskTag) {
        // Get all matching tasks in task model
        logger.verbose(`Task tag filters specified: ${_.options.taskTag}`);

        rootNodes = []; // Reset rootNodes array

        const nodesFiltered = _.taskNetwork.nodes.filter((node) => {
            // Are there any tags in this node?
            if (!node.taskTags) {
                return false;
            }

            if (node.taskTags.some((tag) => _.options.taskTag.includes(tag))) {
                return true;
            } else {
                return false;
            }
        });

        // Method:
        // 1. For each node in nodesFiltered, find its root node.
        try {
            // Did task filters result in any actual tasks/nodes?
            if (nodesFiltered.length > 0) {
                for (const node of nodesFiltered) {
                    // node can be isolated, i.e. not part of a chain, or part of a chain
                    // If isolated, it is by definition a root node
                    // If part of a chain, it may or may not be a root node

                    // Method to find root node:
                    // 1. Check if node is a top level/root node. isTopLevelNode property is true for root nodes.
                    // 2. Check if node has any upstream nodes.
                    //    1. Recursively investigate upstream nodes until a root node is found.
                    // 3. Save all found root nodes.

                    // Is the node a root node?
                    if (node.isTopLevelNode) {
                        // Add the node to rootNodes
                        rootNodes.push(node);
                    } else {
                        const tmpRootNodes = findRootNodesWithCircularCheck(node);
                        rootNodes.push(...tmpRootNodes);
                    }
                }

                logger.verbose(`Found ${rootNodes.length} root nodes in task model via task tag filter`);
                // Log root node type, id and if available name
                rootNodes.forEach((node) => {
                    if (node.taskName) {
                        logger.debug(`Root task: [${node.id}] - "${node.taskName}"`);
                    } else if (node.metaNodeType) {
                        logger.debug(`Root meta task: [${node.id}] - "${node.metaNodeType}"`);
                    }
                });
            } else {
                logger.warn('No tasks found matching the specified task id(s)/tag(s). Exiting.');
                return false;
            }
        } catch (error) {
            console.error(error);
            console.error('Error in parseTree()');
        }
    }

    // De-duplicate root nodes
    rootNodes = rootNodes.filter((node, index, self) => {
        return index === self.findIndex((t) => t.id === node.id);
    });

    logger.debug(`getRootNodesFromFilter done.`);
    return rootNodes;
}
