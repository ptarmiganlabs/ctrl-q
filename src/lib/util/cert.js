import path from 'path';
import { logger, execPath } from '../../globals.js';
import { catchLog } from './log.js';

const getCertFilePaths = async (options) => {
    let fileCert;
    let fileCertKey;
    let fileCertCA;

    try {
        // Make sure QRS certificates exist
        fileCert = path.resolve(execPath, options.authCertFile);
        fileCertKey = path.resolve(execPath, options.authCertKeyFile);
        fileCertCA = path.resolve(execPath, options.authRootCertFile);
    } catch (err) {
        catchLog('GET TASK QRS (ID). Exiting. ', err);
        process.exit(1);
    }
    return { fileCert, fileCertKey, fileCertCA };
};

export default getCertFilePaths;
