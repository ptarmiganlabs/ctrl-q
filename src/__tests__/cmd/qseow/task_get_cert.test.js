import { jest, test, expect, describe } from '@jest/globals';

import fs from 'node:fs';
import path from 'node:path';
import { getTask } from '../../../lib/cmd/qseow/gettask.js';
import { getTaskAssertOptions } from '../../../lib/util/qseow/assert-options.js';
import { logger } from '../../../globals.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || './cert/client.pem',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || './cert/client_key.pem',
    authRootCertFile: process.env.CTRL_Q_AUTH_ROOT_CERT_FILE || './cert/root.pem',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || ['reload', 'ext-program'],
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

const validTaskIdDoesNotExist = '123e4567-e89b-12d3-a456-426614174000';

test('get tasks (verify parameters) ', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

// Test suite for task table
describe('get tasks as table (cert auth)', () => {
    test('get reload + ext pgm tasks as table on screen, columns "common"', async () => {
        options.outputFormat = 'table';
        options.outputDest = 'screen';
        options.tableDetails = ['common'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    test('get tasks as table on screen, columns "common", "tag"', async () => {
        options.outputFormat = 'table';
        options.outputDest = 'screen';
        options.tableDetails = ['common', 'tag'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    test('get tasks as table on screen, no detail columns', async () => {
        options.outputFormat = 'table';
        options.outputDest = 'screen';

        const result = await getTask(options);
        expect(result).toBe(true);
    });
});

// Test suite for task tree
describe('get tasks as tree (cert auth)', () => {
    test('get tasks as tree on screen, valid task ID that does not exist in Sense', async () => {
        // Test assertion:
        options.taskId = [validTaskIdDoesNotExist];
        options.outputFormat = 'tree';
        options.outputDest = 'screen';

        // Remove taskType option if it exists
        if (options.taskType) {
            delete options.taskType;
        }

        // Mock logger.warn to capture console output
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

        // Should succeed, but with warning in console
        const result = await getTaskAssertOptions(options);
        expect(result).toBe(true);

        // Was there a warning logged by the Winston logger?
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Task with ID'));

        // Restore the original implementation
        warnSpy.mockRestore();
    });

    test('get tasks as tree on screen, task tag that does not exist in Sense', async () => {
        // Test assertion:
        options.taskTag = ['tag_does_not_exist'];
        options.outputFormat = 'tree';
        options.outputDest = 'screen';

        // Remove taskType option if it exists
        if (options.taskType) {
            delete options.taskType;
        }

        // Mock logger.warn to capture console output
        const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

        // Should succeed, but with warning in console
        const result = await getTaskAssertOptions(options);
        expect(result).toBe(true);

        // Was there a warning logged by the Winston logger?
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Tag does not exist in the Qlik Sense environment'));

        // Restore the original implementation
        warnSpy.mockRestore();
    });

    test('get tasks as tree on screen, no detail columns, colored text', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'yes';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    test('get tasks as tree on screen, no detail columns, no colored text (should succeed)', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'no';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    test('get tasks as tree on screen, full detail columns, colored text (should succeed)', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = ['taskid', 'laststart', 'laststop', 'nextstart', 'appname', 'appstream'];
        options.treeIcons = true;
        options.textColor = 'yes';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    test('get tasks as tree on screen, full detail columns, no colored text (should succeed)', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = ['taskid', 'laststart', 'laststop', 'nextstart', 'appname', 'appstream'];
        options.treeIcons = true;
        options.textColor = 'no';

        const result = await getTask(options);
        expect(result).toBe(true);
    });
});

// Test suite for storing table output to file
describe('get tasks as table, store to file (cert auth)', () => {
    test('get tasks as table, store to CSV, columns "common", "tag"', async () => {
        const outputDir = 'task_export_1';
        const outputFile = `task_get_table_1.csv`;

        options.outputFormat = 'table';
        options.outputDest = 'file';
        options.outputFileFormat = 'csv';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;
        options.tableDetails = ['common', 'tag'];

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the second column in the CSV file contains only "Reload" or "External program"
        // except first line, which contains the column header
        // Disregard empty lines
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].length > 0) {
                const columns = lines[i].split(',');
                expect(columns[1]).toMatch(/Reload|External program/);
            }
        }

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });

    test('get tasks as table, store to CSV, no detail columns option (cert auth)', async () => {
        const outputDir = 'task_export_2';
        const outputFile = `task_get_table_2.csv`;

        options.outputFormat = 'table';
        options.outputDest = 'file';
        options.outputFileFormat = 'csv';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the second column in the CSV file contains only "Reload" or "External program"
        // except first line, which contains the column header
        // Disregard empty lines
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].length > 0) {
                const columns = lines[i].split(',');
                expect(columns[1]).toMatch(/Reload|External program/);
            }
        }

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });

    test('get tasks as table, store to CSV, reload tasks only', async () => {
        const outputDir = 'task_export_3';
        const outputFile = `task_get_table_3.csv`;

        options.outputFormat = 'table';
        options.outputDest = 'file';
        options.outputFileFormat = 'csv';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;
        options.taskType = ['reload'];

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the second column in the CSV file contains only "Reload"
        // except first line, which contains the column header
        // Disregard empty lines
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].length > 0) {
                const columns = lines[i].split(',');
                expect(columns[1]).toBe('Reload');
            }
        }

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });

    test('get tasks as table, store to CSV, ext pgm tasks only', async () => {
        const outputDir = 'task_export_4';
        const outputFile = `task_get_table_4.csv`;

        options.outputFormat = 'table';
        options.outputDest = 'file';
        options.outputFileFormat = 'csv';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;
        options.taskType = ['ext-program'];

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the second column in the CSV file contains only "External program"
        // except first line, which contains the column header
        // Disregard empty lines
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].length > 0) {
                const columns = lines[i].split(',');
                expect(columns[1]).toBe('External program');
            }
        }

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });
});

