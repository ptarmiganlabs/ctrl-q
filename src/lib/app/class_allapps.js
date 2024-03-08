import * as rax from 'retry-axios';
import axios from 'axios';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs/promises';
import fs2 from 'fs';
import { v4 as uuidv4, validate } from 'uuid';
import yesno from 'yesno';
import { logger, execPath, mergeDirFilePath, verifyFileExists, sleep, isPkg } from '../../globals.js';
import setupQRSConnection from '../util/qrs.js';
import { getAppColumnPosFromHeaderRow } from '../util/lookups.js';
import QlikSenseApp from './class_app.js';
import { getTagIdByName } from '../util/tag.js';
import { getAppById, deleteAppById } from '../util/app.js';
import { getCustomPropertyDefinitionByName, doesCustomPropertyValueExist } from '../util/customproperties.js';
import { catchLog } from '../util/log.js';

class QlikSenseApps {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(options) {
        try {
            this.appList = [];
            this.options = options;

            // Should cerrificates be used for authentication?
            if (options.authType === 'cert') {
                // Make sure certificates exist
                this.fileCert = path.resolve(execPath, options.authCertFile);
                this.fileCertKey = path.resolve(execPath, options.authCertKeyFile);
                this.fileCertCA = path.resolve(execPath, options.authRootCertFile);
            }

            // Map that will connect app counter from Excel file with ID an app gets after import to QSEoW
            this.appCounterIdMap = new Map();
        } catch (err) {
            catchLog(`INIT QS APP`, err);
        }
    }

    clear() {
        this.appList = [];
    }

    // Function to add app to class' app list
    async addApp(app, tmpAppId) {
        const newApp = new QlikSenseApp();
        await newApp.init(app, tmpAppId, this.options);
        this.appList.push(newApp);
    }

    // Get array of apps matching app id, tags etc filters
    async getAppsFromQseow() {
        try {
            logger.debug('GET APPS: Starting get apps from QSEoW');

            // Are there any app filters specified?
            // If so, build a query string
            let filter = '';

            // Add app id(s) to query string
            if (this.options.appId && this.options?.appId.length >= 1) {
                // At least one app ID specified
                // Add first app ID
                filter += encodeURIComponent(`(id eq ${this.options.appId[0]}`);
            }
            if (this.options.appId && this.options?.appId.length >= 2) {
                // Add remaining app IDs, if any
                for (let i = 1; i < this.options.appId.length; i += 1) {
                    filter += encodeURIComponent(` or id eq ${this.options.appId[i]}`);
                }
            }

            // Add closing parenthesis
            if (this.options.appId && this.options?.appId.length >= 1) {
                filter += encodeURIComponent(')');
            }
            logger.debug(`GET APPS FROM QSEOW: QRS query filter (incl ids): ${filter}`);

            // Add app tag(s) to query string
            if (this.options.appTag && this.options?.appTag.length >= 1) {
                // At least one app tag specified
                if (filter.length >= 1) {
                    // We've previously added some app IDs
                    // Add first app tag
                    filter += encodeURIComponent(` or (tags.name eq '${this.options.appTag[0]}'`);
                } else {
                    // No app IDs added yet
                    // Add first app tag
                    filter += encodeURIComponent(`(tags.name eq '${this.options.appTag[0]}'`);
                }
            }
            if (this.options.appTag && this.options?.appTag.length >= 2) {
                // Add remaining app tags, if any
                for (let i = 1; i < this.options.appTag.length; i += 1) {
                    filter += encodeURIComponent(` or tags.name eq '${this.options.appTag[i]}'`);
                }
            }

            // Add closing parenthesis
            if (this.options.appTag && this.options?.appTag.length >= 1) {
                filter += encodeURIComponent(')');
            }
            logger.debug(`GET APPS FROM QSEOW: QRS query filter (incl ids, tags): ${filter}`);

            // Should cerrificates be used for authentication?
            let axiosConfig;
            if (this.options.authType === 'cert') {
                if (filter === '') {
                    axiosConfig = await setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        fileCertCA: this.fileCertCA,
                        path: '/qrs/app/full',
                    });
                } else {
                    axiosConfig = await setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        fileCertCA: this.fileCertCA,
                        path: '/qrs/app/full',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                }
            } else if (this.options.authType === 'jwt') {
                if (filter === '') {
                    axiosConfig = await setupQRSConnection(this.options, {
                        method: 'get',
                        path: '/qrs/app/full',
                    });
                } else {
                    axiosConfig = await setupQRSConnection(this.options, {
                        method: 'get',
                        path: '/qrs/app/full',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                }
            }

            const result = await axios.request(axiosConfig);
            logger.debug(`GET APPS FROM QSEOW: Result=result.status`);

            const apps = JSON.parse(result.data);
            logger.verbose(`GET APPS FROM QSEOW: # apps: ${apps.length}`);

            this.clear();
            for (let i = 0; i < apps.length; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await this.addApp(apps[i], apps[i].id);
            }

            return apps;
        } catch (err) {
            catchLog(`GET QS APP 2`, err);

            return false;
        }
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

            logger.info('-------------------------------------------------------------------');
            logger.info('Importing apps...');

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
                        appPublishToStreamOption: appRow[0][appFileColumnHeaders.appPublishToStreamOption.pos],
                    };

