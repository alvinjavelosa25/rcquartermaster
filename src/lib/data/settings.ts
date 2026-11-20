import type { Payload } from 'payload'
import { unstable_cache } from 'next/cache'
import { CATALOGUE_CACHE_TAG } from '@/lib/constants'
import { getPayloadClient, skipDbAtBuild } from '@/lib/payload'

/** Public-safe subset of the site settings. Never include recipients or retention here. */
export interface PublicSettings {
  companyName: string
  legalName: string
  tagline: string
  homeHeadline: string
  homeSubheadline: string
  phone: string
  email: string
  addressLines: string[]
  hours: string
  responseTime: string
  identifiers: { label: string; value: string }[]
  certifications: { label: string; description: string }[]
  capabilityStatementUrl: string | null
}

export const DEFAULT_SETTINGS: PublicSettings = {
  companyName: 'RC Quartermaster LLC',
  legalName: '',
  tagline: 'Facility supplies, equipment and services for government and healthcare buyers.',
  homeHeadline: 'Find approved supplies. Request a quote.',
  homeSubheadline:
    'Browse approved products for VA medical centres, federal facilities and healthcare systems, review specifications and submit one request for quote.',
  phone: '',
  email: '',
  addressLines: [],
  hours: '',
  responseTime: 'We respond to requests within 1 business day.',
  identifiers: [],
  certifications: [],
  capabilityStatementUrl: null,
}

/** Full settings including private fields. Server-side only; uses override access. */
export async function getPrivateSettings(payload: Payload) {
  return payload.findGlobal({ slug: 'site-settings', depth: 1, overrideAccess: true })
}

async function loadPublicSettings(): Promise<PublicSettings> {
  if (skipDbAtBuild()) return DEFAULT_SETTINGS
  const payload = await getPayloadClient()
  const s = await getPrivateSettings(payload)
  const doc = typeof s.capabilityStatement === 'object' ? s.capabilityStatement : null
  return {
    companyName: s.companyName || DEFAULT_SETTINGS.companyName,
    legalName: s.legalName ?? '',
    tagline: s.tagline || DEFAULT_SETTINGS.tagline,
    homeHeadline: s.homeHeadline || DEFAULT_SETTINGS.homeHeadline,
    homeSubheadline: s.homeSubheadline || DEFAULT_SETTINGS.homeSubheadline,
    phone: s.phone ?? '',
    email: s.email ?? '',
    addressLines: (s.addressLines ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
    hours: s.hours ?? '',
    responseTime: s.responseTime ?? '',
    // Only identifiers the client has marked as verified are ever shown.
    identifiers: (s.identifiers ?? []).filter((i) => i.verified).map((i) => ({ label: i.label, value: i.value })),
    certifications: (s.certifications ?? [])
      .filter((c) => c.verified)
      .map((c) => ({ label: c.label, description: c.description ?? '' })),
    capabilityStatementUrl: doc && doc.status === 'published' && doc.filename ? `/api/documents/file/${encodeURIComponent(doc.filename)}` : null,
  }
}

export const getPublicSettings = unstable_cache(loadPublicSettings, ['public-settings'], {
  tags: [CATALOGUE_CACHE_TAG],
  revalidate: 3600,
})
