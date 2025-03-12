const config = require('eslint-config-standard-with-typescript')

const restrictPlusOperandsRule =
  config.overrides?.[0]?.rules?.['@typescript-eslint/restrict-plus-operands']

if (!restrictPlusOperandsRule) {
  throw new Error(
    'Could not find @typescript-eslint/restrict-plus-operands rule in eslint-config-standard-with-typescript.'
  )
}

restrictPlusOperandsRule[1] = { skipCompoundAssignments: false }

module.exports = config
