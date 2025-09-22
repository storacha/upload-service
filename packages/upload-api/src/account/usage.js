import { provide as provideGet } from './usage/get.js'

/** @param {import('../types.js').AccountUsageServiceContext} context */
export const createService = (context) => ({
  get: provideGet(context),
})
