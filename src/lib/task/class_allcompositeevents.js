import axios from 'axios';
import path from 'path';
import { logger, execPath, verifyFileExists } from '../../globals.js';
import setupQRSConnection from '../util/qrs.js';
import QlikSenseCompositeEvent from './class_compositeevent.js';
import { catchLog } from '../util/log.js';

class QlikSenseCompositeEvents {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options) {
        try {
            this.compositeEventList = [];
            this.options = options;

            if (this.options.authType === 'cert') {
                // Make sure certificates exist
                this.fileCert = path.resolve(execPath, options.authCertFile);
                this.fileCertKey = path.resolve(execPath, options.authCertKeyFile);
            }
        } catch (err) {
            catchLog(`GET COMPOSITE EVENT`, err);
        }
    }

    clear() {
        this.compositeEventList = [];
    }

    // Add new composite event
    addCompositeEvent(compositeEvent) {
        const newCompositeEvent = new QlikSenseCompositeEvent(compositeEvent);
        this.compositeEventList.push(newCompositeEvent);
    }

    getCompositeEventsFromQseow() {
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('GET SCHEMAEVENT: Starting get composite events from QSEoW');

                const axiosConfig = await setupQRSConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: '/qrs/compositeevent/full',
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        logger.debug(`GET COMPOSITE EVENT: Result=${result.status}`);
                        const compositeEvents = JSON.parse(result.data);
                        logger.verbose(`GET COMPOSITE EVENT: Total number of composite events: ${compositeEvents.length}`);

                        this.clear();
                        // eslint-disable-next-line no-plusplus
                        for (let i = 0; i < compositeEvents.length; i++) {
                            this.addCompositeEvent(compositeEvents[i]);
                        }
                        resolve(this.taskList);
                    })
                    .catch((err) => {
                        catchLog(`GET COMPOSITE EVENT 1`, err);
                        reject(err);
                    });
            } catch (err) {
                catchLog(`GET COMPOSITE EVENT 2`, err);
                reject(err);
            }
        });
    }
}

export default QlikSenseCompositeEvents;
