export function extFindRootNodes(_, node, logger, visitedNodes = new Set()) {
    const rootNodes = [];

    try {
        if (visitedNodes.has(node.id)) {
            logger.verbose(`Circular dependency detected when looking for root nodes: [${node.id}] "${node.taskName}"`);
            return rootNodes;
        }
        visitedNodes.add(node.id);

        if (node.isTopLevelNode) {
            rootNodes.push(node);
        } else {
            // This node is not a root node.
            // Investigate upstream nodes.
            const upstreamEdges = _.taskNetwork.edges.filter((edge) => edge.to === node.id);

            for (const upstreamEdge of upstreamEdges) {
                const upstreamNode = _.taskNetwork.nodes.find((n) => n.id === upstreamEdge.from);
                // If the task network is correctly defined in nodes and edges, the upstream node should always be found.
                // If not, there is an error in the task network definition.
                if (upstreamNode === undefined) {
                    logger.error(`UPSTREAM NODE NOT FOUND: ${upstreamEdge.from}`);
                    continue;
                }

                // Is the upstream node a root node?
                // If so add it to the rootNodes array and don't go further up the tree.
                if (upstreamNode.isTopLevelNode) {
                    rootNodes.push(upstreamNode);
                    continue;
                }

                const result = extFindRootNodes(_, upstreamNode, logger, visitedNodes);
                if (result.length > 0) {
                    rootNodes.push(...result);
                }
            }
        }
    } catch (err) {
        catchLog('FIND ROOT NODES', err);
    }

    return rootNodes;
}
