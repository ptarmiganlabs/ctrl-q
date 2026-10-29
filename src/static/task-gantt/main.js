/* global echarts */
// Ctrl-Q task Gantt page: loads the snapshot from the Ctrl-Q server, draws it with ECharts, and shows details.
import { createClientStore, laneGaps, rowBegin, rowWait } from './store.js';
import { buildChartOption, createPatterns, lanesThatFit } from './chart.js';
import {
    el,
    setChildren,
    fmtTime,
    fmtDuration,
    statusInfo,
    csvCell,
    cssVar,
    TASK_TYPE_NAMES,
    FLAG_STALE,
    PROBLEM_BUCKETS,
} from './format.js';

const RANGES = { '6h': 6 * 3600e3, '24h': 24 * 3600e3, '3d': 3 * 86400e3, '7d': 7 * 86400e3 };
// Executions listed in the task panel
const MAX_TASK_RUNS = 100;
const $ = (id) => document.getElementById(id);

const store = createClientStore();
const ui = { search: '', statusFilter: 'all', sort: 'first', onlyWithRuns: true, node: '', utc: false, followLive: true };
let config = null;
let chart = null;
let colors = null;
let patterns = null;
let view = { order: [], rows: [] };
let rowKeys = [];
let pendingZoom = null;
let lastOrderSig = '';
let lastOrder = [];
let brushing = false;
let renderTimer = null;
let lastRenderAt = 0;
let events = null;
// EventSource state: false = not opened yet, true = open, null = lost (reload the snapshot when it reopens)
let liveConnected = false;
let liveStarted = false;
// Server clock minus this browser's clock: execution times are server times
let clockOffset = 0;
// Snapshot reloads in progress: deltas that arrive meanwhile are kept and applied afterwards
let resyncing = null;
let resyncAgain = false;
let pendingDeltas = [];
// Only the latest clicked execution may fill the execution panel
let executionRequest = 0;

const serverNow = () => Date.now() + clockOffset;

// ---------------------------------------------------------------------------------------------------------------
// Data loading

async function getJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
        throw new Error(`${url}: HTTP ${res.status}`);
    }
    return res.json();
}

async function loadSnapshot() {
    const snap = await getJson('/api/snapshot');
    clockOffset = snap.generatedAt - Date.now();
    store.load(snap);
    updateNodeFilter();
    renderBadges();
    renderEpisodes();
    return snap;
}

// ---------------------------------------------------------------------------------------------------------------
// Theme

function readColors() {
    return {
        fg: cssVar('--fg'),
        muted: cssVar('--muted'),
        panel: cssVar('--panel'),
        border: cssVar('--border'),
        grid: cssVar('--chart-grid'),
        hatch: cssVar('--hatch'),
        danger: cssVar('--danger'),
        episode: cssVar('--episode'),
        status: {
            success: cssVar('--st-success'),
            failed: cssVar('--st-failed'),
            aborted: cssVar('--st-aborted'),
            aborting: cssVar('--st-aborted'),
            error: cssVar('--st-error'),
            skipped: cssVar('--st-skipped'),
            running: cssVar('--st-running'),
            waiting: cssVar('--st-waiting'),
            queued: cssVar('--st-waiting'),
            unknown: cssVar('--st-unknown'),
        },
    };
}

function initChart() {
    const zoom = chart ? currentZoom() : null;
    if (chart) chart.dispose();
    colors = readColors();
    patterns = createPatterns(colors);
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Dirty-rect rendering stays off: with it, the axis pointer corrupts dense line series such as the concurrency strip
    // (apache/echarts#21634)
    chart = echarts.init($('chart'), dark ? 'dark' : null, { renderer: 'canvas', useDirtyRect: false });
    chart.on('click', onChartClick);
    chart.on('brushEnd', onBrushEnd);
    chart.on('datazoom', onDataZoom);
    if (zoom) pendingZoom = zoom;
    lastOrderSig = '';
}

// ---------------------------------------------------------------------------------------------------------------
// Rendering

function currentWindow() {
    const snap = store.snapshot();
    return snap ? snap.window : { from: serverNow() - 86400e3, to: serverNow() };
}

function currentZoom() {
    const opt = chart?.getOption();
    if (!opt?.dataZoom) return {};
    const dz = (id) => opt.dataZoom.find((d) => d.id === id) || {};
    return { xStart: dz('xSlider').startValue, xEnd: dz('xSlider').endValue, yStart: dz('ySlider').startValue };
}

