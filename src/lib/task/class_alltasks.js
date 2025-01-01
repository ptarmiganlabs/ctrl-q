import axios from 'axios';
import { v4 as uuidv4, validate } from 'uuid';

import { logger } from '../../globals.js';
import { setupQrsConnection } from '../util/qseow/qrs.js';
import { QlikSenseTask } from './class_task.js';
import { QlikSenseSchemaEvents } from './class_allschemaevents.js';
import { QlikSenseCompositeEvents } from './class_allcompositeevents.js';
import { catchLog } from '../util/log.js';
import { getCertFilePaths } from '../util/qseow/cert.js';
import { extParseReloadTask } from './parse_reload_task.js';
import { extParseExternalProgramTask } from './parse_ext_program_task.js';
import { extGetTaskModelFromQseow } from './get_task_model_from_qseow.js';
import { extGetTasksFromQseow } from './get_tasks_from_qseow.js';
import { extGetTaskSubGraph } from './get_task_sub_graph.js';
import { extGetTaskSubTree } from './get_task_sub_tree.js';
import { extGetTaskSubTable } from './get_task_sub_table.js';
import { extParseSchemaEvents } from './parse_schema_events.js';
import { extGetTaskModelFromFile } from './get_task_model_from_file.js';
import { extSaveTaskModelToQseow } from './save_task_model_to_qseow.js';
import { extGetRootNodesFromFilter } from './get_root_nodes_from_filter.js';
import { extFindRootNodes } from './find_root_nodes.js';

export class QlikSenseTasks {
    constructor() {
        //
    }

    async init(options, importedApps) {
        try {
            this.options = options;
            this.importedApps = importedApps;

            this.taskList = [];
            this.compositeEventUpstreamTask = [];

            // Map that will map fake task IDs (used in source file) with real task IDs after tasks have been created in Sense
            this.taskIdMap = new Map();

            // Data structure to keep track of which up-tree nodes a node is connected to in a task tree or network
            this.taskCyclicVisited = new Set();
            this.taskCyclicStack = new Set();

            // Data structure to keep track of which nodes have been visited when looking for root nodes
            this.nodeRootCyclicVisited = new Set();

            if (options.authType === 'cert') {
                // Get certificate paths
                const { fileCert, fileCertKey, fileCertCA } = getCertFilePaths(options);

                this.fileCert = fileCert;
                this.fileCertKey = fileCertKey;
                this.fileCertCA = fileCertCA;
            }

            this.qlikSenseSchemaEvents = new QlikSenseSchemaEvents();
            await this.qlikSenseSchemaEvents.init(options);

            this.qlikSenseCompositeEvents = new QlikSenseCompositeEvents();
            await this.qlikSenseCompositeEvents.init(options);
        } catch (err) {
            catchLog(`QS TASK`, err);
        }
    }

    // Function to determine if a task tree is cyclic
    // Uses a depth-first search algorithm to determine if a task tree is cyclic
    isTaskTreeCyclic(task) {
        if (this.taskCyclicVisited.has(task)) {
            return true;
        }

        this.taskCyclicVisited.add(task);

        return false;
    }

    getTask(taskId) {
        if (taskId === undefined || taskId === null) {
            return false;
        }
        const task = this.taskList.find((el) => el.taskId === taskId);

        logger.debug(`GET TASK: taskID=${taskId}: ${JSON.stringify(task)}`);
        return task;
    }

    clear() {
        this.taskList = [];
        this.compositeEventUpstreamTask = [];
    }

    // Add new task
    async addTask(source, task, anonymizeTaskNames) {
        const newTask = new QlikSenseTask();
        await newTask.init(source, task, anonymizeTaskNames, this.options, this.fileCert, this.fileCertKey);
        this.taskList.push(newTask);
    }

    /**
     * Recursively find root nodes in a node tree.
     * Each node may have one or more upstream nodes.
     * When there are no more upstream nodes, the node is a root node.
     *
     * Upstream nodes are found by following the edges in the task network.
     * edge.to === node.id, then look at edge.from to find the upstream node id.
     *
     * After the final call to this function, the rootNodes array will contain all root nodes.
     * There may be duplicates in the array, as the function does not check for duplicates.
     * De-deplication should be done after the function has been called.
     *
     * @param {object} node - Node to start the search from.
     * @returns {Array} Array of found root nodes.
     */
    findRootNodes(node) {
        const result = extFindRootNodes(this, node, logger);

        // logger.verbose(`Root node count: ${result.length}`);
        // Log root node and name
        // for (const rootNode of result) {
        //     // Meta node?
        //     if (rootNode.metaNode === true) {
        //         // Reload task?
        //         if (rootNode.taskType === 'reloadTask') {
        //             logger.verbose(
        //                 `Meta node: metanode type=${rootNode.metaNodeType} id=[${rootNode.id}] task type=${rootNode.taskType} task name="${rootNode.completeSchemaEvent.reloadTask.name}"`
        //             );
        //         }
        //     } else {
        //         logger.verbose(`Root node: [${rootNode.id}] "${rootNode.taskName}"`);
        //     }
        // }

        return result;
    }

