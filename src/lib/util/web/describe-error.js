import { inspect } from 'node:util';

/**
 * Describe a thrown or rejected value for a log line.
 *
 * Anything can be thrown or rejected: undefined, a string, a Symbol, an object without a prototype. Turning those into
 * text must not throw in turn, as `${err.message}` does for undefined and `${err}` for a Symbol: in a catch handler
 * that would leave a rejection that nothing handles, and Node ends the process on one.
 *
 * @param {*} err - What was thrown or rejected.
 * @returns {string} Its message, or a description of it.
 */
export function describeError(err) {
    try {
        return String(err?.message ?? err);
    } catch {
        return inspect(err);
    }
}
