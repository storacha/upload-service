# Patch for `eslint-config-standard-with-typescript`

This patches `eslint-config-standard-with-typescript`, which is now deprecated, to use the correct option for `@typescript-eslint/restrict-plus-operands`. `checkCompoundAssignments` has been replaced with its inverse, `skipCompoundAssignments`.
