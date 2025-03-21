module.exports = {
  extends: ['./node_modules/hd-scripts/eslint/ts.js'],
  parserOptions: {
    projectService: true,
  },
  env: {},
  globals: {},
  rules: {
    'unicorn/prefer-number-properties': 'off',
    'unicorn/no-negated-condition': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prefer-export-from': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/expiring-todo-comments': 'off',
    'unicorn/no-nested-ternary': 'off',
    'jsdoc/require-param': 'off',
    'jsdoc/newline-after-description': 'off',
    'jsdoc/require-param-type': 'off',
    'import/extensions': 'off',
    'comma-dangle': 'off',
    'multiline-ternary': 'off',
    '@typescript-eslint/comma-dangle': 'off',
    '@typescript-eslint/space-before-function-paren': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/restrict-plus-operands': [
      'error',
      { checkCompoundAssignments: true },
    ],
  },
  ignorePatterns: ['dist/', 'vitest.config.ts'],
}
