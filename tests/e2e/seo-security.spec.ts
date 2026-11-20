import { expect, test, GLOVE_M } from './fixtures'

test.describe('SEO and structured data', () => {
  test('[E2E-050] sitemap lists published content only', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    expect(xml).toContain(GLOVE_M)
    expect(xml).toContain('/categories/personal-protective-equipment/gloves')
    expect(xml).toContain('/about')
    expect(xml).not.toContain('/admin')
    expect(xml).not.toContain('/search')
  })

  test('[FR-064] non-production environments are blocked from indexing', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain('Disallow: /')
    const res = await request.get('/')
    expect(res.headers()['x-robots-tag']).toContain('noindex')
  })

  test('[FR-065][FR-066] Organization and Product JSON-LD, canonical and metadata', async ({
    page,
  }) => {
    await page.goto(GLOVE_M)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const data = blocks.map((b) => JSON.parse(b))
    const product = data.find((d) => d['@type'] === 'Product')
    expect(product).toMatchObject({ sku: 'PPE-GLV-3001', name: expect.stringContaining('Nitrile') })
    expect(product.offers).toBeUndefined() // no public pricing
    expect(data.some((d) => d['@type'] === 'Organization')).toBe(true)
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.length).toBeGreaterThanOrEqual(3)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`${GLOVE_M}$`),
    )
    await expect(page).toHaveTitle(/Nitrile Exam Gloves.*PPE-GLV-3001/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /nitrile/i)
  })

  test('filtered and search pages are not indexable; category pages are', async ({ page }) => {
    await page.goto('/search?q=gloves')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await page.goto('/categories/personal-protective-equipment/gloves?attr.size=M')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await page.goto('/categories/personal-protective-equipment/gloves')
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('[SEC-01] security headers are present on pages', async ({ request }) => {
    const res = await request.get('/')
    const h = res.headers()
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['content-security-policy']).toContain('https://challenges.cloudflare.com')
    expect(h['permissions-policy']).toContain('camera=()')
    expect(h['x-powered-by']).toBeUndefined()
  })

  test('[SEC-02] no CSP violations on key pages', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to/.test(m.text())) violations.push(m.text())
    })
    for (const url of ['/', '/categories', GLOVE_M, '/search?q=gloves', '/rfq']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
    }
    expect(violations).toEqual([])
  })

  test('[SEC-06] user-supplied search text is escaped', async ({ page }) => {
    await page.goto('/search?q=' + encodeURIComponent('<img src=x onerror=alert(1)>'))
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '<img src=x onerror=alert(1)>',
    )
  })

  test('[SEC-07] search resists injection payloads', async ({ request }) => {
    for (const q of [
      "'; DROP TABLE products;--",
      '" OR 1=1 --',
      ':* & | !',
      '\\',
      '%',
      'a'.repeat(1000),
    ]) {
      const res = await request.get('/search?q=' + encodeURIComponent(q))
      expect(res.status(), q).toBe(200)
    }
    const filter = await request.get(
      '/search?attr.size=' + encodeURIComponent("M' OR '1'='1") + '&attr.bad%20key=x',
    )
    expect(filter.status()).toBe(200)
  })
})
