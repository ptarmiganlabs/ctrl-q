// Static files of the task-gantt web page. Each file also needs an entry in sea-config.json ("<seaKey>": "./src/<file>"),
// which the unit tests check.
export const TASK_GANTT_ROUTES = [
    { url: '/', file: 'static/task-gantt/index.html' },
    { url: '/task-gantt/styles.css', file: 'static/task-gantt/styles.css' },
    { url: '/task-gantt/main.js', file: 'static/task-gantt/main.js' },
    { url: '/task-gantt/chart.js', file: 'static/task-gantt/chart.js' },
    { url: '/task-gantt/store.js', file: 'static/task-gantt/store.js' },
    { url: '/task-gantt/format.js', file: 'static/task-gantt/format.js' },
    // Shared with the backend, so concurrency maths is the same on both sides
    { url: '/task-gantt/lib/sweep.js', file: 'lib/task-gantt/shared/sweep.js' },
    { url: '/vendor/echarts/echarts.min.js', file: 'static/vendor/echarts/echarts.min.js' },
    { url: '/vendor/echarts/LICENSE.txt', file: 'static/vendor/echarts/LICENSE.txt' },
    { url: '/vendor/echarts/NOTICE.txt', file: 'static/vendor/echarts/NOTICE.txt' },
    { url: '/vendor/echarts/LICENSE-d3.txt', file: 'static/vendor/echarts/LICENSE-d3.txt' },
    { url: '/vendor/echarts/LICENSE-zrender.txt', file: 'static/vendor/echarts/LICENSE-zrender.txt' },
    { url: '/vendor/echarts/LICENSE-tslib.txt', file: 'static/vendor/echarts/LICENSE-tslib.txt' },
    { url: '/ctrl-q.png', file: 'static/ctrl-q.png' },
    { url: '/favicon.ico', file: 'static/favicon.ico' },
];
