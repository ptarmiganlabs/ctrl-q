import axios from 'axios';
import path from 'node:path';

import { logger } from '../../globals.js';
import { setupQrsConnection } from '../util/qseow/qrs.js';
import QlikSenseCompositeEvent from './class_compositeevent.js';
import { catchLog } from '../util/log.js';
import { getCertFilePaths } from '../util/qseow/cert.js';

class QlikSenseCompositeEvents {
    constructor() {
        //
    }

    async init(options) {
        try {
            this.compositeEventList = [];
            this.options = options;

            // Should certificates be used for authentication?
            if (this.options.authType === 'cert') {
                // Get certificate paths
                const { fileCert, fileCertKey, fileCertCA } = getCertFilePaths(options);

                this.fileCert = fileCert;
                this.fileCertKey = fileCertKey;
                this.fileCertCA = fileCertCA;
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

                const axiosConfig = setupQrsConnection(this.options, {
                    method: 'get',
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
