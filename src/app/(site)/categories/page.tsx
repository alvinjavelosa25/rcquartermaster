import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { childrenOf, getCategories } from '@/lib/data/catalogue'

export const metadata: Metadata = {
  title: 'Product categories',
  description: 'Browse facility supplies and equipment by category.',
  alternates: { canonical: '/categories' },
}

export default async function CategoriesPage() {
  const all = await getCategories()
  const top = childrenOf(all, null)
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Categories' }]} />
      <h1 className="mt-4 text-3xl font-bold">Product categories</h1>
      {top.length === 0 ? (
        <p className="mt-6">
          No categories are published yet.{' '}
          <Link href="/rfq">Submit a general request for quote</Link>.
        </p>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((c) => {
            const subs = childrenOf(all, c.id)
            return (
              <li key={c.id} className="rounded-lg border border-line bg-white">
                {c.image && (
                  <Image
                    src={c.image.url}
                    alt=""
                    width={640}
                    height={360}
                    className="aspect-video w-full rounded-t-lg object-cover"
                  />
                )}
                <div className="p-4">
                  <h2 className="text-xl font-bold">
                    <Link href={`/categories/${c.path}`}>{c.name}</Link>
                  </h2>
                  {c.description && <p className="mt-1 text-sm">{c.description}</p>}
                  {subs.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {subs.map((s) => (
                        <li key={s.id}>
                          <Link href={`/categories/${s.path}`}>{s.name}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
