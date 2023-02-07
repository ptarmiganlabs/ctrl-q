const winston = require('winston');
const upath = require('upath');
const { promises: Fs } = require('fs');
const fs = require('fs');
require('winston-daily-rotate-file');

// Get app version from package.json file
const appVersion = require('./package.json').version;

// Set up logger with timestamps and colors, and optional logging to disk file
const logTransports = [];

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

const logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
});

// Are we running as standalone app or not?
const isPkg = typeof process.pkg !== 'undefined';
const execPath = isPkg ? upath.dirname(process.execPath) : __dirname;

// Functions to get/set current console logging level
const getLoggingLevel = () => logTransports.find((transport) => transport.name === 'console').level;

const setLoggingLevel = (newLevel) => {
    logTransports.find((transport) => transport.name === 'console').level = newLevel;
};

const verifyFileExists = async (file) =>
    // eslint-disable-next-line no-async-promise-executor, no-unused-vars
    new Promise(async (resolve, reject) => {
        try {
            logger.debug(`Checking if file ${file} exists`);

            try {
                await Fs.access(file);
                resolve(true);
            } catch {
                resolve(false);
            }
        } catch (err) {
            logger.error(`Error while checking if file ${file} exists: ${JSON.stringify(err, null, 2)}`);
            resolve(false);
        }
    });

const generateXrfKey = () => {
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
const readCert = (filename) => fs.readFileSync(filename);

// https://stackoverflow.com/questions/175739/how-can-i-check-if-a-string-is-a-valid-number
function isNumeric(str) {
    if (typeof str !== 'string') return false; // we only process strings!
    return (
        !Number.isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !Number.isNaN(parseFloat(str))
    ); // ...and ensure strings of whitespace fail
}

module.exports = {
    logger,
    appVersion,
    getLoggingLevel,
    setLoggingLevel,
    execPath,
    isPkg,
    verifyFileExists,
    generateXrfKey,
    readCert,
    isNumeric,
};
