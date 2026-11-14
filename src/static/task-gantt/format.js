// Formatting and DOM helpers for the task Gantt page. Text is always inserted with textContent, never innerHTML,
// because task, app and tag names come from Sense and may contain anything.

// QRS TaskExecutionStatus codes -> name and display bucket (mirrors src/lib/task-gantt/model/status.js)
export const STATUS = {
    0: { name: 'Never started', bucket: 'unknown' },
    1: { name: 'Triggered', bucket: 'waiting' },
    2: { name: 'Started', bucket: 'running' },
    3: { name: 'Queued', bucket: 'queued' },
    4: { name: 'Abort initiated', bucket: 'aborting' },
    5: { name: 'Aborting', bucket: 'aborting' },
    6: { name: 'Aborted', bucket: 'aborted' },
    7: { name: 'Finished successfully', bucket: 'success' },
    8: { name: 'Failed', bucket: 'failed' },
    9: { name: 'Skipped', bucket: 'skipped' },
    10: { name: 'Retry', bucket: 'waiting' },
    11: { name: 'Error', bucket: 'error' },
    12: { name: 'Reset', bucket: 'error' },
    13: { name: 'Distribution queue', bucket: 'waiting' },
    14: { name: 'Distribution running', bucket: 'running' },
};

export const TERMINAL = new Set([6, 7, 8, 9, 11, 12]);
export const PROBLEM_BUCKETS = new Set(['failed', 'aborted', 'error']);

export const TASK_TYPE_NAMES = { 0: 'Reload', 1: 'External program', 2: 'User sync', 3: 'Distribute', 4: 'Preload' };

// Bits in cols.flags (see src/lib/task-gantt/api/snapshot.js)
export const FLAG_STALE = 1;
export const FLAG_DERIVED = 2;

/**
 * Status info for a code, with a fallback for unknown codes.
 *
 * @param {number} code - Status code.
 * @returns {{name: string, bucket: string}} Status info.
 */
export function statusInfo(code) {
    return STATUS[code] || { name: `Unknown (${code})`, bucket: 'unknown' };
}

/**
 * Create a DOM element. Children may be elements, strings (inserted as text) or null.
 *
 * @param {string} tag - Tag name.
 * @param {object} [attrs] - Attributes; 'class' sets className, 'text' sets textContent, 'on<event>' adds a listener.
 * @param {...*} children - Child nodes or strings.
 * @returns {HTMLElement} The element.
 */
export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = String(v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

/**
 * Replace all children of an element.
 *
 * @param {HTMLElement} node - Element.
 * @param {...*} children - New children.
 */
export function setChildren(node, ...children) {
    node.replaceChildren();
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/**
 * Format a time as 'YYYY-MM-DD HH:mm:ss', in local time or UTC.
 *
 * @param {number|null} ms - Epoch milliseconds.
 * @param {boolean} utc - Use UTC.
 * @param {boolean} [withDate] - Include the date.
 * @returns {string} Formatted time, '–' for null.
 */
export function fmtTime(ms, utc, withDate = true) {
    if (ms === null || ms === undefined) return '–';
    const d = new Date(ms);
    const parts = utc
        ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
        : [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
    const time = `${pad(parts[3])}:${pad(parts[4])}:${pad(parts[5])}`;
    return withDate ? `${parts[0]}-${pad(parts[1])}-${pad(parts[2])} ${time}${utc ? ' UTC' : ''}` : time;
}

/**
 * Format a duration in a compact, readable way, e.g. '45 s', '12 min 05 s', '3 h 07 min', '2 d 4 h'.
 *
 * @param {number|null} ms - Duration in milliseconds.
 * @returns {string} Formatted duration, '–' for null.
 */
export function fmtDuration(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return '–';
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ${pad(s % 60)} s`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h} h ${pad(m % 60)} min`;
    return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/**
 * Format a count with thousands separators, e.g. '2,140', in English like the rest of the page.
 *
 * @param {number} n - Count.
 * @returns {string} Formatted count.
 */
export function fmtCount(n) {
    return Number(n).toLocaleString('en-US');
}

/**
 * Quote a value for CSV, and neutralise values Excel would treat as formulas.
 *
 * @param {*} value - Cell value.
 * @returns {string} CSV cell.
 */
export function csvCell(value) {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Read a CSS custom property, e.g. a theme colour.
 *
 * @param {string} name - Property name, e.g. '--fg'.
 * @returns {string} Value.
 */
export function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
