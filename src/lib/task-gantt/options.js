import os from 'node:os';
import path from 'node:path';
import { validate as uuidValidate } from 'uuid';

import { MAX_LOOKBACK_MS, SOURCE } from './defaults.js';
import { TASK_TYPE_CODES } from './model/lanes.js';
import { isLoopbackHost } from '../util/web/server.js';

const UNIT_MS = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000 };
const MIN_LOOKBACK_MS = 10 * 60 * 1000;
const MIN_POLL_INTERVAL_S = 5;
// An hour. Far longer would overflow setTimeout() (about 24.8 days), which then fires at once: QRS would be polled
// back to back.
const MAX_POLL_INTERVAL_S = 3600;

// Sources selectable with --sources, in the order they become available
export const SELECTABLE_SOURCES = [SOURCE.QRS, SOURCE.HISTORY];

export const DEFAULT_HISTORY_DIR = path.join('~', '.ctrl-q', 'task-history');

/**
 * Parse a duration such as '30m', '12h', '7d' or '4w'.
 *
 * @param {string} value - Duration.
 * @returns {number|null} Milliseconds, or null if the value is not a valid duration.
 */
export function parseDuration(value) {
    const m = /^\s*(\d+(?:\.\d+)?)\s*([mhdw])\s*$/i.exec(String(value ?? ''));
    if (!m) return null;
    return Math.round(Number(m[1]) * UNIT_MS[m[2].toLowerCase()]);
}

/**
 * Expand a leading '~' to the user's home directory and make the path absolute.
 *
 * @param {string} p - Path.
 * @param {string} [home] - Home directory.
 * @returns {string} Absolute path.
 */
export function expandHome(p, home = os.homedir()) {
    const s = String(p || '');
    if (s === '~') return home;
    if (s.startsWith('~/') || s.startsWith('~\\')) return path.join(home, s.slice(2));
    return path.resolve(s);
}

const isWholeNumber = (v) => /^\s*\d+\s*$/.test(String(v ?? ''));

/**
 * Values of a list option. Each value may hold several, separated by commas or spaces, which is how environment
 * variables pass lists.
 *
 * @param {string|string[]|undefined} v - Option value(s).
 * @param {RegExp|null} [split] - Separators, or null to keep each value whole.
 * @returns {string[]} Values.
 */
export const toList = (v, split = /[\s,]+/) =>
    [v ?? []]
        .flat()
        .flatMap((x) => (split ? String(x).split(split) : [String(x)]))
        .map((s) => s.trim())
        .filter(Boolean);

/**
 * Parse an on/off option such as --vis-allow-remote: given without a value, or from an environment variable.
 *
 * @param {boolean|string|undefined} v - Option value.
 * @returns {boolean|null} The setting, or null if the value is not a valid one.
 */
export function parseFlag(v) {
    if (v === undefined || v === null || v === false) return false;
    if (v === true) return true;
    const s = String(v).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off', ''].includes(s)) return false;
    return null;
}

/**
 * Validate the options of the qseow task-gantt command and turn them into the command's configuration.
 * Pure: no network or file system access, so it can be tested directly.
 *
 * @param {object} options - Options from commander.
 * @param {object} [context] - Context.
 * @param {Set<string>} [context.fromEnv] - Names of options whose value came from an environment variable. Tags in
 *   those are separated by commas only, since tag names may contain spaces.
 * @returns {{ok: boolean, errors: string[], config: object|null}} Result.
 */
