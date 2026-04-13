/**
 * @fileoverview Intel extractor for Qlik Sense master measures.
 * Extracts definitions, labels, expressions, titles, and descriptions from measures.
 * @module qseow/intel/extractors/measure-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense master measure metadata.
 * @extends BaseExtractor
 */
export default class MeasureIntelExtractor extends BaseExtractor {
    /**
     * Creates a new MeasureIntelExtractor instance.
     */
    constructor() {
        super('measure', ['measures']);
    }

    /**
     * Extracts intel items from measure metadata.
     * Processes measure expressions, labels, label expressions, titles, and descriptions.
     * @param {Object} metadata - Serialized app metadata containing measures array
     * @returns {Object[]} Array of intel items extracted from measures
     */
    extract(metadata) {
        const intel = [];
        const measures = metadata.measures || [];

        measures.forEach((measWrapper, measIndex) => {
            const measId = measWrapper.qInfo?.qId || '';
            const qMeasure = measWrapper.qMeasure || {};
            const qMetaDef = measWrapper.qMetaDef || {};

            // Measure definition (expression)
            if (qMeasure.qDef) {
                const item = this.createIntelItem(
                    qMeasure.qDef,
                    IntelType.DEFINITION,
                    SourceType.MEASURE,
                    measId,
                    qMetaDef.title || '',
                    `measures[${measIndex}].qMeasure.qDef`
                );
                if (item) intel.push(item);
            }

            // Label
            if (qMeasure.qLabel) {
                const item = this.createIntelItem(
                    qMeasure.qLabel,
                    IntelType.LABEL,
                    SourceType.MEASURE,
                    measId,
                    qMetaDef.title || '',
                    `measures[${measIndex}].qMeasure.qLabel`
                );
                if (item) intel.push(item);
            }

            // Label expression (dynamic label)
            if (qMeasure.qLabelExpression) {
                const item = this.createIntelItem(
                    qMeasure.qLabelExpression,
                    IntelType.EXPRESSION,
                    SourceType.MEASURE,
                    measId,
                    qMetaDef.title || '',
                    `measures[${measIndex}].qMeasure.qLabelExpression`
                );
                if (item) intel.push(item);
            }

            // Master item title
            if (qMetaDef.title) {
                const item = this.createIntelItem(
                    qMetaDef.title,
                    IntelType.TITLE,
                    SourceType.MEASURE,
                    measId,
                    qMetaDef.title,
                    `measures[${measIndex}].qMetaDef.title`
                );
                if (item) intel.push(item);
            }

            // Description
            if (qMetaDef.description) {
                const item = this.createIntelItem(
                    qMetaDef.description,
                    IntelType.DESCRIPTION,
                    SourceType.MEASURE,
                    measId,
                    qMetaDef.title || '',
                    `measures[${measIndex}].qMetaDef.description`
                );
                if (item) intel.push(item);
            }
        });

        return intel;
    }
}
