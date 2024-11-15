import axios from 'axios';
import path from 'node:path';
import { logger, execPath } from '../../../globals.js';
import { setupQrsConnection } from './qrs.js';
import { catchLog } from '../log.js';

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
