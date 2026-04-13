/**
 * @fileoverview Main entry point for intel extraction system.
 * Orchestrates extraction of structured intel from Qlik Sense app metadata.
 * @module qseow/intel
 */

import { getAllExtractors } from './registry.js';

/**
 * Extracts structured intel from serialized Qlik Sense app metadata.
 *
 * Runs all registered extractors (sheet, dimension, measure, variable, bookmark,
 * dataconnection) against the provided metadata and aggregates the results into
 * a unified intel object containing metadata about the extraction and all
 * extracted items.
 *
 * @async
 * @param {Object} metadata - Serialized app metadata containing sheets, dimensions, measures, etc.
 * @param {string} appId - The Qlik Sense application ID
 * @param {string} appName - The Qlik Sense application name
 * @returns {Promise<Object>} Intel object with extracted items, metadata, and count
 * @throws {Error} If metadata is invalid or extraction fails
 * @example
 * const result = await extractIntel(appMetadata, 'abc123', 'Sales App');
 * // result.intel.items contains array of extracted intel items
 * // result.intel.count shows total number of items
 * // result.intel.extractors shows which extractors were used
 */
export function extractIntel(metadata, appId, appName) {
    if (!metadata) {
        return {
            intel: {
                extractedAt: new Date().toISOString(),
                appId: appId || '',
                appName: appName || '',
                extractors: [],
                count: 0,
                items: [],
            },
        };
    }

    const extractors = getAllExtractors();
    const allIntelItems = [];

    extractors.forEach((extractor) => {
        const items = extractor.extract(metadata);
        allIntelItems.push(...items);
    });

    return {
        intel: {
            extractedAt: new Date().toISOString(),
            appId: appId || '',
            appName: appName || '',
            extractors: extractors.map((e) => e.name),
            count: allIntelItems.length,
            items: allIntelItems,
        },
    };
}
