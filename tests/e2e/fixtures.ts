import {
  expect,
  request as pwRequest,
  test as base,
  type APIRequestContext,
} from '@playwright/test'

export { expect }

export const GLOVE_M = '/products/nitrile-exam-gloves-powder-free-medium-ppe-glv-3001'
export const GLOVE_M_SKU = 'PPE-GLV-3001'
export const PASSWORD = process.env.SEED_PASSWORD ?? 'ChangeMe-12345!'

export const randomIp = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`

/**
 * Every test gets its own client IP for same-origin API calls, so per-IP rate limits never leak between tests.
 * The header is only added to requests for this site.
 */
export const test = base.extend<{ clientIp: string }>({
  clientIp: async ({}, use) => use(randomIp()),
  page: async ({ page, baseURL, clientIp }, use) => {
    await page.route(`${baseURL}/api/**`, (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': clientIp } }),
    )
    await use(page)
  },
})

/**
 * Authenticated API client for a seeded staff role (Payload REST login sets the session cookie).
 * Logged in once per worker and role: concurrent logins of the same user can overwrite each other's
 * session records, which would make tests flaky. The session is verified and the login retried if needed.
 */
const staffClients = new Map<string, Promise<APIRequestContext>>()

export function loginAs(
  baseURL: string,
  role: 'admin' | 'catalogue' | 'sales',
): Promise<APIRequestContext> {
  const key = `${baseURL}|${role}`
  let client = staffClients.get(key)
  if (!client) {
    client = (async () => {
      const email = `${role}@example.com`
      for (let attempt = 1; ; attempt++) {
        const api = await pwRequest.newContext({
          baseURL,
          extraHTTPHeaders: { Origin: baseURL, 'x-forwarded-for': randomIp() },
        })
        const res = await api.post('/api/users/login', { data: { email, password: PASSWORD } })
        expect(res.ok(), `login as ${email}`).toBeTruthy()
        const me = await api.get('/api/users/me')
        if ((await me.json()).user || attempt >= 4) return api
        await api.dispose()
      }
    })()
    staffClients.set(key, client)
  }
  return client
}

export function anonymous(baseURL: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, 'x-forwarded-for': randomIp() },
  })
}

export const tinyPdf = (text = 'sample') =>
  Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n% ${text}`)

/** Waits until the Turnstile widget (test keys) has produced a token. */
export async function waitForTurnstile(page: import('@playwright/test').Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('', {
    timeout: 30_000,
  })
}
