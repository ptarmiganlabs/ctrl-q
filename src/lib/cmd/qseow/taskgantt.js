import os from 'node:os';

import { logger, appVersion } from '../../../globals.js';
import { createGanttApp } from '../../task-gantt/app.js';
import { createApiRoutes } from '../../task-gantt/api/routes.js';
import { createQrsPoller } from '../../task-gantt/live/qrs-poller.js';
import { TASK_GANTT_ROUTES } from '../../task-gantt/page-routes.js';
import { createAssetCatalog } from '../../util/web/assets.js';
import { startWebServer, createAccessToken, isLoopbackHost, formatHostForUrl } from '../../util/web/server.js';
import { createSseHub } from '../../util/web/sse.js';
import { createShutdownManager } from '../../util/web/shutdown.js';

// Analytics (concurrency, episodes) are recomputed and pushed at most this often
const ANALYTICS_THROTTLE_MS = 5000;

/**
 * Push live changes to connected pages: execution deltas at once, analytics at most every few seconds, and after every
 * poll a small 'live' event saying up to when the data is complete.
 *
 * @param {object} app - The task-gantt app.
 * @param {object} sse - SSE hub.
 * @returns {Function} Callback for the poller's onUpdate.
 */
export function createLivePublisher(app, sse) {
    let analyticsTimer = null;
    let lastAnalyticsAt = 0;

    const publishAnalytics = () => {
        analyticsTimer = null;
        // Nobody is watching: skip the work. A page that connects later loads a fresh snapshot.
        if (sse.clientCount() === 0) return;
        lastAnalyticsAt = Date.now();
        sse.broadcast('analytics', app.analyticsPayload());
    };

    return ({ changed, statusChanged }) => {
        const delta = app.drainDelta();
        // Also send deltas that only move the revision (changes of hidden tasks) or add node names: pages compare
        // revisions to find missed deltas, and look up node names by index
        if (delta.rev !== delta.prevRev || delta.nodes || delta.cols.key.length || delta.removed.length || delta.lanes.length) {
            sse.broadcast('delta', delta, delta.rev);
        }
        if ((changed || statusChanged) && !analyticsTimer) {
            const wait = Math.max(0, ANALYTICS_THROTTLE_MS - (Date.now() - lastAnalyticsAt));
            analyticsTimer = setTimeout(publishAnalytics, wait);
            analyticsTimer.unref?.();
        }
        if (sse.clientCount() > 0) {
            sse.broadcast('live', app.liveStatus());
        }
    };
}

/**
 * Names and addresses other computers can use to open a page served on all interfaces ('0.0.0.0' or '::').
 *
 * @param {string} visHost - Host the web server listens on.
 * @param {object} [param] - Parameters, for tests.
 * @param {Function} [param.hostname] - Returns this computer's name, like os.hostname().
 * @param {Function} [param.networkInterfaces] - Returns the network interfaces, like os.networkInterfaces().
 * @returns {string[]} Host names and IP addresses, or none if the server listens on one host only.
 */
export function shareHosts(visHost, { hostname = os.hostname, networkInterfaces = os.networkInterfaces } = {}) {
    if (visHost !== '0.0.0.0' && visHost !== '::') return [];
    const hosts = [String(hostname() || '').toLowerCase()];
    for (const addrs of Object.values(networkInterfaces() || {})) {
        for (const a of addrs || []) {
            if (a.internal) continue;
            const ipv4 = a.family === 'IPv4' || a.family === 4;
            // '0.0.0.0' accepts IPv4 only. Link-local IPv6 addresses need a zone id, which does not work in a URL.
            if (ipv4 || (visHost === '::' && !a.address.toLowerCase().startsWith('fe80:'))) hosts.push(a.address);
        }
    }
    return [...new Set(hosts.filter(Boolean))];
}

/**
 * URLs of a page served on all interfaces, one per name or address other computers can use.
 *
 * @param {string} url - URL the web server reported (with 'localhost').
 * @param {string[]} hosts - Host names and IP addresses, see shareHosts().
 * @returns {string[]} URLs.
 */
export function shareUrls(url, hosts) {
    return hosts.map((h) => {
        const u = new URL(url);
        u.hostname = formatHostForUrl(h);
        return u.toString();
    });
}

/**
 * Run the task-gantt command: load task execution history from Sense and serve it as a Gantt-style web page.
 *
 * @param {object} config - Configuration from validateTaskGanttOptions().
 * @param {object} [param] - Parameters.
 * @param {boolean} [param.installSignalHandlers] - Install Ctrl-C handlers. Tests pass false.
 * @param {Function} [param.request] - QRS request function. Tests pass a stub; defaults to qrsRequestJson.
 * @param {object} [param.processRef] - The process whose signals are handled. Tests pass a stand-in.
 * @returns {Promise<{url: string, port: number, close: Function, app: object}>} The running page server.
 */
export async function taskGantt(config, { installSignalHandlers = true, request, processRef = process } = {}) {
    const assets = createAssetCatalog({ routes: TASK_GANTT_ROUTES });
    const assetCheck = await assets.verifyAll();
    if (!assetCheck.ok) {
        throw new Error(`Files for the task-gantt page are missing: ${assetCheck.missing.join(', ')}`);
    }

    const app = createGanttApp({ config, logger, ...(request ? { request } : {}) });

    // Closers are registered as resources come up, and Ctrl-C is handled from the start: start-up can take minutes on a
    // large site, and holds the history file's lock while it waits for QRS
    const shutdown = createShutdownManager({ processRef, logger });
    shutdown.register('history file', () => app.close());
    if (installSignalHandlers) {
        shutdown.install();
    }
    try {
        await app.init();
    } catch (err) {
        await shutdown.shutdown('start-up failed');
        throw err;
    }

    const live = config.pollIntervalMs > 0;
    const sse = live ? createSseHub({ logger }) : null;
    // A token is needed, and only makes sense, when other computers can reach the page
    const token = config.allowRemote && !isLoopbackHost(config.visHost) ? createAccessToken() : null;
    const pageConfig = {
        appVersion,
        senseHost: config.qseow.host,
        lookbackMs: config.lookbackMs,
        pollIntervalMs: config.pollIntervalMs,
        sources: config.sources,
    };

    let web;
    try {
        web = await startWebServer({
            host: config.visHost,
            port: config.visPort,
            assets,
            apiRoutes: createApiRoutes({ app, pageConfig, sse }),
            token,
            logger,
        });
    } catch (err) {
        await shutdown.shutdown('web server failed to start');
        throw err;
    }
    shutdown.register('web server', () => web.close());

    if (live) {
        shutdown.register('live updates', () => sse.close());
        const poller = createQrsPoller({ app, intervalMs: config.pollIntervalMs, logger, onUpdate: createLivePublisher(app, sse) });
        shutdown.register('QRS poller', () => poller.stop());
        poller.start();
    }

    logger.info('');
    const others = shareUrls(web.url, shareHosts(config.visHost));
    if (others.length) {
        logger.info(`Task Gantt chart, on this computer: ${web.url}`);
        for (const u of others) logger.info(`Task Gantt chart, from other computers: ${u}`);
    } else {
        logger.info(`Task Gantt chart: ${web.url}`);
    }
    if (live) {
        logger.info(`Live updates every ${config.pollIntervalMs / 1000} s.`);
    }
    if (token) {
        logger.info(
            `The page is reachable from other computers. Share ${others.length ? 'one of the URLs' : 'the URL'} above, including its token, only with people who may see it.`
        );
    }
    logger.info('Press Ctrl-C to quit.');

    return { url: web.url, port: web.port, close: () => shutdown.shutdown('close()'), app };
}
