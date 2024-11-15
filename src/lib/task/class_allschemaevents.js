import axios from 'axios';
import { logger } from '../../globals.js';
import { setupQrsConnection } from '../util/qseow/qrs.js';
import QlikSenseSchemaEvent from './class_schemaevent.js';
import { catchLog } from '../util/log.js';
import { getCertFilePaths } from '../util/qseow/cert.js';

class QlikSenseSchemaEvents {
    constructor() {
        //
    }

    async init(options) {
        try {
            this.schemaEventList = [];
            this.options = options;

            if (this.options.authType === 'cert') {
                // Get certificate paths
                const { fileCert, fileCertKey, fileCertCA } = getCertFilePaths(options);

                this.fileCert = fileCert;
                this.fileCertKey = fileCertKey;
                this.fileCertCA = fileCertCA;
            }
        } catch (err) {
            catchLog(`GET SCHEMA EVENT INIT`, err);
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

    getSchemaEventsFromFile(schemaEvent) {
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('GET SCHEMA EVENT: Starting get schema events from QSEoW');

                this.addSchemaEvent(schemaEvent);

                resolve();
            } catch (err) {
                catchLog(`GET SCHEMA EVENT 1`, err);
                reject(err);
            }
        });
    }

    getSchemaEventsFromQseow() {
        return new Promise(async (resolve, reject) => {
            try {
                logger.debug('GET SCHEMA EVENT: Starting get schema events from QSEoW');

                const axiosConfig = await setupQrsConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: '/qrs/schemaevent/full',
                });

                axios
                    .request(axiosConfig)
                    .then((result) => {
                        logger.debug(`GET SCHEMA EVENT: Result=${result.status}`);
                        const schemaEvents = JSON.parse(result.data);
                        logger.verbose(`GET SCHEMA EVENT: Total number of schema events: ${schemaEvents.length}`);

                        this.clear();
                        for (let i = 0; i < schemaEvents.length; i++) {
                            this.addSchemaEvent(schemaEvents[i]);
                        }
                        resolve(this.taskList);
                    })
                    .catch((err) => {
                        catchLog(`GET SCHEMA EVENT 2`, err);
                        reject(err);
                    });
            } catch (err) {
                catchLog(`GET SCHEMA EVENT 3`, err);
                reject(err);
            }
        });
    }
}

export default QlikSenseSchemaEvents;
