/**
 * @fileoverview Intel extractor for Qlik Sense sheet objects.
 * Extracts labels, titles, descriptions, and expressions from sheets, cells, and child objects.
 * @module qseow/intel/extractors/sheet-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense sheet metadata.
 * Handles sheets, cells (visualizations), and nested child objects.
 * @extends BaseExtractor
 */
export default class SheetIntelExtractor extends BaseExtractor {
    /**
     * Creates a new SheetIntelExtractor instance.
     */
    constructor() {
        super('sheet', ['sheets']);
    }

    /**
     * Extracts intel items from sheet metadata.
     * Processes sheet properties, cell references, and all child objects.
     * @param {Object} metadata - Serialized app metadata containing sheets array
     * @returns {Object[]} Array of intel items extracted from sheets
     */
    extract(metadata) {
        const intel = [];
        const sheets = metadata.sheets || [];

        sheets.forEach((sheetWrapper, sheetIndex) => {
            if (!sheetWrapper || !sheetWrapper.qProperty) {
                return;
            }

            const sheetProperty = sheetWrapper.qProperty;
            const sheetId = sheetProperty?.qInfo?.qId || '';
            const sheetName = sheetProperty?.qMetaDef?.title || '';

            // Extract sheet-level title and description
            if (sheetProperty?.qMetaDef) {
                const title = this.createIntelItem(
                    sheetProperty.qMetaDef.title,
                    IntelType.TITLE,
                    SourceType.SHEET,
                    sheetId,
                    sheetName,
                    `sheets[${sheetIndex}].qProperty.qMetaDef.title`
                );
                if (title) intel.push(title);

                const description = this.createIntelItem(
                    sheetProperty.qMetaDef.description,
                    IntelType.DESCRIPTION,
                    SourceType.SHEET,
                    sheetId,
                    sheetName,
                    `sheets[${sheetIndex}].qProperty.qMetaDef.description`
                );
                if (description) intel.push(description);
            }

            // Process cells (visualization references on the sheet)
            const cells = sheetProperty?.cells || [];
            cells.forEach((cell, cellIndex) => {
                const cellAssociations = {
                    sheetId,
                    sheetName,
                    cellName: cell.name,
                    cellType: cell.type,
                };

                const cellIntel = this.extractCellIntel(sheetIndex, cellIndex, cell, cellAssociations);
                intel.push(...cellIntel);
            });

            // Process child objects (actual visualization definitions)
            const children = sheetWrapper.qChildren || [];
            children.forEach((childWrapper, childIndex) => {
                const childProperty = childWrapper.qProperty;
                if (childProperty) {
                    const childIntel = this.extractChildIntel(sheetIndex, childIndex, childProperty, {
                        sheetId,
                        sheetName,
                    });
                    intel.push(...childIntel);
                }
            });
        });

        return intel;
    }

    /**
     * Extracts intel from a sheet cell (visualization reference).
     * @param {number} sheetIndex - Index of the parent sheet in the sheets array
     * @param {number} cellIndex - Index of the cell in the sheet's cells array
     * @param {Object} cell - Cell object containing name and type
     * @param {Object} associations - Sheet context for the cell
     * @returns {Object[]} Array of intel items from the cell
     */
    extractCellIntel(sheetIndex, cellIndex, cell, associations) {
        const intel = [];

        // Extract cell name (ID) and type
        const name = this.createIntelItem(
            cell.name,
            IntelType.NAME,
            SourceType.SHEET_CELL,
            cell.name,
            cell.type,
            `sheets[${sheetIndex}].qProperty.cells[${cellIndex}].name`,
            associations
        );
        if (name) intel.push(name);

        return intel;
    }

