import { readFileSync } from 'node:fs'
import { withPayload } from '@payloadcms/next/withPayload'
import { buildSecurityHeaders } from './src/lib/security/headers.mjs'

const redirectMap = JSON.parse(
  readFileSync(new URL('./src/config/redirects.json', import.meta.url), 'utf8'),
)

const isDev = process.env.NODE_ENV !== 'production'
const siteEnv =
  process.env.SITE_ENV ?? process.env.VERCEL_ENV ?? (isDev ? 'development' : 'production')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  experimental: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({
          isDev,
          s3Endpoint: process.env.S3_ENDPOINT,
          plausible: Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
          ga4: Boolean(process.env.NEXT_PUBLIC_GA4_ID),
          indexable: siteEnv === 'production',
        }),
      },
    ]
  },
  async redirects() {
    return redirectMap.redirects.map((r) => ({
      source: r.source,
      destination: r.destination,
      statusCode: 301,
    }))
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
