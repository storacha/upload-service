// Much of this has been copied from `hd-scripts` without much scrutiny, to
// avoid holding on to an old dependency. These rules could use a review.

module.exports = {
  extends: [
    'standard',
    'plugin:unicorn/recommended',
    'standard-with-typescript',
  ],
  plugins: ['etc', 'no-only-tests', 'jsdoc', 'unicorn'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
    projectService: true,
  },
  env: {
    es2022: true,
    browser: true,
    node: true,
  },
  globals: {},
  rules: {
    strict: ['error', 'safe'],
    curly: 'error',
    'block-scoped-var': 'error',
    complexity: 'warn',
    'default-case': 'error',
    'guard-for-in': 'warn',
    'linebreak-style': ['warn', 'unix'],
    'no-alert': 'error',
    'no-console': 'error',
    'no-continue': 'warn',
    'no-div-regex': 'error',
    'no-empty': 'warn',
    'no-extra-semi': 'error',
    'no-implicit-coercion': 'error',
    'no-loop-func': 'error',
    'no-nested-ternary': 'warn',
    'no-script-url': 'error',
    'no-warning-comments': 'warn',
    'max-nested-callbacks': ['error', 4],
    'max-depth': ['error', 4],
    'require-yield': 'error',
    // plugins
    'no-only-tests/no-only-tests': 'error',
    'jsdoc/check-alignment': 'error',
    'jsdoc/check-examples': 'off',
    'jsdoc/check-indentation': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-syntax': 'error',
    'jsdoc/check-tag-names': [
      'error',
      { definedTags: ['internal', 'packageDocumentation'] },
    ],
    'jsdoc/check-types': 'error',
    'jsdoc/implements-on-classes': 'error',
    'jsdoc/match-description': 'off',
    'jsdoc/no-types': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/require-description': 'off',
    'jsdoc/require-description-complete-sentence': 'off',
    'jsdoc/require-example': 'off',
    'jsdoc/require-hyphen-before-param-description': 'error',
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-param-name': 'error',
    // Note: Do not require @returns because TS often can infer return types and
    // in many such cases it's not worth it.
    'jsdoc/require-returns': 'off',
    'jsdoc/require-returns-check': 'error',
    'jsdoc/require-returns-description': 'off',
    // Note: At the moment type parser used by eslint-plugin-jsdoc does not
    // parse various forms correctly. For now warn on invalid type froms,
    // should revisit once following issue is fixed:
    // https://github.com/jsdoctypeparser/jsdoctypeparser/issues/50
    'jsdoc/valid-types': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'unicorn/prevent-abbreviations': 'off',

    'unicorn/prefer-number-properties': 'off',
    'unicorn/no-negated-condition': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prefer-export-from': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/expiring-todo-comments': 'off',
    'unicorn/no-nested-ternary': 'off',
    'comma-dangle': 'off',
    'multiline-ternary': 'off',
    '@typescript-eslint/comma-dangle': 'off',
    '@typescript-eslint/space-before-function-paren': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/restrict-plus-operands': [
      'error',
      { skipCompoundAssignments: false },
    ],
  },
  ignorePatterns: ['dist/', 'vitest.config.ts'],
  settings: {
    jsdoc: {
      mode: 'typescript',
      tagNamePreference: {
        augments: {
          message:
            '@extends is to be used over @augments as it is more evocative of classes than @augments',
          replacement: 'extends',
        },
      },
      structuredTags: {
        extends: {
          type: true,
        },
      },
    },
  },
}
