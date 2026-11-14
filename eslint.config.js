import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

// export default [...compat.extends("airbnb-base", "prettier"), {
export default [
    // Vendored third-party bundles are not linted
    { ignores: ['src/static/vendor/**', 'src/static/*.min.js'] },
    ...compat.extends('prettier'),
    {
        plugins: {
            prettier,
        },

        languageOptions: {
            globals: {
                ...globals.node,
            },

            ecmaVersion: 2022,
            sourceType: 'module',
        },

        rules: {
            'prettier/prettier': 'error',
        },
    },
    {
        // Browser code of the task-gantt web page; ECharts is loaded as a global by the page
        files: ['src/static/task-gantt/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                echarts: 'readonly',
            },
        },
    },
];
