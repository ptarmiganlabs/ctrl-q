import os from 'node:os';

import { formatHostForUrl } from './server.js';

/**
 * Names and addresses other computers can use to open a page served on all interfaces ('0.0.0.0' or '::').
 *
 * @param {string} visHost - Host the web server listens on.
 * @param {object} [param] - Parameters, for tests.
 * @param {Function} [param.hostname] - Returns this computer's name, like os.hostname().
 * @param {Function} [param.networkInterfaces] - Returns the network interfaces, like os.networkInterfaces().
 * @returns {string[]} Host names and IP addresses, or none if the server listens on one host only.
 */
export function shareHosts(visHost, { hostname = os.hostname, networkInterfaces = os.networkInterfaces } = {}) {
    if (visHost !== '0.0.0.0' && visHost !== '::') return [];
    const hosts = [String(hostname() || '').toLowerCase()];
    for (const addrs of Object.values(networkInterfaces() || {})) {
        for (const a of addrs || []) {
            if (a.internal) continue;
            const ipv4 = a.family === 'IPv4' || a.family === 4;
            // '0.0.0.0' accepts IPv4 only. Link-local IPv6 addresses need a zone id, which does not work in a URL.
            if (ipv4 || (visHost === '::' && !a.address.toLowerCase().startsWith('fe80:'))) hosts.push(a.address);
        }
    }
    return [...new Set(hosts.filter(Boolean))];
}

/**
 * URLs of a page served on all interfaces, one per name or address other computers can use.
 *
 * @param {string} url - URL the web server reported (with 'localhost').
 * @param {string[]} hosts - Host names and IP addresses, see shareHosts().
 * @returns {string[]} URLs.
 */
export function shareUrls(url, hosts) {
    return hosts.map((h) => {
        const u = new URL(url);
        u.hostname = formatHostForUrl(h);
        return u.toString();
    });
}
