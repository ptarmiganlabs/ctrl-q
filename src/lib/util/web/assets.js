import { readFile as fsReadFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sea from 'node:sea';

import { mimeTypeFor } from './mime.js';

/**
 * Directory holding Ctrl-Q's source files (the 'src' directory), when running from source.
 * Computed lazily: when running as a SEA binary, import.meta.url points at the bundle and must not be used.
 *
 * @returns {string} Absolute path to the 'src' directory.
 */
export function defaultSrcRoot() {
    return fileURLToPath(new URL('../../../', import.meta.url));
}

/**
 * Validate one route definition.
 * Routes are an exact-match allowlist: the URL path a browser asks for is never joined with a file system path,
 * so path traversal is impossible by construction.
 *
 * @param {object} route - Route definition, { url, file, seaKey? }.
 * @returns {string|null} Error message, or null if the route is valid.
 */
export function validateRoute(route) {
    if (!route || typeof route !== 'object') {
        return 'route must be an object';
    }
    if (typeof route.url !== 'string' || !route.url.startsWith('/')) {
        return `route url must start with '/': ${route?.url}`;
    }
    if (typeof route.file !== 'string' || route.file.length === 0) {
        return `route file missing for url ${route.url}`;
    }
    if (route.file.startsWith('/') || route.file.includes('\\') || route.file.split('/').includes('..')) {
        return `route file must be a relative forward-slash path without '..': ${route.file}`;
    }
    if (route.seaKey !== undefined && (typeof route.seaKey !== 'string' || !route.seaKey.startsWith('/'))) {
        return `route seaKey must start with '/': ${route.seaKey}`;
    }
    return null;
}

/**
 * Create a catalog of the static files a web server may serve.
 *
 * Each route maps one URL path to one file below the 'src' directory. When Ctrl-Q runs as a SEA binary, the file is
 * read from the embedded assets instead. Its asset key is route.seaKey, by default '/' + route.file.
 * The matching sea-config.json entry is then "<seaKey>": "./src/<file>".
 *
 * @param {object} param - Parameters.
 * @param {Array<{url: string, file: string, seaKey?: string}>} param.routes - Exact-match routes.
 * @param {boolean} [param.isSea] - True when running as a SEA binary. Defaults to sea.isSea().
 * @param {Function} [param.getSeaAsset] - (key) => ArrayBuffer. Defaults to sea.getAsset.
 * @param {Function} [param.readFile] - async (absolutePath) => Buffer. Defaults to fs.promises.readFile.
 * @param {string} [param.srcRoot] - Absolute path to the 'src' directory. Defaults to defaultSrcRoot().
 * @returns {{lookup: Function, load: Function, verifyAll: Function, routes: Array}} The asset catalog.
 */
export function createAssetCatalog({ routes, isSea, getSeaAsset, readFile, srcRoot } = {}) {
    if (!Array.isArray(routes)) {
        throw new Error('createAssetCatalog: routes must be an array');
    }

    const runningAsSea = isSea === undefined ? sea.isSea() : isSea;
    const seaGet = getSeaAsset || ((key) => sea.getAsset(key));
    const fileRead = readFile || fsReadFile;
    let root = srcRoot;

    const byUrl = new Map();
    for (const route of routes) {
        const error = validateRoute(route);
        if (error) {
            throw new Error(`createAssetCatalog: ${error}`);
        }
        if (byUrl.has(route.url)) {
            throw new Error(`createAssetCatalog: duplicate route url ${route.url}`);
        }
        byUrl.set(route.url, {
            url: route.url,
            file: route.file,
            seaKey: route.seaKey || `/${route.file}`,
            mimeType: mimeTypeFor(route.file),
        });
    }

    const filePath = (route) => {
        if (!root) {
            root = defaultSrcRoot();
        }
        return path.join(root, ...route.file.split('/'));
    };

    /**
     * Find the route for a URL path. Only exact matches count.
     *
     * @param {string} urlPath - Path part of the request URL, without query string.
     * @returns {object|undefined} The route, or undefined.
     */
    const lookup = (urlPath) => byUrl.get(urlPath);

    /**
     * Load the content of a route's file.
     *
     * @param {object} route - A route returned by lookup().
     * @returns {Promise<Buffer>} File content.
     */
    const load = async (route) => {
        if (runningAsSea) {
            return Buffer.from(seaGet(route.seaKey));
        }
        return fileRead(filePath(route));
    };

    /**
     * Check that every route's file can be loaded.
     *
     * @returns {Promise<{ok: boolean, missing: string[]}>} Result, with the URLs whose files could not be loaded.
     */
    const verifyAll = async () => {
        const missing = [];
        for (const route of byUrl.values()) {
            try {
                await load(route);
            } catch {
                missing.push(route.url);
            }
        }
        return { ok: missing.length === 0, missing };
    };

    return { lookup, load, verifyAll, routes: [...byUrl.values()] };
}

/**
 * Check routes against the "assets" map of sea-config.json. Every route must have an entry whose key is the route's SEA
 * key and whose value is "./src/<file>", otherwise the file is missing from the SEA binary.
 *
 * @param {Array<{url: string, file: string, seaKey?: string}>} routes - Routes, as given to createAssetCatalog().
 * @param {object} seaAssets - The "assets" object from sea-config.json.
 * @returns {string[]} Problems found, empty if all routes are embedded correctly.
 */
export function checkSeaConfig(routes, seaAssets) {
    const problems = [];
    const seen = new Set();
    for (const route of routes) {
        const key = route.seaKey || `/${route.file}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const expected = `./src/${route.file}`;
        if (!(key in (seaAssets || {}))) {
            problems.push(`missing sea-config asset "${key}" (expected "${expected}")`);
        } else if (seaAssets[key] !== expected) {
            problems.push(`sea-config asset "${key}" points to "${seaAssets[key]}", expected "${expected}"`);
        }
    }
    return problems;
}
