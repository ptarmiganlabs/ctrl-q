// MIME types for files served by Ctrl-Q's local web servers.
// JavaScript must be served with a JavaScript MIME type, as browsers refuse to run ES modules otherwise.
export const MIME_TYPES = {
    html: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json; charset=utf-8',
    map: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    ico: 'image/x-icon',
    woff2: 'font/woff2',
};

export const DEFAULT_MIME_TYPE = 'application/octet-stream';

/**
 * Get the MIME type for a file, based on its extension.
 *
 * @param {string} fileName - File name or path, e.g. 'task-gantt/index.html'.
 * @returns {string} MIME type, or 'application/octet-stream' if the extension is unknown.
 */
export function mimeTypeFor(fileName) {
    const match = /\.([a-z0-9]+)$/i.exec(fileName || '');
    if (!match) {
        return DEFAULT_MIME_TYPE;
    }
    return MIME_TYPES[match[1].toLowerCase()] || DEFAULT_MIME_TYPE;
}

/**
 * Is the MIME type a text type, i.e. one that benefits from compression?
 *
 * @param {string} mimeType - MIME type.
 * @returns {boolean} True for text, JavaScript, JSON and SVG.
 */
export function isTextMimeType(mimeType) {
    return /^text\/|^application\/json|^image\/svg\+xml/.test(mimeType || '');
}
