/* global vis */
// Ctrl-Q task network page: loads the task network from the Ctrl-Q server and draws it with vis-network.

const VIS_OPTIONS = {
    nodes: {
        widthConstraint: { maximum: 200 },
        font: '20px arial',
    },
    edges: {
        arrows: 'to',
        width: 5,
        smooth: false,
        font: {
            size: 22, // Increase font size for text edge labels
        },
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
    },
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
        showButton: true,
    },
};

const $ = (id) => document.getElementById(id);

let taskNetwork = null;
let network = null;
let nodes = null;

async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
        throw new Error(`${url}: HTTP ${res.status}`);
    }
    return res.json();
}

/**
 * Tooltip of a node, as an element: vis-network shows text titles as plain text, so formatting needs an element.
 * Task and trigger names come from Sense, so everything goes into the element as text, never as HTML.
 *
 * @param {{heading: string, rows: Array<[string, string]>}} tooltip - Heading and label/value rows.
 * @returns {HTMLElement} The tooltip.
 */
function tooltipElement({ heading, rows }) {
    const box = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = heading;
    box.append(title);
    for (const [label, value] of rows) {
        box.append(document.createElement('br'), `${label}: ${value}`);
    }
    return box;
}

function showMessage(text) {
    $('loadingBar').classList.remove('done');
    $('loadingBar').hidden = false;
    $('loadingMessage').textContent = text;
    $('loadingMessage').hidden = false;
}

function showProgress(fraction) {
    const maxWidth = 496;
    const minWidth = 20;
    $('bar').style.width = `${Math.max(minWidth, maxWidth * fraction)}px`;
    $('text').textContent = `${Math.round(fraction * 100)}%`;
}

function hideLoadingBar() {
    showProgress(1);
    $('loadingBar').classList.add('done');
    // Remove the overlay once it has faded out
    setTimeout(() => {
        $('loadingBar').hidden = true;
    }, 500);
}

function showCounts() {
    $('reloadTaskCount').textContent = taskNetwork.counts.reloadTasks;
    $('externalProgramTaskCount').textContent = taskNetwork.counts.externalProgramTasks;
    $('schemaTriggerCount').textContent = taskNetwork.counts.schemaTriggers;
    $('compositeTriggerCount').textContent = taskNetwork.counts.compositeTriggers;
    $('appVersion').textContent = taskNetwork.appVersion;
}

function showNodeInfo(nodeId) {
    // Clusters are not in the data set
    const node = nodes.get(nodeId);
    if (!node) {
        return;
    }
    const rows = [
        ['ID', node.id],
        ['Name', node.label],
        ['Type', node.typeName],
    ].map(([label, value]) => {
        const th = document.createElement('th');
        th.textContent = label;
        const td = document.createElement('td');
        td.textContent = value;
        const tr = document.createElement('tr');
        tr.append(th, td);
        return tr;
    });
    $('nodeInfoContent').replaceChildren(...rows);
    $('nodeInfoModal').hidden = false;
}

function draw() {
    // Clean up old network
    if (network !== null) {
        network.destroy();
        network = null;
    }
    $('loadingBar').classList.remove('done');
    $('loadingBar').hidden = false;
    showProgress(0);

    nodes = new vis.DataSet(taskNetwork.nodes.map(({ tooltip, ...node }) => ({ ...node, title: tooltipElement(tooltip) })));
    const edges = new vis.DataSet(taskNetwork.edges);

    network = new vis.Network($('network'), { nodes, edges }, VIS_OPTIONS);

    network.on('stabilizationProgress', (params) => showProgress(params.iterations / params.total));
    network.once('stabilizationIterationsDone', hideLoadingBar);

    network.on('click', (params) => {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0]; // Get the ID of the clicked node
            if (network.isCluster(nodeId)) {
                network.openCluster(nodeId);
            }
        }
    });

    // Open node info modal popup
    network.on('doubleClick', (params) => {
        if (params.nodes.length > 0) {
            showNodeInfo(params.nodes[0]);
        }
    });

    network.setOptions({ configure: { enabled: true, container: $('networkConfig') } });

    if (taskNetwork.nodes.length === 0) {
        showMessage('There are no tasks to show.');
    }
}

function clusterByHubSize() {
    const clusterOptionsByData = {
        processProperties(clusterOptions, childNodes) {
            clusterOptions.label = `[${childNodes.length}]`;
            return clusterOptions;
        },
        clusterNodeProperties: {
            borderWidth: 3,
            shape: 'box',
            font: { size: 30 },
        },
    };
    network.clusterByHubsize(undefined, clusterOptionsByData);
}

function uncluster() {
    let clusterFound = false;
    for (const nodeId of network.body.nodeIndices) {
        if (network.isCluster(nodeId)) {
            clusterFound = true;
            network.openCluster(nodeId);
        }
    }
    return clusterFound;
}

function unclusterAll() {
    while (uncluster()) {
        // Clusters can contain clusters
    }
}

// Make the legend movable
function makeDraggable(box) {
    let startX = 0;
    let startY = 0;

    const onMove = (e) => {
        e.preventDefault();
        box.style.top = `${box.offsetTop - (startY - e.clientY)}px`;
        box.style.left = `${box.offsetLeft - (startX - e.clientX)}px`;
        startX = e.clientX;
        startY = e.clientY;
    };
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };

    box.addEventListener('mousedown', (e) => {
        // Links in the legend must stay clickable
        if (e.target.closest('a')) {
            return;
        }
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function bindControls() {
    makeDraggable($('nodeLegend'));

    $('toggleLegend').addEventListener('click', () => {
        $('nodeLegend').hidden = !$('nodeLegend').hidden;
    });
    $('clusterByHubSize').addEventListener('click', () => network && clusterByHubSize());
    $('clusterOutlier').addEventListener('click', () => network && network.clusterOutliers());
    $('unclusterAll').addEventListener('click', () => network && unclusterAll());
    // Draw the network again, with a new layout
    $('refreshNetwork').addEventListener('click', () => taskNetwork && draw());
    $('toggleNetworkConfig').addEventListener('click', () => {
        $('networkConfig').hidden = !$('networkConfig').hidden;
    });

    const closeModal = () => {
        $('nodeInfoModal').hidden = true;
    };
    document.querySelector('#nodeInfoModal .close').addEventListener('click', closeModal);
    $('nodeInfoModal').addEventListener('click', (e) => {
        if (e.target === $('nodeInfoModal')) {
            closeModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

async function start() {
    bindControls();
    try {
        taskNetwork = await getJson('/api/network');
    } catch (err) {
        showMessage(`Could not load the task network from Ctrl-Q (${err.message}). Is Ctrl-Q still running?`);
        return;
    }
    showCounts();
    draw();
}

start();
