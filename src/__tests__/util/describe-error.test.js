import { test, expect, describe } from '@jest/globals';

import { describeError } from '../../lib/util/describe-error.js';

describe('describeError', () => {
    test.each([
        ['an Error', new Error('boom'), 'boom'],
        ['an object with a message', { message: 'from a library' }, 'from a library'],
        ['undefined', undefined, 'undefined'],
        ['null', null, 'null'],
        ['a string', 'gave up', 'gave up'],
        ['a number', 42, '42'],
        ['a Symbol', Symbol('odd'), 'Symbol(odd)'],
        ['an object without a prototype', Object.create(null), '[Object: null prototype] {}'],
    ])('describes %s without throwing', (_, value, expected) => {
        expect(describeError(value)).toBe(expected);
    });

    test('falls back to inspect() when even reading the message throws', () => {
        const hostile = {
            get message() {
                throw new Error('no');
            },
        };

        expect(describeError(hostile)).toContain('message: [Getter]');
    });

    test('describes an Error without a message by its name and code, not as nothing', () => {
        const aborted = new Error('');
        aborted.name = 'AbortError';

        expect(describeError(aborted)).toBe('AbortError');
        expect(describeError(Object.assign(new Error(''), { code: 'EPIPE' }))).toBe('Error (EPIPE)');
        expect(describeError(Object.assign(new Error('write failed'), { code: 'EIO' }))).toBe('write failed (EIO)');
        // System errors already name their code
        expect(describeError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:80'), { code: 'ECONNREFUSED' }))).toBe(
            'connect ECONNREFUSED 127.0.0.1:80'
        );
    });

    test('keeps the description of a large value to one short line', () => {
        const large = Object.create(null);
        large.rows = Array.from({ length: 1000 }, (_, i) => ({ id: i, text: 'x'.repeat(1000) }));
        const text = describeError(large);

        expect(text).not.toContain('\n');
        expect(text.length).toBeLessThan(1000);
    });
});
