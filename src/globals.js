import winston from 'winston';
import upath from 'upath';
import { fileURLToPath } from 'node:url';
import { readFileSync, promises as Fs } from 'node:fs';
import 'winston-daily-rotate-file';
import sea from 'node:sea';

// Get app version from package.json file
const filenamePackage = `./package.json`;
let a;
let b;
let c;
export let appVersion;

// Are we running as a packaged app?
if (sea.isSea()) {
    // Get contents of package.json file
    packageJson = sea.getAsset('package.json', 'utf8');
    const version = JSON.parse(packageJson).version;

    appVersion = version;
} else {
    // Get path to JS file
    a = fileURLToPath(import.meta.url);

    // Strip off the filename
    b = upath.dirname(a);

    // Add path to package.json file
    c = upath.join(b, '..', filenamePackage);

    const { version } = JSON.parse(readFileSync(c));
    appVersion = version;
}

// Set up logger with timestamps and colors, and optional logging to disk file
const logTransports = [];

// CLI options specified when starting Ctrl-Q
let cliOptions = {};

logTransports.push(
    new winston.transports.Console({
        name: 'console',
        level: 'info',
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
    })
);

export const logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
});

// Are we running as standalone app or not?
export const isSea = sea.isSea();
export const execPath = isSea ? upath.dirname(process.execPath) : process.cwd();

// Functions to get/set current console logging level
export const getLoggingLevel = () => logTransports.find((transport) => transport.name === 'console').level;

/**
 * Sets the logging level for the console transport.
 *
 * @param {string} newLevel - The new logging level to set (e.g., 'info', 'debug').
 */

export const setLoggingLevel = (newLevel) => {
    logTransports.find((transport) => transport.name === 'console').level = newLevel;
};

/**
 * Asynchronously checks if a specified file exists in the file system.
 *
 * @param {string} file - The path of the file to check.
 * @param {boolean} [silent=false] - If true, suppresses logging of errors.
 * @returns {Promise<boolean>} A promise that resolves to true if the file exists, false otherwise.
 */

export async function verifyFileSystemExists(file, silent = false) {
    let exists = false;
    try {
        await Fs.stat(file);
        exists = true;
    } catch (err) {
        if (!silent) {
            if (err.message) {
                if (err.message.includes('no such file or directory')) {
                    logger.error(`File "${file}" does not exist.`);
                } else {
                    logger.error(`Error while checking if file ${file} exists: ${err.message}`);
                }
            } else if (err.stack) {
                logger.error(`Error while checking if file ${file} exists: ${err.stack}`);
            } else {
                logger.error(`Error while checking if file ${file} exists: ${err}`);
            }
        }
    }
    return exists;
}

/**
 * Check if a bundled SEA asset exists in a packaged Ctrl-Q app.
 *
 * @param {string} file - Name of file to check.
 * @param {boolean} [silent=false] - If true, do not log errors.
 * @returns {boolean} True if file exists, false otherwise.
 */
export function verifySeaAssetExists(file, silent = false) {
    let exists = false;
    try {
        sea.getAsset(file, 'utf8');
        exists = true;
    } catch (err) {
        if (!silent) {
            if (err.message) {
                if (err.message.includes('no such file or directory')) {
                    logger.error(`Asset "${file}" does not exist.`);
                } else {
                    logger.error(`Error while checking if asset ${file} exists: ${err.message}`);
                }
            } else {
                logger.error(`Error while checking if asset ${file} exists: ${err}`);
            }
        }
    }
    return exists;
}

/**
 * Merge an array of path elements to a single path.
 * If running as a packaged SEA app, the path is resolved relative to the directory
 * containing the executable. Otherwise, the path is resolved relative to the current
 * working directory.
 *
 * @param {string[]} pathElements - Path elements to merge.
 * @returns {string} - Merged path.
 */
export const mergeDirFilePath = (pathElements) => {
    let fullPath = '';
    if (isSea) {
        fullPath = upath.resolve(upath.dirname(process.execPath), ...pathElements);
    } else {
        // Return empty string if pathElements is empty
        if (pathElements.length === 0) {
            return fullPath;
        }
        fullPath = upath.resolve(upath.join(...pathElements));
    }
    return fullPath;
};

/**
 * Generates a random X-XSS-Protection header value, which is a string of 16
 * characters that is a mix of numbers and uppercase and lowercase letters.
 *
 * @returns {string} The generated X-XSS-Protection header value.
 */
export const generateXrfKey = () => {
    let xrfString = '';

    for (let i = 0; i < 16; i++) {
        if (Math.floor(Math.random() * 2) === 0) {
            xrfString += Math.floor(Math.random() * 10).toString();
        } else {
            const charNumber = Math.floor(Math.random() * 26);
            if (Math.floor(Math.random() * 2) === 0) {
                // lowercase letter
                xrfString += String.fromCharCode(charNumber + 97);
            } else {
                xrfString += String.fromCharCode(charNumber + 65);
            }
        }
    }
    return xrfString;
};

/**
 * Reads the contents of a certificate file.
 *
 * @param {string} filename - Path to certificate file to read.
 * @returns {string} The contents of the certificate file.
 */
export const readCert = (filename) => readFileSync(filename, 'utf8');

/**
 * Returns true if the input string is numeric, false otherwise.
 * Strings that contain whitespace or non-numeric characters will return false.
 * https://stackoverflow.com/questions/175739/how-can-i-check-if-a-string-is-a-valid-number
 * @param {string} str The string to check if it is numeric.
 * @returns {boolean} True if the string is numeric, false otherwise.
 */
export function isNumeric(str) {
    if (typeof str !== 'string') return false; // we only process strings!
    return (
        !Number.isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !Number.isNaN(parseFloat(str))
    ); // ...and ensure strings of whitespace fail
}

/**
 * A Promise-based sleep function. Returns a Promise that resolves after the given number
 * of milliseconds. The ms parameter may be a number or a string that can be converted to a number.
 * Throw an error if the input is not a positive number, or cannot be converted to such a number.
 *
 * @param {number|string} ms The number of milliseconds to sleep. Can be a number or a string that can be converted to a number.
 * @returns {Promise<void>} A Promise that resolves after the given number of milliseconds.
 */
export function sleep(ms) {
    return new Promise((resolve, reject) => {
        const sleepTime = parseInt(ms, 10);
        if (Number.isNaN(sleepTime) || sleepTime <= 0) {
            reject(new Error('Invalid sleep time'));
        } else {
            setTimeout(resolve, sleepTime);
        }
    });
}

// Function to set CLI options. Clear any existing options first.
export const setCliOptions = (options) => {
    cliOptions = {};

    Object.assign(cliOptions, options);
};

// Function to get CLI options
export const getCliOptions = () => cliOptions;
