/**
 * @fileoverview Integration tests for the `getTask` command using certificate authentication.
 * @module integration/task_get_cert
 *
 * @description
 * Exercises the {@link getTask} command (and {@link getTaskAssertOptions}) to list Qlik Sense
 * reload and external-program tasks in multiple output formats and destinations:
 * - Table output on screen (various column combinations)
 * - Tree output on screen (with/without colours, icons, detail columns, task ID / tag filters)
 * - Table output written to CSV file (all types, reload-only, ext-program-only)
 * - Tree output written to JSON file
 * Edge cases include non-existing task IDs and tags, which trigger logger.warn calls.
 * Created output directories and files are cleaned up after each test.
 *
 * @requires ../../lib/cmd/qseow/gettask
 * @requires ../../lib/util/qseow/assert-options
 * @requires ../../globals
 *
 * @environment
 * - CTRL_Q_HOST               – Qlik Sense server hostname (required)
 * - CTRL_Q_PORT               – QRS port (default: '4242')
 * - CTRL_Q_AUTH_TYPE          – Auth type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Client certificate PEM path
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Client private-key PEM path
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Root/CA certificate PEM path
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_TASK_TYPE          – Task type filter (default: ['reload', 'ext-program'])
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense server reachable at CTRL_Q_HOST on port 4242 via cert auth
 * - At least one reload task and one external-program task must exist
 * - Tag 'Test data' must exist and be applied to at least one task
 * - Task ID '4174b1ec-0fd1-4cbe-8d47-0afe545d69bd' may or may not exist (tree filter test)
 *
 * @cleanup
 * Each file-output test removes its own temporary directory via `fs.rmSync(..., { recursive: true })`.
 */
import { jest, test, expect, describe } from '@jest/globals';

import fs from 'node:fs';
import path from 'node:path';
import { getTask } from '../../lib/cmd/qseow/gettask.js';
import { getTaskAssertOptions } from '../../lib/util/qseow/assert-options.js';
import { logger } from '../../globals.js';

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

/**
 * @test Verify parameters (cert auth)
 * @description Pre-flight guard: asserts certificate paths, host, and user credentials are non-empty.
 * Input: options populated from environment variables
 * Expected: authCertFile, authCertKeyFile, authRootCertFile, host, authUserDir, authUserId are all non-empty
 */
