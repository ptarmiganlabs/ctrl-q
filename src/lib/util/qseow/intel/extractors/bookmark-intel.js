/**
 * @fileoverview Intel extractor for Qlik Sense bookmarks.
 * Extracts titles and descriptions from bookmarks.
 * @module qseow/intel/extractors/bookmark-intel
 */

import { BaseExtractor, IntelType, SourceType } from './base.js';

/**
 * Extracts intel from Qlik Sense bookmark metadata.
 * @extends BaseExtractor
 */
export default class BookmarkIntelExtractor extends BaseExtractor {
    /**
     * Creates a new BookmarkIntelExtractor instance.
     */
    constructor() {
        super('bookmark', ['bookmarks']);
    }

    /**
     * Extracts intel items from bookmark metadata.
     * Processes bookmark titles and descriptions.
     * @param {Object} metadata - Serialized app metadata containing bookmarks array
     * @returns {Object[]} Array of intel items extracted from bookmarks
     */
    extract(metadata) {
        const intel = [];
        const bookmarks = metadata.bookmarks || [];

        bookmarks.forEach((bookmarkWrapper, bkmIndex) => {
            const bkmId = bookmarkWrapper.qInfo?.qId || '';
            const qMetaDef = bookmarkWrapper.qMetaDef || {};
            const sheetId = bookmarkWrapper.sheetId || '';

            // Bookmark title
            if (qMetaDef.title) {
                const item = this.createIntelItem(
                    qMetaDef.title,
                    IntelType.TITLE,
                    SourceType.BOOKMARK,
                    bkmId,
                    qMetaDef.title,
                    `bookmarks[${bkmIndex}].qMetaDef.title`,
                    { sheetId }
                );
                if (item) intel.push(item);
            }

            // Description
            if (qMetaDef.description) {
                const item = this.createIntelItem(
                    qMetaDef.description,
                    IntelType.DESCRIPTION,
                    SourceType.BOOKMARK,
                    bkmId,
                    qMetaDef.title || '',
                    `bookmarks[${bkmIndex}].qMetaDef.description`,
                    { sheetId }
                );
                if (item) intel.push(item);
            }
        });

        return intel;
    }
}
