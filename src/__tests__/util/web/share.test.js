import { test, expect, describe } from '@jest/globals';

import { shareHosts, shareUrls } from '../../../lib/util/web/share.js';

describe('shareHosts and shareUrls', () => {
    const interfaces = () => ({
        lo0: [
            { address: '127.0.0.1', family: 'IPv4', internal: true },
            { address: '::1', family: 'IPv6', internal: true },
        ],
        en0: [
            { address: '192.168.1.20', family: 'IPv4', internal: false },
            { address: 'fe80::1c2b:3a4d', family: 'IPv6', internal: false },
            { address: '2001:db8::20', family: 'IPv6', internal: false },
        ],
        en1: [{ address: '10.0.0.5', family: 4, internal: false }],
    });
    const env = { hostname: () => 'Ctrl-Q-Box', networkInterfaces: interfaces };

    test('a 0.0.0.0 server is reachable by host name and IPv4 addresses', () => {
        expect(shareHosts('0.0.0.0', env)).toEqual(['ctrl-q-box', '192.168.1.20', '10.0.0.5']);
    });

    test('a :: server also by IPv6 addresses, except link-local ones', () => {
        expect(shareHosts('::', env)).toEqual(['ctrl-q-box', '192.168.1.20', '2001:db8::20', '10.0.0.5']);
    });

    test('a server on one host needs no other URLs', () => {
        expect(shareHosts('localhost', env)).toEqual([]);
        expect(shareHosts('192.168.1.20', env)).toEqual([]);
    });

    test('shareUrls swaps the host and keeps port, path and token; IPv6 addresses get brackets', () => {
        expect(shareUrls('http://localhost:3001/?token=abc', ['ctrl-q-box', '2001:db8::20'])).toEqual([
            'http://ctrl-q-box:3001/?token=abc',
            'http://[2001:db8::20]:3001/?token=abc',
        ]);
    });
});
