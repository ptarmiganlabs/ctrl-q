import { table } from 'table';
import { getSessionsFromQseow } from '../../util/qseow/session.js';
import { logger, setLoggingLevel, isPkg, execPath } from '../../../globals.js';
import { catchLog } from '../../util/log.js';

const consoleTableConfig = {
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

/**
 *
 * @param {*} options
 */
const getSessions = async (options) => {
    try {
        // Set log level
        setLoggingLevel(options.logLevel);

        logger.verbose(`Ctrl-Q was started as a stand-alone binary: ${isPkg}`);
        logger.verbose(`Ctrl-Q was started from ${execPath}`);

        logger.info('Get Qlik Sense proxy sessions');
        logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);

        const sessionDataArray = await getSessionsFromQseow(options, null);

        if (sessionDataArray === false || sessionDataArray === undefined) {
            logger.error(`Error getting proxy sessions from from QSEoW`);
            return false;
        }

        // Get mapping between proxy host and proxy host name
        // Reduce to unique mappings
        const proxyHostNameMap = sessionDataArray.map((vp) => ({ hostProxy: vp.hostProxy, hostProxyName: vp.hostProxyName }));
        const uniqueProxyHostNameMap = proxyHostNameMap.filter(
            (vp, index, self) => index === self.findIndex((t) => t.hostProxy === vp.hostProxy)
        );

        // Expand all session data into a single array of objects to make later sorting and filtering easier
        const sessionsTabular = [];
        sessionDataArray.forEach((vp) => {
            vp.sessions.forEach((s) => {
                const proxyHostName = uniqueProxyHostNameMap.find((m) => m.hostProxy === vp.hostProxy).hostProxyName;
                const vpLoadBalancingNodes = vp.virtualproxy.loadBalancingServerNodes
                    .map((node) => `${node.name}: ${node.hostName}`)
                    .join('\n');

                // session.Attributes is an array, where each element is an object with a single key-value pair
                const attributes = s.Attributes.map((a) => {
                    // Convert object to string on the format "key: value"
                    const attr = Object.keys(a).map((key) => `${key}: ${a[key]}`)[0];

                    return attr;
                }).join('\n');

                sessionsTabular.push({
                    vpDescription: vp.virtualproxy.description,
                    vpPrefix: vp.virtualproxy.prefix,
                    vpSessionCookieHeaderName: vp.virtualproxy.sessionCookieHeaderName,
                    proxyHost: vp.hostProxy,
                    proxyName: proxyHostName,
                    proxyFull: `${proxyHostName}:\n${vp.hostProxy}`,
                    loadBalancingNodes: vpLoadBalancingNodes,
                    userDir: s.UserDirectory,
                    userId: s.UserId,
                    userName: s.UserName === undefined || s.UserName === null ? '' : s.UserName,
                    attributes,
                    sessionId: s.SessionId,
                });
            });
        });

        // Build table or json, depending on output format
        if (options.outputFormat === 'table') {
            const sessionsTable = [];
            sessionsTable.push([
                'Virtual proxy description',
                'Virtual proxy prefix',
                'Virtual proxy session cookie header',
                'Linked proxy service',
                'Load balancing nodes',
                'Session user directory',
                'Session user ID',
                'Session user name',
                'Session attributes',
                'Session ID',
            ]);

            // Get total number of sessions
            // Sum the number of entries in each sessionDataArray.sessions array
            const totalSessions = sessionDataArray.reduce((acc, vp) => acc + vp.sessions.length, 0);

            // Get sessions per proxy host
            // First get all unique proxy hosts
            const uniqueProxyHosts = [...new Set(sessionDataArray.map((vp) => vp.hostProxy))];
            const sessionsPerProxyHost = uniqueProxyHosts.map((host) => {
                const sessions = sessionDataArray.filter((vp) => vp.hostProxy === host).reduce((acc, vp) => acc + vp.sessions.length, 0);
                return { host, sessions };
            });

            // Build text for table header
            let headerText = `-- Sessions per virtual proxy and proxy services --\n\nTotal number of sessions: ${totalSessions}\n\n`;

            // Add sessions per proxy host
            headerText += 'Sessions per proxy service:\n';
            sessionsPerProxyHost.forEach((p) => {
                // Get name of proxy host
                const proxyHostName = uniqueProxyHostNameMap.find((m) => m.hostProxy === p.host).hostProxyName;
                headerText += `   ${proxyHostName}: ${p.host}: ${p.sessions}\n`;
            });

            consoleTableConfig.header = {
                alignment: 'left',
                content: headerText,
            };

            // Sort the sessionDataArray as specified in the options.sortBy option
            // Possible values are: 'prefix', 'proxyhost', 'proxyname'
            if (options.sortBy !== undefined && options.sortBy !== null && options.sortBy !== '') {
                if (options.sortBy === 'prefix') {
                    sessionsTabular.sort((a, b) => a.vpPrefix.localeCompare(b.vpPrefix));
                } else if (options.sortBy === 'proxyhost') {
                    sessionsTabular.sort((a, b) => a.proxyHost.localeCompare(b.proxyHost));
                } else if (options.sortBy === 'proxyname') {
                    sessionsTabular.sort((a, b) => a.proxyName.localeCompare(b.proxyName));
                } else if (options.sortBy === 'userdir') {
                    sessionsTabular.sort((a, b) => a.userDir.localeCompare(b.userDir));
                } else if (options.sortBy === 'userid') {
                    sessionsTabular.sort((a, b) => a.userId.localeCompare(b.userId));
                } else if (options.sortBy === 'username') {
                    sessionsTabular.sort((a, b) => a.userName.localeCompare(b.userName));
                }
            } else {
                logger.warn('--sort-by option is invalid. Use default sorting.');
            }

            // Add to table that will be printed to console
            // eslint-disable-next-line no-restricted-syntax
            for (const s of sessionsTabular) {
                sessionsTable.push([
                    s.vpDescription,
                    s.vpPrefix,
                    s.vpSessionCookieHeaderName,
                    s.proxyFull,
                    s.loadBalancingNodes,
                    s.userDir,
                    s.userId,
                    s.userName,
                    s.attributes,
                    s.sessionId,
                ]);
            }

            // Print table to console
            logger.info(`\n${table(sessionsTable, consoleTableConfig)}`);
        } else {
            logger.info(`Sessions data in JSON format\n\n${JSON.stringify(sessionsTabular, null, 2)}`);
        }

        return sessionDataArray;
    } catch (err) {
        catchLog(`Error getting proxy sessions from host ${options.host}`, err);

        return false;
    }
};

export default getSessions;
