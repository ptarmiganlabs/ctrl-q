/* eslint-disable no-console */
/**
 * @fileoverview Integration tests for exporting Qlik Sense apps to QVF files using certificate authentication.
 * @module integration/app_export_cert
 *
 * @description
 * Exercises `exportAppToFile` with various combinations of app tags, app IDs, file-name
 * formats, separators, and optional metadata-file generation. Each export test writes QVF
 * files to a temporary output directory (`qvfs_tmp`) and then deletes the directory after
 * asserting the expected output, keeping the filesystem clean between runs.
 *
 * @requires ../../lib/cmd/qseow/exportapp
 *
 * @environment
 * The following environment variables are read from `.test.env` via the global Jest setup:
 * - CTRL_Q_HOST               – Hostname or IP of the Qlik Sense server (required)
 * - CTRL_Q_PORT               – QRS port (default: '4242')
 * - CTRL_Q_AUTH_TYPE          – Authentication type (default: 'cert')
 * - CTRL_Q_AUTH_CERT_FILE     – Path to client certificate PEM (default: './cert/client.pem')
 * - CTRL_Q_AUTH_CERT_KEY_FILE – Path to client private-key PEM (default: './cert/client_key.pem')
 * - CTRL_Q_AUTH_ROOT_CERT_FILE – Path to root/CA certificate PEM (default: './cert/root.pem')
 * - CTRL_Q_AUTH_USER_DIR      – Qlik user directory (required)
 * - CTRL_Q_AUTH_USER_ID       – Qlik user ID (required)
 * - CTRL_Q_SCHEMA_VERSION     – Qlik Sense schema version (default: '12.612.0')
 * - CTRL_Q_SECURE             – Whether to use HTTPS (default: true)
 * - CTRL_Q_SLEEP_APP_EXPORT   – Milliseconds to sleep between app exports (default: '500')
 * - CTRL_Q_LIMIT_EXPORT_COUNT – Maximum number of apps to export, 0 = unlimited (default: '0')
 * - CTRL_Q_LOG_LEVEL          – Logging verbosity (default: 'info')
 * - CTRL_Q_TEST_TIMEOUT       – Jest timeout in ms (default: 600000)
 *
 * @prerequisites
 * - A running Qlik Sense Enterprise server reachable at CTRL_Q_HOST on port 4242
 * - Apps tagged 'apiCreated' and 'Ctrl-Q import' must exist on the server
 * - The following apps must exist on the server:
 *   - eb3ab049-d007-43d3-93da-5962f9208c65
 *   - 2933711d-6638-41d4-a2d2-6dd2d965208b ("Ctrl-Q CLI")
 *
 * @cleanup
 * Each test deletes the `qvfs_tmp` output directory after assertions complete.
 * No persistent side-effects remain on the server after the suite finishes.
 */
import { jest, test, expect, describe } from '@jest/globals';

import fs from 'node:fs';
import path from 'node:path';
import { exportAppToFile } from '../../lib/cmd/qseow/exportapp.js';

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    // logLevel: process.env.CTRL_Q_LOG_LEVEL || 'verbose',
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

    sleepAppExport: process.env.CTRL_Q_SLEEP_APP_EXPORT || '500',
    limitExportCount: process.env.CTRL_Q_LIMIT_EXPORT_COUNT || '0',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
jest.setTimeout(defaultTestTimeout);

/**
 * Test suite for {@link exportAppToFile} with certificate authentication.
 * Validates QVF export under multiple tag/ID combinations, file-naming formats, and
 * optional metadata-file creation. The output directory is created by the function and
 * deleted by each test after assertions to keep the workspace clean.
 */
