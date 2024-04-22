import axios from 'axios';
import path from 'path';
import { table } from 'table';
import yesno from 'yesno';
import { logger, execPath } from '../../globals.js';
import setupQPSConnection from './qps.js';
import setupQRSConnection from './qrs.js';
import { catchLog } from './log.js';
import getProxiesFromQseow from './proxy.js';

const consoleProxiesTableConfig = {
    border: {
        topBody: `─`,
        topJoin: `┬`,
        topLeft: `┌`,
        topRight: `┐`,

        bottomBody: `─`,
        bottomJoin: `┴`,
        bottomLeft: `└`,
        bottomRight: `┘`,

        bodyLeft: `│`,
        bodyRight: `│`,
        bodyJoin: `│`,

        joinBody: `─`,
        joinLeft: `├`,
        joinRight: `┤`,
        joinJoin: `┼`,
    },
    columns: {
        // 3: { width: 40 },
        // 4: { width: 100 },
        // 5: { width: 30 },
        // 6: { width: 30 },
    },
};

// Get sessions from Qlik Sense Enterprise on Windows (QSEoW)
//
// Sessions from one or more proxy services can be retrieved
// If the --host parameter is not set, sessions from all proxy services will be retrieved
// If one or more host names are specified, sessions from the proxy services on those hosts will be retrieved
//
// Returns an array of objects, each object representing a proxy service
// Each proxy service object contains the virtual proxy, the sessions and the linked proxies for that virtual proxy
//
// options - Options object
//   logLevel - Log level
//   host - Host where QRS is running (hostname or IP address)
//   virtualProxy - Virtual proxy prefix where QRS is running
//   qrsPort - Port where QRS is running
//   sessionVirtualProxy - Array of virtual proxy prefixes for which sessions should be retrieved
//   hostProxy - Array of proxies for which sessions should be retrieved (hostname or IP address)
//   qpsPort - Port where QPS is running
//   secure - Use https
//   authUserDir - User directory for Qlik Sense user
//   authUserId - User ID for Qlik Sense user
//   authType - Authentication type. Only "cert" is allowed
//   authCertFile - File name of certificate file
//   authCertKeyFile - File name of certificate key file
//   authRootCertFile - File name of root certificate file
//   outputFormat - Output format for the command. json or table
//   sortBy - Sort by column for table output
export const getSessionsFromQseow = async (options, sessionCookie) => {
    logger.verbose(`Getting sessions from QSEoW...`);

    // Only cerrificates allowed for authentication
    if (options.authType !== 'cert') {
        logger.error(`Only certificates allowed for authentication with Qlik Proxy Service (QPS)`);
        return false;
    }

    // Make sure certificates exist
    const fileCert = path.resolve(execPath, options.authCertFile);
    const fileCertKey = path.resolve(execPath, options.authCertKeyFile);
    const fileCertCA = path.resolve(execPath, options.authRootCertFile);

    let axiosConfig;
    let virtualProxiesToProcess = [];

    //  Are there any virtual proxies specified for which sessions should be retrieved?
    if (options.sessionVirtualProxy && options.sessionVirtualProxy.length > 0) {
        // At least one virtual proxy is specified
        // virtualProxy = options.virtualProxy;

        // Build filter string
        // Virtual proxies are specified as an array of strings
        // Filter format is: id eq 'vpName1' or id eq 'vpName2' or id eq 'vpName3'
        const vpFilter = options.sessionVirtualProxy.map((vp) => `prefix eq '${vp}'`).join(' or ');
        axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            fileCertCA,
            path: '/qrs/virtualproxyconfig/full',
            queryParameters: [{ name: 'filter', value: encodeURI(vpFilter) }],
        });
    } else {
        // No virtual proxies specified, get all of them from QRS
        axiosConfig = setupQRSConnection(options, {
            method: 'get',
            fileCert,
            fileCertKey,
            fileCertCA,
            path: '/qrs/virtualproxyconfig/full',
        });
    }

    // Get virtual proxies from QRS
    try {
        logger.debug(`Config: ${JSON.stringify(axiosConfig)}`);
        const result = await axios.request(axiosConfig);

        if (result.status === 200) {
            const response = JSON.parse(result.data);
            logger.info(`Successfully retrieved ${response.length} virtual proxies from host ${options.host}`);

            virtualProxiesToProcess = response;
        }
    } catch (err) {
        catchLog('GET VIRTUAL PROXIES FROM QSEoW', err);
        return false;
    }

    let proxiesAvailable = [];
    let proxiesToProcess = [];
    try {
        // Get all proxies from QRS
        proxiesAvailable = await getProxiesFromQseow(options, sessionCookie);

        // Build table of all proxies, writing to console
        // This will make it easier for users to know which host name that should be used when calling Ctrl-Q
        const proxiesTable = [];
        proxiesTable.push(['Name', 'Host name', 'Id', 'Linked virtual proxies']);

        consoleProxiesTableConfig.header = {
            alignment: 'left',
            content: `Available proxy services.\n\nNote: The "sessions-get" command will only work correctly if the correct --host parameter is used when calling Ctrl-Q.\nThe --host parameter should be one of the host names listed below.`,
        };

        // Loop over all proxies and build table
        proxiesAvailable.forEach((proxy) => {
            proxiesTable.push([
                proxy.serverNodeConfiguration.name,
                proxy.serverNodeConfiguration.hostName,
                proxy.id,
                proxy.settings.virtualProxies.length,
            ]);
        });

        // Print proxies table to console
        logger.info(`Available Proxy services.\n${table(proxiesTable, consoleProxiesTableConfig)}`);

        // Make sure that the --host-proxy parameter is set to one of the host names listed in the table
        // If the --host-proxy parameter is not set, get sessions from all proxies
        // The --host-proxy parameter can contain one or more host names
        if (options.hostProxy === undefined) {
            proxiesToProcess = proxiesAvailable.map((p) => p.serverNodeConfiguration.hostName);
        } else {
            const proxyHostNames = proxiesAvailable.map((p) => p.serverNodeConfiguration.hostName);

            // Which of the proxy host names specified on the command line are valid?
            const validHostParameters = options.hostProxy.filter((h) => {
                if (proxyHostNames.includes(h)) {
                    return h;
                }
                logger.error(
                    `❌ The --host-proxy parameter is set to "${h}". Getting sessions from Sense only work correctly if the correct --host-proxy parameter is used when calling Ctrl-Q.\n\n===> Please use one or more of the following proxy host names: ${proxyHostNames.join(
                        ', '
                    )}\n`
                );
                return null;
            });

            if (validHostParameters.length === options.hostProxy.length) {
                // All host names are valid
                logger.info(`✅ All host names specified in the --host-proxy parameter are valid.`);
            } else {
                logger.error('Exiting');
                process.exit(1);
            }

            proxiesToProcess = options.hostProxy;
        }
    } catch (err) {
        catchLog('GET PROXIES FROM QSEoW', err);
        return false;
    }

    let sessions = [];
    // Loop over virtual proxies and get sessions for each, but only if the linked proxy is in the list of proxies to process
    // eslint-disable-next-line no-restricted-syntax
    for (const vp of virtualProxiesToProcess) {
        // Is this virtual proxy linked to at least one proxy?
        const proxiesVirtualProxy = proxiesAvailable.filter((p) => p.settings.virtualProxies.find((q) => q.id === vp.id));
        logger.verbose(
            `Virtual proxy "${vp.prefix}" (header="${vp.sessionCookieHeaderName}") is linked to ${proxiesVirtualProxy.length} proxies`
        );

        if (proxiesVirtualProxy.length === 0) {
            logger.warn(
                `Virtual proxy is not linked to any proxy. Prefix="${vp.prefix}", Session cookie header name="${vp.sessionCookieHeaderName}"`
            );

            continue;
        }

        let sessionPerVirtualProxy = 0;
        // Loop over all proxies linked to this virtual proxy, get the proxy sessions for each one
        // eslint-disable-next-line no-restricted-syntax
        for (const proxy of proxiesVirtualProxy) {
            // Is this proxy in list of proxies to process?
            if (proxiesToProcess.length > 0 && !proxiesToProcess.includes(proxy.serverNodeConfiguration.hostName)) {
                logger.verbose(
                    `Proxy "${proxy.serverNodeConfiguration.hostName}" is not in list of proxies to process. Skipping for virtual proxy "${vp.prefix}"...`
                );
                continue;
            }

            // Get sessions for this virtual proxy
            axiosConfig = setupQPSConnection(options, {
                hostProxy: proxy.serverNodeConfiguration.hostName,
                method: 'get',
                fileCert,
                fileCertKey,
                fileCertCA,
                path: `/qps/${vp.prefix}/session`,
                sessionCookie: null,
            });

            try {
                // eslint-disable-next-line no-await-in-loop
                const result = await axios.request(axiosConfig);

                if (result.status === 200) {
                    const response = JSON.parse(result.data);
                    logger.verbose(
                        `Virtual proxy prefix/session header "${vp.prefix}" / "${vp.sessionCookieHeaderName}" : ${response.length} sessions on proxy host "${proxy.serverNodeConfiguration.hostName}"`
                    );

                    // Save sessions in array
                    sessions = sessions.concat({
                        virtualproxy: vp,
                        sessions: response,
                        hostProxy: proxy.serverNodeConfiguration.hostName,
                        hostProxyName: proxy.serverNodeConfiguration.name,
                    });
                    sessionPerVirtualProxy += response.length;
                }
            } catch (err) {
                catchLog('GET SESSIONS FROM QSEoW', err);
                return false;
            }
        }

        // Log summary of sessions for this virtual proxy
        logger.verbose(`Total sessions across all linked proxies for virtual proxy "${vp.prefix}": ${sessionPerVirtualProxy}`);
    }

    return sessions;
};

