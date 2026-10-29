import { jest, test, expect, describe, afterEach } from '@jest/globals';
import fs from 'node:fs';

import { buildChartOption, chartLayout, lanesThatFit, safeWindow, LANE_PX } from '../../../static/task-gantt/chart.js';
import { FLAG_STALE, FLAG_DERIVED } from '../../../static/task-gantt/format.js';
import { fromExecutionResult } from '../../../lib/task-gantt/normalize/qrs.js';

// chart.js reads ECharts from the global scope, as the page does (it loads the vendored bundle with a <script> tag).
// The vendored file is a UMD bundle in a "type": "module" package, so jest refuses to require() it ("Must use import
// to load ES Module"). Importing it runs the UMD's browser branch, which sets globalThis.echarts.
await import('../../../static/vendor/echarts/echarts.min.js');
const { echarts } = globalThis;

const WIDTH = 1400;
const HEIGHT = 800;
// Grid geometry from chart.js: 230 px lane labels on the left, 36 px on the right, Gantt lanes start 30 px down
const GRID_LEFT = 230;
const PLOT_WIDTH = WIDTH - GRID_LEFT - 36;
const GANTT_TOP = 30;
const BAR_HEIGHT = Math.min(LANE_PX * 0.72, 18);

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const T0 = Date.parse('2026-10-06T06:00:00.000Z');
const WINDOW = { from: T0, to: T0 + HOUR };
const NOW = T0 + 30 * MIN;

// Distinct colours per bucket so the rendered SVG says which branch drew a shape
const COLORS = {
    fg: '#101010',
    muted: '#606060',
    panel: '#fafafa',
    border: '#c0c0c0',
    grid: '#e0e0e0',
    hatch: '#a0a0a0',
    danger: '#d00000',
    episode: '#fde0e0',
    status: {
        success: '#00a000',
        failed: '#b00000',
        aborted: '#b05000',
        aborting: '#b05001',
        error: '#800080',
        skipped: '#909000',
        running: '#0000b0',
        waiting: '#00a0a0',
        queued: '#00a0a1',
        unknown: '#707070',
    },
};

/**
 * Parameters for buildChartOption, as main.js passes them.
 *
 * @param {object} overrides - Values to replace.
 * @returns {object} Parameters.
 */
function params(overrides = {}) {
    return {
        order: [0, 1, 2],
        laneOf: (idx) => ({ idx, name: `Task ${idx}` }),
        rows: [],
        window: WINDOW,
        now: NOW,
        zoom: {},
        useUTC: true,
        colors: COLORS,
        // createPatterns() needs a DOM canvas; without patterns the bars use the plain status colours
        patterns: {},
        concurrency: [],
        capacity: null,
        episodes: [],
        gaps: [],
        chartHeight: HEIGHT,
        ...overrides,
    };
}

// An execution row as the client store builds it from the snapshot columns (missing values are null)
const row = (key, lane, fields = {}) => ({
    key,
    lane,
    status: 7,
    triggeredAt: null,
    queuedAt: null,
    startedAt: null,
    stoppedAt: null,
    node: 0,
    src: 1,
    flags: 0,
    ...fields,
});

const at = (minutes) => T0 + minutes * MIN;
// Pixel x of a time, for a visible x range
const xAt = (t, range = WINDOW) => GRID_LEFT + ((t - range.from) / (range.to - range.from)) * PLOT_WIDTH;
// Pixel y of the centre of a visible lane
const laneY = (pos) => GANTT_TOP + pos * LANE_PX + LANE_PX / 2;

const charts = [];

afterEach(() => {
    while (charts.length) charts.pop().dispose();
});

/**
 * Render an option server side, as SVG.
 *
 * @param {object} option - ECharts option.
 * @returns {{chart: object, svg: string}} The chart (disposed after the test) and its SVG.
 */
function render(option) {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: WIDTH, height: HEIGHT });
    charts.push(chart);
    chart.setOption(option);
    return { chart, svg: chart.renderToSVGString() };
}

/**
 * Shapes drawn for one series. ECharts' SVG renderer writes rects as `<path d="Mx yl<w> 0l0 <h>l-<w> 0Z">` and
 * polygons as `<polygon points="...">`; with `ssr: true` each carries the series and (filtered) data index.
 *
 * @param {string} svg - Rendered SVG.
 * @param {number} seriesIndex - Series index.
 * @returns {Array<object>} Shapes, in drawing order.
 */
