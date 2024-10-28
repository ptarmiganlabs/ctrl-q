import axios from 'axios';
import path from 'path';
import { logger, execPath } from '../../../globals.js';
import { setupQrsConnection } from './qrs.js';
import { catchLog } from '../log.js';

async function getAboutFromQseow(options) {
    logger.verbose(`Getting about info from QSEoW...`);

    // Should cerrificates be used for authentication?
    let axiosConfig;

    if (options.authType === 'cert') {
        // Make sure certificates exist
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);
        const fileCertCA = path.resolve(execPath, options.authRootCertFile);

        axiosConfig = setupQrsConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            fileCertCA,
            path: '/qrs/about',
        });
    } else if (options.authType === 'jwt') {
        axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/about',
        });
    }

    logger.debug(`About to get about info from QSEoW`);

    try {
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
