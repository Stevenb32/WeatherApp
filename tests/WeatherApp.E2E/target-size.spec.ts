import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures.ts'

async function expectTargetSize(control: Locator, name: string, useAssociatedLabel = false) {
  await expect(control).toBeVisible()
  const bounds = await control.evaluate((element, useLabel) => {
    // Hidden native radios receive clicks through their associated visible label.
    const target = useLabel && element instanceof HTMLInputElement
      ? element.labels?.item(0)
      : element
    if (!target) throw new Error('The unit radio must have an associated label')
    const { x, y, width, height } = target.getBoundingClientRect()
    return { x, y, width, height }
  }, useAssociatedLabel)

  const description = `${name} target measures ${bounds.width}×${bounds.height} CSS pixels`
  expect(bounds.width, description).toBeGreaterThanOrEqual(44)
  expect(bounds.height, description).toBeGreaterThanOrEqual(44)
  return bounds
}

for (const width of [320, 639, 640, 767, 768, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 720 } })

    test('Primary Search, unit, and Retry targets are at least 44×44', async ({ page }) => {
      await page.goto('/')
      const search = page.getByRole('button', { name: 'Search', exact: true })
      await expectTargetSize(search, 'Search')

      // Select the unselected option each time, proving both measured labels act
      // as real pointer targets rather than merely occupying enough layout space.
      for (const name of ['Celsius (metric units)', 'Fahrenheit (imperial units)']) {
        const radio = page.getByRole('radio', { name, exact: true })
        await expect(radio).not.toBeChecked()
        const bounds = await expectTargetSize(radio, name, true)
        await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        await expect(radio).toBeChecked()
      }

      // The always-failing fixture avoids consuming the shared recovery scenario.
      await page.getByLabel('City', { exact: true }).fill('ProviderFailure')
      await search.click()
      await expect(page.getByRole('alert').getByRole('heading', {
        name: 'Weather is temporarily unavailable', exact: true,
      })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Weather results', exact: true }))
        .toHaveAttribute('aria-busy', 'false')
      await expectTargetSize(page.getByRole('button', { name: 'Retry', exact: true }), 'Retry')
    })
  })
}