function shapes(svg, seriesIndex) {
    const out = [];
    for (const m of svg.matchAll(/<(path|polygon)\b([^>]*)>/g)) {
        const attrs = Object.fromEntries([...m[2].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
        if (attrs.ecmeta_series_index !== String(seriesIndex)) continue;
        const r = /^M(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) 0l0 (-?[\d.]+)l/.exec(attrs.d || '');
        const nums = (attrs.points || '').split(/\s+/).filter(Boolean).map(Number);
        out.push({
            tag: m[1],
            attrs,
            dataIndex: Number(attrs.ecmeta_data_index),
            rect: r ? { x: Number(r[1]), y: Number(r[2]), width: Number(r[3]), height: Number(r[4]) } : null,
            points: nums.length ? nums.reduce((acc, v, i) => (i % 2 ? acc[acc.length - 1].push(v) : acc.push([v]), acc), []) : null,
        });
    }
    return out;
}

const barShapes = (svg, dataIndex) => shapes(svg, 2).filter((s) => dataIndex === undefined || s.dataIndex === dataIndex);
const texts = (svg) => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

// Rendered coordinates are rounded to 0.1 px
const expectNear = (actual, expected, tolerance = 0.5) => {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

describe('lanesThatFit', () => {
    test('counts the whole 22 px lanes left after the axis labels, concurrency strip and slider', () => {
        expect(LANE_PX).toBe(22);
        // 800 - 232 px of fixed parts = 568 px -> 25 lanes
        expect(lanesThatFit(800)).toBe(25);
        expect(lanesThatFit(232 + 10 * 22)).toBe(10);
        expect(lanesThatFit(232 + 10 * 22 - 1)).toBe(9);
        expect(lanesThatFit(1000)).toBe(34);
    });

    test('never fewer than five lanes, even in a tiny or zero-height chart', () => {
        expect(lanesThatFit(0)).toBe(5);
        expect(lanesThatFit(100)).toBe(5);
        expect(lanesThatFit(232 + 4 * 22)).toBe(5);
        expect(lanesThatFit(232 + 6 * 22)).toBe(6);
    });
});

describe('chartLayout', () => {
    test('the Gantt grid is exactly as tall as the lanes it shows', () => {
        expect(chartLayout(3, 800)).toEqual({ fit: 25, ganttTop: 30, ganttHeight: 66, concurrencyTop: 132, sliderTop: 268 });
    });

    test('more lanes than fit: the Gantt grid stops at the lanes that fit', () => {
        expect(chartLayout(100, 800)).toEqual({ fit: 25, ganttTop: 30, ganttHeight: 550, concurrencyTop: 616, sliderTop: 752 });
    });

    test('no lanes still reserves one lane', () => {
        expect(chartLayout(0, 800).ganttHeight).toBe(LANE_PX);
    });

    test('with many lanes, the slider and bottom margin always end inside the chart', () => {
        for (let h = 232 + 5 * 22; h <= 2000; h += 7) {
            const layout = chartLayout(1000, h);
            expect(layout.ganttHeight).toBe(layout.fit * LANE_PX);
            // slider 22 px + bottom margin 8 px
            expect(layout.sliderTop + 22 + 8).toBeLessThanOrEqual(h);
        }
    });
});

describe('buildChartOption: option shape', () => {
    test('two grids, positioned by chartLayout', () => {
        const { option } = buildChartOption(params({ order: [4, 5, 6] }));

        expect(option.grid).toHaveLength(2);
        expect(option.grid[0]).toMatchObject({ id: 'gantt', left: GRID_LEFT, right: 36, top: 30, height: 3 * LANE_PX });
        expect(option.grid[1]).toMatchObject({ id: 'concurrency', left: GRID_LEFT, right: 36, top: 30 + 3 * LANE_PX + 36, height: 110 });
    });

    test('the Gantt grid height is min(lanes, fit) * 22', () => {
        for (const [lanes, chartHeight] of [
            [1, 800],
            [24, 800],
            [25, 800],
            [26, 800],
            [60, 800],
            [12, 400],
        ]) {
            const order = Array.from({ length: lanes }, (_, i) => i);
            const { option } = buildChartOption(params({ order, chartHeight }));
            const fit = lanesThatFit(chartHeight);

            expect(option.grid[0].height).toBe(Math.min(lanes, fit) * LANE_PX);
            expect(option.grid[1].top).toBe(30 + Math.min(lanes, fit) * LANE_PX + 36);
        }
    });

    test('one y category per lane in display order, labelled with the lane name', () => {
        const lanes = new Map([
            [7, { idx: 7, name: 'Reload Sales' }],
            [3, { idx: 3, name: 'Old task', deleted: true }],
        ]);
        const { option } = buildChartOption(params({ order: [7, 3, 9], laneOf: (idx) => lanes.get(idx) }));
        const y = option.yAxis[0];

        expect(y).toMatchObject({ type: 'category', gridIndex: 0, inverse: true });
        expect(y.data).toEqual(['0', '1', '2']);
        expect(y.axisLabel.formatter('0')).toBe('Reload Sales');
        // Deleted tasks are marked with a dagger
        expect(y.axisLabel.formatter('1')).toBe('† Old task');
        // A lane the store does not know (yet) gets an empty label instead of throwing
        expect(y.axisLabel.formatter('2')).toBe('');
    });

    test('both time axes span exactly the time window', () => {
        const window = { from: at(-90), to: at(45) };
        const { option } = buildChartOption(params({ window }));

        expect(option.xAxis).toHaveLength(2);
        for (const [i, axis] of option.xAxis.entries()) {
            expect(axis).toMatchObject({ type: 'time', gridIndex: i, min: window.from, max: window.to });
        }
        expect(option.axisPointer.link).toEqual([{ xAxisIndex: 'all' }]);
    });

    test('the x zoom defaults to the whole window when it is shorter than 24 hours', () => {
        const { option } = buildChartOption(params());
        const xSlider = option.dataZoom.find((d) => d.id === 'xSlider');

        expect(xSlider).toMatchObject({ type: 'slider', xAxisIndex: [0, 1], startValue: WINDOW.from, endValue: WINDOW.to });
        expect(option.dataZoom.find((d) => d.id === 'xInside')).toMatchObject({ type: 'inside', xAxisIndex: [0, 1] });
    });

    test('the x zoom defaults to the last 24 hours of a longer window', () => {
        const window = { from: T0 - 3 * 24 * HOUR, to: T0 };
        const { option } = buildChartOption(params({ window }));
        const xSlider = option.dataZoom.find((d) => d.id === 'xSlider');

        expect(xSlider.startValue).toBe(T0 - 24 * HOUR);
        expect(xSlider.endValue).toBe(T0);
    });

    test('a saved x zoom is restored', () => {
        const { option } = buildChartOption(params({ zoom: { xStart: at(10), xEnd: at(20) } }));
        const xSlider = option.dataZoom.find((d) => d.id === 'xSlider');

        expect(xSlider.startValue).toBe(at(10));
        expect(xSlider.endValue).toBe(at(20));
        expect(xSlider.top).toBe(chartLayout(3, HEIGHT).sliderTop);
    });

    test('the y slider is hidden while all lanes fit', () => {
        for (const lanes of [0, 1, 3, 25]) {
            const order = Array.from({ length: lanes }, (_, i) => i);
            const { option } = buildChartOption(params({ order, zoom: { yStart: 3 } }));
            const ySlider = option.dataZoom.find((d) => d.id === 'ySlider');

            expect(ySlider.show).toBe(false);
            // Nothing to scroll: a saved position is ignored
            expect(ySlider.startValue).toBe(0);
            expect(ySlider.endValue).toBe(24);
            expect(ySlider.maxValueSpan).toBe(24);
            expect(ySlider.minValueSpan).toBe(Math.max(lanes, 1) - 1);
        }
    });

    test('the y slider shows with more lanes than fit, spans the Gantt grid and clamps the saved position', () => {
        const order = Array.from({ length: 30 }, (_, i) => i);
        const ySliderFor = (zoom) => buildChartOption(params({ order, zoom })).option.dataZoom.find((d) => d.id === 'ySlider');

        const restored = ySliderFor({ yStart: 3 });
        expect(restored).toMatchObject({
            type: 'slider',
            yAxisIndex: 0,
            filterMode: 'filter',
            show: true,
            top: 30,
            height: 25 * LANE_PX,
            startValue: 3,
            endValue: 27,
            minValueSpan: 24,
            maxValueSpan: 24,
            zoomLock: true,
        });
        // Past the end (e.g. lanes were filtered away since): show the last full page of lanes
        expect(ySliderFor({ yStart: 10 })).toMatchObject({ startValue: 5, endValue: 29 });
        expect(ySliderFor({ yStart: -4 })).toMatchObject({ startValue: 0, endValue: 24 });
        expect(ySliderFor({})).toMatchObject({ startValue: 0, endValue: 24 });
    });

    test('no toolbox: neither the page toolbox nor the one the brush component would add', () => {
        const { option } = buildChartOption(params());

        expect(option.toolbox).toEqual({ show: false });
        expect(option.brush).toMatchObject({ xAxisIndex: 0, seriesIndex: [], toolbox: [], brushType: 'lineX', brushMode: 'single' });
    });

    test('no animation, and the UTC setting is passed through', () => {
        expect(buildChartOption(params({ useUTC: true })).option).toMatchObject({ animation: false, useUTC: true });
        expect(buildChartOption(params({ useUTC: false })).option.useUTC).toBe(false);
    });

    test('tooltips only for execution bars, built by p.tooltip from the data index', () => {
        const tooltip = jest.fn((i) => `row ${i}`);
        const { option } = buildChartOption(params({ tooltip }));
        const { formatter } = option.tooltip;

        expect(formatter({ seriesId: 'bars', dataIndex: 4 })).toBe('row 4');
        expect(tooltip).toHaveBeenCalledWith(4);
        expect(formatter({ seriesId: 'running', dataIndex: 1 })).toBe('');
        expect(tooltip).toHaveBeenCalledTimes(1);

        const noTooltip = buildChartOption(params()).option.tooltip.formatter;
        expect(noTooltip({ seriesId: 'bars', dataIndex: 0 })).toBe('');
    });

    test('the reloads axis leaves headroom above both the peak and the capacity', () => {
        const maxFor = (capacity, peak) => buildChartOption(params({ capacity })).option.yAxis[1].max({ min: 0, max: peak });

        expect(maxFor(null, 3)).toBe(4);
        expect(maxFor(4, 3)).toBe(5);
        expect(maxFor(4, 9)).toBe(10);
        expect(maxFor(null, 0)).toBe(1);
    });

    test('series are drawn gaps, then episodes, then bars, then the concurrency lines', () => {
        const { option } = buildChartOption(params());

        expect(option.series.map((s) => s.id)).toEqual(['gaps', 'episodes', 'bars', 'running', 'queued']);
        expect(option.series.map((s) => [s.xAxisIndex, s.yAxisIndex])).toEqual([
            [0, 0],
            [0, 0],
            [0, 0],
            [1, 1],
            [1, 1],
        ]);
    });
});

describe('buildChartOption: bar data and rowKeys', () => {
    test('rowKeys align with the bar data; rows of lanes not shown are skipped', () => {
        const rows = [
            row('a', 7, { triggeredAt: at(1), startedAt: at(2), stoppedAt: at(3), status: 7 }),
            row('hidden', 4, { triggeredAt: at(1), startedAt: at(2), stoppedAt: at(3) }),
            row('b', 9, { triggeredAt: at(4), startedAt: at(5), stoppedAt: at(6), status: 8, flags: FLAG_DERIVED }),
            row('c', 7, { triggeredAt: at(7), startedAt: at(8), stoppedAt: at(9), status: 7 }),
        ];
        const { option, rowKeys } = buildChartOption(params({ order: [7, 3, 9], rows }));
        const bars = option.series.find((s) => s.id === 'bars');

        expect(rowKeys).toEqual(['a', 'b', 'c']);
        expect(bars.data).toEqual([
            [0, at(1), at(2), at(3), 7, 0],
            [2, at(4), at(5), at(6), 8, FLAG_DERIVED],
            [0, at(7), at(8), at(9), 7, 0],
        ]);
        expect(bars.dimensions).toEqual(['lane', 'triggered', 'started', 'stopped', 'status', 'flags']);
        expect(bars.encode).toMatchObject({ x: [1, 3], y: 0 });
    });

    test('running executions end at now; missing times are null and missing flags 0', () => {
        const rows = [
            row('running', 0, { triggeredAt: at(5), startedAt: at(6), stoppedAt: null, status: 2 }),
            { key: 'sparse', lane: 1, status: 3 },
        ];
        const { option, rowKeys } = buildChartOption(params({ rows }));

        expect(rowKeys).toEqual(['running', 'sparse']);
        expect(option.series.find((s) => s.id === 'bars').data).toEqual([
            [0, at(5), at(6), NOW, 2, 0],
            [1, null, null, NOW, 3, 0],
        ]);
    });

    test('no lanes: no bars, no keys', () => {
        const { option, rowKeys } = buildChartOption(params({ order: [], rows: [row('a', 0, { startedAt: at(1), stoppedAt: at(2) })] }));

        expect(rowKeys).toEqual([]);
        expect(option.series.find((s) => s.id === 'bars').data).toEqual([]);
        expect(option.yAxis[0].data).toEqual([]);
    });
});

describe('buildChartOption: gaps, episodes, concurrency and capacity', () => {
    test('gap ranges become one item per range, at the lane position; lanes not shown are skipped', () => {
        const gaps = [
            [9, [[at(0), at(10)]]],
            [
                5,
                [
                    [at(0), at(5)],
                    [at(40), at(60)],
                ],
            ],
            [7, [[at(20), at(30)]]],
        ];
        const { option } = buildChartOption(params({ order: [7, 9], gaps }));

        expect(option.series.find((s) => s.id === 'gaps').data).toEqual([
            [1, at(0), at(10)],
            [0, at(20), at(30)],
        ]);
    });

    test('missing gaps, episodes and concurrency give empty series', () => {
        const { option } = buildChartOption(params({ gaps: undefined, episodes: undefined, concurrency: undefined }));
        const byId = Object.fromEntries(option.series.map((s) => [s.id, s]));

        expect(byId.gaps.data).toEqual([]);
        expect(byId.episodes.markArea.data).toEqual([]);
        expect(byId.running.markArea.data).toEqual([]);
        expect(byId.running.data).toEqual([]);
        expect(byId.queued.data).toEqual([]);
    });

    test('congestion episodes are marked in both grids', () => {
        const episodes = [
            { from: at(5), to: at(7), node: 'n1' },
            { from: at(20), to: at(21), node: 'n2' },
        ];
        const { option } = buildChartOption(params({ episodes }));
        const expected = [
            [{ xAxis: at(5) }, { xAxis: at(7) }],
            [{ xAxis: at(20) }, { xAxis: at(21) }],
        ];
        const byId = Object.fromEntries(option.series.map((s) => [s.id, s]));

        expect(byId.episodes.markArea.data).toEqual(expected);
        expect(byId.episodes.markArea.itemStyle.color).toBe(COLORS.episode);
        expect(byId.running.markArea.data).toEqual(expected);
    });

    test('concurrency buckets feed the running and queued lines', () => {
        const concurrency = [
            [at(0), 1, 0],
            [at(5), 4, 2],
            [at(9), 0, 0],
        ];
        const { option } = buildChartOption(params({ concurrency }));
        const byId = Object.fromEntries(option.series.map((s) => [s.id, s]));

        expect(byId.running.data).toEqual([
            [at(0), 1],
            [at(5), 4],
            [at(9), 0],
        ]);
        expect(byId.queued.data).toEqual([
            [at(0), 0],
            [at(5), 2],
            [at(9), 0],
        ]);
    });

    test('a capacity line only when the capacity is known', () => {
        const markLineFor = (capacity) => buildChartOption(params({ capacity })).option.series.find((s) => s.id === 'running').markLine;

        expect(markLineFor(4)).toMatchObject({ data: [{ yAxis: 4 }], label: { formatter: 'capacity 4' } });
        // Set with no data rather than left out: the page merges options between renders, so a left-out line would stay
        expect(markLineFor(null).data).toEqual([]);
        expect(markLineFor(undefined).data).toEqual([]);
        expect(markLineFor(0).data).toEqual([]);
    });
});

describe('no NaN reaches an axis (ECharts 6.1 then draws nothing)', () => {
    test('safeWindow keeps a usable window and replaces a broken one with the 24 hours before its end or now', () => {
        expect(safeWindow(WINDOW, NOW)).toEqual(WINDOW);
        expect(safeWindow({ from: NaN, to: WINDOW.to }, NOW)).toEqual({ from: WINDOW.to - 24 * HOUR, to: WINDOW.to });
        expect(safeWindow({ from: WINDOW.from, to: undefined }, NOW)).toEqual({ from: WINDOW.from, to: NOW });
        expect(safeWindow(undefined, NOW)).toEqual({ from: NOW - 24 * HOUR, to: NOW });
        // from must be before to
        expect(safeWindow({ from: WINDOW.to, to: WINDOW.to }, NOW)).toEqual({ from: WINDOW.to - 24 * HOUR, to: WINDOW.to });
    });

    test('a broken window, clock or saved zoom still gives finite axis and zoom values, and a chart that renders', () => {
        const { option } = buildChartOption(
            params({ window: { from: NaN, to: undefined }, now: NaN, zoom: { xStart: NaN, xEnd: undefined, yStart: NaN } })
        );
        const values = [
            ...option.xAxis.flatMap((a) => [a.min, a.max]),
            ...option.dataZoom.filter((z) => z.type === 'slider').flatMap((z) => [z.startValue, z.endValue]),
        ];

        expect(values.every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
        expect(render(option).svg).toContain('Task 0');
    });
});

describe('server-side render with the vendored ECharts', () => {
    test('renders an SVG of the chart size with the lane names and UTC time labels', () => {
        const lanes = new Map([
            [0, { idx: 0, name: 'Reload Sales' }],
            [1, { idx: 1, name: 'Old task', deleted: true }],
        ]);
        const { option } = buildChartOption(params({ order: [0, 1], laneOf: (idx) => lanes.get(idx), useUTC: true }));
        const { svg } = render(option);
        const labels = texts(svg);

        expect(svg.startsWith(`<svg width="${WIDTH}" height="${HEIGHT}"`)).toBe(true);
        expect(labels).toEqual(expect.arrayContaining(['Reload Sales', '† Old task', 'reloads', '06:30']));
    });

    test('a finished execution: a thin wait segment from trigger to start, then a full-height bar to stop', () => {
        const rows = [row('done', 1, { triggeredAt: at(5), startedAt: at(6), stoppedAt: at(10), status: 7 })];
        const { option } = buildChartOption(params({ rows }));
        const { svg } = render(option);
        const [wait, bar, ...rest] = barShapes(svg, 0);

        expect(rest).toEqual([]);
        expect(wait.attrs.fill).toBe(COLORS.status.waiting);
        expect(wait.attrs['fill-opacity']).toBe('0.85');
        expectNear(wait.rect.x, xAt(at(5)));
        expectNear(wait.rect.width, xAt(at(6)) - xAt(at(5)));
        expectNear(wait.rect.height, BAR_HEIGHT * 0.36);
        expectNear(wait.rect.y + wait.rect.height / 2, laneY(1));

        expect(bar.attrs.fill).toBe(COLORS.status.success);
        expect(bar.attrs['fill-opacity']).toBeUndefined();
        expectNear(bar.rect.x, xAt(at(6)));
        expectNear(bar.rect.x + bar.rect.width, xAt(at(10)));
        expectNear(bar.rect.height, BAR_HEIGHT);
        expectNear(bar.rect.y + bar.rect.height / 2, laneY(1));
    });

    test('a running execution is drawn up to now', () => {
        const rows = [row('running', 0, { triggeredAt: at(7), startedAt: at(7), stoppedAt: null, status: 2 })];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);

        // Started the moment it was triggered: no wait segment
        expect(drawn).toHaveLength(1);
        expect(drawn[0].attrs.fill).toBe(COLORS.status.running);
        expectNear(drawn[0].rect.x, xAt(at(7)));
        expectNear(drawn[0].rect.x + drawn[0].rect.width, xAt(NOW));
    });

    test('a skipped execution is a diamond at its trigger time', () => {
        const rows = [row('skipped', 2, { triggeredAt: at(5), startedAt: null, stoppedAt: at(5), status: 9 })];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);
        const d = Math.max(BAR_HEIGHT / 2, 4);
        const x = xAt(at(5));
        const y = laneY(2);

        expect(drawn).toHaveLength(1);
        expect(drawn[0].tag).toBe('polygon');
        expect(drawn[0].attrs).toMatchObject({ fill: COLORS.status.skipped, stroke: COLORS.fg });
        expect(drawn[0].points).toHaveLength(4);
        const expected = [
            [x, y - d],
            [x + d, y],
            [x, y + d],
            [x - d, y],
        ];
        for (const [i, [px, py]] of drawn[0].points.entries()) {
            expectNear(px, expected[i][0]);
            expectNear(py, expected[i][1]);
        }
    });

    test('a skipped execution without a trigger time is marked at its start time', () => {
        const rows = [row('skipped', 0, { triggeredAt: null, startedAt: at(8), stoppedAt: at(8), status: 9 })];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);

        expect(drawn).toHaveLength(1);
        expect(drawn[0].tag).toBe('polygon');
        const xs = drawn[0].points.map((p) => p[0]);
        expectNear((Math.min(...xs) + Math.max(...xs)) / 2, xAt(at(8)));
    });

    test('a skipped execution triggered before the visible range draws no diamond', () => {
        // Kept by the x dataZoom (it "ends" at now), but its marker would be left of the grid
        const rows = [row('skipped', 0, { triggeredAt: at(-10), startedAt: null, stoppedAt: null, status: 9 })];
        const { svg } = render(buildChartOption(params({ rows })).option);

        expect(barShapes(svg)).toEqual([]);
    });

    test('a queued execution that never started: only the wait segment, to now or to when it stopped', () => {
        const rows = [
            row('still-queued', 0, { triggeredAt: at(5), queuedAt: at(5), startedAt: null, stoppedAt: null, status: 3 }),
            row('aborted-in-queue', 1, { triggeredAt: at(2), queuedAt: at(2), startedAt: null, stoppedAt: at(4), status: 6 }),
        ];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const queued = barShapes(svg, 0);
        const aborted = barShapes(svg, 1);

        expect(queued).toHaveLength(1);
        expect(queued[0].attrs.fill).toBe(COLORS.status.waiting);
        expectNear(queued[0].rect.height, BAR_HEIGHT * 0.36);
        expectNear(queued[0].rect.x, xAt(at(5)));
        expectNear(queued[0].rect.x + queued[0].rect.width, xAt(NOW));

        expect(aborted).toHaveLength(1);
        expect(aborted[0].attrs.fill).toBe(COLORS.status.waiting);
        expectNear(aborted[0].rect.x, xAt(at(2)));
        expectNear(aborted[0].rect.x + aborted[0].rect.width, xAt(at(4)));
        expectNear(aborted[0].rect.y + aborted[0].rect.height / 2, laneY(1));
    });

    test('a stale execution is drawn dashed in the unknown colour, whatever its status', () => {
        const rows = [row('stale', 0, { triggeredAt: null, startedAt: at(7), stoppedAt: null, status: 2, flags: FLAG_STALE })];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);

        // No trigger time: anchored at the start, so no wait segment
        expect(drawn).toHaveLength(1);
        expect(drawn[0].attrs).toMatchObject({
            fill: COLORS.status.unknown,
            'fill-opacity': '0.6',
            stroke: COLORS.fg,
            'stroke-dasharray': '3,2',
        });
        expectNear(drawn[0].rect.x, xAt(at(7)));
        expectNear(drawn[0].rect.x + drawn[0].rect.width, xAt(NOW));
    });

    test('a stale execution that never started (stuck in the queue) is drawn in the stale style, not as waiting', () => {
        const rows = [
            row('stuck', 0, { triggeredAt: at(2), queuedAt: at(2), startedAt: null, stoppedAt: null, status: 3, flags: FLAG_STALE }),
        ];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);

        expect(drawn).toHaveLength(1);
        expect(drawn[0].attrs).toMatchObject({ fill: COLORS.status.unknown, 'fill-opacity': '0.6', 'stroke-dasharray': '3,2' });
        expectNear(drawn[0].rect.x, xAt(at(2)));
        expectNear(drawn[0].rect.x + drawn[0].rect.width, xAt(NOW));
    });

    test('a derived (approximate) execution is drawn translucent', () => {
        const rows = [
            row('derived', 0, { triggeredAt: at(1), startedAt: at(7), stoppedAt: at(9), status: 8, flags: FLAG_DERIVED }),
            row('stale-derived', 1, { triggeredAt: at(1), startedAt: at(2), stoppedAt: null, status: 2, flags: FLAG_STALE | FLAG_DERIVED }),
        ];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const [wait, bar] = barShapes(svg, 0);
        const [staleWait, staleBar] = barShapes(svg, 1);

        expect(wait.attrs.fill).toBe(COLORS.status.waiting);
        expect(Number(wait.attrs['fill-opacity'])).toBeCloseTo(0.85 * 0.65, 4);
        expect(bar.attrs.fill).toBe(COLORS.status.failed);
        expect(bar.attrs['fill-opacity']).toBe('0.65');
        // Stale wins over derived, for the wait as for the run
        expect(staleWait.attrs).toMatchObject({ fill: COLORS.status.unknown, 'fill-opacity': '0.6', 'stroke-dasharray': '3,2' });
        expect(staleBar.attrs).toMatchObject({ fill: COLORS.status.unknown, 'fill-opacity': '0.6', 'stroke-dasharray': '3,2' });
    });

    test('a status bucket pattern takes precedence over its colour; unknown status codes use the unknown colour', () => {
        const rows = [
            row('failed', 0, { startedAt: at(1), stoppedAt: at(3), status: 8 }),
            row('success', 1, { startedAt: at(1), stoppedAt: at(3), status: 7 }),
            row('mystery', 2, { startedAt: at(1), stoppedAt: at(3), status: 99 }),
        ];
        const patterns = { failed: '#123456' };
        const { svg } = render(buildChartOption(params({ rows, patterns })).option);

        expect(barShapes(svg).map((s) => [s.dataIndex, s.attrs.fill])).toEqual([
            [0, '#123456'],
            [1, COLORS.status.success],
            [2, COLORS.status.unknown],
        ]);
    });

    test('waits under a pixel draw no wait segment; zero-length runs are still 2 px wide', () => {
        // 1134 px for 60 min: one pixel is about 3.2 s
        const rows = [row('instant', 0, { triggeredAt: at(10) - 1000, startedAt: at(10), stoppedAt: at(10), status: 7 })];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);

        expect(drawn).toHaveLength(1);
        expectNear(drawn[0].rect.x, xAt(at(10)));
        expectNear(drawn[0].rect.width, 2, 0.05);
        expectNear(drawn[0].rect.height, BAR_HEIGHT);
    });

    test('a start before the trigger (clock skew) draws no wait segment', () => {
        const rows = [row('skewed', 0, { triggeredAt: at(6), startedAt: at(5), stoppedAt: at(8), status: 7 })];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const drawn = barShapes(svg, 0);

        expect(drawn).toHaveLength(1);
        expectNear(drawn[0].rect.height, BAR_HEIGHT);
        expectNear(drawn[0].rect.x, xAt(at(5)));
    });

    test('bars are clipped to the grid', () => {
        const rows = [
            row('before', 0, { triggeredAt: at(-20), startedAt: at(-10), stoppedAt: at(2), status: 7 }),
            row('after', 1, { triggeredAt: at(55), startedAt: at(58), stoppedAt: at(70), status: 7 }),
        ];
        const { svg } = render(buildChartOption(params({ rows })).option);
        const before = barShapes(svg, 0);
        const after = barShapes(svg, 1);

        // The wait segment of 'before' lies entirely left of the grid
        expect(before).toHaveLength(1);
        expectNear(before[0].rect.x, GRID_LEFT);
        expectNear(before[0].rect.width, xAt(at(2)) - GRID_LEFT);

        expect(after).toHaveLength(2);
        expectNear(after[1].rect.x, xAt(at(58)));
        expectNear(after[1].rect.x + after[1].rect.width, GRID_LEFT + PLOT_WIDTH);
    });

    test('the restored x zoom sets the visible range of both grids', () => {
        const zoom = { xStart: at(10), xEnd: at(20) };
        const range = { from: zoom.xStart, to: zoom.xEnd };
        const rows = [
            row('in-view', 0, { startedAt: at(12), stoppedAt: at(14), status: 7 }),
            row('out-of-view', 1, { startedAt: at(30), stoppedAt: at(40), status: 7 }),
        ];
        const episodes = [{ from: at(12), to: at(14) }];
        const { option, rowKeys } = buildChartOption(params({ rows, zoom, episodes }));
        const { chart, svg } = render(option);
        const drawn = barShapes(svg);

        expect(drawn).toHaveLength(1);
        expect(rowKeys[drawn[0].dataIndex]).toBe('in-view');
        expectNear(drawn[0].rect.x, xAt(at(12), range));
        expectNear(drawn[0].rect.width, xAt(at(14), range) - xAt(at(12), range));

        // The concurrency grid follows the same zoom: its episode area lines up with the Gantt one
        const [ganttArea] = shapes(svg, 1);
        const [concurrencyArea] = shapes(svg, 3).filter((s) => s.tag === 'polygon');
        for (const area of [ganttArea, concurrencyArea]) {
            const xs = area.points.map((p) => p[0]);
            expectNear(Math.min(...xs), xAt(at(12), range));
            expectNear(Math.max(...xs), xAt(at(14), range));
        }

        const xSlider = chart.getOption().dataZoom.find((d) => d.id === 'xSlider');
        expect(xSlider.startValue).toBe(zoom.xStart);
        expect(xSlider.endValue).toBe(zoom.xEnd);
    });

    test('gaps are hatched across the lane height, below the bars', () => {
        const gaps = [[1, [[at(40), at(50)]]]];
        const rows = [row('overlapping', 1, { startedAt: at(45), stoppedAt: at(55), status: 7 })];
        const { svg } = render(buildChartOption(params({ gaps, rows })).option);
        const [gap, ...rest] = shapes(svg, 0);

        expect(rest).toEqual([]);
        expect(gap.attrs).toMatchObject({ fill: COLORS.hatch, 'fill-opacity': '0.55', ecmeta_silent: 'true' });
        expectNear(gap.rect.x, xAt(at(40)));
        expectNear(gap.rect.width, xAt(at(50)) - xAt(at(40)));
        expectNear(gap.rect.y, GANTT_TOP + LANE_PX + 1);
        expectNear(gap.rect.height, LANE_PX - 2);
        // SVG paints in document order: the gap comes first, so the bar is drawn on top of it
        expect(barShapes(svg)).toHaveLength(1);
        expect(svg.indexOf('ecmeta_series_index="0"')).toBeLessThan(svg.indexOf('ecmeta_series_index="2"'));
    });

    test('a gap pattern takes precedence over the hatch colour', () => {
        const gaps = [[0, [[at(40), at(50)]]]];
        const { svg } = render(buildChartOption(params({ gaps, patterns: { gap: '#654321' } })).option);

        expect(shapes(svg, 0).map((s) => s.attrs.fill)).toEqual(['#654321']);
    });

    test('congestion episodes are shaded over the full height of both grids', () => {
        const order = [0, 1, 2];
        const layout = chartLayout(order.length, HEIGHT);
        const episodes = [{ from: at(12), to: at(14) }];
        const { svg } = render(buildChartOption(params({ order, episodes, concurrency: [[at(0), 2, 0]] })).option);
        const areas = svg.match(new RegExp(`<polygon[^>]*fill="${COLORS.episode}"[^>]*>`, 'g'));

        expect(areas).toHaveLength(2);
        const [gantt, concurrency] = [shapes(svg, 1)[0], shapes(svg, 3).find((s) => s.tag === 'polygon')];
        const ys = (s) => s.points.map((p) => p[1]);
        expect(Math.min(...ys(gantt))).toBe(layout.ganttTop);
        expect(Math.max(...ys(gantt))).toBe(layout.ganttTop + layout.ganttHeight);
        expect(Math.min(...ys(concurrency))).toBe(layout.concurrencyTop);
        expect(Math.max(...ys(concurrency))).toBe(layout.concurrencyTop + 110);
    });

    test('the capacity line is drawn, with headroom above it, only when the capacity is known', () => {
        const concurrency = [
            [at(0), 1, 0],
            [at(10), 3, 2],
            [at(20), 0, 0],
        ];
        const layout = chartLayout(3, HEIGHT);
        const withCapacity = render(buildChartOption(params({ concurrency, capacity: 4 })).option).svg;
        const line = shapes(withCapacity, 3).find((s) => s.attrs.stroke === COLORS.danger);

        expect(texts(withCapacity)).toContain('capacity 4');
        expect(line.attrs['stroke-dasharray']).toBeDefined();
        // Axis max = max(peak 3, capacity 4) + 1 = 5, so the line sits at 4/5 of the strip height
        const y = Number(/^M[-\d.]+ ([-\d.]+)L/.exec(line.attrs.d)[1]);
        expectNear(y, layout.concurrencyTop + 110 - (110 * 4) / 5, 1);

        const without = render(buildChartOption(params({ concurrency, capacity: null })).option).svg;
        expect(texts(without).some((t) => t.startsWith('capacity'))).toBe(false);
        expect(shapes(without, 3).some((s) => s.attrs.stroke === COLORS.danger)).toBe(false);
    });

    test('lanes outside the y slider window are not drawn, and data indices map back to rowKeys', () => {
        const order = Array.from({ length: 30 }, (_, i) => i);
        const rows = [
            row('first', 0, { startedAt: at(1), stoppedAt: at(3), status: 7 }),
            row('middle', 12, { startedAt: at(1), stoppedAt: at(3), status: 7 }),
            row('last', 29, { startedAt: at(1), stoppedAt: at(3), status: 7 }),
        ];

        const top = buildChartOption(params({ order, rows, zoom: { yStart: 0 } }));
        const topRender = render(top.option);
        const topBars = barShapes(topRender.svg);
        expect(topBars).toHaveLength(2);
        expectNear(topBars[0].rect.y + topBars[0].rect.height / 2, laneY(0));
        expectNear(topBars[1].rect.y + topBars[1].rect.height / 2, laneY(12));
        expect(texts(topRender.svg)).not.toContain('Task 29');

        const scrolled = buildChartOption(params({ order, rows, zoom: { yStart: 5 } }));
        const { chart, svg } = render(scrolled.option);
        const bars = barShapes(svg);
        expect(bars).toHaveLength(2);
        // Lane 12 is the 8th visible lane, lane 29 the 25th
        expectNear(bars[0].rect.y + bars[0].rect.height / 2, laneY(7));
        expectNear(bars[1].rect.y + bars[1].rect.height / 2, laneY(24));
        expect(texts(svg)).toEqual(expect.arrayContaining(['Task 5', 'Task 29']));
        expect(texts(svg)).not.toContain('Task 4');

        // Events report the raw data index (what main.js looks up in rowKeys), not the index among the drawn bars
        const series = chart.getModel().getSeriesByIndex(2);
        expect(bars.map((b) => scrolled.rowKeys[series.getDataParams(b.dataIndex).dataIndex])).toEqual(['middle', 'last']);
    });

    test('an empty chart renders', () => {
        const { option, rowKeys } = buildChartOption(params({ order: [], rows: [], laneOf: () => undefined }));
        const { svg } = render(option);

        expect(rowKeys).toEqual([]);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(barShapes(svg)).toEqual([]);
    });

    test('the lab run: two reloads queued behind maxConcurrentEngines 4 show ~46 s and ~49 s wait segments', () => {
        const qrsRows = JSON.parse(
            fs.readFileSync(new URL('../../testdata/task-gantt/qrs-executionresult-full.json', import.meta.url), 'utf8')
        );
        const CONTENT_MONITOR = '966a93e3-5e6d-495a-ac78-a2ba4067a794';
        const OPS_MONITOR = '0419086f-a935-4358-a356-da2f79069e78';
        const taskIds = [
            '8d2c5d0c-12e2-4dc8-9832-de1ae367a373',
            '60f56836-b6e4-4690-8896-a2262c4ebb8c',
            '5fee7b84-76f8-4cc1-ba4f-466d8eefa8be',
            'a87ae597-be31-4453-be04-5b4f67489d8d',
            CONTENT_MONITOR,
            OPS_MONITOR,
        ];
        const laneIdx = new Map(taskIds.map((id, i) => [id, i]));
        // The fixture also holds older runs of a task that is not shown here: those lanes are not in the order
        const rows = qrsRows
            .map((r) => fromExecutionResult(r, new Map(taskIds.map((id) => [id, 0]))))
            .filter(Boolean)
            .map((rec) => row(rec.key, laneIdx.get(rec.taskId) ?? 99, rec));
        const window = { from: Date.parse('2026-10-06T06:29:00.000Z'), to: Date.parse('2026-10-06T06:32:00.000Z') };
        const order = [...taskIds.keys()];

        const { option, rowKeys } = buildChartOption(
            params({ order, rows, window, now: window.to, laneOf: (idx) => ({ idx, name: `task ${taskIds[idx].slice(0, 8)}` }) })
        );
        const { svg } = render(option);

        expect(rows).toHaveLength(8);
        expect(rowKeys).toHaveLength(6);
        for (const [i, key] of rowKeys.entries()) {
            const rec = rows.find((r) => r.key === key);
            const drawn = barShapes(svg, i);
            const [wait, bar] = drawn;
            const waitSeconds = (rec.startedAt - rec.triggeredAt) / 1000;

            expect(drawn).toHaveLength(2);
            expectNear(wait.rect.x, xAt(rec.triggeredAt, window));
            expectNear(wait.rect.x + wait.rect.width, xAt(rec.startedAt, window));
            // The run continues where the wait ends
            expectNear(bar.rect.x, wait.rect.x + wait.rect.width, 0.2);
            expectNear(bar.rect.x + bar.rect.width, xAt(rec.stoppedAt, window));
            expectNear(bar.rect.y + bar.rect.height / 2, laneY(laneIdx.get(rec.taskId)));

            if (rec.taskId === CONTENT_MONITOR || rec.taskId === OPS_MONITOR) {
                expect(waitSeconds).toBeGreaterThan(45);
                expect(waitSeconds).toBeLessThan(50);
                expect(wait.rect.width).toBeGreaterThan(45 * (PLOT_WIDTH / 180));
            } else {
                expect(waitSeconds).toBeLessThan(1);
                expect(wait.rect.width).toBeLessThan(PLOT_WIDTH / 180);
            }
            expect(bar.attrs.fill).toBe(rec.status === 8 ? COLORS.status.failed : COLORS.status.success);
        }
    });
});
