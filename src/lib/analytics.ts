export type AnalyticsEvent =
  'add_to_rfq' | 'rfq_start' | 'rfq_submit' | 'search' | 'document_download'

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Fire an analytics event. Never pass personal data (names, emails, free text).
 * `rfq_submit` is the conversion event: GA4 receives it as the recommended `generate_lead` event too.
 */
export function trackEvent(
  event: AnalyticsEvent,
  props: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === 'undefined') return
  try {
    window.plausible?.(event, { props })
    window.gtag?.('event', event, props)
    if (event === 'rfq_submit') window.gtag?.('event', 'generate_lead', props)
  } catch {
    // analytics must never break the page
  }
}