    /**
     * Extracts intel from a child object (visualization definition).
     * Handles titles, labels, expressions, dimensions, measures, and other properties.
     * @param {number} sheetIndex - Index of the parent sheet
     * @param {number} childIndex - Index of the child in the qChildren array
     * @param {Object} childProperty - The child object's qProperty
     * @param {Object} parentAssociations - Sheet context and parent info
     * @returns {Object[]} Array of intel items from the child
     */
    extractChildIntel(sheetIndex, childIndex, childProperty, parentAssociations) {
        const intel = [];
        const childId = childProperty?.qInfo?.qId || '';
        const childType = childProperty?.qInfo?.qType || '';

        // Title
        if (childProperty.title) {
            const title = this.createIntelItem(
                childProperty.title,
                IntelType.TITLE,
                SourceType.SHEET_CHILD,
                childId,
                childProperty.title,
                `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.title`,
                parentAssociations
            );
            if (title) intel.push(title);
        }

        // Label (qLabel)
        if (childProperty.qLabel) {
            const label = this.createIntelItem(
                childProperty.qLabel,
                IntelType.LABEL,
                SourceType.SHEET_CHILD,
                childId,
                childProperty.title || '',
                `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qLabel`,
                parentAssociations
            );
            if (label) intel.push(label);
        }

        // Label expression (dynamic label)
        if (childProperty.qLabelExpression) {
            const labelExpr = this.createIntelItem(
                childProperty.qLabelExpression,
                IntelType.EXPRESSION,
                SourceType.SHEET_CHILD,
                childId,
                childProperty.title || '',
                `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qLabelExpression`,
                parentAssociations
            );
            if (labelExpr) intel.push(labelExpr);
        }

        // Subtitle
        if (childProperty.subtitle) {
            const subtitle = this.createIntelItem(
                childProperty.subtitle,
                IntelType.DESCRIPTION,
                SourceType.SHEET_CHILD,
                childId,
                childProperty.title || '',
                `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.subtitle`,
                parentAssociations
            );
            if (subtitle) intel.push(subtitle);
        }

        // Footnote
        if (childProperty.footnote) {
            const footnote = this.createIntelItem(
                childProperty.footnote,
                IntelType.DESCRIPTION,
                SourceType.SHEET_CHILD,
                childId,
                childProperty.title || '',
                `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.footnote`,
                parentAssociations
            );
            if (footnote) intel.push(footnote);
        }

        // List object definitions (filter panes, listboxes)
        if (childProperty.qListObjectDef?.qDef) {
            const listDef = childProperty.qListObjectDef.qDef;
            if (listDef.qFieldDefs) {
                listDef.qFieldDefs.forEach((fieldDef, fieldIdx) => {
                    const field = this.createIntelItem(
                        fieldDef,
                        IntelType.FIELD,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qListObjectDef.qDef.qFieldDefs[${fieldIdx}]`,
                        parentAssociations
                    );
                    if (field) intel.push(field);
                });
            }
            if (listDef.qFieldLabels) {
                listDef.qFieldLabels.forEach((fieldLabel, labelIdx) => {
                    const label = this.createIntelItem(
                        fieldLabel,
                        IntelType.LABEL,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qListObjectDef.qDef.qFieldLabels[${labelIdx}]`,
                        parentAssociations
                    );
                    if (label) intel.push(label);
                });
            }
        }

        // HyperCube dimensions (charts, tables)
        if (childProperty.qHyperCubeDef?.qDimensions) {
            childProperty.qHyperCubeDef.qDimensions.forEach((dim, dimIdx) => {
                if (dim.qDef?.qFieldDefs) {
                    dim.qDef.qFieldDefs.forEach((fieldDef, fieldIdx) => {
                        const field = this.createIntelItem(
                            fieldDef,
                            IntelType.FIELD,
                            SourceType.SHEET_CHILD,
                            childId,
                            childProperty.title || '',
                            `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qHyperCubeDef.qDimensions[${dimIdx}].qDef.qFieldDefs[${fieldIdx}]`,
                            parentAssociations
                        );
                        if (field) intel.push(field);
                    });
                }
                if (dim.qDef?.qLabel) {
                    const label = this.createIntelItem(
                        dim.qDef.qLabel,
                        IntelType.LABEL,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qHyperCubeDef.qDimensions[${dimIdx}].qDef.qLabel`,
                        parentAssociations
                    );
                    if (label) intel.push(label);
                }
                if (dim.qDef?.qLabelExpression) {
                    const labelExpr = this.createIntelItem(
                        dim.qDef.qLabelExpression,
                        IntelType.EXPRESSION,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qHyperCubeDef.qDimensions[${dimIdx}].qDef.qLabelExpression`,
                        parentAssociations
                    );
                    if (labelExpr) intel.push(labelExpr);
                }
            });
        }

        // HyperCube measures
        if (childProperty.qHyperCubeDef?.qMeasures) {
            childProperty.qHyperCubeDef.qMeasures.forEach((meas, measIdx) => {
                // Measure definition (expression)
                const measDef = meas.qDef?.qDef || meas.qDef;
                if (measDef) {
                    const def = this.createIntelItem(
                        measDef,
                        IntelType.DEFINITION,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qHyperCubeDef.qMeasures[${measIdx}].qDef.qDef`,
                        parentAssociations
                    );
                    if (def) intel.push(def);
                }
                // Measure label
                if (meas.qLabel) {
                    const label = this.createIntelItem(
                        meas.qLabel,
                        IntelType.LABEL,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qHyperCubeDef.qMeasures[${measIdx}].qLabel`,
                        parentAssociations
                    );
                    if (label) intel.push(label);
                }
                // Measure label expression
                if (meas.qLabelExpression) {
                    const labelExpr = this.createIntelItem(
                        meas.qLabelExpression,
                        IntelType.EXPRESSION,
                        SourceType.SHEET_CHILD,
                        childId,
                        childProperty.title || '',
                        `sheets[${sheetIndex}].qChildren[${childIndex}].qProperty.qHyperCubeDef.qMeasures[${measIdx}].qLabelExpression`,
                        parentAssociations
                    );
                    if (labelExpr) intel.push(labelExpr);
                }
            });
        }

        return intel;
    }
}
