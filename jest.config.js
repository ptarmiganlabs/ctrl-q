import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.test.env') });

/** @type {import('jest').Config} */
const config = {
    // Automatically clear mock calls, instances, contexts and results before every test
    clearMocks: true,

    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: true,

    // The directory where Jest should output its coverage files
    coverageDirectory: 'coverage',

    // An array of regexp pattern strings used to skip coverage collection
    coveragePathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],

    // Indicates which provider should be used to instrument code for coverage
    coverageProvider: 'v8',

    // Show test progress
    verbose: true,

    // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
    moduleNameMapper: {
        '^node:sea$': '<rootDir>/src/__mocks__/node/sea.js',
    },

    // Use this configuration option to add custom reporters to Jest
    reporters: ['default', ['jest-junit', { outputDirectory: './test-results' }]],

    // The root directory that Jest should scan for tests and modules within
    roots: ['<rootDir>/src/__tests__'],

    // The paths to modules that run some code to configure or set up the testing framework before each test
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],

    // The number of seconds after which a test is considered as slow and reported as such in the results.
    slowTestThreshold: 5,

    // The test environment that will be used for testing
    testEnvironment: 'jest-environment-node',

    // Adds a location field to test results
    testLocationInResults: true,

    // The glob patterns Jest uses to detect test files
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],

    // Ignore node_modules
    testPathIgnorePatterns: ['/node_modules/'],

    // Whether to use watchman for file crawling
    watchman: true,
};

export default config;
