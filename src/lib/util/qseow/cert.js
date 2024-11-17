import path from 'node:path';
import { execPath } from '../../../globals.js';
import { catchLog } from '../log.js';

export function getCertFilePaths(options) {
    let fileCert;
    let fileCertKey;
    let fileCertCA;

    try {
        // Get cert paths from command line options
        fileCert = path.resolve(execPath, options.authCertFile);
        fileCertKey = path.resolve(execPath, options.authCertKeyFile);
        fileCertCA = path.resolve(execPath, options.authRootCertFile);
    } catch (err) {
        catchLog('GET CERT FILE PATHS', err);
        process.exit(1);
    }
    return { fileCert, fileCertKey, fileCertCA };
}
