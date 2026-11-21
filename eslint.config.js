const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

module.exports = defineConfig([
  globalIgnores([
    'node_modules/*',
    '.expo/*',
    'dist/*',
    'web-build/*',
    '/android',
    '/ios',
    'TODO/*',
    '*.tsbuildinfo',
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: ['babel.config.js', 'app.config.ts', 'jest.config.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
]);
