import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test, GLOVE_M, waitForTurnstile } from './fixtures'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}\n   ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join('\n   ')}`,
  )
  expect(summary, `${label} has accessibility violations`).toEqual([])
}

const pages: [string, string][] = [
  ['Home', '/'],
  ['Categories', '/categories'],
  ['Category listing', '/categories/personal-protective-equipment/gloves'],
  ['Category listing with filter', '/categories/personal-protective-equipment/gloves?attr.size=M'],
  ['Product detail', GLOVE_M],
  ['Search results', '/search?q=nitrile'],
  ['Search with no results', '/search?q=zzzzqqqq'],
  ['RFQ (empty list)', '/rfq'],
  ['Thank you', '/rfq/thank-you?ref=RCQ-202611-ABC234'],
  ['About', '/about'],
  ['Services', '/services'],
  ['Contact', '/contact'],
  ['Privacy', '/privacy'],
  ['Accessibility statement', '/accessibility'],
  ['404', '/does-not-exist'],
]

test.describe('[A11Y] automated axe checks (WCAG 2.2 AA)', () => {
  for (const [label, url] of pages) {
    test(label, async ({ page }) => {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await audit(page, label)
    })
  }

  test('RFQ with items, validation errors and an uploaded file', async ({ page }) => {
    await page.goto(GLOVE_M)
    await page.getByRole('button', { name: /Add to RFQ/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'added' })).toBeVisible()
    await page.goto('/rfq')
    await page.getByLabel('Item description').fill('Sharps container')
    await page.getByRole('button', { name: 'Add item' }).click()
    await page.setInputFiles('#attachments-input', {
      name: 'spec.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    })
    await expect(page.getByTestId('file-list')).toContainText('Uploaded')
    await audit(page, 'RFQ with items and files')

    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Submit request for quote' }).click()
    await expect(page.getByTestId('error-summary')).toBeVisible()
    await audit(page, 'RFQ with validation errors')
  })

  test('[A11Y-02] focus is not obscured: header is not sticky and anchors keep scroll padding', async ({
    page,
  }) => {
    await page.goto('/rfq')
    const position = await page
      .locator('header')
      .first()
      .evaluate((el) => getComputedStyle(el).position)
    expect(position).not.toBe('fixed')
    expect(position).not.toBe('sticky')
    const padding = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollPaddingTop,
    )
    expect(parseFloat(padding)).toBeGreaterThan(0)
  })

  test('[A11Y-01] skip link is the first focusable element and works', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })

  test('[A11Y-03] interactive targets are at least 24x24 CSS pixels (design target 44)', async ({
    page,
  }) => {
    await page.goto('/rfq')
    const small = await page.evaluate(() => {
      const bad: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>(
        'button, input:not([type=hidden]):not([type=checkbox]), select, textarea, nav a, header a',
      )) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.width < 24 || r.height < 24)
          bad.push(
            `${el.tagName} ${el.id || el.textContent?.slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          )
      }
      return bad
    })
    expect(small).toEqual([])
  })

  test('[A11Y-11] content reflows at 320px without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    for (const url of ['/', '/search?q=gloves', GLOVE_M, '/rfq']) {
      await page.goto(url)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${url} overflows horizontally`).toBeLessThanOrEqual(0)
    }
  })
})