describe('export apps to QVF files (cert auth)', () => {
    /**
     * @test Verify parameters
     * @description Pre-flight guard that confirms all required certificate authentication
     * parameters are present and non-empty before any export is attempted.
     * Input: options populated from environment variables
     * Expected: cert file path, cert key path, root cert path, host, user-dir, and user-id are all non-empty
     */
    test('get tasks (verify parameters)', async () => {
        expect(options.authCertFile).not.toHaveLength(0);
        expect(options.authCertKeyFile).not.toHaveLength(0);
        expect(options.authRootCertFile).not.toHaveLength(0);
        expect(options.host).not.toHaveLength(0);
        expect(options.authUserDir).not.toHaveLength(0);
        expect(options.authUserId).not.toHaveLength(0);
    });

    /**
     * @test Export apps matching one tag
     * @description Calls {@link exportAppToFile} selecting apps by the 'apiCreated' tag.
     * Uses 'app-name' and 'export-date' as the QVF filename components, '_' as separator,
     * and overwrites existing files. App data is excluded from the export.
     * Input: appTag=['apiCreated'], qvfNameFormat=['app-name','export-date'], outputDir='qvfs_tmp'
     * Expected: exportAppToFile returns true; qvfs_tmp contains at least one .qvf file;
     *   qvfs_tmp is deleted after assertions
     */
    test('export apps, one tag', async () => {
        options.outputDir = 'qvfs_tmp';
        options.appTag = ['apiCreated'];
        options.excludeAppData = 'true';
        options.qvfNameFormat = ['app-name', 'export-date'];
        options.qvfNameSeparator = '_';
        options.qvfOverwrite = true;

        const result = await exportAppToFile(options);
        expect(result).toBe(true);

        // Verify that output folder contains at least one file
        const exportDir = path.resolve(options.outputDir);
        const files = fs.readdirSync(exportDir);
        expect(files.length).toBeGreaterThan(0);

        // Delete output dir
        fs.rmSync(exportDir, { recursive: true });
    });

    /**
     * @test Export apps matching two tags
     * @description Calls {@link exportAppToFile} selecting apps tagged with either 'apiCreated'
     * or 'Ctrl-Q import'. Uses 'app-id', 'app-name', 'export-date', 'export-time' as filename
     * components and overwrites existing files. App data is excluded.
     * Input: appTag=['apiCreated','Ctrl-Q import'], qvfNameFormat=['app-id','app-name','export-date','export-time'], outputDir='qvfs_tmp'
     * Expected: exportAppToFile returns true; qvfs_tmp contains at least one file;
     *   qvfs_tmp is deleted after assertions
     */
    test('export apps, two tags', async () => {
        options.outputDir = 'qvfs_tmp';
        options.appTag = ['apiCreated', 'Ctrl-Q import'];
        options.excludeAppData = 'true';
        options.qvfNameFormat = ['app-id', 'app-name', 'export-date', 'export-time'];
        options.qvfNameSeparator = '_';
        options.qvfOverwrite = true;

        const result = await exportAppToFile(options);
        expect(result).toBe(true);

        // Verify that output folder contains at least one file
        const exportDir = path.resolve(options.outputDir);
        const files = fs.readdirSync(exportDir);
        expect(files.length).toBeGreaterThan(0);

        // Delete output dir
        fs.rmSync(exportDir, { recursive: true });
    });

    /**
     * @test Export apps matching two tags plus one explicit app ID
     * @description Calls {@link exportAppToFile} selecting apps by two tags and one additional
     * app GUID. Uses 'export-date', 'export-time', 'app-id', 'app-name' as filename components.
     * Input: appTag=['apiCreated','Ctrl-Q import'], appId=['eb3ab049-...'], outputDir='qvfs_tmp'
     * Expected: exportAppToFile returns true; qvfs_tmp contains at least one file;
     *   qvfs_tmp is deleted after assertions
     */
    test('export apps, two tags, one id', async () => {
        options.outputDir = 'qvfs_tmp';
        options.appTag = ['apiCreated', 'Ctrl-Q import'];
        options.appId = ['eb3ab049-d007-43d3-93da-5962f9208c65'];
        options.excludeAppData = 'true';
        options.qvfNameFormat = ['export-date', 'export-time', 'app-id', 'app-name'];
        options.qvfNameSeparator = '_';
        options.qvfOverwrite = true;

        const result = await exportAppToFile(options);
        expect(result).toBe(true);

        // Verify that output folder contains at least one file
        const exportDir = path.resolve(options.outputDir);
        const files = fs.readdirSync(exportDir);
        expect(files.length).toBeGreaterThan(0);

        // Delete output dir
        fs.rmSync(exportDir, { recursive: true });
    });

    /**
     * @test Export apps matching two tags plus two explicit app IDs
     * @description Calls {@link exportAppToFile} selecting apps by two tags and two explicit
     * app GUIDs. Exercises the combined tag + multi-ID selection path.
     * Input: appTag=['apiCreated','Ctrl-Q import'], appId=['eb3ab049-...','2933711d-...'], outputDir='qvfs_tmp'
     * Expected: exportAppToFile returns true; qvfs_tmp contains at least one file;
     *   qvfs_tmp is deleted after assertions
     */
    test('export apps, two tags, two ids', async () => {
        options.outputDir = 'qvfs_tmp';
        options.appTag = ['apiCreated', 'Ctrl-Q import'];
        options.appId = ['eb3ab049-d007-43d3-93da-5962f9208c65', '2933711d-6638-41d4-a2d2-6dd2d965208b'];
        options.excludeAppData = 'true';
        options.qvfNameFormat = ['export-date', 'export-time', 'app-id', 'app-name'];
        options.qvfNameSeparator = '_';
        options.qvfOverwrite = true;

        const result = await exportAppToFile(options);
        expect(result).toBe(true);

        // Verify that output folder contains at least one file
        const exportDir = path.resolve(options.outputDir);
        const files = fs.readdirSync(exportDir);
        expect(files.length).toBeGreaterThan(0);

        // Delete output dir
        fs.rmSync(exportDir, { recursive: true });
    });

    /**
     * @test Export apps with two tags and two IDs and write a metadata Excel file
     * @description Same as 'two tags, two ids' but additionally creates an Excel metadata file
     * (`app-export.xlsx`) in the output directory that documents all exported apps. Verifies
     * that the Excel file is created and has a non-zero size.
     * Input: appTag=['apiCreated','Ctrl-Q import'], appId=['eb3ab049-...','2933711d-...'],
     *   metadataFileCreate=true, metadataFileName='app-export.xlsx', metadataFileFormat='excel',
     *   outputDir='qvfs_tmp'
     * Expected: exportAppToFile returns true; qvfs_tmp contains at least one file; exactly one
     *   .xlsx file exists in qvfs_tmp with size > 0; qvfs_tmp is deleted after assertions
     */
    test('export apps, two tags, two ids, export metadata', async () => {
        options.outputDir = 'qvfs_tmp';
        options.appTag = ['apiCreated', 'Ctrl-Q import'];
        options.appId = ['eb3ab049-d007-43d3-93da-5962f9208c65', '2933711d-6638-41d4-a2d2-6dd2d965208b'];
        options.excludeAppData = 'true';
        options.qvfNameFormat = ['export-date', 'export-time', 'app-id', 'app-name'];
        options.qvfNameSeparator = '_';
        options.qvfOverwrite = true;

        options.metadataFileCreate = true;
        options.metadataFileName = 'app-export.xlsx';
        options.metadataFileFormat = 'excel';
        options.metadataFileOverwrite = true;

        const result = await exportAppToFile(options);
        expect(result).toBe(true);

        // Verify that output folder contains at least one file
        const exportDir = path.resolve(options.outputDir);
        const files = fs.readdirSync(exportDir);
        expect(files.length).toBeGreaterThan(0);

        // Verify that output Excel file has been created
        // Get all files in output folder
        const files2 = fs.readdirSync(exportDir);

        // Filter out Excel files
        const excelFiles = files2.filter((file) => file.endsWith('.xlsx'));
        expect(excelFiles.length).toBe(1);

        // Size of Exel file should be > 0
        const excelFile = path.resolve(exportDir, excelFiles[0]);
        const stats = fs.statSync(excelFile);
        expect(stats.size).toBeGreaterThan(0);

        // Delete output dir
        fs.rmSync(exportDir, { recursive: true });
    });
});
