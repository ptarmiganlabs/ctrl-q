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
