export interface RfqEmailData {
  reference: string
  buyerName: string
  organisation: string
  facility?: string | null
  buyerRole?: string | null
  email: string
  phone: string
  neededBy?: string | null
  solicitationNumber?: string | null
  deliveryDetails?: string | null
  specialInstructions?: string | null
  generalDescription?: string | null
  items: { sku?: string | null; name: string; quantity: number; unitOfMeasure?: string | null }[]
  attachments: { name: string; size: number; status: string }[]
  createdAt: string
}

export interface BuyerContactInfo {
  companyName: string
  phone?: string | null
  email?: string | null
  responseTime?: string | null
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Header values must not contain line breaks (header injection). */
export function singleLine(value: unknown, max = 200): string {
  return String(value ?? '')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .trim()
    .slice(0, max)
}

const fmtBytes = (n: number) =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`

const row = (label: string, value: unknown) =>
  value
    ? `<tr><th align="left" style="padding:4px 12px 4px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
    : ''

const textRow = (label: string, value: unknown) => (value ? `${label}: ${String(value)}` : '')

function itemsHtml(items: RfqEmailData['items']): string {
  if (!items.length) return ''
  const body = items
    .map(
      (i) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(i.sku || 'Not in catalogue')}</td><td style="padding:4px 12px 4px 0">${escapeHtml(i.name)}</td><td style="padding:4px 0" align="right">${escapeHtml(i.quantity)}${i.unitOfMeasure ? ` ${escapeHtml(i.unitOfMeasure)}` : ''}</td></tr>`,
    )
    .join('')
  return `<h2 style="font-size:16px">Requested items</h2><table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><th align="left" style="padding:4px 12px 4px 0">SKU</th><th align="left" style="padding:4px 12px 4px 0">Item</th><th align="right" style="padding:4px 0">Quantity</th></tr>${body}</table>`
}

function itemsText(items: RfqEmailData['items']): string {
  return items
    .map(
      (i) =>
        `- ${i.sku || 'Not in catalogue'} | ${i.name} | ${i.quantity}${i.unitOfMeasure ? ` ${i.unitOfMeasure}` : ''}`,
    )
    .join('\n')
}

/** Notification for the sales inbox. Attachments are listed, never attached: staff download them after login. */
export function renderSalesEmail(rfq: RfqEmailData, adminUrl: string) {
  const subject = singleLine(`New RFQ ${rfq.reference} from ${rfq.organisation}`)
  const attachments = rfq.attachments.length
    ? `<h2 style="font-size:16px">Attachments (${rfq.attachments.length})</h2><ul>${rfq.attachments
        .map(
          (a) =>
            `<li>${escapeHtml(a.name)} (${fmtBytes(a.size)}), scan: ${escapeHtml(a.status)}</li>`,
        )
        .join('')}</ul><p>Sign in to the admin to download attachments.</p>`
    : ''
  const html = `<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
<h1 style="font-size:20px">New request for quote ${escapeHtml(rfq.reference)}</h1>
<p><a href="${escapeHtml(adminUrl)}">Open in the admin</a></p>
<table cellpadding="0" cellspacing="0">
${row('Submitted', rfq.createdAt)}${row('Name', rfq.buyerName)}${row('Organisation', rfq.organisation)}${row('Facility / department', rfq.facility)}${row('Role', rfq.buyerRole)}${row('Email', rfq.email)}${row('Phone', rfq.phone)}${row('Needed by', rfq.neededBy)}${row('Solicitation / contract no.', rfq.solicitationNumber)}${row('Delivery details', rfq.deliveryDetails)}${row('Special instructions', rfq.specialInstructions)}${row('Request description', rfq.generalDescription)}
</table>
${itemsHtml(rfq.items)}${attachments}
</body></html>`
  const text = [
    `New request for quote ${rfq.reference}`,
    `Open in the admin: ${adminUrl}`,
    '',
    textRow('Submitted', rfq.createdAt),
    textRow('Name', rfq.buyerName),
    textRow('Organisation', rfq.organisation),
    textRow('Facility / department', rfq.facility),
    textRow('Role', rfq.buyerRole),
    textRow('Email', rfq.email),
    textRow('Phone', rfq.phone),
    textRow('Needed by', rfq.neededBy),
    textRow('Solicitation / contract no.', rfq.solicitationNumber),
    textRow('Delivery details', rfq.deliveryDetails),
    textRow('Special instructions', rfq.specialInstructions),
    textRow('Request description', rfq.generalDescription),
    '',
    rfq.items.length ? `Requested items:\n${itemsText(rfq.items)}` : '',
    rfq.attachments.length
      ? `\nAttachments: ${rfq.attachments.map((a) => `${a.name} (${fmtBytes(a.size)}, scan: ${a.status})`).join('; ')}`
      : '',
  ]
    .filter((l) => l !== '')
    .join('\n')
  return { subject, html, text, replyTo: rfq.email }
}

/** Confirmation for the buyer. */
export function renderBuyerEmail(rfq: RfqEmailData, contact: BuyerContactInfo) {
  const subject = singleLine(`We received your request for quote ${rfq.reference}`)
  const contactLine = [contact.phone, contact.email].filter(Boolean).join(' or ')
  const html = `<!doctype html><html lang="en"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5">
<h1 style="font-size:20px">Thank you, ${escapeHtml(rfq.buyerName)}</h1>
<p>${escapeHtml(contact.companyName)} received your request for quote. Your reference number is:</p>
<p style="font-size:22px;font-weight:bold">${escapeHtml(rfq.reference)}</p>
<p>${escapeHtml(contact.responseTime || 'We will respond as soon as possible.')} Please quote this reference in any correspondence${contactLine ? `: ${escapeHtml(contactLine)}` : ''}.</p>
${itemsHtml(rfq.items)}
${rfq.generalDescription ? `<h2 style="font-size:16px">Your description</h2><p>${escapeHtml(rfq.generalDescription).replace(/\n/g, '<br>')}</p>` : ''}
${rfq.attachments.length ? `<p>Attachments received: ${rfq.attachments.map((a) => escapeHtml(a.name)).join(', ')}</p>` : ''}
<p style="color:#555;font-size:13px">This request is a request for a quotation only. It is not an order. Do not send controlled or classified information by this form.</p>
</body></html>`
  const text = [
    `Thank you, ${rfq.buyerName}.`,
    `${contact.companyName} received your request for quote.`,
    `Reference number: ${rfq.reference}`,
    '',
    contact.responseTime || 'We will respond as soon as possible.',
    contactLine ? `Contact: ${contactLine}` : '',
    '',
    rfq.items.length ? `Items:\n${itemsText(rfq.items)}` : '',
    rfq.generalDescription ? `Description: ${rfq.generalDescription}` : '',
    '',
    'This request is a request for a quotation only. It is not an order.',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n')
  return { subject, html, text }
}

/** Merge settings recipients with the env default; drop invalid and duplicate addresses. */
export function resolveRecipients(
  fromSettings: string[] | undefined,
  envList: string | undefined,
): string[] {
  const source = fromSettings && fromSettings.length > 0 ? fromSettings : (envList ?? '').split(',')
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of source) {
    const e = raw.trim().toLowerCase()
    if (/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e) && !seen.has(e)) {
      seen.add(e)
      out.push(e)
    }
  }
  return out
}
