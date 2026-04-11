/**
 * @fileoverview Registry for intel extractors.
 * Manages registration and retrieval of extractor classes for different data types.
 * @module qseow/intel/registry
 */

import { BaseExtractor } from './extractors/base.js';
import SheetIntelExtractor from './extractors/sheet-intel.js';
import DimensionIntelExtractor from './extractors/dimension-intel.js';
import MeasureIntelExtractor from './extractors/measure-intel.js';
import VariableIntelExtractor from './extractors/variable-intel.js';
import BookmarkIntelExtractor from './extractors/bookmark-intel.js';
import ConnectionIntelExtractor from './extractors/connection-intel.js';

/**
 * Registry mapping data type names to their extractor classes.
 * Each key corresponds to a metadata property (e.g., 'sheets', 'dimensions')
 * and maps to the extractor class that handles that type.
 * @readonly
 * @type {Object.<string, function(new:BaseExtractor)>}
 */
export const EXTRACTOR_REGISTRY = {
    /** Sheet/visualization extractor */
    sheet: SheetIntelExtractor,
    /** Master dimension extractor */
    dimension: DimensionIntelExtractor,
    /** Master measure extractor */
    measure: MeasureIntelExtractor,
    /** Variable extractor */
    variable: VariableIntelExtractor,
    /** Bookmark extractor */
    bookmark: BookmarkIntelExtractor,
    /** Data connection extractor */
    dataconnection: ConnectionIntelExtractor,
};

/**
 * Retrieves an extractor instance for a specific data type.
 * @param {string} dataType - The data type key (e.g., 'sheet', 'dimension', 'measure')
 * @returns {BaseExtractor} New instance of the appropriate extractor
 * @throws {Error} If no extractor is registered for the given data type
 * @example
 * const extractor = getExtractor('dimension');
 * // Returns a new DimensionIntelExtractor instance
 */
export function getExtractor(dataType) {
    const ExtractorClass = EXTRACTOR_REGISTRY[dataType];
    if (!ExtractorClass) {
        throw new Error(`No extractor registered for data type: ${dataType}`);
    }
    return new ExtractorClass();
}

/**
 * Retrieves all registered extractors as instances.
 * @returns {BaseExtractor[]} Array of extractor instances for all registered types
 * @example
 * const allExtractors = getAllExtractors();
 * // Returns [SheetIntelExtractor, DimensionIntelExtractor, ...]
 */
export function getAllExtractors() {
    return Object.keys(EXTRACTOR_REGISTRY).map((key) => getExtractor(key));
}
