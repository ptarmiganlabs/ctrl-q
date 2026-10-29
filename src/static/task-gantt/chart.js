/* global echarts */
// ECharts option for the task Gantt chart. buildChartOption() is pure (no DOM, no network) so it can be tested with
// ECharts server-side rendering.
//
// Grid 0: one lane per task, one bar per execution. A thin "wait" segment runs from trigger to start (queue time),
// then a full-height bar from start to stop. Hatched blocks mark time without data for the lane.
// Grid 1: running and queued reloads over time, with the schedulers' capacity and the congestion episodes.
import { statusInfo, FLAG_STALE, FLAG_DERIVED } from './format.js';

export const LANE_PX = 22;
const CONCURRENCY_HEIGHT = 110;
const SLIDER_HEIGHT = 22;
const LABEL_WIDTH = 230;
// Vertical layout: top axis labels, the Gantt lanes, a gap, the concurrency strip, its axis labels, the time slider
const GANTT_TOP = 30;
const GAP = 36;
const BELOW_CONCURRENCY = 26;
const BOTTOM_MARGIN = 8;

const DAY_MS = 24 * 3600 * 1000;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * The time window with finite bounds, from before to. ECharts 6.1 draws nothing at all when an axis min or max is NaN,
 * so a broken window must never reach the option.
 *
 * @param {{from: number, to: number}|undefined} window - Time window.
 * @param {number} now - Current time (finite).
 * @returns {{from: number, to: number}} The window, or the 24 hours before now (or before the window end) where it is
 *   not usable.
 */
export function safeWindow(window, now) {
    const to = finite(window?.to) ? window.to : now;
    const from = finite(window?.from) && window.from < to ? window.from : to - DAY_MS;
    return { from, to };
}

/**
 * How many lanes fit on screen.
 *
 * @param {number} chartHeight - Height of the chart element in px.
 * @returns {number} Number of lanes.
 */
export function lanesThatFit(chartHeight) {
    const ganttHeight = chartHeight - GANTT_TOP - GAP - CONCURRENCY_HEIGHT - BELOW_CONCURRENCY - SLIDER_HEIGHT - BOTTOM_MARGIN;
    return Math.max(5, Math.floor(ganttHeight / LANE_PX));
}

/**
 * Vertical positions of the chart parts. The Gantt grid is exactly as tall as the lanes it shows, so a handful of
 * tasks gives compact lanes rather than a few very tall ones.
 *
 * @param {number} laneCount - Number of lanes to show.
 * @param {number} chartHeight - Height of the chart element in px.
 * @returns {{fit: number, ganttTop: number, ganttHeight: number, concurrencyTop: number, sliderTop: number}} Layout.
 */
export function chartLayout(laneCount, chartHeight) {
    const fit = lanesThatFit(chartHeight);
    const ganttHeight = Math.max(1, Math.min(laneCount, fit)) * LANE_PX;
    const concurrencyTop = GANTT_TOP + ganttHeight + GAP;
    return { fit, ganttTop: GANTT_TOP, ganttHeight, concurrencyTop, sliderTop: concurrencyTop + CONCURRENCY_HEIGHT + BELOW_CONCURRENCY };
}

function clipTo(cs) {
    return { x: cs.x, y: cs.y, width: cs.width, height: cs.height };
}

