import axios from 'axios';
import { validate } from 'uuid';
import { logger, execPath, getCliOptions } from '../../../globals.js';
import { setupQrsConnection } from './qrs.js';
import { catchLog } from '../log.js';

export async function getApps(options, idArray, tagArray) {
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

        if (filter === '') {
            // No apps matching the provided app IDs and tags. Error!
            logger.error('GET APPS: No apps matching the provided app IDs and and tags. Exiting.');
            process.exit(1);
        }

        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/app/full',
            queryParameters: [{ name: 'filter', value: filter }],
        });

        const result = await axios.request(axiosConfig);
        logger.debug(`GET APPS BY TAG: Result=result.status`);

        const apps = JSON.parse(result.data);
        logger.verbose(`GET APPS BY TAG: # apps: ${apps.length}`);

        return apps;
    } catch (err) {
        catchLog('GET APPS', err);
        return false;
    }
}

// Function to get app info from QRS, given app ID
export async function getAppById(appId, optionsParam) {
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

        // Set up connection to QRS
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: `/qrs/app/${appId}`,
        });

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
        catchLog('GET APP BY ID', err);
        return false;
    }
}

// Function to delete app given app ID
export async function deleteAppById(appId, options) {
    // Ensuire options are specified. Exit if not
    if (!options) {
        logger.error(`DELETE APP: No options specified. Exiting.`);
        process.exit(1);
    }

    try {
        logger.debug(`DELETE APP: Starting delete app from QSEoW for app id ${appId}`);

        const axiosConfig = setupQrsConnection(options, {
            method: 'delete',
            path: `/qrs/app/${appId}`,
        });
        const result = await axios.request(axiosConfig);
        logger.debug(`DELETE APP: Result=result.status`);

        if (result.status !== 204) {
            logger.error(`DELETE APP: Failed deleting app from QSEoW: ${JSON.stringify(result, null, 2)}. Aborting.`);
            process.exit(1);
        }

        return true;
    } catch (err) {
        catchLog('DELETE APP', err);
        return false;
    }
}

// Function to replace app
// If the replaced app is published, only the sheets that were originally published with the app are replaced.
// If the replaced app is not published, the entire app is replaced.
// Parameters:
// - appIdSource: ID of source app
// - appIdTarget: ID of app that will be replaced (=target) app
// - options: Command line options
//
// Returns:
// - true if app was replaced
// - false if app was not replaced
export async function replaceApp(appIdSource, appIdTarget, options) {
    try {
        logger.debug(`REPLACE APP: Starting replace app id ${appIdTarget} with app id ${appIdSource}`);

        const axiosConfig = setupQrsConnection(options, {
            method: 'put',
            path: `/qrs/app/${appIdSource}/replace`,
            queryParameters: [{ name: 'app', value: appIdTarget }],
        });

        const result = await axios.request(axiosConfig);
        logger.debug(`REPLACE APP: Result=${result.status}`);

        if (result.status === 200) {
            logger.verbose(`App replaced: ID=${appIdTarget}.`);
            return true;
        }

        return false;
    } catch (err) {
        catchLog('REPLACE APP', err);
        return false;
    }
}

// Function to publish app
// Parameters:
// - appId: ID of app to publish
// - appName: Name the published app will get in the stream
// - streamId: ID of stream to publish app to
// - options: Command line options
//
// Returns:
// - true if app was published
// - false if app was not published
export async function publishApp(appId, appName, streamId, options) {
    try {
        logger.debug(`PUBLISH APP: Starting publish app from QSEoW for app id ${appId}`);

        const axiosConfig = setupQrsConnection(options, {
            method: 'put',
            path: `/qrs/app/${appId}/publish`,
            queryParameters: [
                { name: 'stream', value: streamId },
                { name: 'name', value: appName },
            ],
        });

        const result = await axios.request(axiosConfig);
        logger.debug(`PUBLISH APP: Result=${result.status}`);

        if (result.status === 200) {
            logger.verbose(`App published: ID=${appId}. App name="${appName}"`);
            return true;
        }

        return false;
    } catch (err) {
        catchLog('PUBLISH APP', err);
        return false;
    }
}

// Check if an app with a given id exists
export async function appExistById(appId, options) {
    try {
        logger.debug(`Checking if app with id ${appId} exists in QSEoW`);

        // Is the app ID a valid GUID?
        if (!validate(appId)) {
            logger.error(`APP EXIST BY ID: App ID ${appId} is not a valid GUID.`);

            return false;
        }

        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/app',
            queryParameters: [{ name: 'filter', value: encodeURI(`id eq ${appId}`) }],
        });

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
        catchLog('APP EXIST BY ID', err);
        return false;
    }
}