function analyticsFor(node) {
    const a = store.snapshot()?.analytics;
    if (!a) return { concurrency: [], capacity: null, episodes: [] };
    const caps = store.snapshot().capacity?.nodes || [];
    if (node) {
        return {
            concurrency: a.concurrency.nodes.find((n) => n.name === node)?.steps || [],
            capacity: caps.find((c) => c.name === node)?.maxConcurrentEngines ?? null,
            episodes: a.episodes.filter((e) => e.node === node),
        };
    }
    const total = caps.reduce((sum, c) => sum + (c.maxConcurrentEngines || 0), 0);
    return { concurrency: a.concurrency.total, capacity: total || null, episodes: a.episodes };
}

function tooltipFor(dataIndex) {
    const row = store.row(rowKeys[dataIndex]);
    if (!row) return '';
    const lane = store.lane(row.lane);
    const st = statusInfo(row.status);
    const wait = rowWait(row);
    const end = row.stoppedAt;
    return el(
        'div',
        { class: 'tip' },
        el('div', { class: 'tip-title', text: lane?.name ?? '' }),
        el(
            'div',
            { class: 'tip-row' },
            el('span', { class: `swatch st-${st.bucket}` }),
            row.flags & FLAG_STALE ? 'State unknown (stale)' : st.name
        ),
        el('div', { class: 'tip-row', text: `Triggered: ${fmtTime(row.triggeredAt, ui.utc)}` }),
        wait > 0 ? el('div', { class: 'tip-row', text: `Waited: ${fmtDuration(wait)}${row.queuedAt !== null ? ' (queued)' : ''}` }) : null,
        row.startedAt !== null
            ? el('div', {
                  class: 'tip-row',
                  text: `Ran: ${end === null ? 'running for ' : ''}${fmtDuration((end ?? serverNow()) - row.startedAt)}`,
              })
            : null,
        el('div', { class: 'tip-row', text: store.nodes()[row.node] ? `Node: ${store.nodes()[row.node]}` : '' })
    );
}

function render({ resetY = false } = {}) {
    const snap = store.snapshot();
    if (!snap || !chart) return;
    const win = currentWindow();
    const now = serverNow();
    view = store.view({ ...ui, from: win.from, to: win.to, now });

    const orderSig = view.order.join(',');
    const zoom = pendingZoom || currentZoom();
    pendingZoom = null;
    if (ui.followLive && zoom.xStart !== undefined && zoom.xEnd !== undefined) {
        const span = zoom.xEnd - zoom.xStart;
        zoom.xEnd = win.to;
        zoom.xStart = Math.max(win.from, win.to - span);
    }
    if (resetY) {
        zoom.yStart = 0;
    } else if (orderSig !== lastOrderSig && zoom.yStart > 0) {
        // The order changed because of new data or the moving clock: keep the lane at the top where it was
        const i = view.order.indexOf(lastOrder[zoom.yStart]);
        if (i >= 0) zoom.yStart = i;
    }
    lastOrderSig = orderSig;
    lastOrder = view.order;

    const a = analyticsFor(ui.node);
    const built = buildChartOption({
        order: view.order,
        laneOf: (idx) => store.lane(idx),
        rows: view.rows,
        window: win,
        now,
        zoom,
        useUTC: ui.utc,
        colors,
        patterns,
        concurrency: a.concurrency,
        capacity: a.capacity,
        episodes: a.episodes,
        gaps: laneGaps({
            order: view.order,
            laneOf: (idx) => store.lane(idx),
            window: win,
            live: snap.live,
            connected: liveConnected === true,
        }),
        chartHeight: $('chart').clientHeight,
        tooltip: tooltipFor,
    });
    rowKeys = built.rowKeys;
    // Merge (replacing the series) rather than rebuild: the brush and an ongoing drag keep their state
    chart.setOption(built.option, { replaceMerge: ['series'] });
    lastRenderAt = Date.now();

    const empty = $('empty');
    if (view.order.length === 0) {
        empty.classList.remove('hidden');
        empty.textContent = store.lanes().length
            ? 'No task executions match the current filters in this time window.'
            : 'No tasks found in Qlik Sense.';
    } else {
        empty.classList.add('hidden');
    }
    renderSummary(a);
}