function makeRenderBars({ colors, patterns }) {
    const fillFor = (bucket) => patterns[bucket] || colors.status[bucket] || colors.status.unknown;
    return (params, api) => {
        const pos = api.value(0);
        const trig = api.value(1);
        const start = api.value(2);
        const stop = api.value(3);
        const status = api.value(4);
        const flags = api.value(5);
        const bucket = statusInfo(status).bucket;
        const band = api.size([0, 1])[1];
        const h = Math.max(4, Math.min(band * 0.72, 18));
        const clip = clipTo(params.coordSys);
        const children = [];
        const anchor = finite(trig) ? trig : start;
        const y = api.coord([anchor, pos])[1];
        const stale = flags & FLAG_STALE;
        const opacity = flags & FLAG_DERIVED ? 0.65 : 1;
        // A run whose state is unknown is drawn grey and dashed, also while it (seemingly) still waits to start
        const staleStyle = { fill: colors.status.unknown, stroke: colors.fg, lineWidth: 1, lineDash: [3, 2], opacity: 0.6 };

        if (bucket === 'skipped') {
            const [x] = api.coord([anchor, pos]);
            const d = Math.max(h / 2, 4);
            if (x >= clip.x && x <= clip.x + clip.width) {
                children.push({
                    type: 'polygon',
                    shape: {
                        points: [
                            [x, y - d],
                            [x + d, y],
                            [x, y + d],
                            [x - d, y],
                        ],
                    },
                    style: { fill: colors.status.skipped, stroke: colors.fg, lineWidth: 1 },
                });
            }
            return { type: 'group', children };
        }

        // Queue / wait segment: trigger -> start, or trigger -> stop if it never started
        const waitEnd = finite(start) ? start : stop;
        if (finite(anchor) && finite(waitEnd) && waitEnd > anchor) {
            const [x0] = api.coord([anchor, pos]);
            const [x1] = api.coord([waitEnd, pos]);
            if (x1 - x0 >= 1) {
                const rect = echarts.graphic.clipRectByRect({ x: x0, y: y - h * 0.18, width: x1 - x0, height: h * 0.36 }, clip);
                const style = stale ? staleStyle : { fill: colors.status.waiting, opacity: 0.85 * opacity };
                if (rect) children.push({ type: 'rect', shape: rect, style });
            }
        }

        if (finite(start) && finite(stop)) {
            const [x0] = api.coord([start, pos]);
            const [x1] = api.coord([stop, pos]);
            const rect = echarts.graphic.clipRectByRect({ x: x0, y: y - h / 2, width: Math.max(x1 - x0, 2), height: h }, clip);
            if (rect) children.push({ type: 'rect', shape: rect, style: stale ? staleStyle : { fill: fillFor(bucket), opacity } });
        }
        return { type: 'group', children };
    };
}

function makeRenderGaps({ patterns, colors }) {
    return (params, api) => {
        const pos = api.value(0);
        const [x0, y] = api.coord([api.value(1), pos]);
        const [x1] = api.coord([api.value(2), pos]);
        const band = api.size([0, 1])[1];
        const rect = echarts.graphic.clipRectByRect(
            { x: x0, y: y - band / 2 + 1, width: x1 - x0, height: band - 2 },
            clipTo(params.coordSys)
        );
        return rect ? { type: 'rect', shape: rect, style: { fill: patterns.gap || colors.hatch, opacity: 0.55 }, silent: true } : null;
    };
}

/**
 * Build the complete ECharts option.
 *
 * @param {object} p - Parameters.
 * @param {number[]} p.order - Lane numbers in display order.
 * @param {Function} p.laneOf - (laneIdx) => lane object.
 * @param {Array<object>} p.rows - Execution rows to draw.
 * @param {{from: number, to: number}} p.window - Time window (x axis range).
 * @param {number} p.now - Current time; running executions end here.
 * @param {{xStart?: number, xEnd?: number, yStart?: number}} p.zoom - Zoom to restore.
 * @param {boolean} p.useUTC - Show times in UTC.
 * @param {object} p.colors - Theme colours.
 * @param {object} p.patterns - Canvas patterns per status bucket, plus 'gap'.
 * @param {Array<[number, number, number]>} p.concurrency - [time, running, queued] buckets.
 * @param {number|null} p.capacity - Max concurrent reloads, null if unknown.
 * @param {Array<{from: number, to: number}>} p.episodes - Congestion episodes to highlight.
 * @param {Array<[number, Array<[number, number]>]>} p.gaps - [laneIdx, [[from, to], ...]] time without data.
 * @param {number} p.chartHeight - Chart height in px.
 * @param {Function} [p.tooltip] - (rowIndex) => DOM node for the tooltip of an execution.
 * @returns {{option: object, rowKeys: string[]}} The option, and the execution key of each bar (by data index).
 */
