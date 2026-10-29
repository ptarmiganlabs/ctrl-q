/**
 * Unit tests for getTask() from src/lib/cmd/qseow/gettask.js, the qseow task-get command.
 *
 * axios is mocked (requires a live QRS).
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock axios before importing the modules under test (ESM hoisting)
jest.unstable_mockModule('axios', () => ({
    default: { request: jest.fn() },
}));

const axios = (await import('axios')).default;
const { logger } = await import('../../../globals.js');
const { getTask } = await import('../../../lib/cmd/qseow/gettask.js');

const options = {
    authType: 'jwt',
    authJwt: 'test-jwt',
    host: 'qlik.example.com',
    port: '443',
    virtualProxy: '',
    logLevel: 'error',
    outputFormat: 'table',
    outputDest: 'screen',
    taskType: ['reload', 'ext-program'],
};

beforeEach(() => {
    axios.request.mockReset();

    // Keep the errors logged by the failure tests out of the test output
    jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getTask', () => {
    test('should return false, rather than throw, when the task model cannot be built', async () => {
        // The tags arrive, then QRS fails when asked for the reload tasks
        axios.request.mockResolvedValueOnce({ status: 200, data: '[]' }).mockRejectedValue(new Error('QRS unavailable'));

        await expect(getTask(options)).resolves.toBe(false);
    });
});
