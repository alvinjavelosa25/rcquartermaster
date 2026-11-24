import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClass } from '@/components/ui'
import { REFERENCE_RE } from '@/lib/rfq/reference'
import { getPublicSettings } from '@/lib/data/settings'

export const metadata: Metadata = {
  title: 'Request received',
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ ref?: string }> }

export default async function ThankYouPage({ searchParams }: Props) {
  const { ref } = await searchParams
  const settings = await getPublicSettings()
  const reference = ref && REFERENCE_RE.test(ref) ? ref : null
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold" tabIndex={-1} id="thanks-heading">
        Thank you. We received your request.
      </h1>
      {reference ? (
        <>
          <p className="mt-4 text-lg">Your reference number is:</p>
          <p className="mt-1 text-3xl font-bold" data-testid="reference">
            {reference}
          </p>
          <p className="mt-4">
            A confirmation has been sent to the email address you provided. Please quote this
            reference in any correspondence.
          </p>
        </>
      ) : (
        <p className="mt-4 text-lg">
          A confirmation will be sent to the email address you provided.
        </p>
      )}
      <p className="mt-4">{settings.responseTime}</p>
      {(settings.phone || settings.email) && (
        <p className="mt-2">
          Questions? {settings.phone && <>Call {settings.phone}</>}
          {settings.phone && settings.email && ' or '}
          {settings.email && <>email {settings.email}</>}.
        </p>
      )}
      <p className="mt-8 flex flex-wrap gap-4">
        <Link href="/categories" className={buttonClass('primary')}>
          Continue browsing
        </Link>
        <Link href="/" className={buttonClass('secondary')}>
          Back to home
        </Link>
      </p>
    </div>
  )
}