export function buildChartOption(p) {
    const {
        order,
        laneOf,
        rows,
        window: rawWindow,
        now: rawNow,
        zoom = {},
        useUTC,
        colors,
        patterns = {},
        concurrency,
        capacity,
        episodes,
        gaps,
        chartHeight,
    } = p;
    const now = finite(rawNow) ? rawNow : Date.now();
    const window = safeWindow(rawWindow, now);
    const posByLane = new Map(order.map((idx, i) => [idx, i]));
    const layout = chartLayout(order.length, chartHeight);
    const { fit } = layout;

    const rowKeys = [];
    const barData = [];
    for (const r of rows) {
        const pos = posByLane.get(r.lane);
        if (pos === undefined) continue;
        rowKeys.push(r.key);
        barData.push([pos, r.triggeredAt ?? null, r.startedAt ?? null, r.stoppedAt ?? now, r.status, r.flags || 0]);
    }

    const gapData = [];
    for (const [laneIdx, ranges] of gaps || []) {
        const pos = posByLane.get(laneIdx);
        if (pos === undefined) continue;
        for (const [a, b] of ranges) gapData.push([pos, a, b]);
    }

    // Saved zoom values are used only when they are numbers (see safeWindow)
    const yStart = Math.min(Math.max(0, finite(zoom.yStart) ? zoom.yStart : 0), Math.max(0, order.length - fit));
    const xStart = finite(zoom.xStart) ? zoom.xStart : Math.max(window.from, window.to - DAY_MS);
    const xEnd = finite(zoom.xEnd) ? zoom.xEnd : window.to;

    const option = {
        animation: false,
        useUTC,
        backgroundColor: 'transparent',
        textStyle: { color: colors.fg },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        tooltip: {
            trigger: 'item',
            confine: true,
            enterable: false,
            backgroundColor: colors.panel,
            borderColor: colors.border,
            textStyle: { color: colors.fg },
            formatter: (params) => (params.seriesId === 'bars' && p.tooltip ? p.tooltip(params.dataIndex) : ''),
        },
        grid: [
            { id: 'gantt', left: LABEL_WIDTH, right: 36, top: layout.ganttTop, height: layout.ganttHeight, outerBoundsMode: 'none' },
            {
                id: 'concurrency',
                left: LABEL_WIDTH,
                right: 36,
                top: layout.concurrencyTop,
                height: CONCURRENCY_HEIGHT,
                outerBoundsMode: 'none',
            },
        ],
        // The brush component would otherwise add its own toolbox; range selection is started from the page toolbar
        toolbox: { show: false },
        xAxis: [
            {
                type: 'time',
                gridIndex: 0,
                min: window.from,
                max: window.to,
                position: 'top',
                axisLabel: { hideOverlap: true, color: colors.muted },
                axisLine: { lineStyle: { color: colors.border } },
                splitLine: { show: true, lineStyle: { color: colors.grid } },
            },
            {
                type: 'time',
                gridIndex: 1,
                min: window.from,
                max: window.to,
                axisLabel: { hideOverlap: true, color: colors.muted },
                axisLine: { lineStyle: { color: colors.border } },
                splitLine: { show: true, lineStyle: { color: colors.grid } },
            },
        ],
        yAxis: [
            {
                type: 'category',
                gridIndex: 0,
                inverse: true,
                data: order.map((_, i) => String(i)),
                triggerEvent: true,
                axisTick: { show: false },
                axisLine: { lineStyle: { color: colors.border } },
                axisLabel: {
                    interval: 0,
                    width: LABEL_WIDTH - 16,
                    overflow: 'truncate',
                    color: colors.fg,
                    formatter: (value) => {
                        const lane = laneOf(order[Number(value)]);
                        return lane ? `${lane.deleted ? '† ' : ''}${lane.name}` : '';
                    },
                },
                splitLine: { show: true, lineStyle: { color: colors.grid } },
            },
            {
                type: 'value',
                gridIndex: 1,
                name: 'reloads',
                nameTextStyle: { color: colors.muted },
                minInterval: 1,
                splitNumber: 3,
                max: (v) => Math.max(v.max, capacity || 0) + 1,
                axisLabel: { color: colors.muted },
                splitLine: { lineStyle: { color: colors.grid } },
            },
        ],
        dataZoom: [
            {
                id: 'xSlider',
                type: 'slider',
                xAxisIndex: [0, 1],
                filterMode: 'weakFilter',
                top: layout.sliderTop,
                height: SLIDER_HEIGHT,
                startValue: xStart,
                endValue: xEnd,
                labelFormatter: '',
                borderColor: colors.border,
            },
            {
                id: 'xInside',
                type: 'inside',
                xAxisIndex: [0, 1],
                filterMode: 'weakFilter',
                zoomOnMouseWheel: 'ctrl',
                moveOnMouseWheel: false,
                moveOnMouseMove: true,
            },
            {
                id: 'ySlider',
                type: 'slider',
                yAxisIndex: 0,
                filterMode: 'filter',
                right: 6,
                width: 14,
                top: layout.ganttTop,
                height: layout.ganttHeight,
                show: order.length > fit,
                startValue: yStart,
                endValue: yStart + fit - 1,
                minValueSpan: Math.min(fit, Math.max(order.length, 1)) - 1,
                maxValueSpan: fit - 1,
                zoomLock: true,
                showDetail: false,
                brushSelect: false,
                borderColor: colors.border,
            },
            {
                id: 'yInside',
                type: 'inside',
                yAxisIndex: 0,
                filterMode: 'filter',
                zoomOnMouseWheel: false,
                moveOnMouseWheel: true,
                moveOnMouseMove: false,
            },
        ],
        brush: {
            xAxisIndex: 0,
            seriesIndex: [],
            toolbox: [],
            brushType: 'lineX',
            brushMode: 'single',
            transformable: true,
            throttleType: 'debounce',
            throttleDelay: 250,
        },
        series: [
            {
                id: 'gaps',
                type: 'custom',
                xAxisIndex: 0,
                yAxisIndex: 0,
                renderItem: makeRenderGaps({ patterns, colors }),
                encode: { x: [1, 2], y: 0 },
                data: gapData,
                silent: true,
                z: 1,
                tooltip: { show: false },
            },
            {
                id: 'episodes',
                type: 'line',
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: [],
                silent: true,
                markArea: {
                    silent: true,
                    itemStyle: { color: colors.episode },
                    data: (episodes || []).map((e) => [{ xAxis: e.from }, { xAxis: e.to }]),
                },
                z: 2,
            },
            {
                id: 'bars',
                type: 'custom',
                xAxisIndex: 0,
                yAxisIndex: 0,
                renderItem: makeRenderBars({ colors, patterns }),
                encode: { x: [1, 3], y: 0, tooltip: [] },
                dimensions: ['lane', 'triggered', 'started', 'stopped', 'status', 'flags'],
                data: barData,
                progressive: 3000,
                progressiveThreshold: 10000,
                z: 3,
            },
            {
                id: 'running',
                name: 'Running',
                type: 'line',
                xAxisIndex: 1,
                yAxisIndex: 1,
                step: 'end',
                symbol: 'none',
                sampling: 'max',
                data: (concurrency || []).map((b) => [b[0], b[1]]),
                lineStyle: { width: 1, color: colors.status.running },
                itemStyle: { color: colors.status.running },
                areaStyle: { opacity: 0.25, color: colors.status.running },
                // Always set (with no data when the capacity is unknown): the page merges options between renders
                markLine: {
                    silent: true,
                    symbol: 'none',
                    label: { formatter: `capacity ${capacity}`, color: colors.muted, position: 'insideEndTop' },
                    lineStyle: { color: colors.danger, type: 'dashed' },
                    data: capacity ? [{ yAxis: capacity }] : [],
                },
                markArea: {
                    silent: true,
                    itemStyle: { color: colors.episode },
                    data: (episodes || []).map((e) => [{ xAxis: e.from }, { xAxis: e.to }]),
                },
                tooltip: { show: false },
            },
            {
                id: 'queued',
                name: 'Queued',
                type: 'line',
                xAxisIndex: 1,
                yAxisIndex: 1,
                step: 'end',
                symbol: 'none',
                sampling: 'max',
                data: (concurrency || []).map((b) => [b[0], b[2]]),
                lineStyle: { width: 1.5, type: 'dashed', color: colors.status.failed },
                itemStyle: { color: colors.status.failed },
                tooltip: { show: false },
            },
        ],
    };
    return { option, rowKeys };
}

