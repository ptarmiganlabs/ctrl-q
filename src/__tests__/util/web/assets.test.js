import { test, expect, describe } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { createAssetCatalog, validateRoute, defaultSrcRoot, checkSeaConfig } from '../../../lib/util/web/assets.js';

const ROUTES = [
    { url: '/', file: 'static/demo/index.html' },
    { url: '/demo/index.html', file: 'static/demo/index.html' },
    { url: '/demo/app.js', file: 'static/demo/app.js' },
    { url: '/legacy.html', file: 'static/legacy.html', seaKey: '/legacy.html' },
];

const FILES = {
    [path.join('/fake/src', 'static', 'demo', 'index.html')]: '<html>demo</html>',
    [path.join('/fake/src', 'static', 'demo', 'app.js')]: 'console.log(1);',
    [path.join('/fake/src', 'static', 'legacy.html')]: '<html>legacy</html>',
};

const fakeReadFile = async (p) => {
    if (FILES[p] === undefined) {
        throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    }
    return Buffer.from(FILES[p]);
};

describe('validateRoute', () => {
    test('accepts a well-formed route', () => {
        expect(validateRoute({ url: '/a.js', file: 'static/a.js' })).toBeNull();
    });

    test.each([
        [{ url: 'a.js', file: 'static/a.js' }, 'url must start'],
        [{ url: '/a.js', file: '' }, 'file missing'],
        [{ url: '/a.js', file: '/etc/passwd' }, 'relative'],
        [{ url: '/a.js', file: 'static/../../package.json' }, "'..'"],
        [{ url: '/a.js', file: 'static\\a.js' }, 'forward-slash'],
        [{ url: '/a.js', file: 'static/a.js', seaKey: 'a.js' }, 'seaKey'],
    ])('rejects %j', (route, message) => {
        expect(validateRoute(route)).toContain(message);
    });
});

describe('createAssetCatalog', () => {
    test('throws on invalid or duplicate routes', () => {
        expect(() => createAssetCatalog({ routes: [{ url: '/x', file: '../x' }], isSea: false })).toThrow("'..'");
        expect(() =>
            createAssetCatalog({
                routes: [
                    { url: '/x', file: 'static/x' },
                    { url: '/x', file: 'static/y' },
                ],
                isSea: false,
            })
        ).toThrow('duplicate');
        expect(() => createAssetCatalog({ routes: 'nope' })).toThrow('routes must be an array');
    });

    test('lookup only matches exact URL paths', () => {
        const catalog = createAssetCatalog({ routes: ROUTES, isSea: false, srcRoot: '/fake/src', readFile: fakeReadFile });

        expect(catalog.lookup('/demo/app.js').file).toBe('static/demo/app.js');
        expect(catalog.lookup('/demo/app.js/')).toBeUndefined();
        expect(catalog.lookup('/demo/../demo/app.js')).toBeUndefined();
        expect(catalog.lookup('/DEMO/APP.JS')).toBeUndefined();
        expect(catalog.lookup('/package.json')).toBeUndefined();
    });

    test('derives MIME type and SEA key', () => {
        const catalog = createAssetCatalog({ routes: ROUTES, isSea: false, srcRoot: '/fake/src', readFile: fakeReadFile });

        expect(catalog.lookup('/demo/app.js')).toMatchObject({ seaKey: '/static/demo/app.js', mimeType: 'text/javascript; charset=utf-8' });
        expect(catalog.lookup('/legacy.html').seaKey).toBe('/legacy.html');
    });

    test('loads from the file system when not running as SEA', async () => {
        const catalog = createAssetCatalog({ routes: ROUTES, isSea: false, srcRoot: '/fake/src', readFile: fakeReadFile });

        expect((await catalog.load(catalog.lookup('/'))).toString()).toBe('<html>demo</html>');
    });

    test('loads embedded assets by SEA key when running as SEA', async () => {
        const requested = [];
        const getSeaAsset = (key) => {
            requested.push(key);
            return new TextEncoder().encode(`asset ${key}`).buffer;
        };
        const catalog = createAssetCatalog({ routes: ROUTES, isSea: true, getSeaAsset });

        expect((await catalog.load(catalog.lookup('/demo/app.js'))).toString()).toBe('asset /static/demo/app.js');
        expect((await catalog.load(catalog.lookup('/legacy.html'))).toString()).toBe('asset /legacy.html');
        expect(requested).toEqual(['/static/demo/app.js', '/legacy.html']);
    });

    test('verifyAll reports routes whose files are missing', async () => {
        const catalog = createAssetCatalog({
            routes: [...ROUTES, { url: '/missing.js', file: 'static/missing.js' }],
            isSea: false,
            srcRoot: '/fake/src',
            readFile: fakeReadFile,
        });

        expect(await catalog.verifyAll()).toEqual({ ok: false, missing: ['/missing.js'] });
    });

    test('defaultSrcRoot points at the real src directory', () => {
        const root = defaultSrcRoot();

        expect(fs.existsSync(path.join(root, 'ctrl-q.js'))).toBe(true);
    });
});

describe('checkSeaConfig', () => {
    test('passes when every route is embedded under its SEA key', () => {
        const seaAssets = { '/static/demo/index.html': './src/static/demo/index.html', '/legacy.html': './src/static/legacy.html' };

        expect(checkSeaConfig([ROUTES[0], ROUTES[1], ROUTES[3]], seaAssets)).toEqual([]);
    });

    test('reports missing entries and entries pointing at the wrong file', () => {
        const seaAssets = { '/static/demo/index.html': './src/static/demo/other.html' };
        const problems = checkSeaConfig(ROUTES, seaAssets);

        expect(problems).toHaveLength(3);
        expect(problems[0]).toContain('points to "./src/static/demo/other.html"');
        expect(problems[1]).toContain('missing sea-config asset "/static/demo/app.js"');
    });

    test('the existing task-vis files in sea-config.json point at the right files', () => {
        const seaConfig = JSON.parse(fs.readFileSync(path.join(defaultSrcRoot(), '..', 'sea-config.json'), 'utf8'));
        const taskVisRoutes = ['index.html', '404.html', 'vis-network.min.js', 'ctrl-q.png', 'favicon.ico'].map((f) => ({
            url: `/${f}`,
            file: `static/${f}`,
            seaKey: `/${f}`,
        }));

        expect(checkSeaConfig(taskVisRoutes, seaConfig.assets)).toEqual([]);
    });
});
