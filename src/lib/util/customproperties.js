const axios = require('axios');
const path = require('path');

const { logger, execPath } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

function getCustomPropertiesFromQseow(options) {
    return new Promise((resolve, reject) => {
        logger.verbose(`Getting custom properties from QSEoW...`);

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
                path: '/qrs/custompropertydefinition/full',
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/custompropertydefinition/full',
            });
        }

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200) {
                    const response = JSON.parse(result.data);
                    logger.info(`Successfully retrieved ${response.length} custom properties from QSEoW`);

                    // Yes, the tag exists
                    resolve(response);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`GET CUSTOM PROPERTIES FROM QSEoW: ${err}`);
            });
    });
}

function getCustomPropertyIdByName(objectType, customPropertyName, cpExisting) {
    return new Promise((resolve, reject) => {
        logger.debug(`Looking up ID for custom property named "${customPropertyName}" on object type "${objectType}"`);

        const cp = cpExisting.filter((item) => item.name === customPropertyName);

        if (cp.length === 1) {
            // The custom property exists, but is it enabled for this object type (task, app etc)?
            const correctObjectType = cp[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
            if (!correctObjectType) {
                logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
                resolve(false);
            }

            // Yes, the the custom property exists
            logger.verbose(`Successfully found ID ${cp[0].id} for custom property named "${customPropertyName}"`);
            resolve(cp[0].id);
        } else if (cp.length === 0) {
            logger.warn(`Custom property "${customPropertyName}" does not exist.`);
            resolve(false);
        }
    });
}
// function getCustomPropertyIdByName2(objectType, customPropertyName, options, fileCert, fileCertKey) {
//     return new Promise((resolve, reject) => {
//         logger.debug(`Looking up ID for custom property named "${customPropertyName}" on object type "${objectType}"`);

//         const axiosConfig = setupQRSConnection(options, {
//             method: 'get',
//             fileCert,
//             fileCertKey,
//             path: '/qrs/custompropertydefinition/full',
//             queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${customPropertyName}'`) }],
//         });

//         axios
//             .request(axiosConfig)
//             .then((result) => {
//                 if (result.status === 200 && result.data.length === 0) {
//                     logger.warn(`Custom property "${customPropertyName}" does not exist.`);
//                     resolve(false);
//                 }
//                 if (result.status === 200 && result.data.length === 1) {
//                     const correctObjectType = result.data[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
//                     if (!correctObjectType) {
//                         logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
//                         resolve(false);
//                     }

//                     // Yes, the the custom property exists
//                     logger.verbose(`Successfully found ID ${result.data[0].id} for custom property named "${customPropertyName}"`);
//                     resolve(result.data[0].id);
//                 }
//                 resolve(false);
//             })
//             .catch((err) => {
//                 logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
//             });
//     });
// }

function getCustomPropertyDefinitionByName(objectType, customPropertyName, cpExisting) {
    return new Promise((resolve, reject) => {
        logger.debug(`Looking up definition for custom property named "${customPropertyName}" on object type "${objectType}"`);

        const cp = cpExisting.filter((item) => item.name === customPropertyName);

        if (cp.length === 1) {
            // The custom property exists, but is it enabled for this object type (task, app etc)?
            const correctObjectType = cp[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
            if (!correctObjectType) {
                logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
                resolve(false);
            }

            // Yes, the the custom property exists
            logger.verbose(`Successfully found definition ${JSON.stringify(cp[0])} for custom property named "${customPropertyName}"`);
            resolve(cp[0]);
        } else if (cp.length === 0) {
            logger.warn(`Custom property "${customPropertyName}" does not exist.`);
            resolve(false);
        }
    });
}
// function getCustomPropertyDefinitionByName2(objectType, customPropertyName, options, fileCert, fileCertKey) {
//     return new Promise((resolve, reject) => {
//         logger.debug(`Looking up definition for custom property named "${customPropertyName}" on object type "${objectType}"`);

//         const axiosConfig = setupQRSConnection(options, {
//             method: 'get',
//             fileCert,
//             fileCertKey,
//             path: '/qrs/custompropertydefinition/full',
//             queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${customPropertyName}'`) }],
//         });

//         axios
//             .request(axiosConfig)
//             .then((result) => {
//                 if (result.status === 200 && result.data.length === 0) {
//                     logger.warn(`Custom property "${customPropertyName}" does not exist.`);
//                     resolve(false);
//                 }
//                 if (result.status === 200 && result.data.length === 1) {
//                     const correctObjectType = result.data[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
//                     if (!correctObjectType) {
//                         logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
//                         resolve(false);
//                     }

//                     // Yes, the the custom property exists
//                     logger.verbose(`Successfully found definition ${result.data[0]} for custom property named "${customPropertyName}"`);
//                     resolve(result.data[0]);
//                 }
//                 resolve(false);
//             })
//             .catch((err) => {
//                 logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
//             });
//     });
// }

function doesCustomPropertyValueExist(objectType, customPropertyName, customPropertyValue, cpExisting) {
    return new Promise((resolve, reject) => {
        logger.debug(
            `Checking if value "${customPropertyValue}" is valid for custom property "${customPropertyName}" on object type "${objectType}"`
        );

        const cp = cpExisting.filter((item) => item.name === customPropertyName);

        if (cp.length === 1) {
            // The custom property exists, but is it enabled for this object type (task, app etc)?
            const correctObjectType = cp[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
            if (!correctObjectType) {
                logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
                resolve(false);
            }

            // Check if value is valid for this custom property
            const valueExists = cp[0].choiceValues.find((item) => item === customPropertyValue);
            if (!valueExists) {
                logger.warn(
                    `"${customPropertyValue}" is not a valid value for custom property "${customPropertyName}", for object type "${objectType}".`
                );
                resolve(false);
            }

            // Yes, the the custom property exists
            logger.verbose(`Successfully found ID ${cp[0].id} for custom property named "${customPropertyName}"`);
            resolve(cp[0].id);
        } else if (cp.length === 0) {
            logger.warn(`Custom property "${customPropertyName}" does not exist.`);
            resolve(false);
        }
    });
}
// function doesCustomPropertyValueExist2(objectType, customPropertyName, customPropertyValue, options, fileCert, fileCertKey) {
//     return new Promise((resolve, reject) => {
//         logger.debug(
//             `Checking if value "${customPropertyValue}" is valid for custom property "${customPropertyName}" on object type "${objectType}"`
//         );

//         const axiosConfig = setupQRSConnection(options, {
//             method: 'get',
//             fileCert,
//             fileCertKey,
//             path: '/qrs/custompropertydefinition/full',
//             queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${customPropertyName}'`) }],
//         });

//         axios
//             .request(axiosConfig)
//             .then((result) => {
//                 if (result.status === 200 && result.data.length === 0) {
//                     logger.warn(`Custom property "${customPropertyName}" does not exist.`);
//                     resolve(false);
//                 }
//                 if (result.status === 200 && result.data.length === 1) {
//                     const correctObjectType = result.data[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
//                     if (!correctObjectType) {
//                         logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
//                         resolve(false);
//                     }

//                     // Check if value is valid for this custom property
//                     const valueExists = result.data[0].choiceValues.find((item) => item === customPropertyValue);
//                     if (!valueExists) {
//                         logger.warn(
//                             `"${customPropertyValue}" is not a valid value for custom property "${customPropertyName}", for object type "${objectType}".`
//                         );
//                         resolve(false);
//                     }

//                     // Yes, the the custom property exists
//                     logger.verbose(`Successfully found ID ${result.data[0].id} for custom property named "${customPropertyName}"`);
//                     resolve(result.data[0].id);
//                 }
//                 resolve(false);
//             })
//             .catch((err) => {
//                 logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
//             });
//     });
// }

module.exports = {
    getCustomPropertiesFromQseow,
    getCustomPropertyIdByName,
    getCustomPropertyDefinitionByName,
    doesCustomPropertyValueExist,
};
