import { deleteSessionsFromQSEoWIds } from '../../util/qseow/session.js';
import { logger, setLoggingLevel, isSea, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';

/**
 *  Delete Qlik Sense proxy sessions
 * @param {object} options - Options object
 */
export async function deleteSessions(options) {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isSea}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Delete Qlik Sense proxy sessions');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        logger.info(`Deleting sessions on proxy "${options.hostProxy}", virtual proxy "${options.sessionVirtualProxy}"`);
        const deleteResult = await deleteSessionsFromQSEoWIds(options);

        if (deleteResult === false) {
            logger.error('Error deleting proxy sessions.');
            return false;
        }

        return true;
    } catch (err) {
        catchLog(`Error deleting proxy sessions from host "${options.hostProxy}", virtual proxy "${options.sessionVirtualProxy}"`, err);

        return false;
    }
}
