const { withNx } = require('@nx/next')
const { withSentryConfig } = require('@sentry/nextjs')

const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, configFile, stripPrefix, urlPrefix, include, ignore
  org: process.env.NEXT_PUBLIC_SENTRY_ORG,
  project: process.env.NEXT_PUBLIC_SENTRY_PROJECT,
  // Sentry webpack plugin options here
  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
}

/**
 * Sentry config for Next.js + Nx compatibility
 * See: https://github.com/getsentry/sentry-javascript/issues/8621#issuecomment-2034926343
 */
const sentryOptions = {
  // An auth token is required for uploading source maps.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,
  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },
  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
}

/** @type {import('next').NextConfig & import('@nx/next/plugins/with-nx').WithNxOptions} */
const nextConfig = {
  nx: {
    // Set this to true if you would like to to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    '@ipld/dag-ucan',
    '@ipld/unixfs',
  ],
}

/** @type {(phase: string) => Promise<import('next').NextConfig & import('@nx/next/plugins/with-nx').WithNxOptions & import('@sentry/nextjs').WithSentryConfig>} */
const withCustom = async (phase) => {
  const nxConfig = withNx(nextConfig)
  const config = await nxConfig(phase)
  return withSentryConfig(config,  { ...sentryWebpackPluginOptions, ...sentryOptions })
}

module.exports = withCustom