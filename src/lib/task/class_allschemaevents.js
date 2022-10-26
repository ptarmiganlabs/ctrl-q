const axios = require('axios');
const path = require('path');

const { logger, execPath, verifyFileExists } = require('../../globals');
const { setupQRSConnection } = require('../qrs');
const { QlikSenseSchemaEvent } = require('./class_schemaevent');

class QlikSenseSchemaEvents {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options) {
        try {
            this.schemaEventList = [];
            this.options = options;

            // Make sure certificates exist
            this.fileCert = path.resolve(execPath, options.authCertFile);
            this.fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            const fileCertExists = await verifyFileExists(this.fileCert);
            if (fileCertExists === false) {
                logger.error(`Missing certificate key file ${this.fileCert}. Aborting`);
                process.exit(1);
            } else {
                logger.verbose(`Certificate key file ${this.fileCert} found`);
            }

            const fileCertKeyExists = await verifyFileExists(this.fileCertKey);
            if (fileCertKeyExists === false) {
                logger.error(`Missing certificate key file ${this.fileCertKey}. Aborting`);
                process.exit(1);
            } else {
                logger.verbose(`Certificate key file ${this.fileCertKey} found`);
            }
        } catch (err) {
            logger.error(`GET SCHEMA EVENT: ${err}`);
        }
    }

    clear() {
        this.schemaEventList = [];
    }

    // Add new schema event
    addSchemaEvent(schemaEvent) {
        const newSchemaEvent = new QlikSenseSchemaEvent(schemaEvent);
        this.schemaEventList.push(newSchemaEvent);
    }

    getSchemaEventsFromQseow() {
        return new Promise((resolve, reject) => {
            try {
                logger.debug('GET SCHEMA EVENT: Starting get schema events from QSEoW');

                const axiosConfig = setupQRSConnection(this.options, {
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/schemaevent/full',
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        logger.debug(`GET SCHEMA EVENT: Result=${result.status}`);
                        const schemaEvents = JSON.parse(result.data);
                        logger.info(`GET SCHEMA EVENT: # events: ${schemaEvents.length}`);

                        this.clear();
                        // eslint-disable-next-line no-plusplus
                        for (let i = 0; i < schemaEvents.length; i++) {
                            this.addSchemaEvent(schemaEvents[i]);
                        }
                        resolve(this.taskList);
                    })
                    .catch((err) => {
                        logger.error(`GET SCHEMA EVENT 1: ${err}`);
                        reject(err);
                    });
            } catch (err) {
                logger.error(`GET SCHEMA EVENT 2: ${err}`);
                reject(err);
            }
        });
    }
}

module.exports = {
    QlikSenseSchemaEvents,
};