function renderSummary(a) {
    const runs = view.rows.length;
    const peakRun = Math.max(0, ...a.concurrency.map((b) => b[1]));
    const peakQueue = Math.max(0, ...a.concurrency.map((b) => b[2]));
    const fit = lanesThatFit($('chart').clientHeight);
    setChildren(
        $('summary'),
        `${view.order.length} tasks · ${runs} executions · peak ${peakRun} running${a.capacity ? ` of ${a.capacity}` : ''}, ${peakQueue} queued · ${a.episodes.length} congestion episode(s)`,
        view.order.length > fit ? ` · scroll for more tasks (mouse wheel over the chart)` : ''
    );
}

function renderBadges() {
    const snap = store.snapshot();
    const label = { qrs: 'QRS', 'history-file': 'History file', 'ops-monitor': 'Operations Monitor', 'sched-log': 'Scheduler logs' };
    const badges = (snap?.sources || []).map((s) => {
        const coverage = s.coverage
            ? ` · ${fmtTime(s.coverage.fromMs, ui.utc).slice(0, 10)} → ${fmtTime(s.coverage.toMs, ui.utc).slice(5, 16)}`
            : '';
        const title = [s.message, s.hint, s.records ? `${s.records} executions` : ''].filter(Boolean).join('\n');
        return el(
            'span',
            { class: `badge ${s.state}`, title },
            el('span', { class: 'state', text: s.state }),
            `${label[s.id] || s.id}${coverage}`
        );
    });
    setChildren($('sourceBadges'), badges);
}

function renderLegend() {
    const item = (cls, text) => el('span', {}, el('span', { class: `swatch ${cls}` }), text);
    setChildren(
        $('legend'),
        item('st-success', 'Success'),
        item('st-failed', 'Failed'),
        item('st-aborted', 'Aborted'),
        item('st-error', 'Error / reset'),
        item('st-skipped', 'Skipped'),
        item('st-running', 'Running'),
        item('st-waiting', 'Waiting / queued (thin bar before the run)'),
        item('st-unknown', 'State unknown'),
        item('st-gap', 'No data'),
        item('st-episode', 'Congestion: reloads queued or all slots busy'),
        el('span', { text: '† task no longer exists' }),
        el(
            'span',
            { class: 'credits' },
            'Chart: ',
            el('a', {
                href: '/vendor/echarts/LICENSE.txt',
                target: '_blank',
                rel: 'noopener noreferrer',
                text: 'Apache ECharts (Apache-2.0)',
            })
        )
    );
}

function updateNodeFilter() {
    const select = $('nodeFilter');
    const nodes = (store.snapshot()?.capacity?.nodes || []).map((n) => n.name);
    for (const n of store.nodes()) if (n && !nodes.includes(n)) nodes.push(n);
    const current = select.value;
    setChildren(
        select,
        el('option', { value: '', text: 'All nodes' }),
        nodes.map((n) => el('option', { value: n, text: n }))
    );
    select.value = nodes.includes(current) ? current : '';
    select.closest('label').classList.toggle('hidden', nodes.length < 2);
}

// ---------------------------------------------------------------------------------------------------------------
// Side panels

function showTab(name) {
    for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('active', b.dataset.tab === name);
    for (const p of document.querySelectorAll('.panel')) p.classList.toggle('hidden', p.id !== `panel-${name}`);
}

function kv(pairs) {
    return el(
        'dl',
        { class: 'kv' },
        pairs.filter(Boolean).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v ?? '–')])
    );
}

function zoomTo(from, to) {
    const pad = Math.max(5 * 60e3, (to - from) * 0.25);
    ui.followLive = false;
    $('followLive').checked = false;
    chart.dispatchAction({ type: 'dataZoom', dataZoomId: 'xSlider', startValue: from - pad, endValue: to + pad });
    clearRangeButtons();
}

