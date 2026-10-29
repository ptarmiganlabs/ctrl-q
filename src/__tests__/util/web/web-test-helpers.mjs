import http from 'node:http';
import zlib from 'node:zlib';

/**
 * Send a raw HTTP request. The path is sent exactly as given (no URL normalisation), which is what an attacker does.
 *
 * @param {object} param - Request parameters.
 * @returns {Promise<{status: number, headers: object, body: string}>} Response.
 */
export function rawRequest({ port, method = 'GET', path = '/', headers = {}, host = '127.0.0.1' }) {
    return new Promise((resolve, reject) => {
        const req = http.request({ host, port, method, path, headers: { Host: `localhost:${port}`, ...headers }, agent: false }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                let buf = Buffer.concat(chunks);
                if (res.headers['content-encoding'] === 'gzip') {
                    buf = zlib.gunzipSync(buf);
                }
                resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf8') });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

export const silentLogger = { error() {}, warn() {}, info() {}, verbose() {}, debug() {}, silly() {} };

export const sleep = (ms) =>
    new Promise((r) => {
        setTimeout(r, ms);
    });

/**
 * Wait until a condition holds.
 *
 * @param {Function} predicate - Returns true once the condition holds.
 * @param {number} [timeoutMs] - Give up, and throw, after this long.
 */
export async function waitFor(predicate, timeoutMs = 2000) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('timeout waiting for condition');
        }
        await sleep(10);
    }
}
