import axios from 'axios';
import path from 'node:path';
import { logger, execPath } from '../../../globals.js';
import { setupQrsConnection } from './qrs.js';
import { catchLog } from '../log.js';

const getProxiesFromQseow = async (options, _sessionCookie) => {
    logger.verbose(`Getting all proxies from QSEoW...`);

    // TODO Should support JWTs here too?
    const axiosConfig = setupQrsConnection(options, {
        method: 'get',
        path: '/qrs/proxyservice/full',
        sessionCookie: null,
    });

    // Get proxies from QRS
    let proxies = [];
    try {
        const result = await axios.request(axiosConfig);

        if (result.status === 200) {
            const response = JSON.parse(result.data);
            proxies = response;
            logger.info(`Successfully retrieved ${response.length} proxies from host ${options.host}`);
        }
    } catch (err) {
        catchLog('GET PROXIES FROM QSEoW', err);
        return false;
    }

    return proxies;
};

export default getProxiesFromQseow;
