import { anonymous, expect, loginAs, randomIp, PASSWORD, test } from './fixtures'

test.describe('roles and access control', () => {
  test('[UT-006][SEC-03] public API exposes no private data', async ({ baseURL }) => {
    const anon = await anonymous(baseURL!)
    for (const path of [
      '/api/rfqs',
      '/api/rfq-attachments',
      '/api/users',
      '/api/search-documents',
      '/api/rate-limits',
      '/api/globals/site-settings',
    ]) {
      const res = await anon.get(path)
      expect([401, 403, 404], `${path} -> ${res.status()}`).toContain(res.status())
    }
    // Public catalogue reads work, but drafts never leak, even when requested explicitly.
    const draftQuery = await anon.get('/api/products?draft=true&where[_status][equals]=draft')
    const body = await draftQuery.json().catch(() => ({ docs: [] }))
    expect((body.docs ?? []).every((d: { _status: string }) => d._status === 'published')).toBe(
      true,
    )
    expect((await anon.get('/api/graphql')).status()).not.toBe(200)
  })

  test('[SEC-03] sales can handle RFQs but not edit the catalogue', async ({ baseURL }) => {
    const sales = await loginAs(baseURL!, 'sales')
    expect((await sales.get('/api/rfqs')).status()).toBe(200)
    const create = await sales.post('/api/products', { data: { sku: 'HACK-1', name: 'x' } })
    expect(create.status()).toBeGreaterThanOrEqual(400)
    expect((await sales.get('/api/export/products')).status()).toBe(403)
    expect((await sales.get('/api/users')).status()).toBe(200) // own record only
    const users = (await (await sales.get('/api/users')).json()).docs
    expect(users).toHaveLength(1)
  })

  test('[SEC-03] catalogue managers cannot read RFQs or settings', async ({ baseURL }) => {
    const cat = await loginAs(baseURL!, 'catalogue')
    expect((await cat.get('/api/rfqs')).status()).toBe(403)
    expect((await cat.get('/api/rfq-attachments')).status()).toBe(403)
    expect((await cat.get('/api/export/rfqs')).status()).toBe(403)
    expect(
      (
        await cat.post('/api/users', {
          data: { email: 'x@example.com', password: PASSWORD, name: 'x', role: 'admin' },
        })
      ).status(),
    ).toBeGreaterThanOrEqual(400)
  })

  test('[S-04] sales can change status and add notes, but not buyer fields', async ({
    baseURL,
  }) => {
    const sales = await loginAs(baseURL!, 'sales')
    const anon = await anonymous(baseURL!)
    const ref = await anon.post('/api/rfq', {
      headers: { 'x-forwarded-for': randomIp() },
      data: {
        buyerName: 'Original Buyer',
        organisation: 'Org',
        email: 'orig@example.gov',
        phone: '301-555-0100',
        generalDescription: 'Status workflow test request.',
        privacyAcknowledged: true,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        idempotencyKey: crypto.randomUUID(),
      },
    })
    expect(ref.status()).toBe(201)
    const reference = (await ref.json()).reference
    const doc = (
      await (await sales.get(`/api/rfqs?where[reference][equals]=${reference}&depth=0`)).json()
    ).docs[0]

    const patch = await sales.patch(`/api/rfqs/${doc.id}`, {
      data: {
        status: 'in_progress',
        buyerName: 'Tampered',
        notes: [{ body: 'Called the buyer.' }],
      },
    })
    expect(patch.status()).toBe(200)
    const updated = (await patch.json()).doc
    expect(updated.status).toBe('in_progress')
    expect(updated.buyerName).toBe('Original Buyer')
    expect(updated.statusHistory.at(-1)).toMatchObject({ from: 'new', to: 'in_progress' })
    expect(updated.notes[0].body).toBe('Called the buyer.')
    expect(updated.notes[0].author).toBeTruthy()

    // CSV export with filter, formula-safe, BOM.
    const csv = await sales.get('/api/export/rfqs?status=in_progress')
    expect(csv.status()).toBe(200)
    const text = await csv.text()
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text).toContain(reference)
    const none = await sales.get('/api/export/rfqs?status=closed&q=no-such-text-anywhere')
    expect((await none.text()).split('\n').filter(Boolean)).toHaveLength(1)
  })

  test('[A-03][E2E-041] account locks after repeated failed logins', async ({ baseURL }) => {
    const admin = await loginAs(baseURL!, 'admin')
    const email = `lock-${Date.now()}@example.com`
    const created = await admin.post('/api/users', {
      data: { email, password: PASSWORD, name: 'Lock Test', role: 'sales' },
    })
    expect(created.status()).toBe(201)
    const anon = await anonymous(baseURL!)
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await anon.post('/api/users/login', { data: { email, password: 'wrong-password-123' } })
        ).status(),
      ).toBe(401)
    }
    const locked = await anon.post('/api/users/login', { data: { email, password: PASSWORD } })
    expect(locked.status()).toBe(401) // locked, even with the right password
    expect(JSON.stringify(await locked.json())).toMatch(/locked/i)
  })

  test('short passwords are rejected for new users', async ({ baseURL }) => {
    const admin = await loginAs(baseURL!, 'admin')
    const res = await admin.post('/api/users', {
      data: {
        email: `short-${Date.now()}@example.com`,
        password: 'short',
        name: 'x',
        role: 'sales',
      },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('catalogue management', () => {
  test('[E2E-042][M-01][M-02] draft -> hidden, publish -> visible, unpublish -> hidden', async ({
    baseURL,
    page,
  }) => {
    const cat = await loginAs(baseURL!, 'catalogue')
    const sku = `E2E-${Date.now()}`
    const slug = `e2e-lifecycle-${Date.now()}`
    const gloves = (
      await (
        await cat.get(
          '/api/categories?where[path][equals]=medical-surgical-supplies/exam-room-supplies&depth=0',
        )
      ).json()
    ).docs[0]
    const media = (await (await cat.get('/api/media?limit=1&depth=0')).json()).docs[0]

    // Duplicate SKU (case-insensitive after normalisation) is blocked.
    const dup = await cat.post('/api/products?draft=true', {
      data: { sku: 'ppe-glv-3001', name: 'Dup', slug: 'dup', _status: 'draft' },
    })
    expect(dup.status()).toBeGreaterThanOrEqual(400)

    const created = await cat.post('/api/products?draft=true', {
      data: {
        sku: sku.toLowerCase(),
        name: 'E2E lifecycle product',
        slug,
        summary: 'Created by an automated test.',
        category: gloves.id,
        images: [{ image: media.id }],
        _status: 'draft',
      },
    })
    expect(created.status(), await created.text()).toBe(201)
    const doc = (await created.json()).doc
    expect(doc.sku).toBe(sku) // normalised

    try {
      expect((await page.goto(`/products/${slug}`))?.status()).toBe(404)
      await page.goto(`/search?q=${sku}`)
      await expect(page.getByTestId('result-count')).toContainText('No products found')

      const published = await cat.patch(`/api/products/${doc.id}`, {
        data: { _status: 'published' },
      })
      expect(published.status(), await published.text()).toBe(200)
      await expect
        .poll(async () => (await page.goto(`/products/${slug}`))?.status(), { timeout: 60_000 })
        .toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E lifecycle product')
      await page.goto(`/search?q=${sku}`)
      await expect(page.getByTestId('product-card')).toHaveCount(1)
      const sitemap = await (await page.request.get('/sitemap.xml')).text()
      expect(sitemap).toContain(`/products/${slug}`)

      // Unpublish: save with status draft (not as an autosave/draft version), exactly like the admin button.
      const unpublished = await cat.patch(`/api/products/${doc.id}`, { data: { _status: 'draft' } })
      expect(unpublished.status(), await unpublished.text()).toBe(200)
      await expect
        .poll(async () => (await page.goto(`/products/${slug}`))?.status(), { timeout: 60_000 })
        .toBe(404)
      await page.goto(`/search?q=${sku}`)
      await expect(page.getByTestId('result-count')).toContainText('No products found')
      expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain(slug)
    } finally {
      await (await loginAs(baseURL!, 'admin')).delete(`/api/products/${doc.id}`)
    }
  })

  test('[M-01] publishing requires summary, category and an image', async ({ baseURL }) => {
    const cat = await loginAs(baseURL!, 'catalogue')
    const res = await cat.post('/api/products', {
      data: {
        sku: `INCOMPLETE-${Date.now()}`,
        name: 'Incomplete',
        slug: `incomplete-${Date.now()}`,
        _status: 'published',
      },
    })
    expect(res.status()).toBe(400)
    const text = JSON.stringify(await res.json())
    expect(text).toMatch(/summary is required/)
    expect(text).toMatch(/category is required/)
    expect(text).toMatch(/image is required/)
  })

  test('[E2E-010][FR-007] unpublished documents are not downloadable, published ones are', async ({
    baseURL,
  }) => {
    const anon = await anonymous(baseURL!)
    const cat = await loginAs(baseURL!, 'catalogue')
    const all = (await (await cat.get('/api/documents?limit=50&depth=0')).json()).docs as {
      title: string
      filename: string
      status: string
    }[]
    const pub = all.find((d) => d.title.startsWith('Specification sheet: nitrile'))!
    const draft = all.find((d) => d.title.startsWith('Certificate: unreleased'))!
    expect([pub.status, draft.status]).toEqual(['published', 'draft'])

    const published = await anon.get(`/api/documents/file/${pub.filename}`)
    expect(published.status()).toBe(200)
    expect(published.headers()['content-type']).toContain('pdf')
    const hidden = await anon.get(`/api/documents/file/${draft.filename}`)
    expect([401, 403, 404]).toContain(hidden.status())
    const list = await (await anon.get('/api/documents?limit=50')).json()
    expect(list.docs.every((d: { status: string }) => d.status === 'published')).toBe(true)
    expect((await cat.get(`/api/documents/file/${draft.filename}`)).status()).toBe(200)
  })

  test('[E2E-043][M-06][M-07] CSV import (dry run) and export round trip', async ({ baseURL }) => {
    const cat = await loginAs(baseURL!, 'catalogue')
    const exported = await cat.get('/api/export/products')
    expect(exported.status()).toBe(200)
    const csv = await exported.text()
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('PPE-GLV-3001')
    expect(csv.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(21)

    const dry = await cat.post('/api/import/products', {
      multipart: {
        file: { name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) },
        dryRun: 'true',
      },
    })
    expect(dry.status()).toBe(200)
    const report = await dry.json()
    expect(report).toMatchObject({ dryRun: true, created: 0, failed: 0 })
    expect(report.updated).toBeGreaterThanOrEqual(20)

    const bad = await cat.post('/api/import/products', {
      multipart: {
        file: {
          name: 'bad.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            'sku,name,category_path\nBAD-1,Bad,no/such/category\n,Missing sku,\n',
          ),
        },
        dryRun: 'true',
      },
    })
    const badReport = await bad.json()
    expect(badReport.failed).toBe(2)
    expect(badReport.errors[0]).toMatchObject({ row: 2, sku: 'BAD-1' })
    expect(badReport.errors[0].message).toMatch(/unknown category/)

    const notCsv = await cat.post('/api/import/products', {
      multipart: {
        file: { name: 'x.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') },
      },
    })
    expect(notCsv.status()).toBe(400)
  })
})

test.describe('operations endpoints', () => {
  test('[SEC-16] cron endpoints require the secret', async ({ baseURL }) => {
    const anon = await anonymous(baseURL!)
    expect((await anon.get('/api/cron/retention')).status()).toBe(401)
    expect(
      (
        await anon.get('/api/cron/email-retry', { headers: { authorization: 'Bearer wrong' } })
      ).status(),
    ).toBe(401)
  })

  test('scheduled jobs run with the secret and report counts', async ({ baseURL }) => {
    test.skip(Boolean(process.env.E2E_BASE_URL), 'needs the e2e server secret')
    const anon = await anonymous(baseURL!)
    const headers = {
      authorization: `Bearer ${process.env.E2E_CRON_SECRET ?? 'e2e-cron-secret-0123456789'}`,
    }
    const retry = await anon.get('/api/cron/email-retry', { headers })
    expect(retry.status()).toBe(200)
    expect(await retry.json()).toMatchObject({ retried: expect.any(Number) })
    const retention = await anon.get('/api/cron/retention', { headers })
    expect(await retention.json()).toMatchObject({ rfqsDeleted: 0, filesDeleted: 0 })
    const cleanup = await anon.get('/api/cron/cleanup', { headers })
    expect(await cleanup.json()).toMatchObject({
      rateLimitRows: expect.any(Number),
      quarantineFiles: expect.any(Number),
    })
    expect((await anon.get('/api/cron/unknown', { headers })).status()).toBe(404)
  })

  test('health check responds', async ({ baseURL }) => {
    const anon = await anonymous(baseURL!)
    expect((await anon.get('/api/health')).status()).toBe(200)
  })

  test('[ATT-11] dev storage rejects unsigned or tampered uploads', async ({ baseURL }) => {
    const anon = await anonymous(baseURL!)
    const res = await anon.put(
      '/api/dev-storage?key=quarantine/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&exp=9999999999&sig=00',
      { data: 'x' },
    )
    expect(res.status()).toBe(403)
  })
})
