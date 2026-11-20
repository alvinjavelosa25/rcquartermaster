import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ProductView, productMetadata } from '@/components/ProductView'
import { getProductDraftBySlug } from '@/lib/data/catalogue'
import { getPayloadClient } from '@/lib/payload'
import { userCanManageCatalogue } from '@/access'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

/** Staff-only preview of a product including unpublished changes. Linked from the admin "Preview" button. */
async function loadForStaff(slug: string) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  if (!userCanManageCatalogue(user)) return null
  return getProductDraftBySlug(slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadForStaff((await params).slug)
  return { ...(product ? productMetadata(product) : {}), robots: { index: false, follow: false } }
}

export default async function ProductPreviewPage({ params }: Props) {
  const product = await loadForStaff((await params).slug)
  if (!product) notFound()
  return <ProductView product={product} preview />
}