function renderEpisodes() {
    const a = analyticsFor(ui.node);
    const panel = $('panel-episodes');
    if (!a.episodes.length) {
        setChildren(
            panel,
            el('h2', { text: 'Congestion' }),
            el('p', {
                class: 'hint',
                text: 'No congestion in this time window: no reloads waited in a scheduler queue, and the schedulers never ran their maximum number of reloads at once.',
            })
        );
        return;
    }
    const items = a.episodes.map((ep) => {
        const top = ep.tasks.slice(0, 5);
        const node = el(
            'div',
            {
                class: 'episode',
                tabindex: '0',
                role: 'button',
                onclick: () => {
                    zoomTo(ep.from, ep.to);
                    showRange(ep.from, ep.to);
                },
                onkeydown: (e) => {
                    if (e.key === 'Enter') e.currentTarget.click();
                },
            },
            el('div', { class: 'when', text: `${fmtTime(ep.from, ui.utc)} · ${fmtDuration(ep.to - ep.from)}` }),
            el('div', {
                class: 'stats',
                text: `${ep.node ? `${ep.node.split('.')[0]}: ` : ''}peak ${ep.peakRunning} running${ep.capacity ? ` of ${ep.capacity}` : ''}, ${ep.peakQueued} queued · total wait ${fmtDuration(ep.waitMs)}`,
            }),
            el(
                'table',
                { class: 'list' },
                el(
                    'tr',
                    {},
                    el('th', { text: 'Task' }),
                    el('th', { class: 'num', text: 'Waited' }),
                    el('th', { class: 'num', text: 'Overlap' })
                ),
                top.map((t) =>
                    el(
                        'tr',
                        {},
                        el('td', { text: t.name ?? t.taskId }),
                        el('td', { class: 'num', text: fmtDuration(t.waitMs) }),
                        el('td', { class: 'num', text: fmtDuration(t.overlapMs) })
                    )
                )
            ),
            ep.tasks.length > top.length ? el('div', { class: 'hint', text: `+ ${ep.tasks.length - top.length} more task(s)` }) : null
        );
        return node;
    });
    setChildren(
        panel,
        el('h2', { text: `Congestion episodes (${a.episodes.length})` }),
        el('p', { class: 'hint', text: 'Most waiting first. Click one to zoom to it and list the tasks involved.' }),
        items
    );
}

async function showExecution(key) {
    const panel = $('panel-execution');
    showTab('execution');
    const row = store.row(key);
    const lane = row ? store.lane(row.lane) : null;
    setChildren(panel, el('h2', { text: lane?.name ?? 'Execution' }), el('p', { class: 'hint', text: 'Loading…' }));
    executionRequest += 1;
    const request = executionRequest;
    let data = null;
    try {
        data = await getJson(`/api/execution?key=${encodeURIComponent(key)}`);
    } catch (err) {
        if (request !== executionRequest) return;
        setChildren(
            panel,
            el('h2', { text: lane?.name ?? 'Execution' }),
            el('p', { class: 'hint', text: `Could not load details: ${err.message}` })
        );
        return;
    }
    // Another execution was clicked while this one loaded
    if (request !== executionRequest) return;
    const r = data.record;
    const st = statusInfo(r.status);
    const details = data.qrs?.details || [];
    setChildren(
        panel,
        el('h2', { text: data.task?.name ?? lane?.name ?? r.taskId }),
        kv([
            ['Status', el('span', {}, el('span', { class: `swatch st-${st.bucket}` }), st.name)],
            ['App', data.task?.appName],
            ['Triggered', fmtTime(r.triggeredAt, ui.utc)],
            r.queuedAt !== null ? ['Queued', fmtTime(r.queuedAt, ui.utc)] : null,
            ['Started', fmtTime(r.startedAt, ui.utc)],
            ['Stopped', r.stoppedAt === null ? 'still running' : fmtTime(r.stoppedAt, ui.utc)],
            ['Waited', fmtDuration(r.startedAt !== null && r.triggeredAt !== null ? r.startedAt - r.triggeredAt : null)],
            ['Run time', r.startedAt !== null ? fmtDuration((r.stoppedAt ?? serverNow()) - r.startedAt) : '–'],
            ['Node', r.nodeName || '–'],
            r.failureReason ? ['Failure', r.failureReason] : null,
            ['Execution id', r.executionId],
        ]),
        details.length
            ? [
                  el('h3', { text: 'Execution log (QRS)' }),
                  el(
                      'table',
                      { class: 'list' },
                      details.map((d) =>
                          el(
                              'tr',
                              {},
                              el('td', { class: 'num', text: fmtTime(d.t, ui.utc, false) }),
                              el('td', { class: `msg-${d.type}`, text: d.message })
                          )
                      )
                  ),
              ]
            : el('p', { class: 'hint', text: 'Detailed state changes are only available while QRS still holds this execution.' })
    );
}

