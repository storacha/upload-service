import dotenv from 'dotenv'
import { Schema } from '@ucanto/core'
import { LIT_NETWORK } from '@lit-protocol/constants'

dotenv.config()

const envSchema = Schema.struct({
  WALLET_PK: Schema.text(),
  LIT_NETWORK: Schema.enum([LIT_NETWORK.Custom, LIT_NETWORK.Datil, LIT_NETWORK.DatilDev, LIT_NETWORK.DatilTest]).default(LIT_NETWORK.DatilTest),
  LIT_DEBUG: Schema.boolean().default(false),
})

const processEnv = {
  LIT_DEBUG: process.env.LIT_DEBUG,
  LIT_NETWORK: process.env.LIT_NETWORK,
  WALLET_PK: process.env.WALLET_PK
}

const env = envSchema.from(processEnv)

export default env
