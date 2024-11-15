import axios from 'axios';

import { logger } from '../../../globals.js';
import { catchLog } from '../../util/log.js';
import { setupQrsConnection } from './qrs.js';

export async function getCustomPropertiesFromQseow(options) {
    logger.verbose(`Getting custom properties from QSEoW...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/custompropertydefinition/full',
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);

            // Yes, the custom property exists
            return response;
        }
        return false;
    } catch (err) {
        catchLog('GET CUSTOM PROPERTIES FROM QSEoW', err);
        return false;
    }
}

export function getCustomPropertyIdByName(objectType, customPropertyName, cpExisting) {
    logger.debug(`Looking up ID for custom property named "${customPropertyName}" on object type "${objectType}"`);

    try {
        const cp = cpExisting.filter((item) => item.name === customPropertyName);

        if (cp.length === 1) {
            // The custom property exists, but is it enabled for this object type (task, app etc)?
            const correctObjectType = cp[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
            if (!correctObjectType) {
                logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
                return false;
            }

            // Yes, the the custom property exists
            logger.verbose(`Successfully found ID ${cp[0].id} for custom property named "${customPropertyName}"`);
            return cp[0].id;
        } else if (cp.length === 0) {
            logger.warn(`Custom property "${customPropertyName}" does not exist.`);
            return false;
        }
    } catch (err) {
        catchLog('GET CUSTOM PROPERTY ID BY NAME', err);
        return false;
    }
}

export function getCustomPropertyDefinitionByName(objectType, customPropertyName, cpExisting) {
    logger.debug(`Looking up definition for custom property named "${customPropertyName}" on object type "${objectType}"`);

    try {
        const cp = cpExisting.filter((item) => item.name === customPropertyName);

        if (cp.length === 1) {
            // The custom property exists, but is it enabled for this object type (task, app etc)?
            const correctObjectType = cp[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
            if (!correctObjectType) {
                logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
                return false;
            }

            // Yes, the the custom property exists
            logger.verbose(`Successfully found definition ${JSON.stringify(cp[0])} for custom property named "${customPropertyName}"`);
            return cp[0];
        } else if (cp.length === 0) {
            logger.warn(`Custom property "${customPropertyName}" does not exist.`);
            return false;
        }
    } catch (err) {
        catchLog('GET CUSTOM PROPERTY DEFINITION BY NAME', err);
        return false;
    }
}

export function doesCustomPropertyValueExist(objectType, customPropertyName, customPropertyValue, cpExisting) {
    logger.debug(
        `Checking if value "${customPropertyValue}" is valid for custom property "${customPropertyName}" on object type "${objectType}"`
    );

    try {
        const cp = cpExisting.filter((item) => item.name === customPropertyName);

        if (cp.length === 1) {
            // The custom property exists, but is it enabled for this object type (task, app etc)?
            const correctObjectType = cp[0].objectTypes.find((item) => objectType.toLowerCase() === item.toLowerCase());
            if (!correctObjectType) {
                logger.warn(`Custom property "${customPropertyName}" is not valid for task type "${objectType}".`);
                return false;
            }

            // Check if value is valid for this custom property
            const valueExists = cp[0].choiceValues.find((item) => item === customPropertyValue);
            if (!valueExists) {
                logger.warn(
                    `"${customPropertyValue}" is not a valid value for custom property "${customPropertyName}", for object type "${objectType}".`
                );
                return false;
            }

            // Yes, the the custom property exists
            logger.verbose(`Successfully found ID ${cp[0].id} for custom property named "${customPropertyName}"`);
            return cp[0].id;
        } else if (cp.length === 0) {
            logger.warn(`Custom property "${customPropertyName}" does not exist.`);
            return false;
        }
    } catch (err) {
        catchLog('CUSTOM PROPERTY ID BY NAME', err);
        return false;
    }
}

// Function to create a custom property
// customPropertyDefinition has properties:
// - objectTypes (array of strings). Types of objects this custom property is valid for.
// - name (string)
// - choiceValues (array of strings). Possible values for this custom property.
// - description (string)
// - values (array of strings). Values that are actually set for this custom property.
export async function createCustomProperty(options, customPropertyDefinition) {
    logger.verbose(`Creating custom property "${customPropertyDefinition.name}"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'post',
            path: '/qrs/custompropertydefinition',
        });

        // Set payload
        axiosConfig.data = customPropertyDefinition;

        logger.debug(`About to create custom property "${customPropertyDefinition.name}"`);
        const result = await axios.request(axiosConfig);

        if (result.status === 201) {
            logger.info(`Successfully created custom property "${customPropertyDefinition.name}"`);
            return true;
        }

        logger.error(`Failed to create custom property "${customPropertyDefinition.name}"`);
        return false;
    } catch (err) {
        catchLog('CREATE CUSTOM PROPERTY', err);
    }
}

// Function to update a custom property
//
// Parameters:
// options: Command line options
// customPropertyDefinition: The new/updated custom property definition. Object with properties:
// - objectTypes (array of strings). Types of objects this custom property is valid for.

export async function updateCustomProperty(options, customPropertyDefinition) {
    logger.verbose(`Updating custom property "${customPropertyDefinition.name}"...`);

    try {
        const axiosConfig = setupQrsConnection(options, {
            method: 'put',
            path: `/qrs/custompropertydefinition/${customPropertyDefinition.id}`,
            body: customPropertyDefinition,
        });

        // Update custom property
        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            logger.info(`Successfully updated custom property "${customPropertyDefinition.name}"`);
            return true;
        }

        logger.error(`Failed to update custom property "${customPropertyDefinition.name}"`);
        return false;
    } catch (err) {
        catchLog('UPDATE CUSTOM PROPERTY', err);
        return false;
    }
}
