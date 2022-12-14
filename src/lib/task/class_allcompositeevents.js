const axios = require('axios');
const path = require('path');

const { logger, execPath, verifyFileExists } = require('../../globals');
const { setupQRSConnection } = require('../util/qrs');
const { QlikSenseCompositeEvent } = require('./class_compositeevent');

class QlikSenseCompositeEvents {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options) {
        try {
            this.compositeEventList = [];
            this.options = options;

            // Make sure certificates exist
            this.fileCert = path.resolve(execPath, options.authCertFile);
            this.fileCertKey = path.resolve(execPath, options.authCertKeyFile);
        } catch (err) {
            logger.error(`GET COMPOSITE EVENT: ${err}`);
        }
    }

    clear() {
        this.compositeEventList = [];
    }

    // Add new schema event
    addCompositeEvent(compositeEvent) {
        const newCompositeEvent = new QlikSenseCompositeEvent(compositeEvent);
        this.compositeEventList.push(newCompositeEvent);
    }

    getCompositeEventsFromQseow() {
        return new Promise((resolve, reject) => {
            try {
                logger.debug('GET SCHEMAEVENT: Starting get composite events from QSEoW');

                const axiosConfig = setupQRSConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/compositeevent/full',
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        logger.debug(`GET COMPOSITE EVENT: Result=${result.status}`);
                        // const compositeEvents = JSON.parse(result.data);
                        const compositeEvents = result.data;
                        logger.info(`GET COMPOSITE EVENT: # events: ${compositeEvents.length}`);

                        this.clear();
                        // eslint-disable-next-line no-plusplus
                        for (let i = 0; i < compositeEvents.length; i++) {
                            this.addCompositeEvent(compositeEvents[i]);
                        }
                        resolve(this.taskList);
                    })
                    .catch((err) => {
                        logger.error(`GET COMPOSITE EVENT 1: ${err}`);
                        reject(err);
                    });
            } catch (err) {
                logger.error(`GET COMPOSITE EVENT 2: ${err}`);
                reject(err);
            }
        });
    }
}

module.exports = {
    QlikSenseCompositeEvents,
};
