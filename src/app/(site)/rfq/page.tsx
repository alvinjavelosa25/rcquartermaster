import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { RfqForm } from '@/components/rfq/RfqForm'
import { getEnv } from '@/env'
import { getPublicSettings } from '@/lib/data/settings'

export const metadata: Metadata = {
  title: 'Request for quote',
  description: 'Submit a request for quote for products or services. We respond with a quotation.',
  alternates: { canonical: '/rfq' },
}

type Props = { searchParams: Promise<{ alt?: string }> }

export default async function RfqPage({ searchParams }: Props) {
  const { alt } = await searchParams
  const env = getEnv()
  const settings = await getPublicSettings()
  const prefill = alt && /^[A-Za-z0-9._-]{1,64}$/.test(alt) ? `Please suggest an alternative to SKU ${alt}.` : undefined

  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Request for quote' }]} />
      <h1 className="mt-4 text-3xl font-bold">Request for quote</h1>
      <p className="mt-3 max-w-3xl text-lg">
        Tell us what you need. We will reply with a quotation. {settings.responseTime}
      </p>
      <div className="mt-8 max-w-3xl">
        <RfqForm
          turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
          limits={{ maxFiles: env.RFQ_MAX_FILES, maxFileMb: env.RFQ_MAX_FILE_MB, maxTotalMb: env.RFQ_MAX_TOTAL_MB }}
          contact={{ phone: settings.phone, email: settings.email }}
          prefillDescription={prefill}
        />
      </div>
    </>
  )
}
