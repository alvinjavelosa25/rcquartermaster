import Link from 'next/link'

interface Props {
  page: number
  totalPages: number
  /** Build the URL for a page number, preserving current filters. */
  hrefFor: (page: number) => string
}

/** Accessible pagination with plain links (works without JavaScript). */
export function Pagination({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const item =
    'target inline-flex items-center justify-center rounded-md border border-slate-400 px-3 py-2 font-semibold no-underline'
  return (
    <nav aria-label="Pagination" className="mt-8">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 && (
          <li>
            <Link href={hrefFor(page - 1)} rel="prev" className={item}>
              <span aria-hidden="true">‹ </span>Previous<span className="sr-only"> page</span>
            </Link>
          </li>
        )}
        {visible.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - visible[i - 1]! > 1 && <span aria-hidden="true">…</span>}
            {p === page ? (
              <span
                aria-current="page"
                className={`${item} border-brand-800 bg-brand-800 text-white`}
              >
                <span className="sr-only">Page </span>
                {p}
              </span>
            ) : (
              <Link href={hrefFor(p)} className={item}>
                <span className="sr-only">Page </span>
                {p}
              </Link>
            )}
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link href={hrefFor(page + 1)} rel="next" className={item}>
              Next<span className="sr-only"> page</span>
              <span aria-hidden="true"> ›</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
