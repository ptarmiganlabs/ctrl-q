const path = require('path');
const { createLogger, format, transports } = require('winston');

const { logger, execPath } = require('../globals');
const { taskExistById, getTaskByName, getTaskById } = require('../lib/util/task');

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 5 minute default timeout

console.log(`Jest timeout: ${defaultTestTimeout}`);

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || 'reload',
};

jest.setTimeout(defaultTestTimeout);

// Mock logger
global.console = {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
};

// Get certificates
const fileCert = path.resolve(execPath, options.authCertFile);
const fileCertKey = path.resolve(execPath, options.authCertKeyFile);

// Define existing and non-existing tasks
const existingTaskId = '58dd8322-e39c-4b71-b74e-13c47a2f6dd4';
const existingTaskName = 'Reload task of Meetup.com';
const multipleMatchingTaskNames = 'Manually triggered reload of Butler 7 Slack debug';
const nonExistingTaskId = '9f0d0e02-cccc-bbbb-aaaa-3e9a4d0c8a3d';
const nonExistingTaskName = 'Non-existing task 298374293874298734';

// ************************************************************************************************************
describe('taskExistById', () => {
    test('existing task', async () => {
        const result = await taskExistById(existingTaskId, options, fileCert, fileCertKey);
        expect(result).toBe(true);
    });

    test('non-existing task', async () => {
        const result = await taskExistById(nonExistingTaskId, options, fileCert, fileCertKey);
        expect(result).toBe(false);
    });
});

// ************************************************************************************************************
describe('getTaskByName', () => {
    test('no matching task)', async () => {
        const result = await getTaskByName(nonExistingTaskName, options);
        expect(result).toBe(false);
    });

    test('1 matching task)', async () => {
        const result = await getTaskByName(existingTaskName, options);
        expect(result).toEqual(existingTaskId);
    });

    test('should pass', async () => {
        const result = await getTaskByName(multipleMatchingTaskNames, options);
        expect(result).toEqual(false);

        // Ensure correct substring was written to global console log

        expect(global.console.log).toHaveBeenCalledWith(
            expect.stringContaining(`More than one task with name ${multipleMatchingTaskNames} found.`)
        );
        // expect(global.console.log).toHaveBeenCalledWith(`More than one task with name ${multipleMatchingTaskNames} found.`);
    });

    test('no task name provided)', async () => {
        const result = await getTaskByName('', options);
        expect(result).toEqual(false);
    });
});
