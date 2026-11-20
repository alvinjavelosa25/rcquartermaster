import type { MetadataRoute } from 'next'
import { siteUrl } from '@/env'
import { getSitemapEntries } from '@/lib/data/catalogue'

const STATIC_PATHS = ['/', '/categories', '/rfq', '/contact']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const dynamic = await getSitemapEntries()
  const seen = new Set<string>()
  const entries: MetadataRoute.Sitemap = []
  for (const path of [...STATIC_PATHS, ...dynamic.map((d) => d.path)]) {
    if (seen.has(path)) continue
    seen.add(path)
    const found = dynamic.find((d) => d.path === path)
    entries.push({ url: `${base}${path === '/' ? '' : path}`, ...(found?.lastModified ? { lastModified: found.lastModified } : {}) })
  }
  return entries
}
