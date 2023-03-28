const { exportAppToFile } = require('../lib/cmd/exportapp');

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000;  // 5 minute default timeout

console.log(`Jest timeout: ${defaultTestTimeout}`);

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || '',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || '',
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
test('export apps, tag "apiCreated",  (should succeed)', async () => {
    options.outputDir = 'qvfs';
    options.appTag = ['apiCreated'];
    options.excludeAppData = 'true';
    options.qvfNameFormat = ['app-name', 'export-date'];
    options.qvfNameSeparator = '_';
    options.qvfOverwrite = true;

    const result = await exportAppToFile(options);
    expect(result).toBe(true);
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
test('export apps, tag "apiCreated",  (should succeed)', async () => {
    options.outputDir = 'qvfs';
    options.appTag = ['apiCreated', 'Ctrl-Q import'];
    options.excludeAppData = 'true';
    options.qvfNameFormat = ['app-id', 'app-name', 'export-date', 'export-time'];
    options.qvfNameSeparator = '_';
    options.qvfOverwrite = true;

    const result = await exportAppToFile(options);
    expect(result).toBe(true);
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
test('export apps, tag "apiCreated",  (should succeed)', async () => {
    options.outputDir = 'qvfs';
    options.appTag = ['apiCreated', 'Ctrl-Q import'];
    options.appId = ['eb3ab049-d007-43d3-93da-5962f9208c65'];
    options.excludeAppData = 'true';
    options.qvfNameFormat = ['export-date', 'export-time', 'app-id', 'app-name'];
    options.qvfNameSeparator = '_';
    options.qvfOverwrite = true;

    const result = await exportAppToFile(options);
    expect(result).toBe(true);
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
test('export apps, tag "apiCreated",  (should succeed)', async () => {
    options.outputDir = 'qvfs';
    options.appTag = ['apiCreated', 'Ctrl-Q import'];
    options.appId = ['eb3ab049-d007-43d3-93da-5962f9208c65', '2933711d-6638-41d4-a2d2-6dd2d965208b'];
    options.excludeAppData = 'true';
    options.qvfNameFormat = ['export-date', 'export-time', 'app-id', 'app-name'];
    options.qvfNameSeparator = '_';
    options.qvfOverwrite = true;

    const result = await exportAppToFile(options);
    expect(result).toBe(true);
});
