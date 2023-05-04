const axios = require('axios');
const path = require('path');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

async function getApps(options, idArray, tagArray) {
    try {
        logger.debug(`Getting app IDs from appId and appTag arrays`);

        // Build a query string
        let filter = '';

        // Get apps for specified app IDs
        if (idArray && idArray.length >= 1) {
            // At least one app ID specified
            // Add firstr app ID
            filter += encodeURIComponent(`(id eq ${idArray[0]}`);
        }
        if (idArray && idArray.length >= 2) {
            // Add remaining app IDs, if any
            for (let i = 1; i < idArray.length; i += 1) {
                filter += encodeURIComponent(` or id eq ${idArray[i]}`);
            }
        }

        // Add closing parenthesis
        if (idArray && idArray.length >= 1) {
            filter += encodeURIComponent(')');
        }
        logger.debug(`GET VARIABLE: QRS query filter (incl ids): ${filter}`);

        // Add app tag(s) to query string
        if (tagArray && tagArray.length >= 1) {
            // At least one app tag specified
            if (filter.length >= 1) {
                // We've previously added some app IDs
                // Add first app tag
                filter += encodeURIComponent(` or (tags.name eq '${tagArray[0]}'`);
            } else {
                // No app IDs added yet
                // Add first app tag
                filter += encodeURIComponent(`(tags.name eq '${tagArray[0]}'`);
            }
        }
        if (tagArray && tagArray.length >= 2) {
            // Add remaining app tags, if any
            for (let i = 1; i < tagArray.length; i += 1) {
                filter += encodeURIComponent(` or tags.name eq '${tagArray[i]}'`);
            }
        }

        // Add closing parenthesis
        if (tagArray && tagArray.length >= 1) {
            filter += encodeURIComponent(')');
        }
        logger.debug(`GET VARIABLE: QRS query filter (incl ids, tags): ${filter}`);

        // Make sure certificates exist
        const fileCert = path.resolve(execPath, options.authCertFile);
        const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

        let axiosConfig;
        if (filter === '') {
            // No apps matching the provided app IDs and tags. Error!
            logger.error('No apps matching the provided app IDs and and tags. Exiting.');
            process.exit(1);
        } else {
            axiosConfig = await setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: '/qrs/app/full',
                queryParameters: [{ name: 'filter', value: filter }],
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`GET VARIABLE BY TAG: Result=result.status`);

        const apps = JSON.parse(result.data);
        logger.verbose(`GET VARIABLE BY TAG: # apps: ${apps.length}`);

        return apps;
    } catch (err) {
        logger.error(err.stack);
        return false;
    }
}

module.exports = {
    getApps,
};
