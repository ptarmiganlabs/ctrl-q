import { test, expect, describe } from '@jest/globals';

import { mimeTypeFor, isTextMimeType, DEFAULT_MIME_TYPE } from '../../../lib/util/web/mime.js';

describe('mimeTypeFor', () => {
    test('serves JavaScript with a JavaScript MIME type, so ES modules run', () => {
        expect(mimeTypeFor('task-gantt/main.js')).toBe('text/javascript; charset=utf-8');
        expect(mimeTypeFor('x.mjs')).toBe('text/javascript; charset=utf-8');
    });

    test('knows the types used by the web pages', () => {
        expect(mimeTypeFor('index.html')).toBe('text/html; charset=utf-8');
        expect(mimeTypeFor('styles.css')).toBe('text/css; charset=utf-8');
        expect(mimeTypeFor('data.json')).toBe('application/json; charset=utf-8');
        expect(mimeTypeFor('vis-network.min.js.map')).toBe('application/json; charset=utf-8');
        expect(mimeTypeFor('logo.svg')).toBe('image/svg+xml');
        expect(mimeTypeFor('ctrl-q.png')).toBe('image/png');
        expect(mimeTypeFor('favicon.ico')).toBe('image/x-icon');
        expect(mimeTypeFor('LICENSE.txt')).toBe('text/plain; charset=utf-8');
    });

    test('is case-insensitive', () => {
        expect(mimeTypeFor('INDEX.HTML')).toBe('text/html; charset=utf-8');
    });

    test('falls back to octet-stream', () => {
        expect(mimeTypeFor('LICENSE')).toBe(DEFAULT_MIME_TYPE);
        expect(mimeTypeFor('archive.zip')).toBe(DEFAULT_MIME_TYPE);
        expect(mimeTypeFor(undefined)).toBe(DEFAULT_MIME_TYPE);
    });

    test('does not mistake Object.prototype members for MIME types', () => {
        expect(mimeTypeFor('x.constructor')).toBe(DEFAULT_MIME_TYPE);
    });
});

describe('isTextMimeType', () => {
    test('treats text, JSON and SVG as text', () => {
        expect(isTextMimeType('text/javascript; charset=utf-8')).toBe(true);
        expect(isTextMimeType('application/json; charset=utf-8')).toBe(true);
        expect(isTextMimeType('image/svg+xml')).toBe(true);
    });

    test('treats images and unknown types as binary', () => {
        expect(isTextMimeType('image/png')).toBe(false);
        expect(isTextMimeType(DEFAULT_MIME_TYPE)).toBe(false);
        expect(isTextMimeType(undefined)).toBe(false);
    });
});
