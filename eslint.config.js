// WIP: Collecting config here to port to new flat config.

const configForNonUI = {
  extends: ['@storacha/eslint-config'],
  env: {
    es2022: true,
    mocha: true,
    browser: true,
    node: true,
  },
  ignorePatterns: [
    'dist',
    'docs',
    'coverage',
    // JS file matchiing TS files are being ignored
    'src/types.js',
  ],
  globals: {
    // For upload-client
    AsyncIterator: 'readonly',
  },
  rules: {
    // For capabilities, filecoin-api, upload-api
    // "@typescript-eslint/no-empty-object-type": "off"
  },
}

const configForUI = {
  extends: [
    '@storacha/ui-eslint-config',
    // For @storacha/ui-react
    // 'plugin:react-hooks/recommended',
  ],
}
