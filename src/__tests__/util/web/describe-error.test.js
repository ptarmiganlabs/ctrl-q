import { test, expect, describe } from '@jest/globals';

import { describeError } from '../../../lib/util/web/describe-error.js';

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
});
