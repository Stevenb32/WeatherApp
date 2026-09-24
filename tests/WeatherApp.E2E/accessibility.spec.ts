import { AxeBuilder } from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from './fixtures.ts'

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectAccessiblePage(page: Page, testInfo: TestInfo) {
  const scan = await new AxeBuilder({ page }).withTags(axeTags).analyze()

  if (scan.violations.length > 0) {
    await testInfo.attach('axe-results', {
      body: JSON.stringify(scan, null, 2),
      contentType: 'application/json',
    })
  }

  expect(scan.violations, 'The whole page must have no violations of the selected axe rules').toEqual([])
}

const scanCases = [
  { name: 'Desktop idle', width: 1280, state: 'idle' },
  { name: 'Desktop success', width: 1280, state: 'success' },
  { name: 'Desktop error', width: 1280, state: 'error' },
  { name: 'Mobile success', width: 320, state: 'success' },
  { name: 'Mobile error', width: 320, state: 'error' },
] as const

for (const scenario of scanCases) {
  test.describe(scenario.name, () => {
    test.use({
      viewport: { width: scenario.width, height: 720 },
      isMobile: scenario.width === 320,
      hasTouch: scenario.width === 320,
    })

    test('has no axe accessibility violations', async ({ page }, testInfo) => {
      await page.goto('/')

      const results = page.getByRole('region', { name: 'Weather results', exact: true })

      if (scenario.state === 'idle') {
        await expect(results.getByText(
          'Search for a city to see its current weather.',
          { exact: true },
        )).toBeVisible()
      } else {
        // The always-failing fixture avoids sharing RetryRecovery's cached success.
        const location = scenario.state === 'success' ? 'Tampa' : 'ProviderFailure'
        await page.getByLabel('City', { exact: true }).fill(location)
        await page.getByRole('button', { name: 'Search', exact: true }).click()

        if (scenario.state === 'success') {
          await expect(results.getByRole('heading', {
            name: 'Current weather for Tampa, Florida, United States of America',
            level: 2,
            exact: true,
          })).toBeVisible()
          await expect(results.getByRole('region', { name: 'Next 24 hours', exact: true })).toBeVisible()
          await expect(results.getByRole('region', { name: 'Three-day forecast', exact: true })).toBeVisible()
        } else {
          await expect(results.getByRole('alert').getByRole('heading', {
            name: 'Weather is temporarily unavailable',
            level: 2,
            exact: true,
          })).toBeVisible()
          await expect(results.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled()
        }
      }

      await expect(results).toHaveAttribute('aria-busy', 'false')
      await expectAccessiblePage(page, testInfo)
    })
  })
}
