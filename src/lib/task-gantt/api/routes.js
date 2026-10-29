// Execution record keys accepted by /api/execution: 'r:<result id>', 'x:<execution id>' or 'f:<task id>:<epoch ms>'
const KEY_RE =
    /^(r|x):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^f:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{1,16}$/i;

/**
 * Create the JSON API routes of the task-gantt web page.
 *
 * @param {object} param - Parameters.
 * @param {object} param.app - The task-gantt app, from createGanttApp().
 * @param {object} param.pageConfig - Static page configuration (version, host, window, sources...).
 * @param {object} [param.sse] - SSE hub for live updates; without it there is no /api/events route.
 * @returns {Array<{method?: string, path: string, handler: Function}>} Routes for startWebServer().
 */
export function createApiRoutes({ app, pageConfig, sse }) {
    return [
        { path: '/api/config', handler: () => pageConfig },
        { path: '/api/snapshot', handler: () => app.snapshot() },
        ...(sse ? [{ path: '/api/events', handler: ({ req, res, baseHeaders }) => sse.handle(req, res, baseHeaders) }] : []),
        {
            path: '/api/execution',
            handler: async ({ query, sendJson }) => {
                const key = query.get('key') || '';
                if (!KEY_RE.test(key)) {
                    await sendJson(400, { error: 'invalid key' });
                    return;
                }
                const details = await app.executionDetails(key);
                if (!details) {
                    await sendJson(404, { error: 'unknown execution' });
                    return;
                }
                await sendJson(200, details);
            },
        },
    ];
}