test('get tasks (verify parameters) ', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.authRootCertFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

/**
 * Test suite for {@link getTask} table output on screen (cert auth).
 * Calls getTask with outputFormat='table', outputDest='screen' and varying tableDetails.
 */
describe('get tasks as table (cert auth)', () => {
    /**
     * @test Table view — reload + ext-program tasks, common columns
     * @description Calls {@link getTask} with table format, screen output, and tableDetails=['common'].
     * Input: outputFormat='table', outputDest='screen', tableDetails=['common']
     * Expected: result === true
     */
    test('get reload + ext pgm tasks as table on screen, columns "common"', async () => {
        options.outputFormat = 'table';
        options.outputDest = 'screen';
        options.tableDetails = ['common'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Table view — common + tag columns
     * @description Calls {@link getTask} with tableDetails=['common','tag'] to include tag column.
     * Input: outputFormat='table', outputDest='screen', tableDetails=['common','tag']
     * Expected: result === true
     */
    test('get tasks as table on screen, columns "common", "tag"', async () => {
        options.outputFormat = 'table';
        options.outputDest = 'screen';
        options.tableDetails = ['common', 'tag'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Table view — no detail columns specified
     * @description Calls {@link getTask} without setting tableDetails; exercises default column set.
     * Input: outputFormat='table', outputDest='screen', tableDetails not set
     * Expected: result === true
     */
    test('get tasks as table on screen, no detail columns', async () => {
        options.outputFormat = 'table';
        options.outputDest = 'screen';

        const result = await getTask(options);
        expect(result).toBe(true);
    });
});

/**
 * Test suite for {@link getTask} tree output on screen (cert auth).
 * Uses `beforeEach` to clear tableDetails/taskId/taskTag. Tests cover non-existing ID/tag
 * edge cases (which trigger logger.warn) and normal tree display with various filter/display
 * combinations. `logger.warn` is spied on for edge-case tests.
 */
describe('get tasks as tree (cert auth)', () => {
    beforeEach(() => {
        delete options.tableDetails;
        delete options.taskId;
        delete options.taskTag;
    });

    /**
     * @test Tree view — non-existing task ID triggers logger.warn
     * @description Calls {@link getTaskAssertOptions} with a task ID that does not exist.
     * Spies on `logger.warn` to verify the warning message about the unknown task ID.
     * Input: taskId=[validTaskIdDoesNotExist], outputFormat='tree', outputDest='screen'
     * Expected: result === true; logger.warn called with message containing 'Task with ID'
     */
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

    /**
     * @test Tree view — non-existing task tag triggers logger.warn
     * @description Calls {@link getTaskAssertOptions} with a task tag that does not exist.
     * Spies on `logger.warn` to verify the warning about the unknown tag.
     * Input: taskTag=['tag_does_not_exist'], outputFormat='tree', outputDest='screen'
     * Expected: result === true; logger.warn called with message containing 'Tag does not exist'
     */
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

    /**
     * @test Tree view — all tasks, no details, colored text
     * @description Calls {@link getTask} rendering all tasks as a tree with colored text.
     * Input: outputFormat='tree', outputDest='screen', treeDetails='', treeIcons=true, textColor='yes'
     * Expected: result === true
     */
    test('get all tasks as tree on screen, no detail columns, colored text', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'yes';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — filtered by task ID, no details, colored text
     * @description Calls {@link getTask} with a task ID filter showing only that task's subtree.
     * Input: outputFormat='tree', taskId=['4174b1ec-0fd1-4cbe-8d47-0afe545d69bd'], textColor='yes'
     * Expected: result === true
     */
    test('get some tasks (filtered by task id) as tree on screen, no detail columns, colored text', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'yes';
        options.taskId = ['4174b1ec-0fd1-4cbe-8d47-0afe545d69bd'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — filtered by task tag, no details, colored text
     * @description Calls {@link getTask} with a task tag filter ('Test data') to show matching tasks.
     * Input: outputFormat='tree', taskTag=['Test data'], textColor='yes'
     * Expected: result === true
     */
    test('get some tasks (filtered by task tag) as tree on screen, no detail columns, colored text', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'yes';
        options.taskTag = ['Test data'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — filtered by task ID and tag, no details, colored text
     * @description Calls {@link getTask} with both taskId and taskTag filters combined.
     * Input: outputFormat='tree', taskId=[...], taskTag=['Test data'], textColor='yes'
     * Expected: result === true
     */
    test('get some tasks (filtered by task id and tag) as tree on screen, no detail columns, colored text', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'yes';
        options.taskTag = ['Test data'];
        options.taskId = ['4174b1ec-0fd1-4cbe-8d47-0afe545d69bd'];

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — no details, no colored text
     * @description Calls {@link getTask} with textColor='no' to render tree without ANSI colors.
     * Input: outputFormat='tree', treeDetails='', treeIcons=true, textColor='no'
     * Expected: result === true
     */
    test('get tasks as tree on screen, no detail columns, no colored text (should succeed)', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'no';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — full detail columns, colored text
     * @description Calls {@link getTask} with all treeDetails columns enabled and colors on.
     * Input: treeDetails=['taskid','laststart','laststop','nextstart','appname','appstream'], textColor='yes'
     * Expected: result === true
     */
    test('get tasks as tree on screen, full detail columns, colored text (should succeed)', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = ['taskid', 'laststart', 'laststop', 'nextstart', 'appname', 'appstream'];
        options.treeIcons = true;
        options.textColor = 'yes';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — full detail columns, no colored text
     * @description Calls {@link getTask} with all treeDetails columns enabled and colors off.
     * Input: treeDetails=['taskid','laststart','laststop','nextstart','appname','appstream'], textColor='no'
     * Expected: result === true
     */
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

/**
 * Test suite for {@link getTask} table output written to CSV files (cert auth).
 * Tests cover all task types, reload-only, ext-program-only, and omitting tableDetails.
 * Each test writes to a unique temporary directory and verifies file content before cleanup.
 */
describe('get tasks as table, store to file (cert auth)', () => {
    /**
     * @test CSV file output — all task types, common + tag columns
     * @description Calls {@link getTask} to write tasks to a CSV file. Verifies the file exists,
     * has at least 5 lines, and that the task-type column contains only 'Reload' or 'External program'.
     * Input: outputFormat='table', outputDest='file', outputFileFormat='csv', tableDetails=['common','tag']
     * Expected: result === true; CSV file created with >=5 lines; column 1 matches /Reload|External program/
     */
    test('get tasks as table, store to CSV, columns "common", "tag"', async () => {
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

    /**
     * @test CSV file output — no tableDetails option (cert auth)
     * @description Calls {@link getTask} to write CSV without specifying tableDetails.
     * Verifies the file and validates task-type column values.
     * Input: outputFormat='table', outputDest='file', outputFileFormat='csv', no tableDetails
     * Expected: result === true; CSV file created; column 1 matches /Reload|External program/
     */
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

    /**
     * @test CSV file output — reload tasks only
     * @description Calls {@link getTask} with taskType=['reload'] and verifies every row
     * in the output file has 'Reload' in the task-type column.
     * Input: outputFormat='table', outputDest='file', taskType=['reload']
     * Expected: result === true; every non-header CSV row has column 1 === 'Reload'
     */
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

    /**
     * @test CSV file output — external-program tasks only
     * @description Calls {@link getTask} with taskType=['ext-program'] and verifies every row
     * in the output file has 'External program' in the task-type column.
     * Input: outputFormat='table', outputDest='file', taskType=['ext-program']
     * Expected: result === true; every non-header CSV row has column 1 === 'External program'
     */
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

/**
 * Test suite for {@link getTask} tree output written to JSON files (cert auth).
 * Tests cover icon/detail combinations and validate that the output is parseable JSON.
 * Each test writes to a shared 'task_export' directory and cleans up afterwards.
 */
describe('get tasks as tree, store to JSON file (cert auth)', () => {
    /**
     * @test JSON file output — tree with icons, no detail columns or color
     * @description Calls {@link getTask} to write the task tree to a JSON file.
     * Verifies the file exists, has at least 5 lines, and is valid JSON.
     * Input: outputFormat='tree', outputDest='file', treeIcons=true, textColor='no'
     * Expected: result === true; JSON file parseable; result !== null
     */
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

    /**
     * @test JSON file output — tree without icons, no detail columns or color
     * @description Like the icons variant, but with treeIcons=false.
     * Input: outputFormat='tree', outputDest='file', treeIcons=false, textColor='no'
     * Expected: result === true; JSON file parseable
     */
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

    /**
     * @test JSON file output — tree with icons and all detail columns
     * @description Calls {@link getTask} with all treeDetails columns, icons on, colors off.
     * Input: outputFormat='tree', treeDetails=['taskid','laststart','laststop','nextstart','appname','appstream']
     * Expected: result === true; JSON file parseable
     */
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