function showTask(laneIdx) {
    const lane = store.lane(laneIdx);
    if (!lane) return;
    showTab('task');
    const win = currentWindow();
    const runs = store
        .rowsIn(win.from, win.to, serverNow())
        .filter((r) => r.lane === laneIdx)
        .sort((a, b) => rowBegin(b) - rowBegin(a));
    const durations = runs
        .filter((r) => r.stoppedAt !== null && r.startedAt !== null)
        .map((r) => r.stoppedAt - r.startedAt)
        .sort((a, b) => a - b);
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
    const fails = runs.filter((r) => PROBLEM_BUCKETS.has(statusInfo(r.status).bucket)).length;
    setChildren(
        $('panel-task'),
        el('h2', { text: lane.name }),
        lane.deleted
            ? el('p', { class: 'hint', text: 'This task no longer exists in Qlik Sense. Its history comes from the local history file.' })
            : null,
        kv([
            ['Type', TASK_TYPE_NAMES[lane.taskType] ?? '–'],
            ['App', lane.appName],
            ['Stream', lane.stream],
            ['Enabled', lane.enabled ? 'yes' : 'no'],
            ['Tags', (lane.tags || []).join(', ') || '–'],
            ['Runs in window', String(runs.length)],
            ['Failed', String(fails)],
            ['Median run time', fmtDuration(median)],
            ['Total queue wait', fmtDuration(runs.reduce((s, r) => s + rowWait(r), 0))],
            ['Task id', lane.id],
        ]),
        el('h3', { text: runs.length > MAX_TASK_RUNS ? `Latest ${MAX_TASK_RUNS} executions` : 'Executions' }),
        el(
            'table',
            { class: 'list' },
            el(
                'tr',
                {},
                el('th', { text: 'Triggered' }),
                el('th', { text: 'Status' }),
                el('th', { class: 'num', text: 'Wait' }),
                el('th', { class: 'num', text: 'Run' })
            ),
            runs.slice(0, MAX_TASK_RUNS).map((r) =>
                el(
                    'tr',
                    {},
                    el(
                        'td',
                        {},
                        el('button', {
                            class: 'linkish',
                            type: 'button',
                            text: fmtTime(r.triggeredAt ?? r.startedAt, ui.utc),
                            onclick: () => showExecution(r.key),
                        })
                    ),
                    el('td', {}, el('span', { class: `swatch st-${statusInfo(r.status).bucket}` }), statusInfo(r.status).name),
                    el('td', { class: 'num', text: fmtDuration(rowWait(r)) }),
                    el('td', {
                        class: 'num',
                        text: r.startedAt !== null ? fmtDuration((r.stoppedAt ?? serverNow()) - r.startedAt) : '–',
                    })
                )
            )
        ),
        runs.length > MAX_TASK_RUNS
            ? el('p', { class: 'hint', text: `+ ${runs.length - MAX_TASK_RUNS} older execution(s) in the window, not listed` })
            : null
    );
}

