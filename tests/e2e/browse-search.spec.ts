import { expect, test, GLOVE_M, GLOVE_M_SKU } from './fixtures'

test.describe('browse and search', () => {
  test('[E2E-001] browse home -> categories -> subcategory -> product', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find approved supplies')

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Products' })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Product categories' })).toBeVisible()

    await page
      .getByRole('heading', { level: 2, name: 'Personal Protective Equipment' })
      .getByRole('link')
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Personal Protective Equipment' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Categories')

    await page
      .getByRole('navigation', { name: 'Subcategories' })
      .getByRole('link', { name: 'Gloves' })
      .click()
    await expect(page.getByTestId('result-count')).toContainText('4 products found')
    await expect(page.getByTestId('product-card')).toHaveCount(4)

    await page.getByRole('link', { name: 'Nitrile Exam Gloves, Powder-Free, Medium' }).click()
    await expect(page).toHaveURL(new RegExp(GLOVE_M))
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nitrile Exam Gloves')
    await expect(page.getByText(GLOVE_M_SKU).first()).toBeVisible()
  })

  test('[E2E-008][E2E-010] product page shows approved details and only published documents', async ({
    page,
  }) => {
    await page.goto(GLOVE_M)
    await expect(page.getByRole('heading', { name: 'Approved specifications' })).toBeVisible()
    await expect(page.getByRole('row', { name: /Thickness/ })).toContainText('4 mil')
    await expect(page.getByRole('img', { name: /Sample illustration/ }).first()).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Specification sheet: nitrile exam gloves/ }),
    ).toBeVisible()
    await expect(page.getByText('unreleased draft')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Add to RFQ/ })).toBeVisible()
  })

  test('[E2E-004][E2E-005] keyword and SKU search', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('search').first().getByRole('searchbox').fill('nitrile')
    await page
      .getByRole('search')
      .first()
      .getByRole('button', { name: /Search/ })
      .click()
    await expect(page).toHaveURL(/\/search\?q=nitrile/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('nitrile')
    await expect(page.getByTestId('result-count')).toContainText('3 products found')

    await page.goto(`/search?q=${GLOVE_M_SKU}`)
    await expect(page.getByTestId('product-card').first()).toContainText(GLOVE_M_SKU)
  })

  test('[UT-012] tolerates a small typo', async ({ page }) => {
    await page.goto('/search?q=nitirle')
    await expect(page.getByTestId('product-card').first()).toContainText('Nitrile')
  })

  test('[E2E-006] no results offers next steps', async ({ page }) => {
    await page.goto('/search?q=zzzzqqqq')
    await expect(page.getByTestId('result-count')).toContainText('No products found')
    await expect(page.getByRole('heading', { name: 'Nothing matched' })).toBeVisible()
    await expect(page.getByRole('link', { name: /general request for quote/ })).toBeVisible()
  })

  test('[E2E-007] filters live in the URL and can be cleared', async ({ page }) => {
    await page.goto('/categories/personal-protective-equipment/gloves')
    await page.getByLabel(/^M \(/).check()
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(/attr\.size=M/)
    await expect(page.getByTestId('product-card')).toHaveCount(2)
    await page.goBack()
    await expect(page.getByTestId('product-card')).toHaveCount(4)
    await page.goForward()
    await page.getByRole('link', { name: 'Clear all filters' }).click()
    await expect(page).not.toHaveURL(/attr\.size/)
    await expect(page.getByTestId('product-card')).toHaveCount(4)
  })

  test('[E2E-009] unknown and unpublished content returns 404 with helpful page', async ({
    page,
  }) => {
    const res = await page.goto('/products/does-not-exist')
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('search')).toHaveCount(2) // header search + 404 search
    const res2 = await page.goto('/totally/unknown/path')
    expect(res2?.status()).toBe(404)
  })
})

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('[E2E-054] browse and search work without JS', async ({ page }) => {
    await page.goto('/search?q=gloves')
    await expect(page.getByTestId('product-card').first()).toBeVisible()
    await page.goto('/categories/personal-protective-equipment/gloves?attr.size=M')
    await expect(page.getByTestId('product-card')).toHaveCount(2)
  })
})
