const winston = require('winston');
const upath = require('upath');
const { promises: Fs } = require('fs');
require('winston-daily-rotate-file');

// Get app version from package.json file
const appVersion = require('../package.json').version;

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

// Check file existence
async function exists(pathToCheck) {
    try {
        await Fs.access(pathToCheck);
        return true;
    } catch {
        return false;
    }
}

const verifyFileExists = (file) =>
    // eslint-disable-next-line no-async-promise-executor, no-unused-vars
    new Promise(async (resolve, reject) => {
        try {
            logger.debug(`Checking if file ${file} exists`);

            const fileExists = await exists(file);

            if (fileExists === true) {
                resolve(true);
            } else {
                resolve(false);
            }
        } catch (err) {
            logger.error(`Error while checking if file ${file} exists: ${JSON.stringify(err, null, 2)}`);
            resolve(false);
        }
    });

module.exports = {
    logger,
    appVersion,
    getLoggingLevel,
    setLoggingLevel,
    execPath,
    isPkg,
    verifyFileExists,
};
