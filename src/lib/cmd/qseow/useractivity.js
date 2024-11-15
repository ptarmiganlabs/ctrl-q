import axios from 'axios';
import path from 'node:path';

import { logger, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';
import { setupQrsConnection } from '../../util/qseow/qrs.js';

// Function to get user activity from QRS for license type "Analyzer"
export async function getUserActivityAnalyzer(options) {
    logger.verbose(`Getting user activity for license type "Analyzer"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/license/analyzeraccesstype/full',
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.info(`  Successfully retrieved ${response.length} user activity records for license type "Analyzer" from QSEoW`);

            return response;
        }
        return false;
    } catch (err) {
        catchLog(`USER ACTIVITY ANALYZER: Error getting user activity info from QRS`, err);
        return false;
    }
}

// Function to get user activity from QRS for license type "Analyzer Time"
export async function getUserActivityAnalyzerTime(options) {
    logger.verbose(`Getting user activity for license type "Analyzer Time"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/license/analyzertimeaccessusage/full',
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.info(`  Successfully retrieved ${response.length} user activity records for license type "Analyzer Time" from QSEoW`);

            return response;
        }
        return false;
    } catch (err) {
        catchLog(`USER ACTIVITY ANALYZER TIME: Error getting user activity info from QRS`, err);
        return false;
    }
}

// Function to get user activity from QRS for license type "Login"
export async function getUserActivityLogin(options) {
    logger.verbose(`Getting user activity for license type "Login"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/license/loginaccessusage/full',
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.info(`  Successfully retrieved ${response.length} user activity records for license type "Login" from QSEoW`);

            return response;
        }
        return false;
    } catch (err) {
        catchLog(`USER ACTIVITY LOGIN: Error getting user activity info from QRS`, err);
        return false;
    }
}

// Function to get user activity from QRS for license type "Professional"
export async function getUserActivityProfessional(options) {
    logger.verbose(`Getting user activity for license type "Professional"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/license/professionalaccesstype/full',
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.info(`  Successfully retrieved ${response.length} user activity records for license type "Professional" from QSEoW`);

            return response;
        }
        return false;
    } catch (err) {
        catchLog(`USER ACTIVITY PROFESSIONAL: Error getting user activity info from QRS`, err);
        return false;
    }
}

// Function to get user activity from QRS for license type "User"
export async function getUserActivityUser(options) {
    logger.verbose(`Getting user activity for license type "User"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/license/useraccessusage/full',
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.info(`  Successfully retrieved ${response.length} user activity records for license type "User" from QSEoW`);

            return response;
        }
        return false;
    } catch (err) {
        catchLog(`USER ACTIVITY USER: Error getting user activity info from QRS`, err);
        return false;
    }
}

// Function to extract the last activity date for the different license types.
//
//  Return:
//  An array of objects, each object containing
//  - user directory
//  - user ID
//  - user name
//  - last activity date
export async function getUsersLastActivity(activityAnalyzer, activityAnalyzerTime, activityLogin, activityProfessional, activityUser) {
    const usersActivity = [];

    for (const user of activityAnalyzer) {
        // Does this user already exist in user activity array?
        if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
            // User ID has already been added (seems it appears in more than one activity type!)
            // Pick the most recent last activity date
            logger.debug(
                `  USER ACTIVITY ANALYZER: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
            );
        } else {
            // User ID has not been added yet. Add it!
            usersActivity.push({
                userSenseId: user.user.id,
                userId: user.user.userId,
                userDirectory: user.user.userDirectory,
                userName: user.user.name,
                lastUsed: user.lastUsed,
            });
        }
    }

    for (const user of activityAnalyzerTime) {
        // Does this user already exist in user activity array?
        if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
            // User ID has already been added (seems it appears in more than one activity type!)
            // Pick the most recent last activity date
            logger.debug(
                `  USER ACTIVITY ANALYZER TIME: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
            );
        } else {
            // User ID has not been added yet. Add it!
            usersActivity.push({
                userSenseId: user.user.id,
                userId: user.user.userId,
                userDirectory: user.user.userDirectory,
                userName: user.user.name,
                lastUsed: user.latestActivity,
            });
        }
    }

    for (const user of activityLogin) {
        // Does this user already exist in user activity array?
        if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
            // User ID has already been added (seems it appears in more than one activity type!)
            // Pick the most recent last activity date
            logger.debug(
                `  USER ACTIVITY LOGIN: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
            );
        } else {
            // User ID has not been added yet. Add it!
            usersActivity.push({
                userSenseId: user.user.id,
                userId: user.user.userId,
                userDirectory: user.user.userDirectory,
                userName: user.user.name,
                lastUsed: user.latestActivity,
            });
        }
    }

    for (const user of activityProfessional) {
        // Does this user already exist in user activity array?
        if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
            // User ID has already been added (seems it appears in more than one activity type!)
            // Pick the most recent last activity date
            logger.debug(
                `  USER ACTIVITY PROFESSIONAL: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
            );
        } else {
            // User ID has not been added yet. Add it!
            usersActivity.push({
                userSenseId: user.user.id,
                userId: user.user.userId,
                userDirectory: user.user.userDirectory,
                userName: user.user.name,
                lastUsed: user.lastUsed,
            });
        }
    }

    for (const user of activityUser) {
        // Does this user already exist in user activity array?
        if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
            // User ID has already been added (seems it appears in more than one activity type!)
            // Pick the most recent last activity date
            logger.debug(
                `  USER ACTIVITY USER: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
            );
        } else {
            // User ID has not been added yet. Add it!
            usersActivity.push({
                userSenseId: user.user.id,
                userId: user.user.userId,
                userDirectory: user.user.userDirectory,
                userName: user.user.name,
                lastUsed: user.lastUsed,
            });
        }
    }

    logger.verbose(`  USER ACTIVITY: Net list of user activity data consists of ${usersActivity.length} items.`);
    return usersActivity;
}
