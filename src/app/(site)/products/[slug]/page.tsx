import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductView, productMetadata } from '@/components/ProductView'
import { getProductBySlug } from '@/lib/data/catalogue'

type Props = { params: Promise<{ slug: string }> }

// Rendered on first request, then cached and refreshed on publish/unpublish (see revalidateCatalogue).
export const dynamicParams = true
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug)
  return product ? productMetadata(product) : {}
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug)
  if (!product) notFound()
  return <ProductView product={product} />
}
