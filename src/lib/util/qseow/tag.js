import axios from 'axios';
import { logger } from '../../../globals.js';
import { setupQrsConnection } from './qrs.js';
import { catchLog } from '../log.js';

// Check if a tag with a given name exists
export async function tagExistByName(tagName, optionsParam) {
    try {
        logger.debug(`Checking if tag with name ${tagName} exists`);

        // Did we get any options as parameter?
        let options;
        if (!optionsParam) {
            // Get CLI options
            options = getCliOptions();
        } else {
            options = optionsParam;
        }

        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/tag/full',
            queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${tagName}'`) }],
        });

        const result = await axios.request(axiosConfig);
        if (result.status === 200) {
            const response = JSON.parse(result.data);
            if (response.length === 1) {
                logger.debug(`Tag with name ${tagName} exists`);
                return true;
            }

            logger.debug(`Tag with name ${tagName} does not exist`);
            return false;
        }
        return false;
    } catch (err) {
        catchLog('TAG EXIST BY NAME', err);
        return false;
    }
}

export function getTagsFromQseow(options) {
    return new Promise((resolve, _reject) => {
        logger.verbose(`Getting tags from QSEoW...`);

        const axiosConfig = setupQrsConnection(options, {
            method: 'get',
            path: '/qrs/tag/full',
        });

        logger.debug(`About to retrieve tags from QRS API.`);

        axios
            .request(axiosConfig)
            .then((result) => {
                if (result.status === 200) {
                    const response = JSON.parse(result.data);
                    logger.info(`Successfully retrieved ${response.length} tags from QSEoW`);
                    // Yes, the tag exists
                    resolve(response);
                }
                resolve(false);
            })
            .catch((err) => {
                catchLog('GET TAGS FROM QSEoW', err);
            });
    });
}

export function getTagIdByName(tagName, tagsExisting) {
    return new Promise((resolve, _reject) => {
        logger.debug(`Looking up ID for tag named "${tagName}"`);

        let tag;
        if (typeof tagsExisting === 'string') {
            tag = JSON.parse(tagsExisting).filter((item) => item.name === tagName);
        } else {
            tag = tagsExisting.filter((item) => item.name === tagName);
        }

        if (tag.length === 1) {
            // The tag exists
            resolve(tag[0].id);
        } else {
            resolve(false);
        }
    });
}
