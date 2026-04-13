/**
 * @fileoverview Intel extractor for Qlik Sense data tables and keys.
 * Extracts table names, tags, and key information from app data model.
 * @module qseow/intel/extractors/table-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense tables and keys metadata.
 * @extends BaseExtractor
 */
export default class TableIntelExtractor extends BaseExtractor {
    /**
     * Creates a new TableIntelExtractor instance.
     */
    constructor() {
        super('table', ['tables']);
    }

    /**
     * Extracts intel items from tables and keys metadata.
     * Processes table names, tags, table tags, and key information.
     * @param {Object} metadata - Serialized app metadata containing tables object
     * @returns {Object[]} Array of intel items extracted from tables and keys
     */
    extract(metadata) {
        const intel = [];
        const tablesData = metadata.tables || {};

        // Extract from qtr (tables)
        const tables = tablesData.qtr || [];
        tables.forEach((table, tableIndex) => {
            const tableId = table.qName || `table-${tableIndex}`;
            const tableName = table.qName || '';

            // Table name
            if (table.qName) {
                const item = this.createIntelItem(
                    table.qName,
                    IntelType.NAME,
                    SourceType.TABLE,
                    tableId,
                    tableName,
                    `tables.qtr[${tableIndex}].qName`
                );
                if (item) intel.push(item);
            }

            // Table tags
            if (table.qTags && Array.isArray(table.qTags)) {
                table.qTags.forEach((tag) => {
                    const item = this.createIntelItem(
                        tag,
                        IntelType.FIELD,
                        SourceType.TABLE,
                        tableId,
                        tableName,
                        `tables.qtr[${tableIndex}].qTags`
                    );
                    if (item) intel.push(item);
                });
            }

            // Table table tags
            if (table.qTableTags && Array.isArray(table.qTableTags)) {
                table.qTableTags.forEach((tag) => {
                    const item = this.createIntelItem(
                        tag,
                        IntelType.FIELD,
                        SourceType.TABLE,
                        tableId,
                        tableName,
                        `tables.qtr[${tableIndex}].qTableTags`
                    );
                    if (item) intel.push(item);
                });
            }
        });

        // Extract from qk (keys)
        const keys = tablesData.qk || [];
        keys.forEach((key, keyIndex) => {
            const keyId = key.qKeyFields?.join('_') || `key-${keyIndex}`;

            // Key tables (which tables are linked by this key)
            if (key.qTables && Array.isArray(key.qTables)) {
                key.qTables.forEach((tableName) => {
                    const item = this.createIntelItem(
                        tableName,
                        IntelType.FIELD,
                        SourceType.TABLE_KEY,
                        keyId,
                        `Key: ${key.qKeyFields?.join(', ')}`,
                        `tables.qk[${keyIndex}].qTables`
                    );
                    if (item) intel.push(item);
                });
            }

            // Key fields (which fields are the keys)
            if (key.qKeyFields && Array.isArray(key.qKeyFields)) {
                key.qKeyFields.forEach((field) => {
                    const item = this.createIntelItem(
                        field,
                        IntelType.FIELD,
                        SourceType.TABLE_KEY,
                        keyId,
                        `Key: ${key.qKeyFields?.join(', ')}`,
                        `tables.qk[${keyIndex}].qKeyFields`
                    );
                    if (item) intel.push(item);
                });
            }
        });

        return intel;
    }
}
