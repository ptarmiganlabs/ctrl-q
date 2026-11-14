/**
 * Unit tests for getTagsFromQseow() from src/lib/util/qseow/tag.js
 *
 * axios is mocked (requires a live QRS).
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { settled } from '../../helpers/settled.mjs';

// Mock axios before importing the modules under test (ESM hoisting)
jest.unstable_mockModule('axios', () => ({
    default: { request: jest.fn() },
}));

const axios = (await import('axios')).default;
const { logger } = await import('../../../globals.js');
const { getTagsFromQseow } = await import('../../../lib/util/qseow/tag.js');

const options = { authType: 'jwt', authJwt: 'test-jwt', host: 'qlik.example.com', port: '443', virtualProxy: '' };

beforeEach(() => {
    axios.request.mockReset();

    // Keep the logging out of the test output
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getTagsFromQseow', () => {
    test('should resolve with the tags QRS returns', async () => {
        const tags = [{ id: 'tag-1', name: 'Production' }];
        axios.request.mockResolvedValue({ status: 200, data: JSON.stringify(tags) });

        await expect(settled(getTagsFromQseow(options))).resolves.toEqual(tags);
    });

    test('should reject, rather than never settle, when the request fails', async () => {
        axios.request.mockRejectedValue(new Error('QRS unavailable'));

        await expect(settled(getTagsFromQseow(options))).rejects.toThrow('QRS unavailable');
    });
});
