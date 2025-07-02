import dotenv from 'dotenv'
import { Schema } from '@ucanto/core'
import { LIT_NETWORK } from '@lit-protocol/constants'

// Only load env variables if running in node
if (typeof window === 'undefined') {
  dotenv.config()
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

const processEnv = {
  LIT_DEBUG: process.env.LIT_DEBUG,
  LIT_NETWORK: process.env.LIT_NETWORK,
}

const env = envSchema.from(processEnv)

export default env
