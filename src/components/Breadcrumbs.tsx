import Link from 'next/link'

export interface Crumb {
  name: string
  href?: string
}

/** Accessible breadcrumb trail. The last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.name}-${i}`} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link href={item.href} className="inline-block py-1">
                  {item.name}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.name}</span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** BreadcrumbList structured data for the same trail. */
export function breadcrumbJsonLd(items: Crumb[], baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.href ? { item: `${baseUrl}${item.href}` } : {}),
    })),
  }
}
