import axios from 'axios';
import path from 'path';
import { logger, execPath } from '../../globals.js';
import setupQRSConnection from './qrs.js';
import { catchLog } from './log.js';

function getAboutFromQseow(options) {
    return new Promise((resolve, reject) => {
        logger.verbose(`Getting about info from QSEoW...`);

        // Should cerrificates be used for authentication?
        let axiosConfig;
        if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: '/qrs/about',
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/about',
            });
        }

        logger.debug(`About to get about info from QSEoW`);

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200) {
                    const response = JSON.parse(result.data);
                    logger.debug(`Successfully retrieved about info from QSEoW`);
                    // Yes, the tag exists
                    resolve(response);
                }
                resolve(false);
            })
            .catch((err) => {
                catchLog('GET ABOUT INFO', err);
            });
    });
}

export default getAboutFromQseow;
