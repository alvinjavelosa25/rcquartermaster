'use client'

import Script from 'next/script'
import { useSyncExternalStore } from 'react'

const CONSENT_KEY = 'rcq.analytics-consent'
type Consent = 'granted' | 'denied' | 'unset' | 'server'

const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
function getConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : 'unset'
  } catch {
    return 'unset'
  }
}
const getServerConsent = (): Consent => 'server'

function choose(value: 'granted' | 'denied') {
  try {
    window.localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // storage unavailable: the choice applies until the page is reloaded
  }
  for (const l of listeners) l()
}

/**
 * Plausible (cookieless) loads immediately when configured. GA4 loads only after the visitor accepts,
 * because it sets cookies. With neither configured this renders nothing.
 */
export function Analytics({
  plausibleDomain,
  ga4Id,
}: {
  plausibleDomain?: string
  ga4Id?: string
}) {
  const consent = useSyncExternalStore(subscribe, getConsent, getServerConsent)

  return (
    <>
      {plausibleDomain && (
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      )}
      {ga4Id && consent === 'granted' && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
          >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(ga4Id)},{anonymize_ip:true});`}</Script>
        </>
      )}
      {ga4Id && consent === 'unset' && (
        <section
          aria-label="Analytics cookies"
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-brand-800 bg-white p-4 shadow-lg"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
            <p className="max-w-3xl text-sm">
              We would like to use Google Analytics cookies to understand how the site is used. No
              personal details from your request are shared.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => choose('granted')}
                className="target rounded-md bg-brand-800 px-4 py-2 font-semibold text-white"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => choose('denied')}
                className="target rounded-md border-2 border-brand-800 px-4 py-2 font-semibold text-brand-800"
              >
                Decline
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
