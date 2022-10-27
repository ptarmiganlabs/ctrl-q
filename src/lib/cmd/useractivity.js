const { logger } = require('../../globals');

function getUserActivityProfessional(qrsInteractInstance) {
    // eslint-disable-next-line no-unused-vars, no-async-promise-executor
    return new Promise(async (resolve, _reject) => {
        let result;
        try {
            result = await qrsInteractInstance.Get('license/professionalaccesstype/full');
        } catch (err) {
            logger.error(`USER ACTIVITY PROFESSIONAL: Error getting user activity info from QRS: ${err}`);
        }

        resolve(result.body);
    });
}

function getUserActivityAnalyzer(qrsInteractInstance) {
    // eslint-disable-next-line no-unused-vars, no-async-promise-executor
    return new Promise(async (resolve, _reject) => {
        let result;
        try {
            result = await qrsInteractInstance.Get('license/analyzeraccesstype/full');
        } catch (err) {
            logger.error(`USER ACTIVITY ANALYZER: Error getting user activity info from QRS: ${err}`);
        }

        resolve(result.body);
    });
}

function getUserActivityAnalyzerTime(qrsInteractInstance) {
    // eslint-disable-next-line no-unused-vars, no-async-promise-executor
    return new Promise(async (resolve, _reject) => {
        let result;
        try {
            result = await qrsInteractInstance.Get('license/analyzertimeaccesstype/full');
        } catch (err) {
            logger.error(`USER ACTIVITY ANALYZER TIME: Error getting user activity info from QRS: ${err}`);
        }

        resolve(result.body);
    });
}

function getUserActivityLogin(qrsInteractInstance) {
    // eslint-disable-next-line no-unused-vars, no-async-promise-executor
    return new Promise(async (resolve, _reject) => {
        let result;
        try {
            result = await qrsInteractInstance.Get('license/loginaccesstype/full');
        } catch (err) {
            logger.error(`USER ACTIVITY LOGIN: Error getting user activity info from QRS: ${err}`);
        }

        resolve(result.body);
    });
}

function getUserActivityUser(qrsInteractInstance) {
    // eslint-disable-next-line no-unused-vars, no-async-promise-executor
    return new Promise(async (resolve, _reject) => {
        let result;
        try {
            result = await qrsInteractInstance.Get('license/useraccesstype/full');
        } catch (err) {
            logger.error(`USER ACTIVITY USER: Error getting user activity info from QRS: ${err}`);
        }

        resolve(result.body);
    });
}

function getUsersLastActivity(activityProfessional, activityAnalyzer, activityAnalyzerTime, activityLogin, activityUser) {
    // eslint-disable-next-line no-unused-vars, no-async-promise-executor
    return new Promise(async (resolve, _reject) => {
        const usersActivity = [];

        // eslint-disable-next-line no-restricted-syntax
        for (const user of activityProfessional) {
            // Does this user already exist in user activity array?
            if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
                // User ID has already been added (seems it appears in more than one activity type!)
                // Pick the most recent last activity date
                logger.debug(
                    `USER ACTIVITY PROFESSIONAL: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
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

        // eslint-disable-next-line no-restricted-syntax
        for (const user of activityAnalyzer) {
            // Does this user already exist in user activity array?
            if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
                // User ID has already been added (seems it appears in more than one activity type!)
                // Pick the most recent last activity date
                logger.debug(
                    `USER ACTIVITY ANALYZER: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
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

        // eslint-disable-next-line no-restricted-syntax
        for (const user of activityAnalyzerTime) {
            // Does this user already exist in user activity array?
            if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
                // User ID has already been added (seems it appears in more than one activity type!)
                // Pick the most recent last activity date
                logger.debug(
                    `USER ACTIVITY ANALYZER TIME: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
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

        // eslint-disable-next-line no-restricted-syntax
        for (const user of activityLogin) {
            // Does this user already exist in user activity array?
            if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
                // User ID has already been added (seems it appears in more than one activity type!)
                // Pick the most recent last activity date
                logger.debug(
                    `USER ACTIVITY LOGIN: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
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

        // eslint-disable-next-line no-restricted-syntax
        for (const user of activityUser) {
            // Does this user already exist in user activity array?
            if (usersActivity.find((findUser) => findUser.userSenseId === user.user.id) !== undefined) {
                // User ID has already been added (seems it appears in more than one activity type!)
                // Pick the most recent last activity date
                logger.debug(
                    `USER ACTIVITY USER: User id ${user.user.id}, ${user.user.userDirectory}\\${user.user.userId} already exists in activity array. Will use entry with the most recent activity date.`
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

        logger.verbose(`USER ACTIVITY: Net list of user activity data consists of ${usersActivity.length} items.`);
        resolve(usersActivity);
    });
}

module.exports = {
    getUserActivityProfessional,
    getUserActivityAnalyzer,
    getUserActivityAnalyzerTime,
    getUserActivityLogin,
    getUserActivityUser,
    getUsersLastActivity,
};
