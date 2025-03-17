import { z } from 'zod'
import dotenv from 'dotenv'
import { LIT_NETWORK } from '@lit-protocol/constants'

dotenv.config()

const envSchema = z.object({
  LIT_NETWORK: z
    .enum([LIT_NETWORK.Custom, LIT_NETWORK.Datil, LIT_NETWORK.DatilDev, LIT_NETWORK.DatilTest])
    .default(LIT_NETWORK.DatilTest),
  LIT_DEBUG: z.boolean().optional(),
  WALLET_PK: z.string(),
})

// validate `process.env` against our schema
const env = envSchema.parse(process.env)

export default env
