const http = require('http');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const { Readable } = require('stream');
const { appVersion, logger, setLoggingLevel, isPkg, execPath, verifyFileExists } = require('../../globals');
const { QlikSenseTasks } = require('../task/class_alltasks');

// js: 'application/javascript',
const MIME_TYPES = {
    default: 'application/octet-stream',
    html: 'text/html; charset=UTF-8',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpg',
    gif: 'image/gif',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
};

// Get path to static html files
let STATIC_PATH = '';
if (isPkg) {
    // Running as standalone app
    STATIC_PATH = path.join(__dirnamn, './src/static');
} else {
    // Running packaged app
    STATIC_PATH = path.join(execPath, './src/static');
}

const toBool = [() => true, () => false];

const templateData = {
    appVersion,
    title: 'Ctrl-Q',
    description: 'Task visualization for Ctrl-Q',
};

let taskNetwork = [];

const visOptions = {
    nodes: {
        widthConstraint: { maximum: 200 },
        // smooth: {
        //     enabled: true,
        //     type: 'dynamic',
        //     roundness: 0.5,
        // },
        font: '20px arial',
    },
    edges: {
        arrows: 'to',
        width: 5,
        smooth: false,
    },
    layout: {
        randomSeed: 5.5,
        improvedLayout: true,
        clusterThreshold: 150,

        hierarchical: {
            enabled: false,
            levelSeparation: 150,
            nodeSpacing: 50,
            treeSpacing: 200,
            blockShifting: true,
            edgeMinimization: false,
            parentCentralization: false,
            direction: 'UD', // UD, DU, LR, RL
            sortMethod: 'directed', // hubsize, directed
        },
        // hierarchical: {
        //     direction: 'UD',
        //     sortMethod: 'directed',
        //     // shakeTowards: 'roots',
        //     // sortMethod: 'hubsize',
        //     // levelSeparation: 150,
        //     nodeSpacing: 50,
        //     // treeSpacing: 150,
        //     blockShifting: true,
        //     edgeMinimization: true,
        //     // parentCentralization: false,
        // },
    },
    // interaction: { dragNodes: false },
    physics: {
        enabled: true,

        stabilization: {
            enabled: true,
            iterations: 250,
            updateInterval: 25,
        },
        minVelocity: 0.75,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
            centralGravity: 0.005,
            springLength: 150,
            springConstant: 0.7,
            damping: 0.72,
            avoidOverlap: 0.5,
        },
        hierarchicalRepulsion: {
            centralGravity: 0.3,
            springLength: 230,
            springConstant: 0.8,
            nodeDistance: 150,
            damping: 0.09,
            avoidOverlap: 0.3,
        },
    },
    interaction: {
        navigationButtons: true,
        hideNodesOnDrag: false,
    },
    configure: {
        enabled: true,
        filter: 'physics, layout',
        // filter: 'physics, edges, layout, interaction',
        showButton: true,
    },
};

function getSchemaText(incrementOption, incrementDescription) {
    let schemaText = '';

    /**
     * IncrementOption:
        "0: once",
        "1: hourly",
            incrementDescription: Repeat after each 'minutes hours 0 0 '
        "2: daily",
            incrementDescription: Repeat after each '0 0 days 0 '
        "3: weekly",
        "4: monthly" 
     */

    if (incrementOption === 0) {
        schemaText = 'Once';
    } else if (incrementOption === 1) {
        schemaText = 'Hourly';
    } else if (incrementOption === 2) {
        schemaText = 'Daily';
    } else if (incrementOption === 3) {
        schemaText = 'Weekly';
    } else if (incrementOption === 4) {
        schemaText = 'Monthly';
    }

    return schemaText;
}

