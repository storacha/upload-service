import { Schema } from '@ucanto/core'
import { LIT_NETWORK } from '@lit-protocol/constants'

// Only conditionally load dotenv in Node.js environments to prevent browser bundling issues
if (
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  process.versions
) {
  try {
    // Use eval to prevent webpack from bundling dotenv in browser builds
    const dotenv = eval('require')('dotenv')
    dotenv.config()
  } catch (error) {
    // dotenv not available or we're in a browser-like environment, continue with defaults
  }
}

const envSchema = Schema.struct({
  LIT_NETWORK: Schema.enum([
    LIT_NETWORK.Custom,
    LIT_NETWORK.Datil,
    LIT_NETWORK.DatilDev,
    LIT_NETWORK.DatilTest,
  ]).default(LIT_NETWORK.DatilTest),
  LIT_DEBUG: Schema.boolean().default(false),
})

// Safe environment variable access
const processEnv = {
  LIT_DEBUG:
    typeof process !== 'undefined' && process.env
      ? process.env.LIT_DEBUG
      : undefined,
  LIT_NETWORK:
    typeof process !== 'undefined' && process.env
      ? process.env.LIT_NETWORK
      : undefined,
}

const env = envSchema.from(processEnv)

export default env