                    // Deal with the fact that appPublishToStreamOption is not always present
                    if (appFileColumnHeaders.appPublishToStreamOption.pos !== -1) {
                        // There is an appPublishToStreamOption column in source file
                        if (appRow[0][appFileColumnHeaders.appPublishToStreamOption.pos]) {
                            // There is an appPublishToStreamOption value present
                            currentApp.appPublishToStreamOption = appRow[0][appFileColumnHeaders.appPublishToStreamOption.pos];
                        } else {
                            // There is no appPublishToStreamOption value present
                            currentApp.appPublishToStreamOption = 'publish-replace'; // Default value
                        }
                    } else {
                        // There is no appPublishToStreamOption column in source file
                        currentApp.appPublishToStreamOption = 'publish-replace'; // Default value
                    }

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
                                        }" not found or not valid for task type "Reload task". Exiting.`
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
                        // 1. Upload the app specified in the Excel file.
                        // eslint-disable-next-line no-await-in-loop
                        const uploadedAppId = await this.uploadAppToQseow(currentApp);

                        // false returned if the app could not be uploaded to Sense
                        if (uploadedAppId === false) {
                            logger.error(`Failed uploading app to Sense: ${JSON.stringify(currentApp, null, 2)}}`);
                            process.exit(1);
                        }

                        // Save id of created app
                        currentApp.createdAppId = uploadedAppId;

                        // Update tags, custom properties and owner of uploaded app
                        // eslint-disable-next-line no-await-in-loop
                        const result = await this.updateUploadedApp(currentApp, uploadedAppId);

                        // Should the app be published to a stream?
                        if (currentApp?.appPublishToStream?.length > 0) {
                            // Yes, publish to stream after app upload

                            // eslint-disable-next-line no-await-in-loop
                            const { streamId, streamName } = await this.getStreamInfo(currentApp);
                            let tmpAppId;

                            // Do we know which stream to publish to? Publish if so!
                            if (streamId) {
                                if (currentApp.appPublishToStreamOption === 'publish-replace') {
                                    // eslint-disable-next-line no-await-in-loop
                                    const result2 = await this.streamAppPublishReplace(
                                        currentApp.appCounter,
                                        uploadedAppId,
                                        streamId,
                                        streamName
                                    );

                                    if (result2.res === true) {
                                        logger.info(
                                            `(${appRow[0][appFileColumnHeaders.appCounter.pos]}, publish-replace) App "${
                                                currentApp.name
                                            }" published to stream "${streamName}", replacing the existing app with the same name. Id of published app: ${
                                                result2.publishedApp.id
                                            }`
                                        );

                                        // Keep record of published app
                                        currentApp.publishStatus = 'published';

                                        // Add mapping between app counter and the id of published app
                                        tmpAppId = `newapp-${currentApp.appCounter}`;
                                        this.appCounterIdMap.set(tmpAppId, result2.publishedApp.id);
                                    } else {
                                        logger.error(
                                            `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) Failed publishing app "${
                                                currentApp.name
                                            }" to stream "${streamName}"`
                                        );

                                        // Keep record of failed app
                                        currentApp.publishStatus = 'failed';

                                        // Add mapping between app counter and the id of uploaded, not published app
                                        tmpAppId = `newapp-${currentApp.appCounter}`;
                                        this.appCounterIdMap.set(tmpAppId, uploadedAppId);
                                    }

                                    // eslint-disable-next-line no-await-in-loop
                                    await this.addApp(currentApp, tmpAppId);
                                } else if (currentApp.appPublishToStreamOption === 'publish-another') {
                                    // eslint-disable-next-line no-await-in-loop
                                    const result2 = await this.streamAppPublishAnother(
                                        currentApp.appCounter,
                                        uploadedAppId,
                                        currentApp.name,
                                        streamId
                                    );

                                    if (result2.res === true) {
                                        logger.info(
                                            `(${appRow[0][appFileColumnHeaders.appCounter.pos]}, publish-another) App "${
                                                currentApp.name
                                            }" published to stream "${streamName}". Id of published app: ${result2.publishedApp.id}`
                                        );

                                        // Keep record of published app
                                        currentApp.publishStatus = 'published';

                                        // Add mapping between app counter and the id of published app
                                        tmpAppId = `newapp-${currentApp.appCounter}`;
                                        this.appCounterIdMap.set(tmpAppId, result2.publishedApp.id);
                                    } else {
                                        logger.error(
                                            `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) Failed publishing app "${
                                                currentApp.name
                                            }" to stream "${streamName}"`
                                        );

                                        // Keep record of failed app
                                        currentApp.publishStatus = 'failed';

                                        // Add mapping between app counter and the id of uploaded, not published app
                                        tmpAppId = `newapp-${currentApp.appCounter}`;
                                        this.appCounterIdMap.set(tmpAppId, uploadedAppId);
                                    }

                                    // eslint-disable-next-line no-await-in-loop
                                    await this.addApp(currentApp, tmpAppId);
                                } else if (currentApp.appPublishToStreamOption === 'delete-publish') {
                                    // eslint-disable-next-line no-await-in-loop
                                    const result2 = await this.streamAppDeletePublish(
                                        currentApp.appCounter,
                                        uploadedAppId,
                                        currentApp.name,
                                        streamId,
                                        streamName
                                    );

                                    if (result2.res === true) {
                                        logger.info(
                                            `(${appRow[0][appFileColumnHeaders.appCounter.pos]}, delete-publish) App "${
                                                currentApp.name
                                            }" published to stream "${streamName}", the existing app (if one exists) with the same name in this stream has been deleted. Id of published app: ${
                                                result2.publishedApp.id
                                            }`
                                        );

                                        // Keep record of published app
                                        currentApp.publishStatus = 'published';

                                        // Add mapping between app counter and the id of published app
                                        tmpAppId = `newapp-${currentApp.appCounter}`;
                                        this.appCounterIdMap.set(tmpAppId, result2.publishedApp.id);
                                    } else {
                                        logger.error(
                                            `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) Failed publishing app "${
                                                currentApp.name
                                            }" to stream "${streamName}"`
                                        );

                                        // Keep record of failed app
                                        currentApp.publishStatus = 'failed';

                                        // Add mapping between app counter and the id of uploaded, not published app
                                        tmpAppId = `newapp-${currentApp.appCounter}`;
                                        this.appCounterIdMap.set(tmpAppId, uploadedAppId);
                                    }

                                    // eslint-disable-next-line no-await-in-loop
                                    await this.addApp(currentApp, tmpAppId);
                                } else {
                                    logger.error(
                                        `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) Invalid publish option specified for app "${
                                            currentApp.name
                                        }".`
                                    );
                                }
                            } else {
                                logger.error(
                                    `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) Failed publishing app "${
                                        currentApp.name
                                    }" to stream "${
                                        currentApp.appPublishToStream
                                    }". The uploaded app is still present in the QMC (id=${uploadedAppId}).`
                                );

                                // Keep record of failed app
                                currentApp.publishStatus = 'failed';

                                // Add mapping between app counter and the id of uploaded, but not published app
                                const tmpAppId = `newapp-${currentApp.appCounter}`;
                                this.appCounterIdMap.set(tmpAppId, uploadedAppId);

                                // eslint-disable-next-line no-await-in-loop
                                await this.addApp(currentApp, tmpAppId);
                            }
                        } else {
                            // No, do not publish to stream after app upload
                            logger.info(
                                `(${appRow[0][appFileColumnHeaders.appCounter.pos]}) App "${
                                    currentApp.name
                                }" uploaded to QSEoW, but not published to any stream.`
                            );

                            // Keep record of publish status
                            currentApp.publishStatus = 'unpublished';

                            // Add mapping between app counter and the new id of imported app
                            const tmpAppId = `newapp-${currentApp.appCounter}`;
                            this.appCounterIdMap.set(tmpAppId, uploadedAppId);

                            // eslint-disable-next-line no-await-in-loop
                            await this.addApp(currentApp, tmpAppId);
                        }
                    } else {
                        logger.info(`DRY RUN: Importing app to QSEoW: "${currentApp.name}" in file "${currentApp.fullQvfPath}"`);
                    }
                }
            }

            resolve({ appList: this.appList, appIdMap: this.appCounterIdMap });
        });
    }

    // Function to update tags, custom properties and owner of uploaded app
    async updateUploadedApp(newApp, uploadedAppId) {
        try {
            // Should cerrificates be used for authentication?
            let axiosConfigUploadedApp;
            if (this.options.authType === 'cert') {
                // Get info about just uploaded app
                axiosConfigUploadedApp = setupQRSConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app/${uploadedAppId}`,
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfigUploadedApp = setupQRSConnection(this.options, {
                    method: 'get',
                    path: `/qrs/app/${uploadedAppId}`,
                });
            }

            const appUploaded2 = await axios.request(axiosConfigUploadedApp);
            if (appUploaded2.status !== 200) {
                logger.error(`Failed getting info about uploaded app from Sense: ${JSON.stringify(appUploaded2, null, 2)}`);
                process.exit(1);
            }

            const app = JSON.parse(appUploaded2.data);

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

                // Should cerrificates be used for authentication?
                let axiosConfigUser;
                if (this.options.authType === 'cert') {
                    // Get info about just uploaded app
                    axiosConfigUser = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        fileCertCA: this.fileCertCA,
                        path: '/qrs/user',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                } else if (this.options.authType === 'jwt') {
                    axiosConfigUser = setupQRSConnection(this.options, {
                        method: 'get',
                        path: '/qrs/user',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                }

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

            // Pause for a while to let Sense repository catch up
            await sleep(1000);

            // Should cerrificates be used for authentication?
            let axiosConfig2;
            if (this.options.authType === 'cert') {
                // Uppdate app with tags, custom properties and app owner
                axiosConfig2 = setupQRSConnection(this.options, {
                    method: 'put',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app/${app.id}`,
                    body: app,
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfig2 = setupQRSConnection(this.options, {
                    method: 'put',
                    path: `/qrs/app/${app.id}`,
                    body: app,
                });
            }
            const result2 = await axios.request(axiosConfig2);

            if (result2.status === 200) {
                logger.debug(`Update of imported app wrt tags, custom properties and owner was successful.`);
                return true;
            }

            logger.warn(
                `Failed updating tags, custom properties, app owner on imported app ${newApp.name}, return code ${result2.status}.`
            );
            return false;
        } catch (err) {
            catchLog(`UPDATE UPLOADED APP`, err);

            return false;
        }
    }

    // Function to implement publish-replace variant of publishing app to a Stream
    async streamAppPublishReplace(appCounter, uploadedAppId, streamId, streamName) {
        // 2. If there is already a published app with the same name in the target stream, then do a publish-replace. The app ID of the already published app will not change.
        // 3. Otherwise do a normal publish. The published app will get the same app ID as the app that was uploaded.
        // 4. Delete the app uploaded unless keep-source-app is specified in the "Publish options" column.
        try {
            logger.debug(`(${appCounter}) PUBLISH APP publish-replace: Starting`);

            // Get info about the created app
            const appInfo = await getAppById(uploadedAppId, this.options);

            // Check if there is an app with the same name in the target stream
            const matchingAppsInStream = await this.appsInStreamCount(appInfo.name, streamName);

            let result = {};
            if (matchingAppsInStream === 0) {
                // No app with the same name in the target stream, do a normal publish
                result.res = await this.appPublishNormal(streamId, uploadedAppId, appInfo.name);

                if (result.res === true) {
                    // Get info about the published app
                    result.publishedApp = await getAppById(uploadedAppId, this.options);
                } else {
                    result.publishedApp = null;
                }
            } else if (matchingAppsInStream > 1) {
                // More than one app with the same name in the target stream, impossible to know which one to replace
                logger.warn(
                    `(${appCounter}) PUBLISH APP publish-replace: More than one app with the same name "${appInfo.name}" in the target stream "${streamName}". Impossible to know which one to replace. Skipping publishing for this app. The uploaded app is still present in the QMC (id=${uploadedAppId}).`
                );
                result = { res: false, publishedApp: null };
            } else if (matchingAppsInStream === 1) {
                // App with the same name exists in the target stream, do a publish-replace
                // https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/RepositoryServiceAPI/Content/Sense_RepositoryServiceAPI/RepositoryServiceAPI-App-Replace.htm

                // Get the app ID of the app in the target stream
                const appInStream = await this.getAppInStream(streamName, appInfo.name);

                // Do the publish-replace
                result.res = await this.appPublishReplace(uploadedAppId, appInStream.id);

                if (result.res === true) {
                    // Delete the app uploaded unless keep-source-app is specified in the "Publish options" column.
                    // if (appInfo.customProperties.find((cp) => cp.definition.name === 'keep-source-app')?.value === 'true') {
                    //     logger.debug(
                    //         `PUBLISH APP publish-replace: keep-source-app is set to true for app ${appInfo.name}. The app will not be deleted.`
                    //     );
                    // } else {
                    //     logger.debug(
                    //         `PUBLISH APP publish-replace: keep-source-app is not set to true for app ${appInfo.name}. The app will be deleted.`
                    //     );

                    // Delete the uploaded app
                    await deleteAppById(uploadedAppId, this.options);
                    // }

                    const publishedApp = await getAppById(appInStream.id, this.options);
                    result = { res: true, publishedApp };
                } else {
                    // Something went wrong
                    logger.error(
                        `(${appCounter}) PUBLISH APP publish-replace: Unexpected result when publishing app ${appInfo.name} to the target stream ${streamName}.`
                    );

                    result = { res: false, publishedApp: null };
                }
            } else {
                // Something went wrong
                logger.error(
                    `(${appCounter}) PUBLISH APP publish-replace: Unexpected result when checking if there is an app with the same name ${appInfo.name} in the target stream ${streamName}.`
                );
                result = { res: false, publishedApp: null };
            }

            return result;
        } catch (err) {
            catchLog(`PUBLISH APP publish-replace`, err);

            return { res: false, publishedApp: null };
        }
    }

    // Function to implement publish-another variant of publishing app to a Stream
    async streamAppPublishAnother(appCounter, uploadedAppId, appName, streamId) {
        // 2. Publish the uploaded app into the target stream, even if an app with that name already exists in that stream.
        // 3. The result is that there may be several apps with the same name (but different app IDs) in a stream.
        // 4. This is the behaviour in Ctrl-Q version 3.11 and earlier.
        try {
            logger.debug(`(${appCounter}) PUBLISH APP publish-another: Starting`);

            const result = {};

            // Publish the uploaded app into the target stream
            result.res = await this.appPublishNormal(streamId, uploadedAppId, appName);

            if (result.res === true) {
                // Get info about the published app
                result.publishedApp = await getAppById(uploadedAppId, this.options);
            } else {
                result.publishedApp = null;
            }

            return result;
        } catch (err) {
            catchLog(`PUBLISH APP publish-another`, err);

            return { res: false, publishedApp: null };
        }
    }

    // Function to implement delete-publish variant of publishing app to a Stream
    async streamAppDeletePublish(appCounter, uploadedAppId, appName, streamId, streamName) {
        // 2. If an app with the same name as uploaded file already exists in the target stream: Delete that app.
        // 3. Publish the uploaded app. The published app will get the same app ID as the app that was uploaded.
        try {
            logger.debug(`(${appCounter}) PUBLISH APP delete-publish: Starting`);

            // Check if there is an app with the same name in the target stream
            const matchingAppsInStream = await this.appsInStreamCount(appName, streamName);

            let result = {};
            if (matchingAppsInStream === 0) {
                // No app with the same name in the target stream, do a normal publish
                result.res = await this.appPublishNormal(streamId, uploadedAppId, appName);

                if (result.res === true) {
                    // Get info about the published app
                    result.publishedApp = await getAppById(uploadedAppId, this.options);
                } else {
                    result.publishedApp = null;
                }

                // Get info about the published app
            } else if (matchingAppsInStream > 1) {
                // More than one app with the same name in the target stream, impossible to know which one to replace
                logger.warn(
                    `(${appCounter}) PUBLISH APP delete-publish: More than one app with the same name "${appName}" in the target stream "${streamName}". Impossible to know which one to replace. Skipping publishing for this app. The uploaded app is still present in the QMC (id=${uploadedAppId}).`
                );

                result = { res: false, publishedApp: null };
            } else if (matchingAppsInStream === 1) {
                // App with the same name exists in the target stream, delete that app and then do a normal publish

                // Get the app ID of the app in the target stream
                const appInStream = await this.getAppInStream(streamName, appName);

                // Delete the app in the target stream
                await deleteAppById(appInStream.id, this.options);

                // Do the normal publish
                result.res = await this.appPublishNormal(streamId, uploadedAppId, appName);

                if (result.res === true) {
                    // Get info about the published app
                    result.publishedApp = await getAppById(uploadedAppId, this.options);
                } else {
                    result.publishedApp = null;
                }
            } else {
                // Something went wrong
                logger.error(
                    `(${appCounter}) PUBLISH APP delete-publish: Unexpected result when checking if there is an app with the same name "${appName}" in the target stream "${streamName}".`
                );
                result = { res: false, publishedApp: null };
            }

            return result;
        } catch (err) {
            catchLog(`PUBLISH APP delete-publish`, err);

            return { res: false, publishedApp: null };
        }
    }

    // Function to do a normal publish of an app to a stream
    async appPublishNormal(streamId, appId, appName) {
        try {
            logger.debug('PUBLISH APP NORMAL: Starting');

            // Define query parameters
            const queryParameters = [
                { name: 'stream', value: streamId },
                { name: 'name', value: appName },
            ];

            // Should cerrificates be used for authentication?
            let axiosConfig;
            if (this.options.authType === 'cert') {
                // Build QRS query
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'put',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app/${appId}/publish`,
                    queryParameters,
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'put',
                    path: `/qrs/app/${appId}/publish`,
                    queryParameters,
                });
            }

            // Execute QRS query
            const result = await axios.request(axiosConfig);
            const response = JSON.parse(result.data);

            logger.debug(`PUBLISH APP NORMAL: Done. Response: ${JSON.stringify(response, null, 2)}`);
            if (result.status === 200) {
                return true;
            }

            return false;
        } catch (err) {
            catchLog(`PUBLISH APP NORMAL`, err);

            return false;
        }
    }

    // Function to do a publish-replace of an app to a stream
    // This is the same operation that is done when doing a "publish-replace" in the QMC
    async appPublishReplace(sourceAppId, targetAppId) {
        try {
            logger.debug('PUBLISH APP REPLACE: Starting');

            // Define query parameters
            const queryParameters = [{ name: 'app', value: targetAppId }];

            // Should cerrificates be used for authentication?
            let axiosConfig;
            if (this.options.authType === 'cert') {
                // Build QRS query
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'put',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app/${sourceAppId}/replace`,
                    queryParameters,
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'put',
                    path: `/qrs/app/${sourceAppId}/replace`,
                    queryParameters,
                });
            }

            // Execute QRS query
            const result = await axios.request(axiosConfig);
            const response = JSON.parse(result.data);

            logger.debug(`PUBLISH APP REPLACE: Done. Response: ${JSON.stringify(response, null, 2)}`);
            if (result.status === 200) {
                return true;
            }

            return false;
        } catch (err) {
            catchLog(`PUBLISH APP REPLACE`, err);

            return false;
        }
    }

    // Function to check if an app with a certain name already exists in a specific stream
    // Returns the number of apps (zero or more) with the same name in the stream
    // If something goes wrong, false is returned
    async appsInStreamCount(appName, streamName) {
        try {
            logger.debug(`CHECK IF APP EXISTS IN STREAM: Starting. App name: "${appName}", Stream name: "${streamName}"`);

            let filter = '';

            // Is the stream name a valid GUID?
            if (validate(streamName) === true) {
                // Yes, it is a valid GUID.
                logger.debug(`CHECK IF APP EXISTS IN STREAM: Stream name "${streamName}" is a valid GUID`);

                // Build QRS query
                filter = encodeURIComponent(`stream.id eq ${streamName} and name eq '${appName}'`);
            } else {
                // No, it is not a valid GUID. We assume it is a stream name
                logger.debug(`CHECK IF APP EXISTS IN STREAM: Stream name "${streamName}" is not a valid GUID`);

                // Build QRS query
                filter = encodeURIComponent(`stream.name eq '${streamName}' and name eq '${appName}'`);
            }

            // Should cerrificates be used for authentication?
            let axiosConfig;
            if (this.options.authType === 'cert') {
                // Build QRS query
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app`,
                    queryParameters: [{ name: 'filter', value: filter }],
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'get',
                    path: `/qrs/app`,
                    queryParameters: [{ name: 'filter', value: filter }],
                });
            }

            // Execute QRS query
            const result = await axios.request(axiosConfig);
            const response = JSON.parse(result.data);

            // Check if app exists in stream
            if (response.length >= 0) {
                logger.debug(`CHECK IF APP EXISTS IN STREAM: App "${appName}" exists in stream "${streamName}" ${response.length} times.`);
                return response.length;
            }

            logger.debug(`CHECK IF APP EXISTS IN STREAM: App "${appName}" does not exist in stream "${streamName}"`);
            return 0;
        } catch (err) {
            catchLog(`CHECK IF APP EXISTS IN STREAM`, err);

            return false;
        }
    }

    // Function to get info about a specific app in a certain stream, both identified by name
    async getAppInStream(streamName, appName) {
        try {
            logger.debug(`GET APP IN STREAM: Starting. App name: "${appName}", Stream name: "${streamName}"`);

            // Build QRS query
            const filter = encodeURIComponent(`stream.name eq '${streamName}' and name eq '${appName}'`);

            // Should cerrificates be used for authentication?
            let axiosConfig;
            if (this.options.authType === 'cert') {
                // Build QRS query
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'get',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app`,
                    queryParameters: [{ name: 'filter', value: filter }],
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'get',
                    path: `/qrs/app`,
                    queryParameters: [{ name: 'filter', value: filter }],
                });
            }

            // Execute QRS query
            const result = await axios.request(axiosConfig);
            const response = JSON.parse(result.data);

            // Check if app exists in stream
            if (response.length === 1) {
                logger.debug(`GET APP IN STREAM: App "${appName}" exists in stream "${streamName}"`);
                return response[0];
            }

            if (response.length > 1) {
                logger.error(`GET APP IN STREAM: App "${appName}" exists in stream "${streamName}" more than once`);
                return false;
            }

            if (response.length === 0) {
                logger.debug(`GET APP IN STREAM: App "${appName}" does not exist in stream "${streamName}"`);
                return false;
            }

            logger.error(`GET APP IN STREAM: Something went wrong`);
            return false;
        } catch (err) {
            catchLog(`GET APP IN STREAM`, err);

            return false;
        }
    }

    // Function to check if a stream exists
    // Return the stream ID if it exists, false if it does not exist or if something goes wrong
    async getStreamInfo(uploadedAppInfo) {
        try {
            logger.debug(`CHECK IF STREAM EXISTS: Starting. Stream name: "${uploadedAppInfo.appPublishToStream}"`);

            let axiosConfigPublish;
            let resultPublish;
            let responsePublish;

            // Is the provided stream name a valid GUID?
            // If so check if the GUID represents a stream
            if (validate(uploadedAppInfo.appPublishToStream)) {
                // It's a valid GUID

                // Should cerrificates be used for authentication?
                if (this.options.authType === 'cert') {
                    // Build QRS query
                    axiosConfigPublish = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        fileCertCA: this.fileCertCA,
                        path: `/qrs/stream/${uploadedAppInfo.appPublishToStream}`,
                    });
                } else if (this.options.authType === 'jwt') {
                    axiosConfigPublish = setupQRSConnection(this.options, {
                        method: 'get',
                        path: `/qrs/stream/${uploadedAppInfo.appPublishToStream}`,
                    });
                }

                resultPublish = await axios.request(axiosConfigPublish);
                if (resultPublish.status === 200) {
                    // Yes, the GUID represents a stream
                    responsePublish = JSON.parse(resultPublish.data);

                    // eslint-disable-next-line prefer-destructuring
                    return { streamId: responsePublish.id, streamName: responsePublish.name };
                }
            } else {
                // Provided stream name is not a GUID, make sure only one stream exists with this name, then get its GUID
                const filter = encodeURIComponent(`name eq '${uploadedAppInfo.appPublishToStream}'`);

                // Should cerrificates be used for authentication?
                if (this.options.authType === 'cert') {
                    // Build QRS query
                    axiosConfigPublish = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        fileCertCA: this.fileCertCA,
                        path: '/qrs/stream',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                } else if (this.options.authType === 'jwt') {
                    axiosConfigPublish = setupQRSConnection(this.options, {
                        method: 'get',
                        path: '/qrs/stream',
                        queryParameters: [{ name: 'filter', value: filter }],
                    });
                }

                resultPublish = await axios.request(axiosConfigPublish);
                if (resultPublish.status === 200) {
                    responsePublish = JSON.parse(resultPublish?.data);
                    if (responsePublish?.length === 1) {
                        // Exactly one stream has this name
                        logger.verbose(`Publish stream "${uploadedAppInfo.appPublishToStream}" found, id=${responsePublish[0].id} `);

                        const streamId = responsePublish[0].id;
                        const streamName = responsePublish[0].name;
                        return { streamId, streamName };
                    }

                    if (responsePublish?.length > 1) {
                        logger.warn(
                            `More than one stream with the same name "${uploadedAppInfo.appPublishToStream}" found, does not know which one to publish app "${uploadedAppInfo.name}" to.`
                        );
                        return false;
                    }

                    // Stream not found
                    logger.warn(`Stream "${uploadedAppInfo.appPublishToStream}" does not exist.`);
                    return false;
                }
                // Something went wrong when looking up stream name
                logger.warn(
                    `Error while looking publish stream name "${uploadedAppInfo.appPublishToStream}" for app "${uploadedAppInfo.name}": [${resultPublish.status}] ${resultPublish.statusText}`
                );
            }

            return false;
        } catch (err) {
            catchLog(`CHECK IF STREAM EXISTS`, err);

            return false;
        }
    }

    // Function to upload an app in QVF format on disk to QSEoW
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
                fileCertCA: this.fileCertCA,
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
                const appUploaded = JSON.parse(result.data);

                return appUploaded.id;
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
            catchLog(`UPLOAD APP TO QSEOW`, err);

            return false;
        }
    }

    async exportAppStep1(app) {
        try {
            const exportToken = uuidv4();
            const excludeData = this.options.excludeAppData === 'true' ? 'true' : 'false';

            // Should cerrificates be used for authentication?
            let axiosConfig;
            if (this.options.authType === 'cert') {
                // Build QRS query
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'post',
                    fileCert: this.fileCert,
                    fileCertKey: this.fileCertKey,
                    fileCertCA: this.fileCertCA,
                    path: `/qrs/app/${app.id}/export/${exportToken}`,
                    queryParameters: [{ name: 'skipData', value: excludeData }],
                });
            } else if (this.options.authType === 'jwt') {
                axiosConfig = setupQRSConnection(this.options, {
                    method: 'post',
                    path: `/qrs/app/${app.id}/export/${exportToken}`,
                    queryParameters: [{ name: 'skipData', value: excludeData }],
                });
            }

            const result = await axios.request(axiosConfig);
            logger.verbose(`Export app step 1 result: [${result.status}] ${result.statusText}`);

            if (result.status === 201) {
                const exportData = JSON.parse(result.data);
                exportData.appName = app.name;
                logger.verbose(`Export app step 1 done`);
                logger.debug(`Export app step 1 data: ${JSON.stringify(exportData, null, 2)}`);
                return exportData;
            }

            logger.warn(`Export app step 1 failed: [${result.status}] ${result.statusText}`);
            return false;
        } catch (err) {
            catchLog(`EXPORT APP STEP 1`, err);

            return false;
        }
    }

    async exportAppStep2(resultStep1) {
        // resultStep.downloadPath has format
        // /tempcontent/d989fffd-5310-43b5-b028-f313b53bb8e2/User%20retention.qvf?serverNodeId=80db9b97-8ea2-4208-a79a-c46b7e16c38c

        const resultStep2 = JSON.parse(JSON.stringify(resultStep1));

        const urlPath = resultStep1.downloadPath.split('?')[0];
        const param = resultStep1.downloadPath.split('?')[1];
        const paramName = param.split('=')[0];
        const paramValue = param.split('=')[1];

        // Build file name
        let fileName = '';
        const { qvfNameSeparator } = this.options;

        // Build UTC date and time strings
        const today = new Date();
        const todayDate = today.toISOString().split('T')[0];
        const todayTime = today.toISOString().split('T')[1].split('.')[0].replace(':', '-').replace(':', '-');

        this.options.qvfNameFormat.forEach((element) => {
            if (element === 'app-id') {
                fileName += resultStep2.appId + qvfNameSeparator;
            } else if (element === 'app-name') {
                fileName += resultStep2.appName + qvfNameSeparator;
            } else if (element === 'export-date') {
                fileName += todayDate + qvfNameSeparator;
            } else if (element === 'export-time') {
                fileName += todayTime + qvfNameSeparator;
            }
        });

        // Remove trailing separator character, if any
        if (fileName.slice(-qvfNameSeparator.length) === qvfNameSeparator) {
            fileName = fileName.slice(0, -qvfNameSeparator.length);
        }

        // Add app related info that will be useful in upstream code
        resultStep2.qvfFileName = `${fileName}.qvf`;

        // Add path to QVF dir
        const fileDir = mergeDirFilePath([execPath, this.options.outputDir]);
        fileName = `${path.join(fileDir, fileName)}.qvf`;
        logger.verbose(`Directory where QVF will be stored: ${fileDir}`);
        logger.verbose(`Full path to QVF: ${fileName}`);

        // Check if destination QVF file already exists
        // 2nd parameter controls whether to log info or not about file's existence
        const fileExists = await verifyFileExists(fileName, true);
        let fileSkipped = false;
        let writer;

        if (!fileExists || (fileExists && this.options.qvfOverwrite)) {
            // File doesn't exist
        } else if (!this.options.qvfOverwrite) {
            // Target file exist. Ask if user wants to overwrite
            logger.info();
            const ok = await yesno({
                question: `                                  Destination file "${fileName}" exists. Do you want to overwrite it? (y/n)`,
            });
            logger.info();
            if (!ok) {
                logger.info('Not overwriting existing file.');
                fileSkipped = true;
            }
        }

        if (!fileSkipped) {
            if (this.options.dryRun) {
                logger.info(`DRY RUN: Storing app [${resultStep2.appId}] "${resultStep2.appName}" to QVF file`);
            } else {
                writer = fs2.createWriteStream(fileName);

                // Should cerrificates be used for authentication?
                let axiosConfig;
                if (this.options.authType === 'cert') {
                    // Build QRS query
                    axiosConfig = setupQRSConnection(this.options, {
                        method: 'get',
                        fileCert: this.fileCert,
                        fileCertKey: this.fileCertKey,
                        fileCertCA: this.fileCertCA,
                        path: urlPath,
                        queryParameters: [{ name: paramName, value: paramValue }],
                    });
                } else if (this.options.authType === 'jwt') {
                    axiosConfig = setupQRSConnection(this.options, {
                        method: 'get',
                        path: urlPath,
                        queryParameters: [{ name: paramName, value: paramValue }],
                    });
                }

                axiosConfig.responseType = 'stream';

                logger.info('------------------------------------');
                logger.info(`App [${resultStep2.appId}] "${resultStep2.appName}.qvf", download starting`);
                const result = await axios.request(axiosConfig);

                result.data.pipe(writer);
            }
        }

        return new Promise((resolve, reject) => {
            if (fileSkipped) {
                resolve('skipped');
            } else if (this.options.dryRun) {
                resolve(resultStep2);
            } else {
                writer.on('finish', () => {
                    const fileSize = fs2.statSync(fileName).size;
                    logger.info(`✅ App [${resultStep2.appId}] "${resultStep2.appName}.qvf", download complete. Size=${fileSize} bytes`);

                    // Add app related info that will be useful in upstream code
                    resultStep2.qvfFileSize = fileSize;
                    resolve(resultStep2);
                });
                writer.on('error', () => {
                    logger.error(`❌ App [${resultStep2.appId}] "${resultStep2.appName}.qvf", download failed`);
                    reject();
                });
            }
        });
    }
}

export default QlikSenseApps;