/**
 * Create canvas patterns that make failed/aborted/error bars distinguishable without colour, plus the "no data" hatch.
 *
 * @param {object} colors - Theme colours.
 * @returns {object} Patterns per status bucket, plus 'gap'.
 */
export function createPatterns(colors) {
    const make = (bg, fg, draw) => {
        const c = document.createElement('canvas');
        c.width = 8;
        c.height = 8;
        const ctx = c.getContext('2d');
        if (bg) {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 8, 8);
        }
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.5;
        draw(ctx);
        return { image: c, repeat: 'repeat' };
    };
    const diag = (ctx) => {
        ctx.beginPath();
        ctx.moveTo(-2, 10);
        ctx.lineTo(10, -2);
        ctx.moveTo(-2, 2);
        ctx.lineTo(2, -2);
        ctx.moveTo(6, 10);
        ctx.lineTo(10, 6);
        ctx.stroke();
    };
    return {
        failed: make(colors.status.failed, 'rgba(0,0,0,0.35)', diag),
        aborted: make(colors.status.aborted, 'rgba(0,0,0,0.35)', (ctx) => {
            diag(ctx);
            ctx.beginPath();
            ctx.moveTo(-2, -2);
            ctx.lineTo(10, 10);
            ctx.stroke();
        }),
        error: make(colors.status.error, 'rgba(0,0,0,0.35)', (ctx) => {
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(4, 8);
            ctx.stroke();
        }),
        gap: make(null, colors.hatch, diag),
    };
}