// Delete proxy sessions from Qlik Sense Enterprise on Windows (QSEoW) based on session IDs
// If no session IDs are specified, all sessions for the specified virtual proxy and proxy service will be deleted after continue-yes-no prompt
// By design this function will only delete sessions for one virtual proxy and one proxy service
export const deleteSessionsFromQSEoWIds = async (options) => {
    logger.verbose(`Deleting proxy sessions from QSEoW...`);

    // Only cerrificates allowed for authentication
    if (options.authType !== 'cert') {
        logger.error(`Only certificates allowed for authentication with Qlik Proxy Service (QPS)`);
        return false;
    }

    // Make sure certificates exist
    const fileCert = path.resolve(execPath, options.authCertFile);
    const fileCertKey = path.resolve(execPath, options.authCertKeyFile);
    const fileCertCA = path.resolve(execPath, options.authRootCertFile);

    try {
        const sessionDelete = [];

        // Get all sessions for this virtual proxy / proxy service
        const vpWithSessions = await getSessionsFromQseow({
            ...options,
            hostProxy: [options.hostProxy],
            sessionVirtualProxy: [options.sessionVirtualProxy],
        });

        // Are there any sessions IDs specified?
        // If not, show warning that all sessions for this vp/proxy will be deleted
        if (options.sessionId === undefined || options.sessionId.length === 0) {
            logger.info();
            const ok = await yesno({
                question: `                                  No session IDs specified, meaning that all existing sessions will be deleted for proxy "${options.hostProxy}" and virtual proxy "${options.sessionVirtualProxy}".\n\n                                  Are you sure you want to continue? (y/n)`,
            });
            logger.info();

            if (ok === false) {
                logger.info('❌ Not deleting any sessions.');
                process.exit(1);
            } else {
                logger.info('Deleting sessions...');

                // Build array of retrieved session IDs and metadata
                vpWithSessions.forEach((vp) => {
                    vp.sessions.forEach((s) => {
                        sessionDelete.push({
                            hostProxy: vp.hostProxy,
                            hostProxyName: vp.hostProxyName,
                            sessionId: s.SessionId,
                            userDirectory: s.UserDirectory,
                            userId: s.UserId,
                            userName: s.UserName,
                        });
                    });
                });
            }
        } else {
            // Use session IDs specified on command line
            // eslint-disable-next-line no-restricted-syntax
            for (const s of options.sessionId) {
                // eslint-disable-next-line no-restricted-syntax
                for (const vp of vpWithSessions) {
                    if (vp.sessions.find((x) => x.SessionId === s)) {
                        const sessionObject = {
                            sessionId: s,
                            hostProxy: vp.hostProxy,
                            hostProxyName: vp.hostProxyName,
                        };

                        // Dress with additional session metadata (userDirectory and userId) from vpWithSessions.sessions
                        const session = vp.sessions.find((x) => x.SessionId === s);
                        if (session) {
                            sessionObject.userDirectory = session.UserDirectory;
                            sessionObject.userId = session.UserId;
                            sessionObject.userName = session.UserName;
                        }

                        sessionDelete.push(sessionObject);
                    } else {
                        logger.warn(`Session ID "${s}" not found`);
                    }
                }
            }
        }

        let deleteCounter = 0;

        // Loop over all session IDs and delete each one
        // eslint-disable-next-line no-restricted-syntax
        for (const s of sessionDelete) {
            logger.verbose(
                `Deleting session ID "${s.sessionId}" on proxy "${options.hostProxy}", virtual proxy "${options.sessionVirtualProxy}"...`
            );
            logger.debug(`Session metadata: ${JSON.stringify(s, null, 2)}`);

            try {
                const axiosConfig = setupQPSConnection(options, {
                    hostProxy: options.hostProxy,
                    method: 'delete',
                    fileCert,
                    fileCertKey,
                    fileCertCA,
                    path: `/qps/${options.sessionVirtualProxy}/session/${s.sessionId}`,
                    sessionCookie: null,
                });

                // eslint-disable-next-line no-await-in-loop
                const result = await axios.request(axiosConfig);

                if (result.status === 200) {
                    if (s.userName === undefined || s.userName === null) {
                        logger.info(`Session ID "${s.sessionId}" successfully deleted. User: ${s.userDirectory}\\${s.userId}`);
                    } else {
                        logger.info(
                            `Session ID "${s.sessionId}" successfully deleted. User: ${s.userDirectory}\\${s.userId} (${s.userName})`
                        );
                    }
                    deleteCounter += 1;
                }
            } catch (err) {
                if (err?.response?.status === 404) {
                    logger.warn(`Session ID "${s.sessionId}" not found`);
                } else {
                    catchLog('DELETE PROXY SESSIONS FROM QSEoW', err);
                    return false;
                }
            }
        }

        logger.info('');
        logger.info(`Deleted ${deleteCounter} sessions`);
        return true;
    } catch (err) {
        catchLog('DELETE PROXY SESSIONS FROM QSEoW', err);
        return false;
    }
};
