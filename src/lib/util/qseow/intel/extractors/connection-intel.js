/**
 * @fileoverview Intel extractor for Qlik Sense data connections.
 * Extracts names and descriptions from data connections.
 * @module qseow/intel/extractors/connection-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense data connection metadata.
 * @extends BaseExtractor
 */
export default class ConnectionIntelExtractor extends BaseExtractor {
    /**
     * Creates a new ConnectionIntelExtractor instance.
     */
    constructor() {
        super('dataconnection', ['dataconnections']);
    }

    /**
     * Extracts intel items from data connection metadata.
     * Processes connection names and descriptions.
     * @param {Object} metadata - Serialized app metadata containing dataconnections array
     * @returns {Object[]} Array of intel items extracted from data connections
     */
    extract(metadata) {
        const intel = [];
        const connections = metadata.dataconnections || [];

        connections.forEach((conn, connIndex) => {
            const connId = conn.qId || '';
            const connName = conn.qName || '';

            // Connection name
            if (conn.qName) {
                const item = this.createIntelItem(
                    conn.qName,
                    IntelType.NAME,
                    SourceType.DATACONNECTION,
                    connId,
                    connName,
                    `dataconnections[${connIndex}].qName`
                );
                if (item) intel.push(item);
            }

            // Description
            if (conn.qDescription) {
                const item = this.createIntelItem(
                    conn.qDescription,
                    IntelType.DESCRIPTION,
                    SourceType.DATACONNECTION,
                    connId,
                    connName,
                    `dataconnections[${connIndex}].qDescription`
                );
                if (item) intel.push(item);
            }
        });

        return intel;
    }
}