// Test suite for storing tree output to file
describe('get tasks as tree, store to JSON file (cert auth)', () => {
    test('no detail columns or colored text, use icons', async () => {
        const outputDir = 'task_export';
        const outputFile = `task_get_table.json`;

        options.outputFormat = 'tree';
        options.outputDest = 'file';
        options.outputFileFormat = 'json';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;
        options.treeIcons = true;
        options.textColor = 'no';
        options.treeDetails = '';

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the output file contains a valid JSON object
        const json = JSON.parse(fileContents);
        expect(json).not.toBeNull();

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });

    test('no detail columns or colored text or icons', async () => {
        const outputDir = 'task_export';
        const outputFile = `task_get_table.json`;

        options.outputFormat = 'tree';
        options.outputDest = 'file';
        options.outputFileFormat = 'json';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;
        options.treeIcons = false;
        options.textColor = 'no';
        options.treeDetails = '';

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the output file contains a valid JSON object
        const json = JSON.parse(fileContents);
        expect(json).not.toBeNull();

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });

    test('no colored text, use icons and all task details', async () => {
        const outputDir = 'task_export';
        const outputFile = `task_get_table.json`;

        options.outputFormat = 'tree';
        options.outputDest = 'file';
        options.outputFileFormat = 'json';
        options.outputFileName = `./${outputDir}/${outputFile}`;
        options.outputFileOverwrite = true;
        options.treeIcons = true;
        options.textColor = 'no';
        options.treeDetails = ['taskid', 'laststart', 'laststop', 'nextstart', 'appname', 'appstream'];

        // Create output directory, if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const result = await getTask(options);
        expect(result).toBe(true);

        // Verify that output file exists
        const exportFile = path.resolve(options.outputFileName);
        const fileExists = fs.existsSync(exportFile);
        expect(fileExists).toBe(true);

        // Verify that output file contains at least 5 lines
        const fileContents = fs.readFileSync(exportFile, 'utf8');
        const lines = fileContents.split('\n');
        expect(lines.length).toBeGreaterThan(5);

        // Verify that the output file contains a valid JSON object
        const json = JSON.parse(fileContents);
        expect(json).not.toBeNull();

        // Delete output directory
        fs.rmSync(outputDir, { recursive: true });
    });
});