function showRange(from, to) {
    showTab('range');
    const now = serverNow();
    const overlap = (a, b) => Math.max(0, Math.min(b, to) - Math.max(a, from));
    const byLane = new Map();
    for (const r of view.rows) {
        const begin = rowBegin(r);
        const end = r.stoppedAt ?? now;
        const ov = overlap(begin, end);
        if (ov <= 0) continue;
        const e = byLane.get(r.lane) || { lane: r.lane, overlap: 0, wait: 0, runs: 0, statuses: new Set() };
        e.overlap += ov;
        if (r.startedAt !== null) e.wait += overlap(begin, r.startedAt);
        e.runs += 1;
        e.statuses.add(statusInfo(r.status).bucket);
        byLane.set(r.lane, e);
    }
    const entries = [...byLane.values()].sort((a, b) => b.wait - a.wait || b.overlap - a.overlap);
    // Concurrency buckets overlapping the range (buckets are wider than a minute for long --lookback windows)
    const bucketMs = store.snapshot()?.analytics?.bucketMs || 60e3;
    const conc = analyticsFor(ui.node).concurrency.filter((b) => b[0] + bucketMs > from && b[0] < to);
    const peakRun = Math.max(0, ...conc.map((b) => b[1]));
    const peakQueue = Math.max(0, ...conc.map((b) => b[2]));
    setChildren(
        $('panel-range'),
        el('h2', { text: `${fmtTime(from, ui.utc)} – ${fmtTime(to, ui.utc, false)}` }),
        el('p', {
            class: 'hint',
            text: `${fmtDuration(to - from)} · ${entries.length} task(s) shown here ran · peak ${peakRun} running, ${peakQueue} queued`,
        }),
        entries.length
            ? el(
                  'table',
                  { class: 'list' },
                  el(
                      'tr',
                      {},
                      el('th', { text: 'Task' }),
                      el('th', { class: 'num', text: 'In range' }),
                      el('th', { class: 'num', text: 'Waited' }),
                      el('th', { class: 'num', text: 'Runs' })
                  ),
                  entries.map((e) =>
                      el(
                          'tr',
                          {},
                          el(
                              'td',
                              {},
                              el('button', {
                                  class: 'linkish',
                                  type: 'button',
                                  text: store.lane(e.lane)?.name ?? '',
                                  onclick: () => showTask(e.lane),
                              })
                          ),
                          el('td', { class: 'num', text: fmtDuration(e.overlap) }),
                          el('td', { class: 'num', text: fmtDuration(e.wait) }),
                          el('td', { class: 'num', text: String(e.runs) })
                      )
                  )
              )
            : el('p', { class: 'hint', text: 'No executions of the tasks shown in this range.' })
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Chart events

function onChartClick(params) {
    if (params.componentType === 'series' && params.seriesId === 'bars') {
        showExecution(rowKeys[params.dataIndex]);
    } else if (params.componentType === 'yAxis') {
        showTask(view.order[Number(params.value)]);
    }
}

function onBrushEnd(e) {
    const area = e.areas?.[0];
    if (area?.coordRange) {
        const [from, to] = area.coordRange;
        showRange(Math.min(from, to), Math.max(from, to));
    }
}

function onDataZoom() {
    // A manual zoom/pan away from the newest data turns "follow live" off
    const z = currentZoom();
    const win = currentWindow();
    if (ui.followLive && z.xEnd !== undefined && win.to - z.xEnd > 60e3) {
        ui.followLive = false;
        $('followLive').checked = false;
    }
    clearRangeButtons();
}

function setBrush(on) {
    brushing = on;
    $('brushButton').classList.toggle('active', on);
    chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: on ? { brushType: 'lineX', brushMode: 'single' } : { brushType: false },
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Toolbar

function clearRangeButtons() {
    for (const b of document.querySelectorAll('[data-range]')) b.classList.remove('active');
}

function setRange(range) {
    const win = currentWindow();
    const span = RANGES[range];
    const from = span ? Math.max(win.from, win.to - span) : win.from;
    chart.dispatchAction({ type: 'dataZoom', dataZoomId: 'xSlider', startValue: from, endValue: win.to });
    for (const b of document.querySelectorAll('[data-range]')) b.classList.toggle('active', b.dataset.range === range);
    ui.followLive = true;
    $('followLive').checked = true;
}

// The executions in the shown time range (the zoomed part of the window)
function shownRows() {
    const z = currentZoom();
    const win = currentWindow();
    const from = z.xStart ?? win.from;
    const to = z.xEnd ?? win.to;
    const now = serverNow();
    return view.rows.filter((r) => rowBegin(r) <= to && (r.stoppedAt ?? now) >= from);
}

function downloadCsv() {
    const header = ['Task', 'Task id', 'App', 'Status', 'Triggered', 'Queued', 'Started', 'Stopped', 'Wait (s)', 'Run (s)', 'Node'];
    const lines = [header.map(csvCell).join(',')];
    for (const r of shownRows()) {
        const lane = store.lane(r.lane);
        const iso = (t) => (t === null || t === undefined ? '' : new Date(t).toISOString());
        lines.push(
            [
                lane?.name,
                lane?.id,
                lane?.appName,
                statusInfo(r.status).name,
                iso(r.triggeredAt),
                iso(r.queuedAt),
                iso(r.startedAt),
                iso(r.stoppedAt),
                Math.round(rowWait(r) / 1000),
                r.startedAt !== null && r.stoppedAt !== null ? Math.round((r.stoppedAt - r.startedAt) / 1000) : '',
                store.nodes()[r.node] ?? '',
            ]
                .map(csvCell)
                .join(',')
        );
    }
    // The byte order mark makes Excel read the file as UTF-8 (task names with å, ä, ö...)
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const a = el('a', {
        href: URL.createObjectURL(blob),
        download: `ctrl-q-task-executions-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.csv`,
    });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function bindToolbar() {
    for (const b of document.querySelectorAll('[data-range]')) b.addEventListener('click', () => setRange(b.dataset.range));
    for (const b of document.querySelectorAll('[data-tz]')) {
        b.addEventListener('click', () => {
            ui.utc = b.dataset.tz === 'utc';
            for (const x of document.querySelectorAll('[data-tz]')) x.classList.toggle('active', x === b);
            render();
            renderBadges();
            renderEpisodes();
        });
    }
    for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => showTab(b.dataset.tab));

    let searchTimer = null;
    $('search').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            ui.search = e.target.value;
            render({ resetY: true });
        }, 200);
    });
    $('statusFilter').addEventListener('change', (e) => {
        ui.statusFilter = e.target.value;
        render({ resetY: true });
    });
    $('sort').addEventListener('change', (e) => {
        ui.sort = e.target.value;
        render({ resetY: true });
    });
    $('onlyWithRuns').addEventListener('change', (e) => {
        ui.onlyWithRuns = e.target.checked;
        render({ resetY: true });
    });
    $('nodeFilter').addEventListener('change', (e) => {
        ui.node = e.target.value;
        render({ resetY: true });
        renderEpisodes();
    });
    $('followLive').addEventListener('change', (e) => {
        ui.followLive = e.target.checked;
        if (ui.followLive) setRange('24h');
    });
    $('brushButton').addEventListener('click', () => setBrush(!brushing));
    $('csvButton').addEventListener('click', downloadCsv);
    $('refreshButton').addEventListener('click', async () => {
        await resync();
        render();
    });
    $('dismissBanner').addEventListener('click', () => {
        $('retentionBanner').classList.add('hidden');
        try {
            localStorage.setItem('ctrlq.gantt.bannerDismissed', '1');
        } catch {
            // Storage may be unavailable; the banner just comes back next time
        }
    });
    try {
        if (localStorage.getItem('ctrlq.gantt.bannerDismissed') === '1') $('retentionBanner').classList.add('hidden');
    } catch {
        // ignore
    }

    document.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
            if (e.key === 'Escape') e.target.blur();
            return;
        }
        if (e.key === '/') {
            e.preventDefault();
            $('search').focus();
        } else if (e.key === 'b' || e.key === 'B') {
            setBrush(!brushing);
        } else if (e.key === 'Escape' && brushing) {
            setBrush(false);
        }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        initChart();
        render();
        // The new chart starts without range selection
        if (brushing) setBrush(true);
    });

    let lastFit = 0;
    new ResizeObserver(() => {
        chart?.resize();
        const fit = lanesThatFit($('chart').clientHeight);
        if (fit !== lastFit) {
            lastFit = fit;
            render();
        }
    }).observe($('chart'));
}