    // Function to parse the rows associated with a specific reload task in the source file
    // Properties in the param object:
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - tagsExisting: Array of existing tags in QSEoW
    // - cpExisting: Array of existing custom properties in QSEoW
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    // - options: CLI options
    //
    // Returns:
    // Object with two properties:
    // - currentTask: Object containing task data
    // - taskCreationOption: Task creation option. Possible values: "if-exists-add-another", "if-exists-update-existing"
    async parseReloadTask(param) {
        const result = await extParseReloadTask(this, param, logger);
        return result;
    }

    // Function to parse the rows associated with a specific external program task in the source file
    // Properties in the param object:
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - tagsExisting: Array of existing tags in QSEoW
    // - cpExisting: Array of existing custom properties in QSEoW
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    // - options: CLI options
    //
    // Returns:
    // Object with two properties:
    // - currentTask: Object containing task data
    // - taskCreationOption: Task creation option. Possible values: "if-exists-add-another", "if-exists-update-existing"
    async parseExternalProgramTask(param) {
        const result = await extParseExternalProgramTask(this, param, logger);
        return result;
    }

    // Function to get schema events for a specific task
    // Parameters:
    // - taskType: Type of task. Possible values: "reload", "external program"
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - currentTask: Object containing task data
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    // - options: CLI options
    parseSchemaEvents(param) {
        const result = extParseSchemaEvents(this, param, logger);
        return result;
    }

    // Function to get composite events for a specific task
    // Function is async as it may need to check if the upstream task pointed to by the composite event exists in Sense

    // Parameters (all properties in the param object):
    // - taskType: Type of task. Possible values: "reload", "external program"
    // - taskRows: Array of rows associated with the task. All rows associated with the task are passed to this function
    // - taskFileColumnHeaders: Object containing info about which column contains what data
    // - taskCounter: Counter for the current task
    // - currentTask: Object containing task data
    // - fakeTaskId: Fake task ID used to associate task with schema/composite events
    // - nodesWithEvents: Set of nodes that have associated events
    // - options: CLI options
    async parseCompositeEvents(param) {
        const result = extParseCompositeEvents(this, param, logger);
        return result;
    }

    // Function to read task definitions from disk file (CSV or Excel)
    // Parameters:
    // - tasksFromFile: Object containing data read from file
    // - tagsExisting: Array of existing tags in QSEoW
    // - cpExisting: Array of existing custom properties in QSEoW
    // - options: Options object passed on the command line
    async getTaskModelFromFile(tasksFromFile, tagsExisting, cpExisting, options) {
        const result = extGetTaskModelFromFile(this, tasksFromFile, tagsExisting, cpExisting, options, logger);
        return result;
    }

