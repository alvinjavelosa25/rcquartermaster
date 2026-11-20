'use client'

import { trackEvent } from '@/lib/analytics'

export function DocumentLink({ href, children, type }: { href: string; children: React.ReactNode; type: string }) {
  return (
    <a href={href} onClick={() => trackEvent('document_download', { type })}>
      {children}
    </a>
  )
}
