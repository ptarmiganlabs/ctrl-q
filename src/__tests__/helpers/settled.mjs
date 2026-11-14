/**
 * Wait for a promise, failing at once if it hasn't settled within the given time rather than
 * leaving the test to time out.
 *
 * @param {Promise} promise - The promise to wait for.
 * @param {number} [ms] - How long to wait, in milliseconds.
 * @returns {Promise} Settles as the promise does, or rejects if it hasn't settled in time.
 */
export const settled = async (promise, ms = 1000) => {
    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`did not settle within ${ms} ms`)), ms);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
};
