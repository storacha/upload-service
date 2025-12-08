import { NodeSDK } from '@opentelemetry/sdk-node'
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { getPkg } from './lib.js'

const defaultTracesEndpoint = 'https://telemetry.storacha.network:443'

export const setup = () => {
  if (!process.env.STORACHA_TRACING_ENABLED) return
  const pkg = getPkg()

  const ratioArg = Number.parseFloat(process.env.STORACHA_TRACES_SAMPLER_ARG || '1')
  const ratio = Math.min(1, Math.max(0, ratioArg))

  const sampler = new TraceIdRatioBasedSampler(ratio)
  const endpoint = process.env.STORACHA_TRACES_ENDPOINT ?? defaultTracesEndpoint
  const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: pkg.name,
      [ATTR_SERVICE_VERSION]: pkg.version,
    }),
    sampler,
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()]
  })
  sdk.start()

  process.on('beforeExit', async function beforeExit () {
    try {
      await sdk.shutdown()
    } catch (err) {
      console.error('terminating telemetry', err)
    } finally {
      process.off('beforeExit', beforeExit)
    }
  })
}
