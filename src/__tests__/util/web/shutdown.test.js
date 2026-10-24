import { jest, test, expect, describe } from '@jest/globals';
import { EventEmitter } from 'node:events';

import { createShutdownManager } from '../../../lib/util/web/shutdown.js';
import { silentLogger } from './web-test-helpers.mjs';

const fakeProcess = (platform = 'darwin') => {
    const proc = new EventEmitter();
    proc.platform = platform;
    proc.exit = jest.fn();
    return proc;
};

const flush = () =>
    new Promise((r) => {
        setImmediate(r);
    });

describe('createShutdownManager', () => {
    test('runs closers once, in reverse order', async () => {
        const order = [];
        const mgr = createShutdownManager({ processRef: fakeProcess(), logger: silentLogger });
        mgr.register('server', () => order.push('server'));
        mgr.register('poller', async () => order.push('poller'));
        mgr.register('history', () => order.push('history'));

        await Promise.all([mgr.shutdown('test'), mgr.shutdown('again')]);

        expect(order).toEqual(['history', 'poller', 'server']);
    });

    test('a failing closer does not stop the others', async () => {
        const order = [];
        const mgr = createShutdownManager({ processRef: fakeProcess(), logger: silentLogger });
        mgr.register('a', () => order.push('a'));
        mgr.register('b', () => {
            throw new Error('fail');
        });

        await mgr.shutdown();

        expect(order).toEqual(['a']);
    });

    test('a hanging closer is abandoned after the timeout', async () => {
        const order = [];
        const mgr = createShutdownManager({ processRef: fakeProcess(), logger: silentLogger, closerTimeoutMs: 20 });
        mgr.register('a', () => order.push('a'));
        mgr.register('hang', () => new Promise(() => {}));

        await mgr.shutdown();

        expect(order).toEqual(['a']);
    });

    test('SIGINT runs the closers and exits with 0', async () => {
        const proc = fakeProcess();
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger });
        const closer = jest.fn();
        mgr.register('x', closer);
        mgr.install();

        proc.emit('SIGINT');
        await flush();
        await flush();

        expect(closer).toHaveBeenCalledTimes(1);
        expect(proc.exit).toHaveBeenCalledWith(0);
    });

    test('a second signal during shutdown exits immediately with 1', async () => {
        const proc = fakeProcess();
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger });
        mgr.register('slow', () => new Promise(() => {}));
        mgr.install();

        proc.emit('SIGTERM');
        proc.emit('SIGINT');

        expect(proc.exit).toHaveBeenCalledWith(1);
    });

    test('listens for SIGBREAK on Windows only', () => {
        const win = fakeProcess('win32');
        const mac = fakeProcess('darwin');
        createShutdownManager({ processRef: win, logger: silentLogger }).install();
        createShutdownManager({ processRef: mac, logger: silentLogger }).install();

        expect(win.listenerCount('SIGBREAK')).toBe(1);
        expect(mac.listenerCount('SIGBREAK')).toBe(0);
        expect(mac.listenerCount('SIGINT')).toBe(1);
    });

    test('install() is idempotent', () => {
        const proc = fakeProcess();
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger });
        mgr.install();
        mgr.install();

        expect(proc.listenerCount('SIGINT')).toBe(1);
    });
});
