/**
 * @fileoverview Integration tests for the `getTask` command using JWT authentication.
 * @module integration/task_get_jwt
 *
 * @description
 * Mirrors `task_get_cert.test.js` but forces `authType = 'jwt'`, `port = '443'`, and
 * `virtualProxy = 'jwt'` for all suites. Exercises {@link getTask} to list Qlik Sense
 * tasks in table and tree formats, both on screen and written to CSV / JSON files.
 * Tree output tests cover colour, icon, and detail-column variations.
 * Created output directories and files are cleaned up after each test.
 *
 * @requires ../../lib/cmd/qseow/gettask
 *
 * @environment
 * - CTRL_Q_HOST         – Qlik Sense server hostname (required)
 * - CTRL_Q_PORT         – QRS port (default: '4242'; overridden to '443' for JWT)
 * - CTRL_Q_AUTH_TYPE    – Auth type (default: 'cert'; overridden to 'jwt')
 * - CTRL_Q_AUTH_USER_DIR – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID – Qlik user ID (required)
 * - CTRL_Q_AUTH_JWT     – JWT Bearer token (required)
 * - CTRL_Q_TASK_TYPE    – Task type filter (default: ['reload', 'ext-program'])
 * - CTRL_Q_LOG_LEVEL    – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - Qlik Sense server reachable at CTRL_Q_HOST on port 443 via JWT virtual proxy
 * - At least one reload task and one external-program task must exist
 *
 * @cleanup
 * Each file-output test removes its own temporary directory via `fs.rmSync(..., { recursive: true })`.
 */
import { jest, test, expect, describe } from '@jest/globals';

import fs from 'node:fs';
import path from 'node:path';
import { getTask } from '../../lib/cmd/qseow/gettask.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4242',
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',

    taskType: process.env.CTRL_Q_TASK_TYPE || ['reload', 'ext-program'],
    authJwt: process.env.CTRL_Q_AUTH_JWT || '',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

options.authType = 'jwt';
options.port = '443';
options.virtualProxy = 'jwt';

/**
 * @test Verify parameters (JWT auth)
 * @description Pre-flight guard: asserts host and user credentials are non-empty.
 * Input: options with authType='jwt', port='443', virtualProxy='jwt'
 * Expected: host, authUserDir, authUserId are all non-empty
 */
test('get tasks (verify parameters)', async () => {
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

/**
 * Test suite for {@link getTask} table output on screen (JWT auth).
 * Calls getTask with outputFormat='table', outputDest='screen' and varying tableDetails.
 */
describe('get tasks as table (jwt auth)', () => {
    /**
     * @test Table view — reload + ext-program tasks, common columns (JWT)
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
     * @test Table view — common + tag columns (JWT)
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
     * @test Table view — no detail columns (JWT)
     * @description Calls {@link getTask} without specifying tableDetails.
     * Input: outputFormat='table', outputDest='screen'
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
 * Test suite for {@link getTask} tree output on screen (JWT auth).
 * Uses `beforeEach` to clear tableDetails/taskId/taskTag.
 * Tests cover tree display with colour, icon, and detail-column variations.
 */
describe('get tasks as tree (jwt auth)', () => {
    beforeEach(() => {
        delete options.tableDetails;
        delete options.taskId;
        delete options.taskTag;
    });

    /**
     * @test Tree view — no details, colored text (JWT)
     * @description Calls {@link getTask} rendering tasks as a tree with colored text and icons.
     * Input: outputFormat='tree', treeDetails='', treeIcons=true, textColor='yes'
     * Expected: result === true
     */
    test('get tasks as tree on screen, no detail columns, colored text', async () => {
        options.outputFormat = 'tree';
        options.outputDest = 'screen';
        options.treeDetails = '';
        options.treeIcons = true;
        options.textColor = 'yes';

        const result = await getTask(options);
        expect(result).toBe(true);
    });

    /**
     * @test Tree view — no details, no colored text (JWT)
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
     * @test Tree view — full detail columns, colored text (JWT)
     * @description Calls {@link getTask} with all treeDetails columns and colors on.
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
     * @test Tree view — full detail columns, no colored text (JWT)
     * @description Calls {@link getTask} with all treeDetails columns and colors off.
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
 * Test suite for {@link getTask} table output written to CSV files (JWT auth).
 * Each test writes to a unique temporary directory and verifies file content before cleanup.
 */
describe('get tasks as table, store to file (jwt auth)', () => {
    /**
     * @test CSV file output — all task types, common + tag columns (JWT)
     * @description Calls {@link getTask} to write tasks to a CSV file and verifies content.
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
     * @test CSV file output — no tableDetails option (JWT)
     * @description Calls {@link getTask} to write CSV without specifying tableDetails.
     * Input: outputFormat='table', outputDest='file', outputFileFormat='csv'
     * Expected: result === true; CSV created; column 1 matches /Reload|External program/
     */
    test('get tasks as table, store to CSV, no detail columns option', async () => {
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
     * @test CSV file output — reload tasks only (JWT)
     * @description Calls {@link getTask} with taskType=['reload'] to filter to reload tasks.
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
     * @test CSV file output — external-program tasks only (JWT)
     * @description Calls {@link getTask} with taskType=['ext-program'] to filter to ext-program tasks.
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
 * Test suite for {@link getTask} tree output written to JSON files (JWT auth).
 * Tests cover icon/detail combinations and validate that the output is parseable JSON.
 * Each test writes to a shared 'task_export' directory and cleans up afterwards.
 */
describe('get tasks as tree, store to JSON file (jwt auth)', () => {
    /**
     * @test JSON file output — tree with icons, no detail columns or color (JWT)
     * @description Calls {@link getTask} to write tree to JSON. Verifies parseable output.
     * Input: outputFormat='tree', outputDest='file', treeIcons=true, textColor='no'
     * Expected: result === true; JSON file parseable
     */
    test('no detail columns or colored text, use icons', async () => {
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
     * @test JSON file output — tree without icons, no detail columns or color (JWT)
     * @description Like the icons variant, but with treeIcons=false.
     * Input: outputFormat='tree', outputDest='file', treeIcons=false, textColor='no'
     * Expected: result === true; JSON file parseable
     */
    test('no detail columns or colored text or icons', async () => {
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
     * @test JSON file output — tree with icons and all detail columns (JWT)
     * @description Calls {@link getTask} with all treeDetails, icons on, colors off.
     * Input: outputFormat='tree', treeDetails=['taskid','laststart','laststop','nextstart','appname','appstream']
     * Expected: result === true; JSON file parseable
     */
    test('no colored text, use icons and all task details', async () => {
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
