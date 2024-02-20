import axios from 'axios';
import path from 'path';
import { logger, execPath } from '../../globals.js';
import setupQRSConnection from './qrs.js';
import { catchLog } from './log.js';

export function getTagsFromQseow(options) {
    return new Promise((resolve, _reject) => {
        logger.verbose(`Getting tags from QSEoW...`);

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
                path: '/qrs/tag/full',
            });
        } else if (options.authType === 'jwt') {
            axiosConfig = setupQRSConnection(options, {
                method: 'get',
                path: '/qrs/tag/full',
            });
        }

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

// function getTagIdByName2(tagName, options, fileCert, fileCertKey) {
//     return new Promise((resolve, reject) => {
//         logger.debug(`Looking up ID for tag named "${tagName}"`);

//         // const filter = encodeURI(`name eq '👍😎 updateSheetThumbnail'`);
//         const axiosConfig = setupQRSConnection(options, {
//             method: 'get',
//             fileCert,
//             fileCertKey,
//             path: '/qrs/tag',
//             queryParameters: [{ name: 'filter', value: encodeURI(`name eq '${tagName}'`) }],
//         });

//         axios
//             .request(axiosConfig)
//             .then((result) => {
//                 if (result.data.length === 1) {
//                     logger.verbose(`Successfully found ID ${result.data[0].id} for tag named "${tagName}"`);
//                     // Yes, the tag exists
//                     resolve(result.data[0].id);
//                 }
//                 resolve(false);
//             })
//             .catch((err) => {
//                 logger.error(`TAG ID BY NAME: ${err}`);
//             });
//     });
// }