// ---------------------------------------------------------------------------------------------------------------
// Live updates

// Redraw at most once per second, however many updates arrive
function scheduleRender() {
    if (renderTimer) return;
    const wait = Math.max(0, 1000 - (Date.now() - lastRenderAt));
    renderTimer = setTimeout(() => {
        renderTimer = null;
        render();
    }, wait);
}

function setLiveState(state, text) {
    const ind = $('liveIndicator');
    ind.classList.toggle('on', state === 'on');
    ind.classList.toggle('warn', state === 'warn');
    ind.classList.toggle('error', state === 'error');
    $('liveText').textContent = text;
}

// Show whether the page is really up to date: the browser's connection to Ctrl-Q, and Ctrl-Q's polling of QRS
function updateLiveState() {
    if (!config.pollIntervalMs) {
        setLiveState('off', 'snapshot (live updates off)');
        return;
    }
    if (events?.readyState === EventSource.CLOSED) {
        setLiveState('error', 'disconnected from Ctrl-Q – reload the page');
        return;
    }
    if (liveConnected !== true) {
        setLiveState('error', liveConnected === null ? 'reconnecting…' : 'connecting…');
        return;
    }
    const qrs = store.snapshot()?.live?.qrs;
    if (qrs?.state === 'error') {
        setLiveState('error', 'live updates stopped – see the QRS badge');
    } else if (qrs && qrs.state !== 'ok') {
        setLiveState('warn', 'Sense not reachable, retrying…');
    } else {
        setLiveState('on', `live · every ${Math.round(config.pollIntervalMs / 1000)} s`);
    }
}

// Apply a delta to the current snapshot, or reload the snapshot if deltas were missed. Returns false on a gap.
function applyDelta(delta) {
    const snap = store.snapshot();
    if (!snap) return true;
    // Already part of the snapshot
    if (delta.rev < snap.rev) return true;
    // A gap: changes happened that this page has not seen
    if (delta.prevRev > snap.rev) return false;
    store.applyDelta(delta);
    return true;
}

