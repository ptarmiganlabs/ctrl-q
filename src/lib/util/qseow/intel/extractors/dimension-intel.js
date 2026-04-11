/**
 * @fileoverview Intel extractor for Qlik Sense master dimensions.
 * Extracts field definitions, labels, expressions, titles, and descriptions from dimensions.
 * @module qseow/intel/extractors/dimension-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense master dimension metadata.
 * @extends BaseExtractor
 */
export default class DimensionIntelExtractor extends BaseExtractor {
    /**
     * Creates a new DimensionIntelExtractor instance.
     */
    constructor() {
        super('dimension', ['dimensions']);
    }

    /**
     * Extracts intel items from dimension metadata.
     * Processes field definitions, label expressions, titles, and descriptions.
     * @param {Object} metadata - Serialized app metadata containing dimensions array
     * @returns {Object[]} Array of intel items extracted from dimensions
     */
    extract(metadata) {
        const intel = [];
        const dimensions = metadata.dimensions || [];

        dimensions.forEach((dimWrapper, dimIndex) => {
            const dimId = dimWrapper.qInfo?.qId || '';
            const qDim = dimWrapper.qDim || {};
            const qMetaDef = dimWrapper.qMetaDef || {};

            // Field definitions (the actual field/expression the dimension uses)
            if (qDim.qFieldDefs) {
                qDim.qFieldDefs.forEach((fieldDef, idx) => {
                    const item = this.createIntelItem(
                        fieldDef,
                        IntelType.FIELD,
                        SourceType.DIMENSION,
                        dimId,
                        qMetaDef.title || '',
                        `dimensions[${dimIndex}].qDim.qFieldDefs[${idx}]`
                    );
                    if (item) intel.push(item);
                });
            }

            // Label expression (dynamic label)
            if (qDim.qLabelExpression) {
                const item = this.createIntelItem(
                    qDim.qLabelExpression,
                    IntelType.EXPRESSION,
                    SourceType.DIMENSION,
                    dimId,
                    qMetaDef.title || '',
                    `dimensions[${dimIndex}].qDim.qLabelExpression`
                );
                if (item) intel.push(item);
            }

            // Dimension title (qDim.title)
            if (qDim.title) {
                const item = this.createIntelItem(
                    qDim.title,
                    IntelType.TITLE,
                    SourceType.DIMENSION,
                    dimId,
                    qMetaDef.title || '',
                    `dimensions[${dimIndex}].qDim.title`
                );
                if (item) intel.push(item);
            }

            // Master item title (qMetaDef.title)
            if (qMetaDef.title) {
                const item = this.createIntelItem(
                    qMetaDef.title,
                    IntelType.TITLE,
                    SourceType.DIMENSION,
                    dimId,
                    qMetaDef.title,
                    `dimensions[${dimIndex}].qMetaDef.title`
                );
                if (item) intel.push(item);
            }

            // Description
            if (qMetaDef.description) {
                const item = this.createIntelItem(
                    qMetaDef.description,
                    IntelType.DESCRIPTION,
                    SourceType.DIMENSION,
                    dimId,
                    qMetaDef.title || '',
                    `dimensions[${dimIndex}].qMetaDef.description`
                );
                if (item) intel.push(item);
            }
        });

        return intel;
    }
}
