/**
 * @fileoverview Intel extraction system for Qlik Sense app metadata.
 * Provides base classes and utilities for extracting structured intel from serialized app data.
 * @module qseow/intel/extractors/base
 */

/**
 * Enumeration of intel item types.
 * Represents the category of information extracted from app metadata.
 * @readonly
 * @enum {string}
 */
export const IntelType = {
    /** Title of an object (e.g., sheet title, measure title) */
    TITLE: 'title',
    /** Description text */
    DESCRIPTION: 'description',
    /** Label displayed in UI */
    LABEL: 'label',
    /** Expression definition (dynamic calculations) */
    EXPRESSION: 'expression',
    /** Definition (measure expressions, variable definitions) */
    DEFINITION: 'definition',
    /** Name of an object */
    NAME: 'name',
    /** Field reference */
    FIELD: 'field',
};

/**
 * Enumeration of source types for intel items.
 * Identifies where in the Qlik Sense app the intel originated.
 * @readonly
 * @enum {string}
 */
export const SourceType = {
    /** Sheet object itself */
    SHEET: 'sheet',
    /** Cell/visualization on a sheet */
    SHEET_CELL: 'sheet-cell',
    /** Child object within a sheet cell */
    SHEET_CHILD: 'sheet-child',
    /** Master dimension */
    DIMENSION: 'dimension',
    /** Master measure */
    MEASURE: 'measure',
    /** Variable */
    VARIABLE: 'variable',
    /** Bookmark */
    BOOKMARK: 'bookmark',
    /** Data connection */
    DATACONNECTION: 'dataconnection',
};

/**
 * Base class for intel extractors.
 * All extractors must inherit from this class and implement the extract() method.
 * @abstract
 */
export class BaseExtractor {
    /**
     * Creates a new BaseExtractor instance.
     * @param {string} name - Unique identifier for this extractor (e.g., 'sheet', 'dimension')
     * @param {string[]} dataTypes - Array of metadata object types this extractor handles (e.g., ['sheets', 'dimensions'])
     */
    constructor(name, dataTypes) {
        /** @type {string} */
        this.name = name;
        /** @type {string[]} */
        this.dataTypes = dataTypes;
    }

    /**
     * Extracts intel items from metadata.
     * Must be implemented by subclasses.
     * @abstract
     * @param {Object} metadata - The serialized app metadata object
     * @returns {Object[]} Array of intel items extracted from the metadata
     * @throws {Error} If called directly without implementation
     */
    extract(metadata) {
        throw new Error('Extractor must implement extract() method');
    }

    /**
     * Creates a standardized intel item object.
     * Validates and normalizes the input values into a consistent format.
     * @param {*} value - The extracted value (text, expression, name, etc.)
     * @param {string} type - The type of intel (from IntelType enum)
     * @param {string} sourceType - Where the intel originated (from SourceType enum)
     * @param {string} sourceId - Unique identifier of the source object
     * @param {string} sourceName - Human-readable name of the source
     * @param {string} path - JSON path to the source in the metadata
     * @param {Object} [associations={}] - Related context (sheet, visualization info, etc.)
     * @returns {Object|null} Intel item object or null if value is empty/invalid
     */
    createIntelItem(value, type, sourceType, sourceId, sourceName, path, associations = {}) {
        if (value === undefined || value === null || value === '') {
            return null;
        }

        return {
            value: String(value),
            type,
            sourceType,
            sourceId: sourceId || '',
            sourceName: sourceName || '',
            path,
            associations,
        };
    }
}