export function validateTaskGanttOptions(options, { fromEnv = new Set() } = {}) {
    const errors = [];
    const tagList = (name) => toList(options[name], fromEnv.has(name) ? /,/ : null);

    const lookbackMs = parseDuration(options.lookback);
    if (lookbackMs === null) {
        errors.push(`Invalid --lookback "${options.lookback}". Use a number followed by m, h, d or w, e.g. 12h or 7d.`);
    } else if (lookbackMs < MIN_LOOKBACK_MS || lookbackMs > MAX_LOOKBACK_MS) {
        errors.push(`--lookback must be between 10m and 90d, got "${options.lookback}".`);
    }

    const sources = toList(options.sources);
    for (const s of sources) {
        if (!SELECTABLE_SOURCES.includes(s))
            errors.push(`Unknown source "${s}" in --sources. Valid sources: ${SELECTABLE_SOURCES.join(', ')}.`);
    }
    // QRS is always used: it provides the tasks and the live updates
    if (!sources.includes(SOURCE.QRS)) sources.unshift(SOURCE.QRS);

    const pollIntervalS = isWholeNumber(options.pollInterval) ? Number(options.pollInterval) : NaN;
    if (!Number.isInteger(pollIntervalS) || pollIntervalS < 0) {
        errors.push(`--poll-interval must be a whole number of seconds, got "${options.pollInterval}".`);
    } else if (pollIntervalS > 0 && pollIntervalS < MIN_POLL_INTERVAL_S) {
        errors.push(`--poll-interval must be 0 (no live updates) or at least ${MIN_POLL_INTERVAL_S} seconds.`);
    } else if (pollIntervalS > MAX_POLL_INTERVAL_S) {
        errors.push(`--poll-interval must be at most ${MAX_POLL_INTERVAL_S} seconds (an hour), got "${options.pollInterval}".`);
    }

    const retentionDays = isWholeNumber(options.historyRetentionDays) ? Number(options.historyRetentionDays) : NaN;
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
        errors.push(`--history-retention-days must be a whole number of days, at least 1, got "${options.historyRetentionDays}".`);
    }

    const visPort = isWholeNumber(options.visPort) ? Number(options.visPort) : NaN;
    if (!Number.isInteger(visPort) || visPort < 0 || visPort > 65535) {
        errors.push(`--vis-port must be a port number (0-65535), got "${options.visPort}".`);
    }

    const visHost = String(options.visHost || 'localhost');
    const allowRemote = parseFlag(options.visAllowRemote);
    if (allowRemote === null) {
        errors.push(`--vis-allow-remote must be true or false, got "${options.visAllowRemote}".`);
    } else if (!isLoopbackHost(visHost) && !allowRemote) {
        const from = fromEnv.has('visHost') ? ' (from CTRLQ_VIS_HOST)' : '';
        errors.push(
            `--vis-host ${visHost}${from} makes the page reachable from other computers. Add --vis-allow-remote to confirm; the page is then protected by a random access token.`
        );
    }

    const taskTypes = [];
    for (const t of toList(options.taskType)) {
        if (!Object.hasOwn(TASK_TYPE_CODES, t)) errors.push(`Unknown task type "${t}" in --task-type.`);
        else taskTypes.push(TASK_TYPE_CODES[t]);
    }

    const taskIds = toList(options.taskId);
    const appIds = toList(options.appId);
    for (const id of [...taskIds, ...appIds]) {
        if (!uuidValidate(id)) errors.push(`"${id}" is not a valid task/app id (expected a GUID).`);
    }

    if (errors.length) {
        return { ok: false, errors, config: null };
    }

    const qrsPort = String(options.qrsPort ?? options.port ?? '4242');
    return {
        ok: true,
        errors: [],
        config: {
            qseow: {
                host: options.host,
                qrsPort,
                port: qrsPort,
                virtualProxy: options.virtualProxy ?? '',
                secure: options.secure,
                authType: options.authType,
                authUserDir: options.authUserDir,
                authUserId: options.authUserId,
                authCertFile: options.authCertFile,
                authCertKeyFile: options.authCertKeyFile,
                authRootCertFile: options.authRootCertFile,
                authJwt: options.authJwt,
            },
            lookbackMs,
            sources,
            pollIntervalMs: pollIntervalS * 1000,
            historyDir: expandHome(options.historyDir || DEFAULT_HISTORY_DIR),
            historyRetentionDays: retentionDays,
            // QRS gives ids in lower case. Upper case ones are valid GUIDs too, but would match nothing.
            filters: {
                taskTypes,
                taskIds: taskIds.map((id) => id.toLowerCase()),
                taskTags: tagList('taskTag'),
                appIds: appIds.map((id) => id.toLowerCase()),
                appTags: tagList('appTag'),
            },
            visHost,
            visPort,
            allowRemote,
        },
    };
}
