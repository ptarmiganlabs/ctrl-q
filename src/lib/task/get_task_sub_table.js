import { catchLog } from '../util/log.js';

export function extGetTaskSubTable(_, task, parentTreeLevel, logger) {
    try {
        const self = _;

        const newTreeLevel = parentTreeLevel + 1;
        let subTree = [];

        // Debug
        // logger.debug(`GET TASK SUBTABLE: Tree level: ${newTreeLevel}, task name: ${task.taskName}`);

        // Does this node (=task) have any downstream connections?
        const downstreamTasks = self.taskNetwork.edges.filter((edge) => edge.from === task.id);
        // console.log('downStreamTasks 1: ' + JSON.stringify(downstreamTasks));
        let kids = [];
        for (const downstreamTask of downstreamTasks) {
            if (downstreamTask.to !== undefined) {
                // Get downstream task object
                const tmp = self.taskNetwork.nodes.find((el) => el.id === downstreamTask.to);
                const tmp3 = self.getTaskSubTable(tmp, newTreeLevel);
                kids = kids.concat([tmp3]);
            }
        }

        // Only push real Sense tasks to the tree (don't include meta nodes)
        if (!task.metaNodeType) {
            if (kids && kids.length > 0) {
                subTree = {
                    id: task.id,
                    children: kids,
                };
            } else {
                subTree = {
                    id: task.id,
                };
            }

            subTree.text = task.taskName;

            // Tabulator columns
            subTree.taskId = task.taskId;
            subTree.taskName = task.taskName;
            subTree.taskEnabled = task.taskEnabled;
            subTree.appId = task.appId;
            subTree.appName = task.appName;
            subTree.appPublished = task.appPublished;
            subTree.appStream = task.appStream;
            subTree.taskMaxRetries = task.taskMaxRetries;
            subTree.taskLastExecutionStartTimestamp = task.taskLastExecutionStartTimestamp;
            subTree.taskLastExecutionStopTimestamp = task.taskLastExecutionStopTimestamp;
            subTree.taskLastExecutionDuration = task.taskLastExecutionDuration;
            subTree.taskLastExecutionExecutingNodeName = task.taskLastExecutionExecutingNodeName;
            subTree.taskNextExecutionTimestamp = task.taskNextExecutionTimestamp;
            subTree.taskLastStatus = task.taskLastStatus;
            subTree.taskTags = task.completeTaskObject.tags.map((tag) => tag.name);
            subTree.taskCustomProperties = task.completeTaskObject.customProperties.map((el) => `${el.definition.name}=${el.value}`);
            subTree.completeTaskObject = task.completeTaskObject;

            if (newTreeLevel <= 2) {
                subTree = kids.concat([[newTreeLevel, task.taskName, task.taskId, task.taskEnabled]]);
            } else {
                subTree = kids.concat([[newTreeLevel, '--'.repeat(newTreeLevel - 2) + task.taskName, task.taskId, task.taskEnabled]]);
            }
        } else {
            subTree = kids;
        }

        return subTree;
    } catch (err) {
        catchLog('GET TASK SUBTABLE (table)', err);
        return null;
    }
}