// Load a fresh snapshot. Calls while one is loading are coalesced into one more load afterwards.
function resync() {
    if (resyncing) {
        resyncAgain = true;
        return resyncing;
    }
    resyncing = (async () => {
        do {
            resyncAgain = false;
            try {
                await loadSnapshot();
                // Deltas that arrived while loading: apply the ones newer than the snapshot
                for (const delta of pendingDeltas.splice(0)) {
                    if (!applyDelta(delta)) resyncAgain = true;
                }
                updateLiveState();
                advanceWindow();
                scheduleRender();
                if (!liveStarted) startLive();
            } catch (err) {
                pendingDeltas = [];
                setLiveState('error', `could not load data from Ctrl-Q: ${err.message}`);
            }
        } while (resyncAgain);
    })().finally(() => {
        resyncing = null;
    });
    return resyncing;
}

function onDelta(e) {
    const delta = JSON.parse(e.data);
    if (resyncing) {
        pendingDeltas.push(delta);
        return;
    }
    if (!applyDelta(delta)) {
        resync();
        return;
    }
    advanceWindow();
    scheduleRender();
}

function onAnalytics(e) {
    const payload = JSON.parse(e.data);
    const snap = store.snapshot();
    if (!snap || resyncing) return;
    snap.analytics = payload.analytics;
    snap.sources = payload.sources;
    snap.capacity = payload.capacity;
    renderBadges();
    renderEpisodes();
    scheduleRender();
}

// After every poll: how far the data is complete, the QRS state, and runs that turned stale
function onLive(e) {
    const live = JSON.parse(e.data);
    const snap = store.snapshot();
    if (!snap || resyncing) return;
    if (typeof live.now === 'number') clockOffset = live.now - Date.now();
    // Live coverage was split by an outage, or this page missed changes (e.g. while it connected): start over
    if (!snap.live || live.from !== snap.live.from || live.rev > snap.rev) {
        resync();
        return;
    }
    const qrsBefore = snap.live.qrs?.state;
    store.applyLive(live);
    if (live.qrs?.state !== qrsBefore) renderBadges();
    updateLiveState();
    advanceWindow();
    scheduleRender();
}

function connectLive() {
    events = new EventSource('/api/events');
    events.addEventListener('delta', onDelta);
    events.addEventListener('analytics', onAnalytics);
    events.addEventListener('live', onLive);
    events.addEventListener('open', () => {
        // After a reconnect, deltas sent while disconnected are lost
        if (liveConnected === null) resync();
        liveConnected = true;
        updateLiveState();
    });
    events.addEventListener('error', () => {
        // A non-200 answer (e.g. a new access token after a restart) closes the stream for good
        if (liveConnected) liveConnected = null;
        updateLiveState();
        scheduleRender();
    });
}

// Move the time window up to now, so new executions fall inside it
function advanceWindow() {
    const snap = store.snapshot();
    if (!snap || !config.pollIntervalMs) return;
    const to = serverNow();
    snap.window = { from: to - config.lookbackMs, to };
}

// Move the time window along with the clock, so running executions grow. Only while the page is visible: a
// background tab catches up when it is shown again, and new executions still arrive through onDelta.
function tick() {
    if (document.visibilityState !== 'visible') return;
    advanceWindow();
    scheduleRender();
}

// Live updates and the clock start once a snapshot has loaded, also when that first happens on Refresh
function startLive() {
    liveStarted = true;
    if (config.pollIntervalMs) connectLive();
    updateLiveState();
    setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick);
}

// ---------------------------------------------------------------------------------------------------------------
// Start

async function boot() {
    try {
        config = await getJson('/api/config');
    } catch (err) {
        $('empty').classList.remove('hidden');
        $('empty').textContent = `Could not load data from Ctrl-Q: ${err.message}`;
        setLiveState('error', 'error');
        return;
    }
    $('senseHost').textContent = config.senseHost;
    $('appVersion').textContent = config.appVersion;
    renderLegend();
    initChart();
    bindToolbar();
    await resync();
    render();
    if (!store.snapshot()) {
        $('empty').classList.remove('hidden');
        $('empty').textContent = 'Could not load data from Ctrl-Q. Check that it is still running, then press Refresh.';
    }
}

boot();
