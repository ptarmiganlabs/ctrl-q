const { getTask } = require('../lib/cmd/gettask');

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 600000; // 5 minute default timeout

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

    taskType: process.env.CTRL_Q_TASK_TYPE || 'reload',
};

jest.setTimeout(defaultTestTimeout);

test('get tasks (verify parameters)', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

test('get tasks as table on screen, columns "common" (should succeed)', async () => {
    options.outputFormat = 'table';
    options.outputDest = 'screen';
    options.tableDetails = ['common'];

    const result = await getTask(options);
    expect(result).toBe(true);
});

test('get tasks as table on screen, columns "common", "tag" (should succeed)', async () => {
    options.outputFormat = 'table';
    options.outputDest = 'screen';
    options.tableDetails = ['common', 'tag'];

    const result = await getTask(options);
    expect(result).toBe(true);
});

test('get tasks as table on screen, no detail columns (should succeed)', async () => {
    options.outputFormat = 'table';
    options.outputDest = 'screen';

    const result = await getTask(options);
    expect(result).toBe(true);
});

test('get tasks as tree on screen, no detail columns, colored text (should succeed)', async () => {
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