const prepareFile = async (url) => {
    const paths = [STATIC_PATH, url];
    if (url.endsWith('/')) paths.push('index.html');

    const filePath = path.join(...paths);
    const pathTraversal = !filePath.startsWith(STATIC_PATH);
    const exists = await fs.promises.access(filePath).then(...toBool);
    const found = !pathTraversal && exists;
    const streamPath = found ? filePath : `${STATIC_PATH}/404.html`;
    const ext = path.extname(streamPath).substring(1).toLowerCase();

    let stream;
    if (ext === 'html') {
        const file = await fs.promises.readFile(streamPath, 'utf8');
        const template = handlebars.compile(file, { noEscape: true });

        // Get task network model
        const taskModel = taskNetwork;

        // Add schema nodes
        const nodes = taskModel.nodes.filter((node) => node.metaNode === true);
        // let nodes = taskModel.nodes.filter((node) => node.metaNodeType === 'schedule');
        let nodesNetwork = nodes.map((node) => {
            const newNode = {};
            if (node.metaNodeType === 'schedule') {
                newNode.id = node.id;
                newNode.label = node.label;
                // newNode.title = node.label;
                newNode.title = `<strong>Schema trigger</strong><br>Name: ${node.label}<br>Enabled: ${
                    node.enabled
                }<br>Schema: ${getSchemaText(
                    node.completeSchemaEvent.incrementOption,
                    node.completeSchemaEvent.incrementDescription
                )}<br>Next: ${
                    node.completeSchemaEvent.operational.nextExecution === '1753-01-01T00:00:00.000Z'
                        ? '-'
                        : node.completeSchemaEvent.operational.nextExecution
                }<br>Timezone: ${node.completeSchemaEvent.timeZone}<br>Triggered times: ${
                    node.completeSchemaEvent.operational.timesTriggered
                }`;
                newNode.shape = 'triangle';
                // newNode.icon = { face: 'fontawesome', code: '\uf017' };
                newNode.color = node.enabled ? '#FFA807' : '#BCB9BF';
                // Needed to distinguish real tasks from meta tasks in the network diagram
                newNode.isReloadTask = false;
            } else if (node.metaNodeType === 'composite') {
                newNode.id = node.id;
                newNode.label = node.label;
                newNode.title = `<strong>Composite trigger</strong><br>Name: ${node.label}<br>Enabled: ${node.enabled}`;
                newNode.shape = 'hexagon';
                newNode.color = '#FFA807';
                // Needed to distinguish real tasks from meta tasks in the network diagram
                newNode.isReloadTask = false;
            } else {
                logger.error(`Huh? That's an unknown meta node type: ${node.metaNodeType}`);
            }
            // task.color = task.schemaEvent.enabled ? '#FFA807' : '#BCB9BF';
            return newNode;
        });

        // Add task nodes
        nodesNetwork = taskModel.tasks
            .map((node) => {
                let newNode = null;
                newNode = {};
                newNode.id = node.taskId;
                newNode.label = node.taskName;
                // newNode.title = node.taskName;

                // Reload task or external program task?
                if (node.taskType === 0) {
                    // Reload task
                    newNode.title = `<strong>Reload task</strong><br>Name: ${node.taskName}<br>Task ID: ${node.taskId}<br>Enabled: ${node.taskEnabled}<br>App: ${node.appName}<br>Last exec status: ${node.taskLastStatus}<br>Last exec start: ${node.taskLastExecutionStartTimestamp}<br>Last exec stop: ${node.taskLastExecutionStopTimestamp}`;
                    newNode.shape = 'box';
                } else if (node.taskType === 1) {
                    // External program task
                    newNode.title = `<strong>Ext. program task</strong><br>Name: ${node.taskName}<br>Task ID: ${node.taskId}<br>Enabled: ${node.taskEnabled}<br>Last exec status: ${node.taskLastStatus}<br>Last exec start: ${node.taskLastExecutionStartTimestamp}<br>Last exec stop: ${node.taskLastExecutionStopTimestamp}`;
                    newNode.shape = 'ellipse';
                }

                // Needed to distinguish real tasks from meta tasks in the network diagram
                newNode.isReloadTask = true;

                // newNode.color = node.taskEnabled ? '#FFA807' : '#BCB9BF';
                if (node.taskLastStatus === 'NeverStarted') {
                    newNode.color = '#999';
                } else if (node.taskLastStatus === 'Triggered' || node.taskLastStatus === 'Queued') {
                    newNode.color = '#6cf';
                } else if (node.taskLastStatus === 'Started') {
                    newNode.color = '#6cf';
                } else if (
                    node.taskLastStatus === 'AbortInitiated' ||
                    node.taskLastStatus === 'Aborting' ||
                    node.taskLastStatus === 'Error' ||
                    node.taskLastStatus === 'Reset'
                ) {
                    newNode.color = '#fd8008';
                } else if (node.taskLastStatus === 'Aborted' || node.taskLastStatus === 'FinishedFail') {
                    newNode.color = '#fb0207';
                } else if (node.taskLastStatus === 'FinishedSuccess') {
                    newNode.color = '#21ff06';
                } else if (node.taskLastStatus === 'Skipped') {
                    newNode.color = '#6cf';
                }
                newNode.taskLastStatus = node.taskLastStatus;
                return newNode;
            })
            .concat(nodesNetwork);

        const networkTask = { nodes: nodesNetwork, edges: taskModel.edges };

        templateData.nodes = JSON.stringify(nodesNetwork);
        templateData.edges = JSON.stringify(taskModel.edges);

        templateData.visOptions = JSON.stringify(visOptions);

        const result = template(templateData);
        stream = Readable.from([result]);
    } else {
        stream = fs.createReadStream(streamPath);
    }

    return { found, ext, stream };
};

