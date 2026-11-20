import type { MetadataRoute } from 'next'
import { getEnv, siteUrl } from '@/env'

export default function robots(): MetadataRoute.Robots {
  // Preview and development deployments must never be indexed.
  if (getEnv().SITE_ENV_RESOLVED !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      // Images and published spec sheets are served from /api; keep them crawlable, block everything else there.
      allow: ['/', '/api/media/', '/api/documents/'],
      disallow: ['/admin', '/api/', '/search', '/rfq/thank-you'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
