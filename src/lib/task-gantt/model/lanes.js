// Task type names used by the --task-type option, and their TaskTypeEnum codes
export const TASK_TYPE_CODES = { reload: 0, 'ext-program': 1, 'user-sync': 2, distribute: 3, preload: 4 };

/**
 * Decide which tasks get a lane on the page. CLI filters only choose lanes; congestion analytics always use all tasks.
 *
 * Filters on task id, task tag, app id and app tag are additive (a task matching any of them is shown), then
 * restricted to the selected task types. Without id/tag/app filters, all tasks of the selected types are shown.
 *
 * @param {object} task - Task info { id, taskType, tags, appId }.
 * @param {object} filters - { taskTypes: number[], taskIds: string[], taskTags: string[], appIds: string[],
 *   appIdsFromTags: Set<string> }.
 * @returns {boolean} True if the task gets a visible lane.
 */
export function isTaskVisible(task, filters) {
    const types = filters.taskTypes || [];
    if (types.length && task.taskType !== null && task.taskType !== undefined && !types.includes(task.taskType)) {
        return false;
    }
    const taskIds = filters.taskIds || [];
    const taskTags = filters.taskTags || [];
    const appIds = filters.appIds || [];
    const appIdsFromTags = filters.appIdsFromTags || new Set();
    // An --app-tag that matches no app is still a filter: it should show nothing, not everything
    const appTags = filters.appTags || [];
    const anyFilter = taskIds.length || taskTags.length || appIds.length || appTags.length || appIdsFromTags.size;
    if (!anyFilter) {
        return true;
    }
    return (
        taskIds.includes(task.id) ||
        (task.tags || []).some((t) => taskTags.includes(t)) ||
        (task.appId !== null && (appIds.includes(task.appId) || appIdsFromTags.has(task.appId)))
    );
}

/**
 * Keep track of lanes, one per task. Lane numbers stay the same for the lifetime of the command, so live updates can
 * refer to them; tasks seen later (new tasks, or tasks only known from history) get new numbers.
 *
 * @param {object} filters - Lane filters, see isTaskVisible().
 * @returns {object} The lane registry.
 */
export function createLaneRegistry(filters) {
    const byTask = new Map();
    const lanes = [];

    /**
     * Add or update the lane of a task.
     *
     * @param {object} task - { id, name, taskType, enabled, appId, appName, stream, tags, deleted }.
     * @returns {{lane: object, added: boolean, changed: boolean}} The lane, and whether it is new or changed.
     */
    const upsert = (task) => {
        const existing = byTask.get(task.id);
        const next = {
            id: task.id,
            name: task.name ?? existing?.name ?? `Deleted task ${String(task.id).slice(0, 8)}`,
            taskType: task.taskType ?? existing?.taskType ?? null,
            enabled: task.enabled ?? existing?.enabled ?? false,
            appId: task.appId ?? existing?.appId ?? null,
            appName: task.appName ?? existing?.appName ?? null,
            stream: task.stream ?? existing?.stream ?? null,
            tags: task.tags ?? existing?.tags ?? [],
            deleted: Boolean(task.deleted),
        };
        next.visible = isTaskVisible(next, filters);
        if (!existing) {
            const lane = { idx: lanes.length, ...next };
            lanes.push(lane);
            byTask.set(task.id, lane);
            return { lane, added: true, changed: true };
        }
        const changed = Object.keys(next).some((k) => JSON.stringify(existing[k]) !== JSON.stringify(next[k]));
        Object.assign(existing, next);
        return { lane: existing, added: false, changed };
    };

    return {
        upsert,
        get: (taskId) => byTask.get(taskId),
        all: () => lanes,
        visible: () => lanes.filter((l) => l.visible),
    };
}
