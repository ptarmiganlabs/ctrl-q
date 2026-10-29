import { inspect } from 'node:util';

// One short line, however large or deep the value: it goes into a log message
const INSPECT_OPTIONS = { depth: 2, breakLength: Infinity, maxArrayLength: 5, maxStringLength: 100 };

/**
 * Describe a thrown or rejected value for a log line.
 *
 * Anything can be thrown or rejected: undefined, a string, a Symbol, an object without a prototype. Turning those into
 * text must not throw in turn, as `${err.message}` does for undefined and `${err}` for a Symbol: in a catch handler
 * that would leave a rejection that nothing handles, and Node ends the process on one. An Error without a message is
 * described by its name and code, e.g. 'AbortError' or 'Error (EPIPE)', rather than as nothing.
 *
 * @param {*} err - What was thrown or rejected.
 * @returns {string} Its message, or a description of it.
 */
export function describeError(err) {
    try {
        if (err instanceof Error) {
            const what = err.message || err.name;
            return err.code && !what.includes(err.code) ? `${what} (${err.code})` : what;
        }
        if (typeof err?.message === 'string' && err.message) {
            return err.message;
        }
        if (err === null || typeof err !== 'object') {
            return String(err);
        }
        return inspect(err, INSPECT_OPTIONS);
    } catch {
        return inspect(err, INSPECT_OPTIONS);
    }
}
