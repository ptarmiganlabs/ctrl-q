/* eslint-disable no-console */
const { test, expect, describe } = require('@jest/globals');

const fs = require('fs');
const path = require('path');

const { exportAppToFile } = require('../lib/cmd/exportapp');

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

    sleepAppExport: process.env.CTRL_Q_SLEEP_APP_EXPORT || '500',
    limitExportCount: process.env.CTRL_Q_LIMIT_EXPORT_COUNT || '0',
};

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 10 minute default timeout
console.log(`Jest timeout: ${defaultTestTimeout}`);
jest.setTimeout(defaultTestTimeout);

test('get tasks (verify parameters)', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

/**
 * One tag, overwrite
 *
 * --output-dir qvfs
 * --app-tag apiCreated
 * --exclude-app-data true
 * --qvf-name-format app-name export-date
 * --qvf-name-separator _
 * --qvf-overwrite true
 */
test('export apps, tag "apiCreated"', async () => {
    options.outputDir = 'qvfs_1';
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
 * Two tags, overwrite
 *
 * --output-dir qvfs
 * --app-tag apiCreated 'Ctrl-Q import'
 * --exclude-app-data true
 * --qvf-name-format app-id app-name export-date export-time
 * --qvf-name-separator _
 * --qvf-overwrite true
 */
test('export apps, tag "apiCreated"', async () => {
    options.outputDir = 'qvfs_2';
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
 * Two tags, one ID, overwrite
 *
 * --output-dir qvfs
 * --app-tag apiCreated 'Ctrl-Q import'
 * --app-id eb3ab049-d007-43d3-93da-5962f9208c65
 * --exclude-app-data true
 * --qvf-name-format app-id app-name export-date export-time
 * --qvf-name-separator _
 * --qvf-overwrite true
 */
test('export apps, tag "apiCreated"', async () => {
    options.outputDir = 'qvfs_3';
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
 * Two tags, two IDs, overwrite
 *
 * --output-dir qvfs
 * --app-tag apiCreated 'Ctrl-Q import'
 * --app-id eb3ab049-d007-43d3-93da-5962f9208c65
 * --exclude-app-data true
 * --qvf-name-format app-id app-name export-date export-time
 * --qvf-name-separator _
 * --qvf-overwrite true
 */
test('export apps, tag "apiCreated"', async () => {
    options.outputDir = 'qvfs_4';
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
 * Two tags, two IDs, overwrite. Export metadata to Excel file
 *
 * --output-dir qvfs
 * --app-tag apiCreated 'Ctrl-Q import'
 * --app-id eb3ab049-d007-43d3-93da-5962f9208c65
 * --exclude-app-data true
 * --qvf-name-format app-id app-name export-date export-time
 * --qvf-name-separator _
 * --qvf-overwrite true
 */
test('export apps, tag "apiCreated"', async () => {
    options.outputDir = 'qvfs_5';
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
