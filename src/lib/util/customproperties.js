const axios = require('axios');

const { logger } = require('../../globals');
const { setupQRSConnection } = require('./qrs');

function getCustomPropertyIdByName(objectType, customPropertyName, options, fileCert, fileCertKey) {
    return new Promise((resolve, reject) => {
        logger.debug(`Looking up ID for custom property named "${customPropertyName}" on object type "${objectType}"`);

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/custompropertydefinition/full',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${customPropertyName}'`) }],
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200 && result.data.length === 0) {
                    logger.warn(`Custom property "${customPropertyName}" does not exist.`);
                    resolve(false);
                }
                if (result.status === 200 && result.data.length === 1) {
                    const correctObjectType = result.data[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
                    if (!correctObjectType) {
                        logger.warn(`Custom property "${customPropertyName}" is not valid for object type "${objectType}".`);
                        resolve(false);
                    }

                    // Yes, the the custom property exists
                    logger.verbose(`Successfully found ID ${result.data[0].id} for custom property named "${customPropertyName}"`);
                    resolve(result.data[0].id);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
            });
    });
}

function getCustomPropertyDefinitionByName(objectType, customPropertyName, options, fileCert, fileCertKey) {
    return new Promise((resolve, reject) => {
        logger.debug(`Looking up ID for custom property named "${customPropertyName}" on object type "${objectType}"`);

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/custompropertydefinition/full',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${customPropertyName}'`) }],
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200 && result.data.length === 0) {
                    logger.warn(`Custom property "${customPropertyName}" does not exist.`);
                    resolve(false);
                }
                if (result.status === 200 && result.data.length === 1) {
                    const correctObjectType = result.data[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
                    if (!correctObjectType) {
                        logger.warn(`Custom property "${customPropertyName}" is not valid for object type "${objectType}".`);
                        resolve(false);
                    }

                    // Yes, the the custom property exists
                    logger.verbose(`Successfully found ID ${result.data[0].id} for custom property named "${customPropertyName}"`);
                    resolve(result.data[0]);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
            });
    });
}

function doesCustomPropertyValueExist(objectType, customPropertyName, customPropertyValue, options, fileCert, fileCertKey) {
    return new Promise((resolve, reject) => {
        logger.debug(
            `Checking if value "${customPropertyValue}" is valid for custom property "${customPropertyName}" on object type "${objectType}"`
        );

        const axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            path: '/qrs/custompropertydefinition/full',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${customPropertyName}'`) }],
        });

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200 && result.data.length === 0) {
                    logger.warn(`Custom property "${customPropertyName}" does not exist.`);
                    resolve(false);
                }
                if (result.status === 200 && result.data.length === 1) {
                    const correctObjectType = result.data[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
                    if (!correctObjectType) {
                        logger.warn(`Custom property "${customPropertyName}" is not valid for object type "${objectType}".`);
                        resolve(false);
                    }

                    // Check if value is valid for this custom property
                    const valueExists = result.data[0].choiceValues.find((item) => item === customPropertyValue);
                    if (!valueExists) {
                        logger.warn(
                            `"${customPropertyValue}" is not a valid value for custom property "${customPropertyName}", for object type "${objectType}".`
                        );
                        resolve(false);
                    }

                    // Yes, the the custom property exists
                    logger.verbose(`Successfully found ID ${result.data[0].id} for custom property named "${customPropertyName}"`);
                    resolve(result.data[0].id);
                }
                resolve(false);
            })
            .catch((err) => {
                logger.error(`CUSTOM PROPERTY ID BY NAME: ${err}`);
            });
    });
}

module.exports = {
    getCustomPropertyIdByName,
    getCustomPropertyDefinitionByName,
    doesCustomPropertyValueExist,
};
