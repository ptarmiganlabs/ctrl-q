import path from 'path';
import { version as uuidVersion, validate as uuidValidate } from 'uuid';
import { logger, execPath, verifyFileExists } from '../../../globals.js';

// eslint-disable-next-line import/prefer-default-export
export const qscloudSharedParamAssertOptions = async (options) => {
    // Ensure that parameters common to all QS Cloud commands are valid
    if (options.authType === undefined || !options.authType) {
        logger.error('Mandatory option --auth-type is missing. Use it to specify how authorization with Qlik Sense Cloud will be done.');
        process.exit(1);
    }

    // Debug
    logger.debug(`Auth type: ${options.authType}`);
    logger.debug(`execPath: ${execPath}`);
    logger.debug(`authCertFile: ${options.authCertFile}`);
    logger.debug(`authCertKeyFile: ${options.authCertKeyFile}`);

    // API key authentication
    if (options.authType === 'apikey') {
        //
    }
};
