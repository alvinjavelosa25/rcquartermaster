import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

/** Shared Payload (Local API) client. Cached across hot reloads and requests. */
export async function getPayloadClient(): Promise<Payload> {
  return getPayload({ config })
}

/** True while building without a database (CI). Data helpers then return empty results. */
export const skipDbAtBuild = (): boolean =>
  process.env.SKIP_BUILD_DB === 'true' && process.env.NEXT_PHASE === 'phase-production-build'
