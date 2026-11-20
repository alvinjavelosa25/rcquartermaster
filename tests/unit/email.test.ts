import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  renderBuyerEmail,
  renderSalesEmail,
  resolveRecipients,
  singleLine,
  type RfqEmailData,
} from '@/lib/mail/templates'

const base: RfqEmailData = {
  reference: 'RCQ-202611-ABCDEF',
  buyerName: 'Pat <script>alert(1)</script>',
  organisation: 'VA "Medical" Center',
  email: 'pat@example.gov',
  phone: '301-555-0100',
  items: [{ sku: 'A-1', name: '<b>Gloves</b>', quantity: 5, unitOfMeasure: 'BX' }],
  attachments: [{ name: 'spec<1>.pdf', size: 2048, status: 'clean' }],
  createdAt: '2026-11-20T10:00:00.000Z',
}

describe('[UT-034] email templates', () => {
  it('escapes HTML in every interpolated field', () => {
    const { html } = renderSalesEmail(base, 'https://example.com/admin/collections/rfqs/1')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>Gloves</b>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('spec&lt;1&gt;.pdf')
    const buyer = renderBuyerEmail(base, { companyName: 'RC <Quartermaster>' })
    expect(buyer.html).not.toContain('<Quartermaster>')
  })

  it('strips line breaks from the subject (header injection)', () => {
    const { subject } = renderSalesEmail(
      { ...base, organisation: 'X\r\nBcc: attacker@example.com' },
      'https://x',
    )
    expect(subject).not.toMatch(/[\r\n]/)
    expect(singleLine('a\nb\u2028c')).toBe('a b c')
  })

  it('includes the reference in both emails and links attachments without attaching them', () => {
    const sales = renderSalesEmail(base, 'https://example.com/admin')
    expect(sales.subject).toContain(base.reference)
    expect(sales.html).toContain('Sign in to the admin to download attachments')
    expect(sales.replyTo).toBe('pat@example.gov')
    expect(renderBuyerEmail(base, { companyName: 'RCQ' }).subject).toContain(base.reference)
  })

  it('escapeHtml handles quotes and ampersands', () => {
    expect(escapeHtml(`"a" & 'b'`)).toBe('&quot;a&quot; &amp; &#39;b&#39;')
  })
})

describe('[FR-043] recipient resolution', () => {
  it('prefers admin settings over the env default', () => {
    expect(resolveRecipients(['A@x.com', 'b@x.com'], 'env@x.com')).toEqual(['a@x.com', 'b@x.com'])
  })
  it('falls back to env when settings are empty', () => {
    expect(resolveRecipients([], 'one@x.com, two@x.com')).toEqual(['one@x.com', 'two@x.com'])
    expect(resolveRecipients(undefined, undefined)).toEqual([])
  })
  it('drops invalid and duplicate addresses', () => {
    expect(
      resolveRecipients(['bad', 'a@x.com', 'A@X.com', 'x@y', 'c@x.com;d@x.com'], undefined),
    ).toEqual(['a@x.com'])
  })
})
