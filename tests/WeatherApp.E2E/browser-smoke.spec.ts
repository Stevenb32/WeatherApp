import type { Page } from '@playwright/test'
import { test, expect } from './fixtures.ts'

async function expectNoPageOverflow(page: Page) {
  const width = page.viewportSize()!.width
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  // Check the layout viewport too: a missing viewport meta tag must not hide
  // mobile overflow by laying the page out at a wider desktop width.
  expect(dimensions.viewport).toBe(width)
  const description = `Page dimensions: ${JSON.stringify(dimensions)}`
  expect(dimensions.document, description).toBeLessThanOrEqual(width + 1)
  expect(dimensions.body, description).toBeLessThanOrEqual(width + 1)
}

test('Successful Tampa search shows current and forecast weather', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page.getByText('Search for a city to see its current weather.', { exact: true })).toBeVisible()
  if (isMobile) await expectNoPageOverflow(page)

  await expect(page.getByRole('radio', { name: 'Fahrenheit (imperial units)' })).toBeChecked()
  await page.getByLabel('City', { exact: true }).fill('Tampa')
  const search = page.getByRole('button', { name: 'Search', exact: true })
  if (isMobile) await search.tap()
  else await search.click()

  const results = page.getByRole('region', { name: 'Weather results', exact: true })
  const location = 'Current weather for Tampa, Florida, United States of America'
  const current = results.getByRole('region', { name: location, exact: true })
  await expect(current.getByRole('heading', { name: location, exact: true })).toBeVisible()
  await expect(current.getByText(/^87\.8\s*°F$/)).toBeVisible()
  await expect(current.getByText('Partly cloudy', { exact: true })).toBeVisible()
  await expect(results).toHaveAttribute('aria-busy', 'false')

  const hourly = results.getByRole('region', { name: 'Next 24 hours', exact: true })
  const hours = hourly.getByRole('listitem')
  await expect(hours).toHaveCount(24)
  await expect(hours.first().getByText('21:00', { exact: true })).toBeVisible()
  await expect(hours.first().getByText(/^80\.6\s*°F$/)).toBeVisible()

  const daily = results.getByRole('region', { name: 'Three-day forecast', exact: true })
  const days = daily.getByRole('listitem')
  await expect(days).toHaveCount(3)
  await expect(days.first().getByText('Thursday, August 20, 2026', { exact: true })).toBeVisible()
  await expect(days.first().getByRole('definition')).toHaveText([
    /^77\s*°F$/, /^91\.4\s*°F$/, 'Partly cloudy', '40%',
  ])
  if (isMobile) await expectNoPageOverflow(page)
})
