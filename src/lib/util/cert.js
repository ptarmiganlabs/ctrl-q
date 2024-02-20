import path from 'path';
import { logger, execPath } from '../../globals.js';
import { catchLog } from './log.js';

const getCertFilePaths = async (options) => {
    let fileCert;
    let fileCertKey;
    try {
        // Make sure QRS certificates exist
        fileCert = path.resolve(execPath, options.authCertFile);
        fileCertKey = path.resolve(execPath, options.authCertKeyFile);
    } catch (err) {
        catchLog('GET TASK QRS (ID). Exiting. ', err);
        process.exit(1);
    }
    return { fileCert, fileCertKey };
};

export default getCertFilePaths;
