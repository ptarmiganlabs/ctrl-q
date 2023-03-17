const rax = require('retry-axios');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const fs = require('fs/promises');

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
                        // This is the header rowe
                        return -1;
                    }

                    // We should only be here when the source file is Excel... Abort if not
                    if (this.options.fileType !== 'excel') {
                        logger.error('File type must be Excel when importing apps as part of reload task import');
                        process.exit(1);
                    }

                    const appNum = item[appFileColumnHeaders.appCounter.pos];
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
                    // ...form.getHeaders(),
                    'Content-Type': 'application/vnd.qlik.sense.app',
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
            // await sleep(1000);

            if (result.status === 201) {
                logger.debug(`Import app from QVF file success, result from API:\n${JSON.stringify(result.data, null, 2)}`);

                const app = result.data;

                // Add tags to imported app
                app.tags = [...newApp.tags];

                // Add custom properties to imported app
                app.customProperties = [...newApp.customProperties];

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

                    return app.id;
                }
                logger.warn(`Failed setting tags on imported app ${newApp.name}, return code ${result2.status}.`);
            } else if (result.status === 429) {
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