    // Function to create new reload task in QSEoW
    createReloadTaskInQseow(newTask, taskCounter) {
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug(`(${taskCounter}) CREATE RELOAD TASK IN QSEOW: Starting`);

                // Build a body for the API call
                const body = {
                    task: {
                        app: {
                            id: newTask.app.id,
                        },
                        name: newTask.name,
                        isManuallyTriggered: newTask.isManuallyTriggered,
                        isPartialReload: newTask.isPartialReload,
                        taskType: 0,
                        enabled: newTask.enabled,
                        taskSessionTimeout: newTask.taskSessionTimeout,
                        maxRetries: newTask.maxRetries,
                        tags: newTask.tags,
                        customProperties: newTask.customProperties,
                        schemaPath: 'ReloadTask',
                    },
                    schemaEvents: newTask.schemaEvents,
                };

                // Save task to QSEoW
                const axiosConfig = setupQrsConnection(this.options, {
                    method: 'post',
                    path: '/qrs/reloadtask/create',
                    body,
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        const response = JSON.parse(result.data);

                        logger.debug(
                            `(${taskCounter}) CREATE RELOAD TASK IN QSEOW: "${newTask.name}", new task id: ${response.id}. Result: ${result.status}/${result.statusText}.`
                        );

                        if (result.status === 201) {
                            resolve(response.id);
                        } else {
                            reject();
                        }
                    })
                    .catch((err) => {
                        catchLog('CREATE RELOAD TASK IN QSEOW 1', err);
                        reject(err);
                    });
            } catch (err) {
                catchLog('CREATE RELOAD TASK IN QSEOW 2', err);
                reject(err);
            }
        });
    }

    saveTaskModelToQseow() {
        const result = extSaveTaskModelToQseow(this, logger);
        return result;
    }

    async getTasksFromQseow() {
        const result = extGetTasksFromQseow(this, logger);
        return result;
    }

    async getTaskSubGraph(node, parentTreeLevel, parentNode) {
        const result = extGetTaskSubGraph(this, node, parentTreeLevel, parentNode, logger);
        return result;
    }

    async getTaskSubTree(task, parentTreeLevel, parentTask) {
        const result = extGetTaskSubTree(this, task, parentTreeLevel, parentTask, logger);
        return result;
    }

    getTaskSubTable(task, parentTreeLevel) {
        const result = extGetTaskSubTable(this, task, parentTreeLevel, logger);
        return result;
    }

    getTableTaskTable() {
        return new Promise((resolve, reject) => {
            try {
                if (this.taskNetwork === undefined && this.taskList === undefined) {
                    resolve(null);
                } else {
                    const tableTaskBasic = this.taskNetwork ? this.taskNetwork.tasks : null;

                    resolve(tableTaskBasic);
                }
            } catch (err) {
                catchLog('GET TASK TABLE', err);
                reject();
            }
        });
    }

    async getTaskModelFromQseow() {
        const result = await extGetTaskModelFromQseow(this, logger);
        return result;
    }

    /**
     * Returns an array of root nodes in the task network.
     *
     * Method:
     * 1. Use various task and app filters specified in CLI options to get a list of tasks to consider.
     * 2. For each task, check if it has any upstream dependencies.
     * 3. If it does not have any upstream dependencies, it is a root node.
     * 4. If it has upstream dependencies, it is not a root node. Continue to the next upstream node.
     * 5. Repeat until all upstream nodes have been checked.
     * 6. Return an array of root nodes.
     *
     * Root nodes are tasks or metatasks that have no upstream dependencies.
     * In other words, they are not triggered by any other tasks.
     *
     * @param {Array<Object>} tasks List of tasks to consider
     * @param {Array<Object>} apps List of apps to consider
     * @returns {Promise<Array<Object>>} An array of root nodes in the task network, or false if an error occurred
     */
    async getRootNodesFromFilter() {
        const result = await extGetRootNodesFromFilter(this, logger);
        return result;
    }

    /**
     * Extract nodes and edges starting from the provided root nodes.
     * This function processes the root nodes to identify all connected nodes and edges,
     * effectively building a subgraph starting from these root nodes.
     *
     * While doing this, make sure to
     * - De-duplicate nodes where applicable. Node id is unique, but may appear at different places in the task network.
     * - Keep track of edges between nodes and store them in edgesToVisualize
     * - Store nodes in nodesToVisualize
     * - Detect cyclic dependencies. Log warning if detected.
     * - Detect identical, duplicate edges between nodes. Log warning if detected.
     *
     * @param {Array} rootNodes - An array of root node objects from which the extraction begins.
     * @returns {Promise<object>} - A promise that resolves to an object containing the nodes and edges.
     * Object properties:
     *   - nodes: Array of nodes,
     *   - edges: Array of edges
     */
    async getNodesAndEdgesFromRootNodes(rootNodes) {
        // De-duplicate root nodes
        const uniqueRootNodes = rootNodes.filter((node, index, self) => {
            return index === self.findIndex((t) => t.id === node.id);
        });

        // Initialize arrays to store nodes and edges
        let nodesFound = [];
        let edgesFound = [];
        let tasksFound = [];

        // Extract nodes and edges from root nodes
        for (const rootNode of uniqueRootNodes) {
            const subGraph = await this.getTaskSubGraph(rootNode, 0, null);
            // Ensure subgraph is not empty
            if (!subGraph) {
                logger.verbose(`No subgraph found for root node ${rootNode.id}.`);
                continue;
            }
            nodesFound.push(...subGraph.nodes);
            edgesFound.push(...subGraph.edges);
            tasksFound.push(...subGraph.tasks);
        }

        // De-duplicate nodes using node id
        nodesFound = nodesFound.filter((node, index, self) => {
            return index === self.findIndex((t) => t.id === node.id);
        });

        // De-duplicate tasks using task id
        tasksFound = tasksFound.filter((task, index, self) => {
            return (
                index ===
                self.findIndex((t) => {
                    return t.taskId === task.taskId;
                })
            );
        });

        return { nodes: nodesFound, edges: edgesFound, tasks: tasksFound };
    }
}
