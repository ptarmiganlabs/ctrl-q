const rax = require('retry-axios');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const fs = require('fs/promises');
const { validate } = require('uuid');

const { logger, execPath, mergeDirFilePath, verifyFileExists, sleep } = require('../../globals');
const { setupQRSConnection } = require('../util/qrs');
const { getAppColumnPosFromHeaderRow } = require('../util/lookups');
const { QlikSenseApp } = require('./class_app');
const { getTagIdByName } = require('../util/tag');
const { getCustomPropertyDefinitionByName, doesCustomPropertyValueExist } = require('../util/customproperties');

class QlikSenseApps {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options) {
        try {
            this.appList = [];
            this.options = options;

            // Make sure certificates exist
            this.fileCert = path.resolve(execPath, options.authCertFile);
            this.fileCertKey = path.resolve(execPath, options.authCertKeyFile);

            // Map that will connect app counter from Excel file with ID an app gets after import to QSEoW
            this.appCounterIdMap = new Map();
        } catch (err) {
            logger.error(`QS APP: ${err}`);
        }
    }

    clear() {
        this.appList = [];
    }

    async addApp(app, tmpAppId) {
        const newApp = new QlikSenseApp();
        await newApp.init(app, tmpAppId, this.options);
        this.appList.push(newApp);
    }

    async importAppsFromFiles(appsFromFile, tagsExisting, cpExisting) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            logger.debug('PARSE APPS FROM EXCEL FILE: Starting get apps from data in file');

            this.clear();

            // Figure out which data is in which column
            const appFileColumnHeaders = getAppColumnPosFromHeaderRow(appsFromFile.data[0]);

            // Find max app counter = number of apps to be imported into Sense
            const appImportCount = Math.max(
                ...appsFromFile.data.map((item) => {
                    if (item.length === 0) {
                        // Empty row
                        return -1;
                    }

                    if (item[appFileColumnHeaders.appCounter.pos] === appFileColumnHeaders.appCounter.name) {
                        // This is the header row
                        return -1;
                    }

                    // We should only be here when the source file is Excel... Abort if not
                    if (this.options.fileType !== 'excel') {
                        logger.error('File type must be Excel when importing apps as part of reload task import');
                        process.exit(1);
                    }

                    const appNum = item[appFileColumnHeaders.appCounter.pos];
                    if (!appNum) {
                        // Invalid app counter, for example empty row
                        return -1;
                    }
                    return appNum;
                })
            );

            // Loop over all apps in source file
            for (let i = 1; i <= appImportCount; i += 1) {
                // Get the line associated with this app
                const appRow = appsFromFile.data.filter((item) => item[appFileColumnHeaders.appCounter.pos] === i);
                logger.debug(
                    `PARSE APPS FROM FILE: Processing app #${i} of ${appImportCount}. Current app:\n${JSON.stringify(appRow, null, 2)}`
                );

                // Skip empty rows
                if (appRow.length === 1) {
                    const currentApp = {
                        appCounter: appRow[0][appFileColumnHeaders.appCounter.pos],
                        name: appRow[0][appFileColumnHeaders.appName.pos],
                        qvfDirectory: appRow[0][appFileColumnHeaders.qvfDirectory.pos],
                        qvfName: appRow[0][appFileColumnHeaders.qvfName.pos],
                        excludeDataConnections: appRow[0][appFileColumnHeaders.excludeDataConnections.pos],
                        tags: [],
                        customProperties: [],
                        appOwnerUserDirectory: appRow[0][appFileColumnHeaders.appOwnerUserDirectory.pos],
                        appOwnerUserId: appRow[0][appFileColumnHeaders.appOwnerUserId.pos],
                        appPublishToStream: appRow[0][appFileColumnHeaders.appPublishToStream.pos],
                    };

                    // Verify that QVF file exists and build a full path to it
                    currentApp.fullQvfPath = mergeDirFilePath([currentApp.qvfDirectory, currentApp.qvfName]);

                    logger.info(
                        `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) Importing app "${currentApp.name}" from file "${
                            currentApp.fullQvfPath
                        }"`
                    );

                    // eslint-disable-next-line no-await-in-loop
                    const qvfFileExists = await verifyFileExists(currentApp.fullQvfPath);
                    if (!qvfFileExists) {
                        logger.error(
                            `Import of app file ${appRow[0][appFileColumnHeaders.appCounter.pos]} failed. QVF file does not exist: "${
                                currentApp.fullQvfPath
                            }". Exiting.`
                        );
                        process.exit(1);
                    }

                    // Add tags to app object
                    if (appRow[0][appFileColumnHeaders.appTags.pos]) {
                        const tmpTags = appRow[0][appFileColumnHeaders.appTags.pos]
                            .split('/')
                            .filter((item) => item.trim().length !== 0)
                            .map((item) => item.trim());

                        // eslint-disable-next-line no-restricted-syntax
                        for (const item of tmpTags) {
                            // eslint-disable-next-line no-await-in-loop
                            const tagId = await getTagIdByName(item, tagsExisting);
                            if (tagId === false) {
                                // Failed getting tag id, given name. Most likely becuase the tag doesn't exist
                                logger.error(
                                    `IMPORT APP TO QSEOW: Tag "${item}" for app "${
                                        appRow[0][appFileColumnHeaders.appName.pos]
                                    }" not found. Exiting.`
                                );
                                process.exit(1);
                            }
                            currentApp.tags.push({
                                id: tagId,
                                name: item,
                            });
                        }
                    }

                    // Add custom properties to app object
                    if (appRow[0][appFileColumnHeaders.appCustomProperties.pos]) {
                        const tmpCustomProperties = appRow[0][appFileColumnHeaders.appCustomProperties.pos]
                            .split('/')
                            .filter((item) => item.trim().length !== 0)
                            .map((cp) => cp.trim());

                        // eslint-disable-next-line no-restricted-syntax
                        for (const item of tmpCustomProperties) {
                            const tmpCustomProperty = item
                                .split('=')
                                .filter((item2) => item2.trim().length !== 0)
                                .map((cp) => cp.trim());

                            if (tmpCustomProperty?.length === 2) {
                                // eslint-disable-next-line no-await-in-loop
                                const customProperty = await getCustomPropertyDefinitionByName('App', tmpCustomProperty[0], cpExisting);
                                if (customProperty === false) {
                                    // Failed getting custom property id, most likely because the custom property does not exist.
                                    logger.error(
                                        `IMPORT APP TO QSEOW: Custom property "${tmpCustomProperties[0]}" for app "${
                                            appRow[0][appFileColumnHeaders.appName.pos]
                                        }" not found or not valid for object type "Reload task". Exiting.`
                                    );
                                    process.exit(1);
                                }

                                // Verify custom property value is valid
                                // eslint-disable-next-line no-await-in-loop
                                const cpValueExists = await doesCustomPropertyValueExist(
                                    'App',
                                    tmpCustomProperty[0],
                                    tmpCustomProperty[1],
                                    cpExisting
                                );

                                if (cpValueExists) {
                                    currentApp.customProperties.push({
                                        definition: { id: customProperty.id, name: customProperty.name },
                                        value: tmpCustomProperty[1].trim(),
                                    });
                                } else {
                                    logger.error(
                                        `IMPORT APP TO QSEOW: Invalid custom property value for app "${
                                            appRow[0][appFileColumnHeaders.appName.pos]
                                        }". Exiting.`
                                    );
                                    process.exit(1);
                                }
                            }
                        }
                    }

                    // Import app to QSEoW
                    if (this.options.dryRun === false || this.options.dryRun === undefined) {
                        // eslint-disable-next-line no-await-in-loop
                        const newAppId = await this.uploadAppToQseow(currentApp);

                        // false returned if the app could not be uploaded to Sense
                        if (newAppId === false) {
                            logger.error(`Failed uploading app to Sense: ${JSON.stringify(currentApp, null, 2)}}`);
                            process.exit(1);
                        }

                        // Add mapping between app counter and the new id of imported app
                        const tmpAppId = `newapp-${currentApp.appCounter}`;
                        this.appCounterIdMap.set(tmpAppId, newAppId);

                        // eslint-disable-next-line no-await-in-loop
                        await this.addApp(currentApp, tmpAppId);
                    } else {
                        logger.info(`DRY RUN: Importing app to QSEoW: "${currentApp.name}" in file "${currentApp.fullQvfPath}"`);
                    }
                }
            }

            resolve({ appList: this.appList, appIdMap: this.appCounterIdMap });
        });
    }

    async uploadAppToQseow(newApp) {
        try {
            logger.debug('IMPORT APP TO QSEOW: Starting');

            // Add stream to source QVF file
            logger.verbose(`Preparing QVF file #${newApp.appCounter} for uploading to Sense: "${newApp.fullQvfPath}"`);
            const sourceFileBuffer = await fs.readFile(newApp.fullQvfPath);

            // Create form used to send the file
            const form = new FormData();
            form.append('qvfFile', sourceFileBuffer, newApp.qvfName);

            // Build Axios config
            const axiosConfig = setupQRSConnection(this.options, {
                method: 'post',
                fileCert: this.fileCert,
                fileCertKey: this.fileCertKey,
                path: '/qrs/app/upload',
                body: form,
                headers: {
                    ...form.getHeaders(),
                },
                queryParameters: [
                    { name: 'name', value: newApp.name },
                    { name: 'keepdata', value: false },
                    { name: 'excludeconnections', value: newApp.excludeDataConnections },
                ],
            });

            axiosConfig.raxConfig = {
                retry: 8,
                noResponseRetries: 2,
                httpMethodsToRetry: ['GET', 'HEAD', 'OPTIONS', 'DELETE', 'PUT', 'POST'],
                statusCodesToRetry: [
                    [100, 199],
                    [429, 429],
                    [500, 599],
                ],
                backoffType: 'exponential',
                // shouldRetry: (err) => {
                //     console.log('shouldRetry');
                //     const cfg = rax.getConfig(err);
                //     return true;
                // },
                onRetryAttempt: (err) => {
                    const form2 = new FormData();
                    form2.append('qvfFile', sourceFileBuffer, newApp.qvfName);
                    err.config.data = form2;

                    const cfg = rax.getConfig(err);
                    const { status } = err.response;
                    if (status === 429) {
                        logger.warn(`🔄 [${status}] QRS API rate limit reached. Pausing, then retry attempt #${cfg.currentRetryAttempt}`);
                    } else {
                        logger.warn(`🔄 [${status}] Error from QRS API. Pausing, then retry attempt #${cfg.currentRetryAttempt}`);
                    }
                },
            };

            // axiosConfig.baseURL = 'https://httpstat.us';
            // axiosConfig.url = '/429';
            // axiosConfig.method = 'get';

            const myAxiosInstance = axios.create(axiosConfig);

            myAxiosInstance.defaults.raxConfig = {
                instance: myAxiosInstance,
            };
            const interceptorId = rax.attach(myAxiosInstance);

            // Upload QVF
            const result = await myAxiosInstance.request(axiosConfig);
            logger.verbose(`App upload done, sleeping for ${this.options.sleepAppUpload} milliseconds`);
            await sleep(this.options.sleepAppUpload);

            if (result.status === 201) {
                logger.debug(`Import app from QVF file success, result from API:\n${JSON.stringify(result.data, null, 2)}`);
                console.log('1');
                const app = JSON.parse(result.data);

                // Add tags to imported app
                app.tags = [...newApp.tags];

                // Add custom properties to imported app
                app.customProperties = [...newApp.customProperties];

                // Is there a new app owner specific in Excel file?
                // Both user directory and userid must be specified for the app owner to be updated.
                if (newApp?.appOwnerUserDirectory?.length > 0 && newApp?.appOwnerUserId?.length > 0) {
                    // Set app owner

                    // Get full user object from QRS
                    const filter = encodeURIComponent(
                        `userDirectory eq '${newApp.appOwnerUserDirectory}' and userId eq '${newApp.appOwnerUserId}'`
                    );

                    const axiosConfigUser = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        path: '/qrs/user',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });

                    const userResult = await axios.request(axiosConfigUser);
                    const userResponse = JSON.parse(userResult.data);
                    logger.debug(`Retrieving app owner data, result from QRS: [${userResult.status}] ${userResult.statusText}`);
                    if (userResult.status === 200 && userResponse.length === 1) {
                        logger.verbose(
                            `Successfully retrieved app owner user ${userResponse[0].userDirectory}\\${userResponse[0].userId} from QSEoW`
                        );
                        logger.debug(`New app owner data from QRS:${JSON.stringify(userResponse[0], null, 2)} `);

                        // Yes, the user exists
                        const newUser = userResponse[0];
                        app.owner = newUser;
                    } else if (userResult.status === 200 && userResponse.length === 0) {
                        // Ok query but no matching names in Sense
                        logger.error(
                            `User ${userResponse[0].userDirectory}\\${userResponse[0].userId} not found in Sense. Owner of app ${newApp.name} will not be updated.`
                        );
                    } else if (userResult.status !== 200) {
                        // Something went wrong
                        logger.error(
                            `Unexpected result when retrieving app owner data for app ${newApp.name}, result from QRS: [${userResult.status}] ${userResult.statusText}`
                        );
                    }
                }

                // Uppdate app with tags and custom properties
                const axiosConfig2 = setupQRSConnection(this.options, {
                    method: 'put',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    path: `/qrs/app/${app.id}`,
                    body: app,
                });

                const result2 = await axios.request(axiosConfig2);
                if (result2.status === 200) {
                    logger.debug(`Update of imported app wrt tags and custom properties successful`);
                } else if (result2.status !== 200) {
                    logger.warn(
                        `Failed updating tags, custom properties, app owner on imported app ${newApp.name}, return code ${result2.status}.`
                    );
                    return false;
                }

                // Publish app to stream if a stream name is specified
                if (newApp?.appPublishToStream?.length > 0) {
                    let axiosConfigPublish;
                    let streamGuid;
                    let resultPublish;
                    let responsePublish;

                    // Is the provided stream name a valid GUID?
                    // If so check if the GUID represents a stream
                    if (validate(newApp.appPublishToStream)) {
                        // It's a valid GUID
                        axiosConfigPublish = setupQRSConnection(this.options, {
                            method: 'get',
                            fileCert: this.fileCert,
                            fileCertKey: this.fileCertKey,
                            path: `/qrs/stream/${newApp.appPublishToStream}`,
                        });

                        resultPublish = await axios.request(axiosConfigPublish);
                        if (resultPublish.status === 200) {
                            // Yes, the GUID represents a stream
                            responsePublish = JSON.parse(resultPublish.data);

                            // eslint-disable-next-line prefer-destructuring
                            streamGuid = responsePublish.id;
                        }
                    } else {
                        // Provided stream name is not a GUID, make sure only one stream exists with this name, then get its GUID
                        const filter = encodeURIComponent(`name eq '${newApp.appPublishToStream}'`);

                        axiosConfigPublish = setupQRSConnection(this.options, {
                            method: 'get',
                            fileCert: this.fileCert,
                            fileCertKey: this.fileCertKey,
                            path: '/qrs/stream',
                            queryParameters: [{ name: 'filter', value: filter }],
                        });

                        resultPublish = await axios.request(axiosConfigPublish);
                        if (resultPublish.status === 200) {
                            responsePublish = JSON.parse(resultPublish?.data);
                            if (responsePublish?.length === 1) {
                                // Exactly one stream has this name
                                logger.verbose(`Publish stream "${newApp.appPublishToStream}" found, id=${responsePublish[0].id} `);

                                streamGuid = responsePublish[0].id;
                            } else if (responsePublish?.length > 1) {
                                logger.warn(
                                    `More than one stream with the same name "${newApp.appPublishToStream}" found, does not know which one to publish app "${newApp.name}" to.`
                                );
                            } else {
                                // Stream not found
                                logger.warn(
                                    `Cannot publish app "${newApp.name}" to stream "${newApp.appPublishToStream}" as that stream does not exist.`
                                );
                            }
                        } else {
                            // Something went wrong when looking up stream name
                            logger.warn(
                                `Error while looking publish stream name "${newApp.appPublishToStream}" for app "${newApp.name}": [${resultPublish.status}] ${resultPublish.statusText}`
                            );
                        }
                    }

                    // Do we know which stream to publish to? Publish if so!
                    if (streamGuid) {
                        axiosConfigPublish = setupQRSConnection(this.options, {
                            method: 'put',
                            fileCert: this.fileCert,
                            fileCertKey: this.fileCertKey,
                            path: `/qrs/app/${app.id}/publish`,
                            queryParameters: [{ name: 'stream', value: streamGuid }],
                        });

                        resultPublish = await axios.request(axiosConfigPublish);
                        if (resultPublish.status === 200) {
                            // Publish successful
                            logger.info(`App "${newApp.name}" published to stream "${newApp.appPublishToStream}".`);
                        } else {
                            // Something went wrong when looking publishing to stream
                            logger.warn(
                                `Error while publishing app  "${newApp.name}" to stream "${newApp.appPublishToStream}": [${resultPublish.status}] ${resultPublish.statusText}`
                            );
                        }
                    }
                }
                return app.id;
            }
            if (result.status === 429) {
                // Too many requests, even after retries with exponential backoff
                logger.error(`Too many requests (429 errors), even after retries with exponential backoff. Exiting.`);
                process.exit(1);
            } else {
                logger.error(`Error ${result.status} returned from QRS API. Aborting.`);
                process.exit(1);
            }

            return false;
        } catch (err) {
            logger.error(`CREATE RELOAD TASK IN QSEOW 2: ${err}`);
            return false;
        }
    }
}

module.exports = {
    QlikSenseApps,
};
