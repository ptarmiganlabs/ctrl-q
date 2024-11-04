// const QlikSaas = require('./cloud-repo');
import { auth, users } from '@qlik/api';

import { logger } from '../../../globals.js';

// Function to get info about user associated with the auth JWT being used
export async function getQscloudCurrentUser(options) {
    const hostConfig = {
        authType: options.authType,
        host: options.tenantHost,
        apiKey: options.apikey,
    };

    try {
        // sets a default host config for every api request
        // auth.setDefaultConfig(hostConfig);
        auth.setDefaultHostConfig(hostConfig);
    } catch (err) {
        logger.error(`Error setting default authentication for Qlik Sense Cloud: ${err}`);
        return false;
    }

    try {
        const { data, headers, status } = await users.getMyUser();

        if (status !== 200) {
            logger.error(`Error getting user info from Qlik Sense Cloud: ${status}`);
            return false;
        }

        logger.debug(`User info from Qlik Sense Cloud: ${JSON.stringify(data)}`);

        return data;
    } catch (err) {
        logger.error(`Error getting user info from Qlik Sense Cloud: ${err}`);
        return false;
    }
}
