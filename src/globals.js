import winston from 'winston';
import upath from 'upath';
import { fileURLToPath } from 'url';
import { readFileSync, promises as Fs } from 'fs';
import 'winston-daily-rotate-file';

// Get app version from package.json file
// Get app version from package.json file
const filenamePackage = `./package.json`;
let a;
let b;
let c;
// Are we running as a packaged app?
if (process.pkg) {
    // Get path to JS file
    a = process.pkg.defaultEntrypoint;

    // Strip off the filename
    b = upath.dirname(a);

    // Add path to package.json file
    c = upath.join(b, filenamePackage);
} else {
    // Get path to JS file
    a = fileURLToPath(import.meta.url);

    // Strip off the filename
    b = upath.dirname(a);

    // Add path to package.json file
    c = upath.join(b, '..', filenamePackage);
}

const { version } = JSON.parse(readFileSync(c));
export const appVersion = version;

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
export const isPkg = typeof process.pkg !== 'undefined';
export const execPath = isPkg ? upath.dirname(process.execPath) : process.cwd();

// Functions to get/set current console logging level
export const getLoggingLevel = () => logTransports.find((transport) => transport.name === 'console').level;

export const setLoggingLevel = (newLevel) => {
    logTransports.find((transport) => transport.name === 'console').level = newLevel;
};

export const verifyFileExists = async (file, silent = false) => {
    let exists = false;
    try {
        await Fs.stat(file);
        exists = true;
    } catch (err) {
        if (!silent) {
            if (isPkg) {
                if (err.message) {
                    // Make message a bit nicer than what's returned from stat()
                    if (err.message.includes('no such file or directory')) {
                        logger.error(`File "${file}" does not exist.`);
                    } else {
                        logger.error(`Error while checking if file ${file} exists: ${err.message}`);
                    }
                } else {
                    logger.error(`Error while checking if file ${file} exists: ${err}`);
                }
            } else if (err.message) {
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
};

export const mergeDirFilePath = (pathElements) => {
    let fullPath = '';
    if (isPkg) {
        fullPath = upath.resolve(upath.dirname(process.execPath), ...pathElements);
    } else {
        // fullPath = upath.resolve(__dirname, ...pathElements);
        fullPath = upath.resolve(upath.join(...pathElements));
    }
    return fullPath;
};

export const generateXrfKey = () => {
    let xrfString = '';
    // eslint-disable-next-line no-plusplus
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
 * Helper function to read the contents of the certificate files:
 * @param {*} filename
 * @returns
 */
export const readCert = (filename) => readFileSync(filename);

// https://stackoverflow.com/questions/175739/how-can-i-check-if-a-string-is-a-valid-number
export function isNumeric(str) {
    if (typeof str !== 'string') return false; // we only process strings!
    return (
        !Number.isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !Number.isNaN(parseFloat(str))
    ); // ...and ensure strings of whitespace fail
}

export function sleep(ms) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to set CLI options. Clear any existing options first.
export const setCliOptions = (options) => {
    cliOptions = {};

    Object.assign(cliOptions, options);
};

// Function to get CLI options
export const getCliOptions = () => cliOptions;

// export default {
//     logger,
//     appVersion,
//     getLoggingLevel,
//     setLoggingLevel,
//     execPath,
//     isPkg,
//     verifyFileExists,
//     generateXrfKey,
//     readCert,
//     isNumeric,
//     mergeDirFilePath,
//     sleep,
//     getCliOptions,
//     setCliOptions,
// };