// Request handler for http server
const requestHandler = async (req, res) => {
    const file = await prepareFile(req.url);
    const statusCode = file.found ? 200 : 404;
    const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
    res.writeHead(statusCode, { 'Content-Type': mimeType });
    file.stream.pipe(res);

    if (statusCode === 404) {
        logger.error(`${req.method} ${req.url} ${statusCode}`);
    } else if (statusCode === 200) {
        logger.verbose(`${req.method} ${req.url} ${statusCode}`);
    }
};

// Set up http server for serviing html pages with the task visualization
const startHttpServer = async (options) => {
    const server = http.createServer(requestHandler);

    server.listen(options.visPort, options.visHost, () => {
        logger.info('Using vis.js to visualize tasks, more info at https://github.com/visjs/vis-network');
        logger.info('');
        logger.info(`Task visualization server listening on http://${options.visHost}:${options.visPort}`);
        logger.info('Press Ctrl-C to quit.');
    });
};

const visTask = async (options) => {
    // Set log level
    setLoggingLevel(options.logLevel);

    logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
    logger.verbose(`Ctrl-Q was started from ${execPath}`);

    logger.verbose('Visulise tasks');
    logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

    logger.verbose(`Path to html files: ${STATIC_PATH}`);

    // Verify files used by http server exist
    let fileExists = await verifyFileExists(`${STATIC_PATH}/index.html`);
    if (!fileExists) {
        logger.error(`File ${STATIC_PATH}/index.html does not exist`);
        return false;
    }

    fileExists = await verifyFileExists(`${STATIC_PATH}/404.html`);
    if (!fileExists) {
        logger.error(`File ${STATIC_PATH}/404.html does not exist`);
        return false;
    }

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
    taskNetwork = qlikSenseTasks.taskNetwork;

    // Add additional values to Handlebars template
    templateData.visTaskHost = options.visHost;
    templateData.visTaskPort = options.visPort;

    // Get reload task count, i.e. tasks where taskType === 0
    templateData.reloadTaskCount = qlikSenseTasks.taskList.filter((task) => task.taskType === 0).length;

    // Get external program task count, i.e. tasks where taskType === 1
    templateData.externalProgramTaskCount = qlikSenseTasks.taskList.filter((task) => task.taskType === 1).length;

    // Get schema trigger count
    templateData.schemaTriggerCount = qlikSenseTasks.qlikSenseSchemaEvents.schemaEventList.length;

    // Get composite trigger count
    templateData.compositeTaskCount = qlikSenseTasks.qlikSenseCompositeEvents.compositeEventList.length;

    startHttpServer(optionsNew);
    return true;
};

module.exports = {
    visTask,
};
