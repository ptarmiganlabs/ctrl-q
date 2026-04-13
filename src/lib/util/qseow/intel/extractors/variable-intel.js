/**
 * @fileoverview Intel extractor for Qlik Sense variables.
 * Extracts variable names, definitions, and descriptions.
 * @module qseow/intel/extractors/variable-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense variable metadata.
 * @extends BaseExtractor
 */
export default class VariableIntelExtractor extends BaseExtractor {
    /**
     * Creates a new VariableIntelExtractor instance.
     */
    constructor() {
        super('variable', ['variables']);
    }

    /**
     * Extracts intel items from variable metadata.
     * Processes variable names, definitions, and descriptions.
     * @param {Object} metadata - Serialized app metadata containing variables array
     * @returns {Object[]} Array of intel items extracted from variables
     */
    extract(metadata) {
        const intel = [];
        const variables = metadata.variables || [];

        variables.forEach((variableWrapper, varIndex) => {
            const varId = variableWrapper.qInfo?.qId || '';
            const varName = variableWrapper.qName || '';
            const varDefinition = variableWrapper.qDefinition || '';

            // Variable name
            if (variableWrapper.qName) {
                const item = this.createIntelItem(
                    variableWrapper.qName,
                    IntelType.NAME,
                    SourceType.VARIABLE,
                    varId,
                    varName,
                    `variables[${varIndex}].qName`
                );
                if (item) intel.push(item);
            }

            // Variable definition (expression)
            if (variableWrapper.qDefinition) {
                const item = this.createIntelItem(
                    variableWrapper.qDefinition,
                    IntelType.DEFINITION,
                    SourceType.VARIABLE,
                    varId,
                    varName,
                    `variables[${varIndex}].qDefinition`
                );
                if (item) intel.push(item);
            }

            // Description
            if (variableWrapper.qDescription) {
                const item = this.createIntelItem(
                    variableWrapper.qDescription,
                    IntelType.DESCRIPTION,
                    SourceType.VARIABLE,
                    varId,
                    varName,
                    `variables[${varIndex}].qDescription`
                );
                if (item) intel.push(item);
            }
        });

        return intel;
    }
}
