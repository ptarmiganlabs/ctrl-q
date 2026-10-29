import { test, expect, describe } from '@jest/globals';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { TASK_VIS_ROUTES } from '../../../lib/cmd/qseow/vistask.js';
import { TASK_GANTT_ROUTES } from '../../../lib/task-gantt/page-routes.js';

// Files the web pages serve: what sea-config.json embeds in the Ctrl-Q binaries, and the vendored third-party files.

const REPO_DIR = new URL('../../../../', import.meta.url);
const SEA_CONFIG = JSON.parse(fs.readFileSync(new URL('sea-config.json', REPO_DIR), 'utf8'));
const NOTICES = fs.readFileSync(new URL('THIRD-PARTY-NOTICES.md', REPO_DIR), 'utf8');

// Vendored bundles are the unmodified upstream files, see THIRD-PARTY-NOTICES.md
const VENDORED = {
    'src/static/vendor/echarts/echarts.min.js': 'b66b25aeb4df84e33199dc21694014d336d222cbd9deb0e5a7c14bd6aa0d0fd0',
    'src/static/vendor/vis-network/vis-network.min.js': 'f6ee3a6560dd2bc7fce0b08149a30f2111e78255c5bb677e02c6517acc770379',
    'src/static/vendor/vis-network/vis-network.min.css': '2e82d445ad5878ea881652470ce632601f8f55f1b99e6ebecdff8614600e6d0e',
};

describe('sea-config.json', () => {
    test('every embedded file exists', () => {
        for (const file of Object.values(SEA_CONFIG.assets)) {
            expect({ file, exists: fs.existsSync(new URL(file, REPO_DIR)) }).toEqual({ file, exists: true });
        }
    });

    test('every embedded web page file is served by a web page route', () => {
        const served = new Set([...TASK_VIS_ROUTES, ...TASK_GANTT_ROUTES].map((route) => route.seaKey || `/${route.file}`));
        const webAssets = Object.keys(SEA_CONFIG.assets).filter((key) => key.startsWith('/'));

        expect(webAssets.length).toBeGreaterThan(0);
        for (const key of webAssets) expect({ key, served: served.has(key) }).toEqual({ key, served: true });
    });
});

describe('vendored files', () => {
    test.each(Object.entries(VENDORED))('%s is the unmodified upstream file THIRD-PARTY-NOTICES.md names', (file, sha256) => {
        const actual = crypto
            .createHash('sha256')
            .update(fs.readFileSync(new URL(file, REPO_DIR)))
            .digest('hex');

        expect(actual).toBe(sha256);
        expect(NOTICES).toContain(sha256);
    });

    test('every vendored file is listed', () => {
        const listed = fs
            .readdirSync(new URL('src/static/vendor/', REPO_DIR), { recursive: true })
            .map((p) => `src/static/vendor/${p.replaceAll('\\', '/')}`)
            .filter((p) => /\.(js|css)$/.test(p));

        expect(listed.sort()).toEqual(Object.keys(VENDORED).sort());
    });
});
