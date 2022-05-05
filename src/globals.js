const winston = require('winston');
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

// Logging to disk
// logTransports.push(
//     new winston.transports.DailyRotateFile({
//         dirname: path.join(__dirname, config.get('Butler.logDirectory')),
//         filename: 'butler.%DATE%.log',
//         level: config.get('Butler.logLevel'),
//         datePattern: 'YYYY-MM-DD',
//         maxFiles: '30d',
//     }),
// );

const logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
});

// Functions to get/set current console logging level
const getLoggingLevel = () => logTransports.find((transport) => transport.name === 'console').level;

const setLoggingLevel = (newLevel) => {
    logTransports.find((transport) => transport.name === 'console').level = newLevel;
};

module.exports = {
    logger,
    appVersion,
    getLoggingLevel,
    setLoggingLevel,
};
