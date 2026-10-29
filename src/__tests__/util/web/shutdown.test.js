import { jest, test, expect, describe } from '@jest/globals';
import { EventEmitter } from 'node:events';

import { createShutdownManager } from '../../../lib/util/web/shutdown.js';
import { silentLogger } from './web-test-helpers.mjs';

// tty: whether output goes to a terminal, as when Ctrl-Q is started from one (not under nohup or redirected)
const fakeProcess = (platform = 'darwin', { tty = true } = {}) => {
    const proc = new EventEmitter();
    proc.platform = platform;
    proc.exit = jest.fn();
    proc.stdout = Object.assign(new EventEmitter(), { isTTY: tty });
    proc.stderr = Object.assign(new EventEmitter(), { isTTY: tty });
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

    test('a closer that rejects with something other than an Error is logged, and the others still run', async () => {
        const order = [];
        const warnings = [];
        const mgr = createShutdownManager({ processRef: fakeProcess(), logger: { ...silentLogger, warn: (m) => warnings.push(m) } });
        mgr.register('a', () => order.push('a'));
        mgr.register('b', () => Promise.reject());
        mgr.register('c', () => Promise.reject('gave up'));

        await mgr.shutdown();

        expect(order).toEqual(['a']);
        expect(warnings).toEqual(['Shutdown: "c" failed: gave up', 'Shutdown: "b" failed: undefined']);
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
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger, closerTimeoutMs: 20 });
        mgr.register('slow', () => new Promise(() => {}));
        mgr.install();

        proc.emit('SIGTERM');
        proc.emit('SIGINT');

        expect(proc.exit).toHaveBeenNthCalledWith(1, 1);
        // Let the abandoned shutdown finish, so that none of it runs after this test
        await mgr.shutdown();
    });

    test('SIGHUP from a closed terminal runs the closers, and a repeated SIGHUP does not force the exit', async () => {
        const proc = fakeProcess();
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger });
        const closer = jest.fn();
        mgr.register('x', closer);
        mgr.install();

        proc.emit('SIGHUP');
        proc.emit('SIGHUP');
        await flush();
        await flush();

        expect(closer).toHaveBeenCalledTimes(1);
        expect(proc.exit).toHaveBeenCalledTimes(1);
        expect(proc.exit).toHaveBeenCalledWith(0);
    });

    test('console write errors end the process as usual before shutdown, and are ignored once it has begun', async () => {
        const proc = fakeProcess();
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger });
        mgr.install();

        expect(() => proc.stdout.emit('error', new Error('write EPIPE'))).toThrow('write EPIPE');

        // The terminal has gone: writing to it fails with EIO
        proc.emit('SIGHUP');
        expect(() => proc.stdout.emit('error', new Error('write EIO'))).not.toThrow();
        expect(() => proc.stderr.emit('error', new Error('write EIO'))).not.toThrow();
        await mgr.shutdown();
    });

    test('leaves SIGHUP alone when output does not go to a terminal, e.g. under nohup', () => {
        const proc = fakeProcess('linux', { tty: false });
        createShutdownManager({ processRef: proc, logger: silentLogger }).install();

        expect(proc.listenerCount('SIGHUP')).toBe(0);
        expect(proc.listenerCount('SIGINT')).toBe(1);
    });

    test('listens for SIGBREAK on Windows only, and for SIGHUP everywhere', () => {
        const win = fakeProcess('win32');
        const mac = fakeProcess('darwin');
        createShutdownManager({ processRef: win, logger: silentLogger }).install();
        createShutdownManager({ processRef: mac, logger: silentLogger }).install();

        expect(win.listenerCount('SIGBREAK')).toBe(1);
        expect(mac.listenerCount('SIGBREAK')).toBe(0);
        expect(mac.listenerCount('SIGINT')).toBe(1);
        expect(win.listenerCount('SIGHUP')).toBe(1);
        expect(mac.listenerCount('SIGHUP')).toBe(1);
    });

    test('install() is idempotent', () => {
        const proc = fakeProcess();
        const mgr = createShutdownManager({ processRef: proc, logger: silentLogger });
        mgr.install();
        mgr.install();

        expect(proc.listenerCount('SIGINT')).toBe(1);
    });
});
