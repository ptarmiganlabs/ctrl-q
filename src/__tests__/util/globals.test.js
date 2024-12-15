import { jest, test, expect, describe } from '@jest/globals';
import {
    mergeDirFilePath,
    readCert,
    generateXrfKey,
    sleep,
    setLoggingLevel,
    getLoggingLevel,
    getCliOptions,
    setCliOptions,
    verifyFileSystemExists,
} from '../../globals.js';
import fs from 'fs';
import upath from 'upath';

describe('CLI Options', () => {
    test('getCliOptions should return an empty object initially', () => {
        const options = getCliOptions();
        expect(options).toEqual({});
    });

    test('setCliOptions should set the CLI options correctly', () => {
        const newOptions = {
            logLevel: 'debug',
            host: 'localhost',
            port: '8080',
        };
        setCliOptions(newOptions);
        const options = getCliOptions();
        expect(options).toEqual(newOptions);
    });

    test('setCliOptions should overwrite existing options', () => {
        const initialOptions = {
            logLevel: 'info',
            host: '127.0.0.1',
        };
        setCliOptions(initialOptions);

        const newOptions = {
            logLevel: 'debug',
            port: '8080',
        };
        setCliOptions(newOptions);

        const options = getCliOptions();
        expect(options).toEqual(newOptions);
    });
});

describe('setLoggingLevel', () => {
    it('sets logging level to a valid level', () => {
        setLoggingLevel('debug');
        expect(getLoggingLevel()).toBe('debug');
    });

    it('sets logging level to another valid level', () => {
        setLoggingLevel('error');
        expect(getLoggingLevel()).toBe('error');
    });

    it('does not change logging level when set to the same level', () => {
        setLoggingLevel('info');
        setLoggingLevel('info');
        expect(getLoggingLevel()).toBe('info');
    });
});

describe('sleep function', () => {
    // Positive number
    test('returns a Promise when given a positive number', () => {
        const result = sleep(100);
        expect(result).toBeInstanceOf(Promise);
    });
    // String that can be converted to a positive number
    test('returns a Promise when given a string that can be converted to a positive number', () => {
        const result = sleep('100');
        expect(result).toBeInstanceOf(Promise);
    });

    // Negative number
    test('rejects when given a negative number', async () => {
        await expect(sleep(-1)).rejects.toThrowError();
        await expect(sleep(0)).rejects.toThrowError();
        await expect(sleep('a')).rejects.toThrowError();
    });

    // Invalid string
    test('rejects when given an invalid string', async () => {
        await expect(sleep('-100')).rejects.toThrowError();
        await expect(sleep('abc')).rejects.toThrowError();
        await expect(sleep('')).rejects.toThrowError();
    });

    test('resolves after the specified time', async () => {
        const startTime = Date.now();
        await sleep(3000);
        const endTime = Date.now();
        expect(endTime - startTime).toBeGreaterThanOrEqual(2900);
    });
});

describe('generateXrfKey', () => {
    it('generates a string of length 16', () => {
        const xrfKey = generateXrfKey();
        expect(xrfKey.length).toBe(16);
    });

    it('generates a mix of numbers and letters', () => {
        const xrfKey = generateXrfKey();
        expect(/[a-zA-Z]/.test(xrfKey)).toBe(true);
        expect(/[0-9]/.test(xrfKey)).toBe(true);
    });

    it('generates both uppercase and lowercase letters', () => {
        const xrfKey = generateXrfKey();
        expect(/[a-z]/.test(xrfKey)).toBe(true);
        expect(/[A-Z]/.test(xrfKey)).toBe(true);
    });

    it('generates a different key each time', () => {
        const xrfKey1 = generateXrfKey();
        const xrfKey2 = generateXrfKey();
        expect(xrfKey1).not.toBe(xrfKey2);
    });
});

describe('readCert', () => {
    test('should throw an error if the file does not exist', () => {
        expect(() => readCert('non-existent-file.txt')).toThrow();
    });

    test('should throw an error if the file is not readable', () => {
        console.log('Current directory:', process.cwd());

        const filePath = './src/__tests__/testdata/unreadable-file-1.txt';
        fs.chmodSync(filePath, 0o000); // make the file unreadable
        expect(() => readCert(filePath)).toThrow();
        fs.chmodSync(filePath, 0o644); // make the file readable again
    });

    test('should read the contents of a valid file', () => {
        const filePath = './src/__tests__/testdata/test-file-1.txt';
        const expectedContents = 'Hello, world!';
        const actualContents = readCert(filePath);
        expect(actualContents).toBe(expectedContents);
    });
});

describe('mergeDirFilePath', () => {
    beforeEach(() => {
        // Mock isSea variable
        global.isSea = false;
    });

    afterEach(() => {
        // Restore original isSea value
        delete global.isSea;
    });

    it('should merge path elements when not running as a packaged SEA app', () => {
        const pathElements = ['path', 'to', 'file'];
        const expectedPath = upath.resolve(upath.join(...pathElements));
        expect(mergeDirFilePath(pathElements)).toBe(expectedPath);
    });

    it('should merge absolute paths', () => {
        const pathElements = ['/absolute', 'path', 'to', 'file'];
        const expectedPath = upath.resolve(...pathElements);
        expect(mergeDirFilePath(pathElements)).toBe(expectedPath);
    });

    it('should merge relative paths', () => {
        const pathElements = ['relative', 'path', 'to', 'file'];
        const expectedPath = upath.resolve(upath.join(...pathElements));
        expect(mergeDirFilePath(pathElements)).toBe(expectedPath);
    });

    it('should merge mixed absolute and relative paths', () => {
        const pathElements = ['/absolute', 'relative', 'path', 'to', 'file'];
        const expectedPath = upath.resolve(...pathElements);
        expect(mergeDirFilePath(pathElements)).toBe(expectedPath);
    });

    it('should handle empty path elements array', () => {
        const pathElements = [];
        expect(mergeDirFilePath(pathElements)).toBe('');
    });

    it('should handle null or undefined path elements', () => {
        const pathElements = [null, undefined, 'path', 'to', 'file'];
        expect(() => mergeDirFilePath(pathElements)).toThrowError();
    });
});
