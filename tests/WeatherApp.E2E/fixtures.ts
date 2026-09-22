import { test as base, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

export const test = base.extend<{ resetWireMock: void }>({
  resetWireMock: [
    async ({ request }, use) => {
      for (const endpoint of ['requests/reset', 'scenarios/reset']) {
        const response = await request.post(
          `http://127.0.0.1:9090/__admin/${endpoint}`,
          { timeout: 5_000, maxRetries: 0 },
        )

        expect(response.status(), `WireMock ${endpoint} must succeed`).toBe(200)
      }

      await use()
    },
    { auto: true },
  ],
})

export async function withPendingWeatherRequest(
  page: Page,
  expected: { location: string; units: 'imperial' | 'metric' },
  trigger: () => Promise<void>,
  assertPending: () => Promise<void>,
) {
  const origin = new URL(page.url()).origin
  const matchesWeatherRequest = (url: URL) =>
    url.origin === origin &&
    url.pathname === '/api/weather' &&
    url.searchParams.get('location') === expected.location &&
    url.searchParams.get('units') === expected.units

  let releaseRequest!: () => void
  const released = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  let continuation: Promise<void> | undefined
  const holdRequest = (route: Route) => {
    continuation = released.then(() => route.continue())
    return continuation
  }

  await page.route(matchesWeatherRequest, holdRequest, { times: 1 })

  try {
    await Promise.all([
      page.waitForRequest(
        (request) => matchesWeatherRequest(new URL(request.url())),
        { timeout: 5_000 },
      ),
      trigger(),
    ])
    await assertPending()
  } finally {
    // Release even when an action or assertion fails; never fabricate a response.
    releaseRequest()
    try {
      // Finish the continuation before removing interception for the in-flight request.
      await continuation
    } finally {
      await page.unroute(matchesWeatherRequest, holdRequest)
    }
  }
}

export { expect } from '@playwright/test'
