import { appVersion, logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { QlikSenseTasks } from '../../task/class_alltasks.js';
import { findCircularTaskChains } from '../../task/find_circular_task_chain.js';
import { catchLog, redactOptions } from '../../util/log.js';
import { createAssetCatalog } from '../../util/web/assets.js';
import { startWebServer, createAccessToken, isLoopbackHost } from '../../util/web/server.js';
import { shareHosts, shareUrls } from '../../util/web/share.js';
import { createShutdownManager } from '../../util/web/shutdown.js';

// Static files of the task-vis web page. Each file also needs an entry in sea-config.json ("<seaKey>": "./src/<file>"),
// which the unit tests check.
export const TASK_VIS_ROUTES = [
    { url: '/', file: 'static/task-vis/index.html' },
    { url: '/task-vis/styles.css', file: 'static/task-vis/styles.css' },
    { url: '/task-vis/main.js', file: 'static/task-vis/main.js' },
    // The dist build of vis-network, whose stylesheet is a file of its own. The standalone build adds its stylesheet to
    // the page as <style> elements instead, which the Content-Security-Policy blocks.
    { url: '/vendor/vis-network/vis-network.min.js', file: 'static/vendor/vis-network/vis-network.min.js' },
    { url: '/vendor/vis-network/vis-network.min.css', file: 'static/vendor/vis-network/vis-network.min.css' },
    { url: '/vendor/vis-network/LICENSE-APACHE-2.0.txt', file: 'static/vendor/vis-network/LICENSE-APACHE-2.0.txt' },
    { url: '/vendor/vis-network/LICENSE-MIT.txt', file: 'static/vendor/vis-network/LICENSE-MIT.txt' },
    { url: '/vendor/vis-network/LICENSE-bundled.txt', file: 'static/vendor/vis-network/LICENSE-bundled.txt' },
    { url: '/ctrl-q.png', file: 'static/ctrl-q.png' },
    { url: '/favicon.ico', file: 'static/favicon.ico' },
];

// QRS uses this date for "never"
const QRS_NULL_DATE = '1753-01-01T00:00:00.000Z';

// Schema event incrementOption values
const SCHEDULE_NAMES = ['Once', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'Custom'];

// Task node colours by the task's last execution status. The legend on the page shows the same colours.
const STATUS_COLORS = {
    NeverStarted: '#999',
    '?': '#999',
    Triggered: '#6cf',
    Queued: '#6cf',
    Started: '#6cf',
    AbortInitiated: '#fd8008',
    Aborting: '#fd8008',
    Error: '#fd8008',
    Reset: '#fd8008',
    Aborted: '#fb0207',
    FinishedFail: '#fb0207',
    FinishedSuccess: '#21ff06',
    Skipped: '#ffcc00',
};

const TRIGGER_COLOR_ENABLED = '#FFA807';
const TRIGGER_COLOR_DISABLED = '#BCB9BF';

const TASK_TYPES = {
    0: { nodeType: 'reloadTask', typeName: 'Reload task', heading: 'Reload task', shape: 'box' },
    1: { nodeType: 'externalProgramTask', typeName: 'External program task', heading: 'Ext. program task', shape: 'ellipse' },
};

const shown = (value) => (value === undefined || value === null || value === '' ? '-' : String(value));

const tooltip = (heading, rows) => ({ heading, rows: rows.map(([label, value]) => [label, shown(value)]) });

/**
 * Build what the task-vis page shows from a task network: vis-network nodes and edges, plus counts for the header.
 * Tooltips are headings and label/value rows of plain text. Nothing here is HTML: the page inserts all of it as text.
 *
 * @param {object} taskNetwork - Task network { nodes, edges, tasks }, after findCircularTaskChains() has counted edges.
 * @returns {{appVersion: string, counts: object, nodes: object[], edges: object[]}} The page data.
 */
export function buildTaskVisPayload(taskNetwork) {
    const taskNodes = taskNetwork.tasks.map((task) => {
        const type = TASK_TYPES[task.taskType] ?? { nodeType: 'task', typeName: 'Task', heading: 'Task', shape: 'box' };
        const rows = [
            ['Name', task.taskName],
            ['Task ID', task.taskId],
            ['Enabled', task.taskEnabled],
        ];
        if (task.taskType === 0) {
            rows.push(['App', task.appName]);
        }
        rows.push(
            ['Last exec status', task.taskLastStatus],
            ['Last exec start', task.taskLastExecutionStartTimestamp],
            ['Last exec stop', task.taskLastExecutionStopTimestamp]
        );
        return {
            id: task.taskId,
            label: task.taskName,
            nodeType: type.nodeType,
            typeName: type.typeName,
            shape: type.shape,
            // Statuses without a colour get vis-network's default one
            color: STATUS_COLORS[task.taskLastStatus],
            tooltip: tooltip(type.heading, rows),
        };
    });

    const triggerNodes = [];
    for (const node of taskNetwork.nodes.filter((n) => n.metaNode === true)) {
        if (node.metaNodeType === 'schedule') {
            const event = node.completeSchemaEvent ?? {};
            const next = event.operational?.nextExecution;
            triggerNodes.push({
                id: node.id,
                label: node.label,
                nodeType: 'scheduleTrigger',
                typeName: 'Schedule trigger',
                shape: 'triangle',
                color: node.enabled ? TRIGGER_COLOR_ENABLED : TRIGGER_COLOR_DISABLED,
                tooltip: tooltip('Schema trigger', [
                    ['Name', node.label],
                    ['Enabled', node.enabled],
                    ['Schema', SCHEDULE_NAMES[event.incrementOption]],
                    ['Next', next === QRS_NULL_DATE ? '' : next],
                    ['Timezone', event.timeZone],
                    ['Triggered times', event.operational?.timesTriggered],
                ]),
            });
        } else if (node.metaNodeType === 'composite') {
            triggerNodes.push({
                id: node.id,
                label: node.label,
                nodeType: 'compositeTrigger',
                typeName: 'Composite trigger',
                shape: 'hexagon',
                color: TRIGGER_COLOR_ENABLED,
                tooltip: tooltip('Composite trigger', [
                    ['Name', node.label],
                    ['Enabled', node.enabled],
                ]),
            });
        } else {
            logger.error(`Task network: skipping node ${node.id} of unknown meta node type "${node.metaNodeType}"`);
        }
    }

    return {
        appVersion,
        counts: {
            reloadTasks: taskNetwork.tasks.filter((task) => task.taskType === 0).length,
            externalProgramTasks: taskNetwork.tasks.filter((task) => task.taskType === 1).length,
            schemaTriggers: taskNetwork.nodes.filter((node) => node.metaNodeType === 'schedule').length,
            compositeTriggers: taskNetwork.nodes.filter((node) => node.metaNodeType === 'composite').length,
        },
        nodes: taskNodes.concat(triggerNodes),
        // Edges that stand for several identical triggers are labelled with how many there are
        edges: taskNetwork.edges.map((edge) => ({
            from: edge.from,
            to: edge.to,
            ...(edge.edgeCount > 1 ? { label: `${edge.edgeCount}` } : {}),
        })),
    };
}

/**
 * Load the task network from QSEoW: all tasks, or the task chains the --task-id and --task-tag options pick.
 * Circular task chains and duplicate task triggers are logged as warnings.
 *
 * @param {object} options - Command line options.
 * @returns {Promise<object|false>} The task network { nodes, edges, tasks }, or false if it could not be loaded.
 */
export async function loadTaskNetworkFromQseow(options) {
    // Get all tasks from QSEoW
    const optionsNew = { ...options };
    optionsNew.getAllTasks = true;

    // Get reload and external program tasks
    const qlikSenseTasks = new QlikSenseTasks();
    await qlikSenseTasks.init(optionsNew);
    const res1 = await qlikSenseTasks.getTaskModelFromQseow();
    if (!res1) {
        logger.error('Failed to get task model from QSEoW');
        return false;
    }

    let taskNetwork;

    // Filter tasks based on CLI options. Two possible
    // 1. If no filters specified, show all tasks.
    // 2. At least one filter specified.
    //    - If --task-id <id...> specified
    //      - Get root task(s) for each specified task id
    //      - Include in network diagram all tasks that are children of the root tasks
    //    - If --task-tag <tag...> specified
    //      - Get all tasks that have the specified tag(s)
    //      - Get root task(s) for each task that has the specified tag(s)§
    //    - If --app-id <id...> specified
    //      - Get all tasks that are associated with the specified app id(s)
    //      - Get root task(s) for each task that is associated with the specified app id(s)
    //      - Include in network diagram all tasks that are children of the root tasks
    //    - If --app-tag <tag...> specified
    //      - Get all apps that are associated with the specified app tag(s)
    //      - Get all tasks that are associated with the apps that have the specified app tag(s)
    //      - Get root task(s) for each task that is associated with the apps that have the specified app tag(s)
    //      - Include in network diagram all tasks that are children of the root tasks
    //
    // Filters above are additive, i.e. all tasks that match any of the filters are included in the network diagram.
    // Make sure to de-duplicate root tasks.

    // If no task id or tag filters specified, visualize all nodes in task model
    if (!options.taskId && !options.taskTag) {
        // No task id filters specified
        // Visualize all nodes in task model
        logger.verbose('No task id or tag filters specified. Visualizing all nodes in task model.');

        taskNetwork = qlikSenseTasks.taskNetwork;
    } else {
        // Task id filters specified.
        // Get all task chains the tasks are part of, then get the root nodes of each chain.
        // They will be the starting points for the task tree.

        // Array to keep track of root nodes of task chains
        const rootNodes = await qlikSenseTasks.getRootNodesFromFilter();

        // List root nodes to console
        logger.verbose(`${rootNodes.length} root nodes sent to visualizer:`);
        rootNodes.forEach((node) => {
            // Meta node?
            if (node.metaNode === true) {
                // Reload task?
                if (node.taskType === 'reloadTask') {
                    logger.verbose(
                        `Meta node: metanode type=${node.metaNodeType} id=[${node.id}] task type=${node.taskType} task name="${node.completeSchemaEvent.reloadTask.name}"`
                    );
                }
            } else {
                logger.verbose(`Root node: [${node.id}] "${node.taskName}"`);
            }
        });

        // Get all nodes that are children of the root nodes
        const { nodes, edges, tasks } = await qlikSenseTasks.getNetworkFromRootNodes(rootNodes);

        taskNetwork = { nodes, edges, tasks };
    }

    // Look for circular task chains in the task network
    logger.info('');
    logger.info('Looking for circular task chains in the task network');

    try {
        const result = findCircularTaskChains(taskNetwork, logger);

        // Errros?
        if (result === false) {
            return false;
        }

        const circularTaskChains = result.circularTaskChains;
        const duplicateEdges = result.duplicateEdges;

        // De-duplicate circular task chains (where fromTask.id and toTask.id matches in two different chains).
        const deduplicatedCircularTaskChain = circularTaskChains.filter((chain, index, self) => {
            return self.findIndex((c) => c.fromTask.id === chain.fromTask.id && c.toTask.id === chain.toTask.id) === index;
        });

        // Log circular task chains, if any were found.
        if (deduplicatedCircularTaskChain?.length > 0) {
            logger.warn('');
            logger.warn(`Found ${deduplicatedCircularTaskChain.length} circular task chains in task model`);
            for (const chain of deduplicatedCircularTaskChain) {
                logger.warn(`Circular task chain:`);

                logger.warn(`   From task : [${chain.fromTask.id}] "${chain.fromTask.taskName}"`);
                logger.warn(`   To task   : [${chain.toTask.id}] "${chain.toTask.taskName}"`);
            }
        } else {
            logger.info('No circular task chains found in task model');
        }

        // Log duplicate edges, if any were found.
        // De-duplicate first. If two edges have the same from and to task id, and the same rule state, it's a duplicate.
        const deduplicatedDuplicateEdges = duplicateEdges.filter((edge, index, self) => {
            return (
                self.findIndex(
                    (e) =>
                        e.parentNode.id === edge.parentNode.id &&
                        e.downstreamNode.id === edge.downstreamNode.id &&
                        e.ruleState === edge.ruleState
                ) === index
            );
        });

        if (deduplicatedDuplicateEdges?.length > 0) {
            logger.warn('');
            logger.warn(`Found ${deduplicatedDuplicateEdges.length} duplicate task triggers in task model, across all examined tasks.`);
            for (const duplicate of deduplicatedDuplicateEdges) {
                logger.warn(
                    `Multiple downstream nodes (${duplicate.duplicateEdgeCount}) with the same ID and the same trigger relationship "${duplicate.ruleState}" with the parent node.`
                );
                logger.warn(`   Parent node     : [${duplicate.parentNode.id}] "${duplicate.parentNode.completeTaskObject?.name}"`);
                logger.warn(`   Downstream node : [${duplicate.downstreamNode.id}] "${duplicate.downstreamNode.completeTaskObject?.name}"`);
            }
        }
    } catch (error) {
        catchLog('FIND CIRCULAR TASK CHAINS', error);
        return false;
    }

    return taskNetwork;
}

/**
 * Show the QSEoW task network as a network diagram on a local web page.
 *
 * @param {object} options - Command line options.
 * @param {object} [param] - Parameters.
 * @param {boolean} [param.installSignalHandlers] - Install Ctrl-C handlers. Tests pass false.
 * @param {object} [param.processRef] - Process object the Ctrl-C handlers are installed on. Tests pass a stand-in.
 * @param {Function} [param.loadTaskNetwork] - async (options) => task network, or false. Defaults to loading from QSEoW.
 * @returns {Promise<{url: string, port: number, close: Function}|false>} The running page server, or false if the
 *   task network could not be loaded.
 */
export async function visTask(
    options,
    { installSignalHandlers = true, processRef = process, loadTaskNetwork = loadTaskNetworkFromQseow } = {}
) {
    // Set log level
    setLoggingLevel(options.logLevel);

    logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
    logger.verbose(`Ctrl-Q was started from ${execPath}`);

    logger.verbose('Visulise tasks');
    logger.debug(`Options: ${JSON.stringify(redactOptions(options), null, 2)}`);

    const assets = createAssetCatalog({ routes: TASK_VIS_ROUTES });
    const assetCheck = await assets.verifyAll();
    if (!assetCheck.ok) {
        throw new Error(`Files for the task-vis page are missing: ${assetCheck.missing.join(', ')}`);
    }

    const taskNetwork = await loadTaskNetwork(options);
    if (!taskNetwork) {
        return false;
    }

    const payload = buildTaskVisPayload(taskNetwork);
    logger.debug(`Task network: ${payload.nodes.length} nodes, ${payload.edges.length} edges`);
    for (const node of payload.nodes) {
        logger.debug(`${node.typeName}: [${node.id}] "${node.label}"`);
    }

    const visHost = String(options.visHost || 'localhost');
    // The page is reachable from other computers unless the server listens on a loopback address. It then needs a token.
    const token = isLoopbackHost(visHost) ? null : createAccessToken();

    const shutdown = createShutdownManager({ processRef, logger });
    const web = await startWebServer({
        host: visHost,
        port: options.visPort,
        assets,
        apiRoutes: [{ path: '/api/network', handler: () => payload }],
        token,
        logger,
    });
    shutdown.register('web server', () => web.close());

    if (installSignalHandlers) {
        shutdown.install();
    }

    logger.info('');
    logger.info('Using vis.js to visualize tasks, more info at https://github.com/visjs/vis-network');
    logger.info('');
    const others = shareUrls(web.url, shareHosts(visHost));
    if (others.length) {
        logger.info(`Task visualization, on this computer: ${web.url}`);
        for (const u of others) logger.info(`Task visualization, from other computers: ${u}`);
    } else {
        logger.info(`Task visualization: ${web.url}`);
    }
    if (token) {
        logger.info(
            `The page is reachable from other computers. Share ${others.length ? 'one of the URLs' : 'the URL'} above, including its token, only with people who may see it.`
        );
    }
    logger.info('Press Ctrl-C to quit.');

    return { url: web.url, port: web.port, close: () => shutdown.shutdown('close()') };
}
