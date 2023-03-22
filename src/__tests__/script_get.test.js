const { getScript } = require('../lib/cmd/getscript');

const defaultTestTimeout = process.env.CTRL_Q_TEST_TIMEOUT || 120000; // 2 minute default timeout

console.log(`Jest timeout: ${defaultTestTimeout}`);

const options = {
    logLevel: process.env.CTRL_Q_LOG_LEVEL || 'info',
    authType: process.env.CTRL_Q_AUTH_TYPE || 'cert',
    authCertFile: process.env.CTRL_Q_AUTH_CERT_FILE || '',
    authCertKeyFile: process.env.CTRL_Q_AUTH_CERT_KEY_FILE || '',
    host: process.env.CTRL_Q_HOST || '',
    port: process.env.CTRL_Q_PORT || '4747',
    virtualProxy: process.env.CTRL_Q_VIRTUAL_PROXY || '',
    secure: process.env.CTRL_Q_SECURE || true,
    schemaVersion: process.env.CTRL_Q_SCHEMA_VERSION || '12.612.0',
    appId: process.env.CTRL_Q_APP_ID || 'a3e0f5d2-000a-464f-998d-33d333b175d7',
    authUserDir: process.env.CTRL_Q_AUTH_USER_DIR || '',
    authUserId: process.env.CTRL_Q_AUTH_USER_ID || '',
};

jest.setTimeout(defaultTestTimeout);

test('get app script (verify parameters)', async () => {
    expect(options.authCertFile).not.toHaveLength(0);
    expect(options.authCertKeyFile).not.toHaveLength(0);
    expect(options.host).not.toHaveLength(0);
    expect(options.authUserDir).not.toHaveLength(0);
    expect(options.authUserId).not.toHaveLength(0);
});

/**
 * Get app script
 * Should succeed
 */
test('get app script (should succeed)', async () => {
    const result = await getScript(options);

    expect(result.appId).toBe('a3e0f5d2-000a-464f-998d-33d333b175d7');
    expect(result.appCreatedDate).toBe('2021-06-03T22:04:52.283Z');
    expect(result.appModifiedDate).toBe('2021-06-04T15:42:23.759Z');
    expect(result.appScript.length).toBe(1655);
});
