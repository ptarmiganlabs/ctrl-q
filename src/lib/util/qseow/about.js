import axios from 'axios';
import path from 'path';
import { logger, execPath } from '../../../globals.js';
import { setupQrsConnection } from './qrs.js';
import { catchLog } from '../log.js';

async function getAboutFromQseow(options) {
    logger.verbose(`Getting about info from QSEoW...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/about',
        });

        logger.debug(`About to get about info from QSEoW`);

        const result = await axios.request(axiosConfig);

        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.debug(`Successfully retrieved about info from QSEoW`);

            return response;
        }
        return false;
    } catch (err) {
        catchLog('GET ABOUT INFO', err);
        return false;
    }
}

export default getAboutFromQseow;
