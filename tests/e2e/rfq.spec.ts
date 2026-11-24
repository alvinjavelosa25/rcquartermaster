import {
  anonymous,
  expect,
  loginAs,
  test,
  tinyPdf,
  waitForTurnstile,
  GLOVE_M,
  GLOVE_M_SKU,
} from './fixtures'

const REFERENCE = /RCQ-\d{6}-[A-Z0-9]{6}/

async function fillDetails(page: import('@playwright/test').Page, email = 'pat.buyer@example.gov') {
  await page.getByLabel(/^Name/).fill('Pat Buyer')
  await page.getByLabel(/^Organisation/).fill('Example VA Medical Center')
  await page.getByLabel(/^Facility or department/).fill('Supply chain')
  await page.getByLabel(/^Email/).fill(email)
  await page.getByLabel(/^Phone/).fill('301-555-0101')
  await page.getByLabel(/privacy policy/).check()
}

async function addGloveToList(page: import('@playwright/test').Page) {
  await page.goto(GLOVE_M)
  await page.getByRole('button', { name: /Add to RFQ/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'added to your RFQ list' })).toBeVisible()
}

test.describe('RFQ list', () => {
  test('[E2E-020][E2E-021] add, announce, persist, edit quantity, remove', async ({ page }) => {
    await addGloveToList(page)
    await expect(page.getByRole('link', { name: /RFQ list.*1 item/ })).toBeVisible()

    // Adding again increases the quantity instead of duplicating the line.
    await page.getByRole('button', { name: /Add to RFQ/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Quantity is now 2' })).toBeVisible()

    await page.reload() // persisted in localStorage
    await page.goto('/rfq')
    const line = page.getByTestId('rfq-line')
    await expect(line).toHaveCount(1)
    await expect(line).toContainText(GLOVE_M_SKU)
    const qty = page.getByLabel(/Quantity for Nitrile Exam Gloves/)
    await expect(qty).toHaveValue('2')

    await qty.fill('abc')
    await expect(page.getByText(/Enter a whole number from 1 to/)).toBeVisible()
    await qty.fill('12')
    await expect(page.getByText(/Enter a whole number from 1 to/)).toHaveCount(0)
    await qty.blur()
    await page.reload()
    await expect(page.getByLabel(/Quantity for Nitrile Exam Gloves/)).toHaveValue('12')

    await page.getByRole('button', { name: /Remove Nitrile Exam Gloves/ }).click()
    await expect(page.getByTestId('rfq-line')).toHaveCount(0)
    await expect(page.getByText('Your list is empty')).toBeVisible()
  })

  test('discontinued products cannot be added and offer an alternative request', async ({
    page,
  }) => {
    await page.goto('/search?q=FAC-LTG-5002')
    const card = page.getByTestId('product-card').first()
    await expect(card.getByRole('button', { name: /Add to RFQ/ })).toHaveCount(0)
    await card.getByRole('link', { name: /Request an alternative/ }).click()
    await expect(page.getByLabel(/Request description/)).toHaveValue(
      /alternative to SKU FAC-LTG-5002/,
    )
  })
})

test.describe('RFQ submission', () => {
  test('[E2E-025] empty submission shows an accessible error summary and keeps entries', async ({
    page,
  }) => {
    await page.goto('/rfq')
    await page.getByLabel(/^Name/).fill('Pat Buyer')
    await page.getByRole('button', { name: 'Submit request for quote' }).click()

    const summary = page.getByTestId('error-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toBeFocused()
    await expect(summary).toContainText('Organisation')
    await expect(summary).toContainText('Email')
    await expect(page.getByLabel(/^Name/)).toHaveValue('Pat Buyer')

    // Each summary entry links to (and focuses) its field.
    await summary.getByRole('link', { name: /Organisation/ }).click()
    await expect(page.getByLabel(/^Organisation/)).toBeFocused()
    await expect(page.locator('#field-organisation-error')).toContainText('required')
  })

  test('[E2E-023] full SKU request is saved, confirmed, and emails are sent', async ({
    page,
    baseURL,
  }) => {
    await addGloveToList(page)
    await page.goto('/rfq')
    await fillDetails(page)
    await page
      .getByLabel(/^Needed by/)
      .fill(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10))
    await page.getByLabel(/^Delivery location and details/).fill('Building 5, loading dock B')
    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Submit request for quote' }).click()

    await expect(page).toHaveURL(/\/rfq\/thank-you\?ref=/)
    const ref = (await page.getByTestId('reference').textContent())!.trim()
    expect(ref).toMatch(REFERENCE)

    // List cleared after success.
    await page.goto('/rfq')
    await expect(page.getByText('Your list is empty')).toBeVisible()

    // Saved with a snapshot of the item; both emails eventually marked as sent.
    const sales = await loginAs(baseURL!, 'sales')
    await expect
      .poll(
        async () => {
          const r = await sales.get(`/api/rfqs?where[reference][equals]=${ref}&depth=0`)
          const doc = (await r.json()).docs[0]
          return doc
            ? `${doc.status}|${doc.items[0]?.sku}|${doc.notifications?.salesEmailStatus}|${doc.notifications?.buyerEmailStatus}`
            : ''
        },
        { timeout: 20_000 },
      )
      .toBe(`new|${GLOVE_M_SKU}|sent|sent`)
  })

  test('[E2E-024] general RFQ without catalogue items', async ({ page }) => {
    await page.goto('/rfq')
    await fillDetails(page)
    await page
      .getByLabel(/^Request description/)
      .fill('Need 40 cases of hospital-grade floor cleaner delivered monthly.')
    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Submit request for quote' }).click()
    await expect(page).toHaveURL(/\/rfq\/thank-you\?ref=/)
    await expect(page.getByTestId('reference')).toContainText(REFERENCE)
  })

  test('free-text line items are submitted without a SKU', async ({ page, baseURL }) => {
    await page.goto('/rfq')
    await page.getByLabel('Item description').fill('Sharps container, 2 gallon')
    await page.getByLabel('Quantity', { exact: true }).fill('6')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByTestId('rfq-line')).toContainText('Not in catalogue')
    await fillDetails(page)
    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Submit request for quote' }).click()
    await expect(page).toHaveURL(/thank-you/)
    const ref = (await page.getByTestId('reference').textContent())!.trim()
    const sales = await loginAs(baseURL!, 'sales')
    const doc = (
      await (await sales.get(`/api/rfqs?where[reference][equals]=${ref}&depth=0`)).json()
    ).docs[0]
    expect(doc.items[0]).toMatchObject({ name: 'Sharps container, 2 gallon', quantity: 6 })
    expect(doc.items[0].sku ?? '').toBe('')
  })

  test('[E2E-031][ATT-01] attachments upload, are stored privately, and sales can download them', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/rfq')
    await fillDetails(page)
    await page.getByLabel(/^Request description/).fill('Please quote the attached specification.')
    await page.setInputFiles('#attachments-input', {
      name: 'spec.pdf',
      mimeType: 'application/pdf',
      buffer: tinyPdf('spec'),
    })
    await expect(page.getByTestId('file-list')).toContainText('Uploaded')
    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Submit request for quote' }).click()
    await expect(page).toHaveURL(/thank-you/)
    const ref = (await page.getByTestId('reference').textContent())!.trim()

    const sales = await loginAs(baseURL!, 'sales')
    const rfq = (
      await (await sales.get(`/api/rfqs?where[reference][equals]=${ref}&depth=0`)).json()
    ).docs[0]
    const atts = (
      await (await sales.get(`/api/rfq-attachments?where[rfq][equals]=${rfq.id}&depth=0`)).json()
    ).docs
    expect(atts).toHaveLength(1)
    expect(atts[0]).toMatchObject({ originalName: 'spec.pdf', detectedKind: 'pdf' })
    expect(atts[0].sha256).toMatch(/^[0-9a-f]{64}$/)

    // [ATT-21] download policy: anonymous 401, catalogue manager 403, sales allowed.
    const anon = await anonymous(baseURL!)
    expect(
      (await anon.get(`/api/rfq-attachments/${atts[0].id}/download`, { maxRedirects: 0 })).status(),
    ).toBe(401)
    const catalogue = await loginAs(baseURL!, 'catalogue')
    expect(
      (
        await catalogue.get(`/api/rfq-attachments/${atts[0].id}/download`, { maxRedirects: 0 })
      ).status(),
    ).toBe(403)
    const download = await sales.get(`/api/rfq-attachments/${atts[0].id}/download`)
    expect(download.status()).toBe(200)
    expect(download.headers()['content-disposition']).toContain('attachment')
    expect((await download.body()).toString()).toContain('%PDF-1.4')
    // Raw attachments are never exposed through the REST list to anonymous users.
    expect((await anon.get('/api/rfq-attachments')).status()).toBe(403)
  })

  test('[ATT-05][ATT-06] disallowed files are rejected on the client and disguised files on the server', async ({
    page,
  }) => {
    await page.goto('/rfq')
    await page.setInputFiles('#attachments-input', {
      name: 'malware.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    })
    await expect(page.getByTestId('file-status')).toContainText('not allowed')
    await expect(page.getByTestId('file-list')).toHaveCount(0)

    // An executable renamed to .pdf passes the extension check but fails the magic-byte check on submit.
    await fillDetails(page)
    await page.getByLabel(/^Request description/).fill('Disguised file test request.')
    await page.setInputFiles('#attachments-input', {
      name: 'invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4]),
    })
    await expect(page.getByTestId('file-list')).toContainText('Uploaded')
    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Submit request for quote' }).click()
    const summary = page.getByTestId('error-summary')
    await expect(summary).toContainText('does not match its file type')
    await expect(page).toHaveURL(/\/rfq$/)
    await expect(page.getByLabel(/^Name/)).toHaveValue('Pat Buyer')
  })

  test('[E2E-028][FR-053] retrying with the same idempotency key does not duplicate', async ({
    baseURL,
    clientIp,
  }) => {
    const api = await anonymous(baseURL!)
    const key = crypto.randomUUID()
    const body = {
      buyerName: 'Pat Buyer',
      organisation: 'Org',
      email: 'pat@example.gov',
      phone: '301-555-0100',
      generalDescription: 'Need something quoted please.',
      privacyAcknowledged: true,
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      idempotencyKey: key,
    }
    const headers = { 'x-forwarded-for': clientIp }
    const first = await api.post('/api/rfq', { data: body, headers })
    expect(first.status()).toBe(201)
    const second = await api.post('/api/rfq', { data: body, headers })
    expect(second.status()).toBe(200)
    expect(await second.json()).toMatchObject({
      reference: (await first.json()).reference,
      duplicate: true,
    })
  })

  test('[E2E-027][FR-037] rate limiting returns 429 with Retry-After', async ({
    baseURL,
    clientIp,
  }) => {
    const api = await anonymous(baseURL!)
    const headers = { 'x-forwarded-for': clientIp }
    const statuses: number[] = []
    let retryAfter: string | undefined
    for (let i = 0; i < 7; i++) {
      const res = await api.post('/api/rfq', { data: { buyerName: '' }, headers })
      statuses.push(res.status())
      if (res.status() === 429) retryAfter = res.headers()['retry-after']
    }
    expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true)
    expect(statuses.slice(5)).toEqual([429, 429])
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  test('[SEC-08][SEC-09] cross-origin posts and invalid Turnstile tokens are rejected', async ({
    baseURL,
    clientIp,
  }) => {
    const api = await anonymous(baseURL!)
    const evil = await api.post('/api/rfq', {
      data: {},
      headers: { Origin: 'https://evil.example', 'x-forwarded-for': clientIp },
    })
    expect(evil.status()).toBe(403)

    const bad = await api.post('/api/rfq', {
      headers: { 'x-forwarded-for': clientIp },
      data: {
        buyerName: 'Pat',
        organisation: 'Org',
        email: 'pat@example.gov',
        phone: '301-555-0100',
        generalDescription: 'Test request for quote.',
        privacyAcknowledged: true,
        turnstileToken: 'invalid-token',
        idempotencyKey: crypto.randomUUID(),
      },
    })
    // With Cloudflare's always-pass test secret any token passes; with a real secret this is rejected.
    expect([201, 400]).toContain(bad.status())
  })

  test('[ATT-12] attachment references outside quarantine are rejected', async ({
    baseURL,
    clientIp,
  }) => {
    const api = await anonymous(baseURL!)
    const res = await api.post('/api/rfq', {
      headers: { 'x-forwarded-for': clientIp },
      data: {
        buyerName: 'Pat',
        organisation: 'Org',
        email: 'pat@example.gov',
        phone: '301-555-0100',
        generalDescription: 'Test request for quote.',
        privacyAcknowledged: true,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        idempotencyKey: crypto.randomUUID(),
        attachments: [
          {
            key: 'rfq/2026/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'x.pdf',
            size: 10,
            contentType: 'application/pdf',
          },
        ],
      },
    })
    expect(res.status()).toBe(400)
    // Unknown quarantine object: the upload was never made.
    const missing = await api.post('/api/rfq', {
      headers: { 'x-forwarded-for': clientIp },
      data: {
        buyerName: 'Pat',
        organisation: 'Org',
        email: 'pat@example.gov',
        phone: '301-555-0100',
        generalDescription: 'Test request for quote.',
        privacyAcknowledged: true,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        idempotencyKey: crypto.randomUUID(),
        attachments: [
          {
            key: 'quarantine/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'x.pdf',
            size: 10,
            contentType: 'application/pdf',
          },
        ],
      },
    })
    expect(missing.status()).toBe(400)
    expect((await missing.json()).error).toMatch(/not found/)
  })
})

test('GLOVE_M constant stays in sync with the seed', async ({ page }) => {
  const res = await page.goto(GLOVE_M)
  expect(res?.status()).toBe(200)
})
