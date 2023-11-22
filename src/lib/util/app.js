const axios = require('axios');
const path = require('path');
const { validate } = require('uuid');
const { error } = require('console');

const { logger, execPath, getCliOptions } = require('../../globals');
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
        logger.debug(`GET APPS: QRS query filter (incl ids): ${filter}`);

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
        logger.debug(`GET APPS: QRS query filter (incl ids, tags): ${filter}`);

        let axiosConfig;
        if (filter === '') {
            // No apps matching the provided app IDs and tags. Error!
            logger.error('GET APPS: No apps matching the provided app IDs and and tags. Exiting.');
            process.exit(1);
        }
        // Should cerrificates be used for authentication?
        else if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                fileCert,
                fileCertKey,
                path: '/qrs/app/full',
                queryParameters: [{ name: 'filter', value: filter }],
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/app/full',
                queryParameters: [{ name: 'filter', value: filter }],
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`GET APPS BY TAG: Result=result.status`);

        const apps = JSON.parse(result.data);
        logger.verbose(`GET APPS BY TAG: # apps: ${apps.length}`);

        return apps;
    } catch (err) {
        logger.error(err.stack);
        return false;
    }
}

// Function to get app info from QRS, given app ID
async function getAppById(appId, optionsParam) {
    try {
        logger.debug(`GET APP BY ID: Starting get app from QSEoW for app id ${appId}`);
        // Did we get any options as parameter?
        let options;
        if (!optionsParam) {
            // Get CLI options
            options = getCliOptions();
        } else {
            options = optionsParam;
        }

        // Is the app ID a valid GUID?
        if (!validate(appId)) {
            logger.error(`GET APP BY ID: App ID ${appId} is not a valid GUID.`);

            return false;
        }

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
                path: `/qrs/app/${appId}`,
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: `/qrs/app/${appId}`,
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`GET APP BY ID: Result=${result.status}`);

        if (result.status === 200) {
            const app = JSON.parse(result.data);
            logger.debug(`GET APP BY ID: App details: ${app}`);

            if (app && app?.id) {
                // Yes, the app exists
                logger.verbose(`App exists: ID=${app.id}. App name="${app.name}"`);
                return app;
            }
            // No, the app does not exist
            logger.verbose(`App does not exist: ID=${appId}`);
        }

        return false;
    } catch (err) {
        logger.error(`GET APP BY ID: ${err}`);

        // Show stack trace if available
        if (err?.stack) {
            logger.error(`GET APP BY ID:\n  ${err.stack}`);
        }

        return false;
    }
}

// Function to delete app given app ID
async function deleteAppById(appId, options) {
    // Ensuire options are specified. Exit if not
    if (!options) {
        logger.error(`DELETE APP: No options specified. Exiting.`);
        process.exit(1);
    }

    try {
        logger.debug(`DELETE APP: Starting delete app from QSEoW for app id ${appId}`);

        // Get CLI options
        // const cliOptions = getCliOptions();

        // Should cerrificates be used for authentication?
        let axiosConfig;
        if (options.authType === 'cert') {
            // Make sure certificates exist
            const fileCert = path.resolve(execPath, options.authCertFile);
            const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            axiosConfig = setupQRSConnection(options, {
                method: 'delete',
                fileCert,
                fileCertKey,
                path: `/qrs/app/${appId}`,
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'delete',
                path: `/qrs/app/${appId}`,
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`DELETE APP: Result=result.status`);

        if (result.status !== 204) {
            logger.error(`DELETE APP: Failed deleting app from QSEoW: ${JSON.stringify(result, null, 2)}. Aborting.`);
            process.exit(1);
        }

        return true;
    } catch (err) {
        logger.error(`DELETE APP: ${err}`);

        // Show stack trace if available
        if (err?.stack) {
            logger.error(`DELETE APP:\n  ${err.stack}`);
        }

        return false;
    }
}

// Check if an app with a given id exists
async function appExistById(appId, options) {
    try {
        logger.debug(`Checking if app with id ${appId} exists in QSEoW`);

        // Is the app ID a valid GUID?
        if (!validate(appId)) {
            logger.error(`APP EXIST BY ID: App ID ${appId} is not a valid GUID.`);

            return false;
        }

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
                path: '/qrs/app',
                queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${appId}`) }],
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/app',
                queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${appId}`) }],
            });
        }

        const result = await axios.request(axiosConfig);
        logger.debug(`APP EXIST BY ID: Result=${result.status}`);

        if (result.status === 200) {
            const apps = JSON.parse(result.data);
            logger.debug(`APP EXIST BY ID: App details: ${JSON.stringify(apps)}`);

            if (apps.length === 1 && apps[0].id) {
                // Yes, the app exists
                logger.verbose(`App exists: ID=${apps[0].id}. App name="${apps[0].name}"`);

                return true;
            }

            if (apps.length > 1) {
                logger.error(`More than one app with ID ${appId} found. Should not be possible. Exiting.`);
                process.exit(1);
            } else {
                return false;
            }
        }

        return false;
    } catch (err) {
        logger.error(`APP EXIST BY ID: ${err}`);

        // Show stack trace if available
        if (err?.stack) {
            logger.error(`APP EXIST BY ID:\n  ${err.stack}`);
        }

        return false;
    }
}

module.exports = {
    getApps,
    getAppById,
    deleteAppById,
    appExistById,
};
