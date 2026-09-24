import { test, expect, withPendingWeatherRequest } from './fixtures.ts'

test('Keyboard-only search, native units, and hourly scrolling', async ({ page }) => {
  await page.goto('/')

  const imperial = page.getByRole('radio', { name: 'Fahrenheit (imperial units)' })
  const metric = page.getByRole('radio', { name: 'Celsius (metric units)' })
  const city = page.getByLabel('City', { exact: true })
  const search = page.getByRole('button', { name: 'Search', exact: true })
  const results = page.getByRole('region', { name: 'Weather results', exact: true })
  const current = results.getByRole('region', {
    name: 'Current weather for Tampa, Florida, United States of America',
    exact: true,
  })
  const hourlyScroll = results.getByRole('region', {
    name: 'Next 24 hours hourly forecast',
    exact: true,
  })

  await test.step('Tab enters the radio group and arrow keys change its selection', async () => {
    await page.keyboard.press('Tab')
    await expect(imperial).toBeFocused()
    await expect(imperial).toBeChecked()

    await page.keyboard.press('ArrowRight')
    await expect(metric).toBeFocused()
    await expect(metric).toBeChecked()
    await expect(imperial).not.toBeChecked()

    await page.keyboard.press('ArrowLeft')
    await expect(imperial).toBeFocused()
    await expect(imperial).toBeChecked()
    await expect(metric).not.toBeChecked()

    // Native radio groups occupy one Tab stop, so the next stop is City.
    await page.keyboard.press('Tab')
    await expect(city).toBeFocused()
  })

  await test.step('Enter submits City and focus stays usable through loading and success', async () => {
    await page.keyboard.type('Tampa')
    await withPendingWeatherRequest(
      page,
      { location: 'Tampa', units: 'imperial' },
      () => page.keyboard.press('Enter'),
      async () => {
        await expect(results).toHaveAttribute('aria-busy', 'true')
        await expect(results.getByText('Loading weather…', { exact: true })).toBeVisible()
        await expect(city).toBeFocused()
        await expect(search).toHaveAttribute('aria-disabled', 'true')
        await page.keyboard.press('Tab')
        await expect(search).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(city).toBeFocused()
      },
    )

    await expect(current.getByText(/^87\.8\s*°F$/)).toBeVisible()
    await expect(results).toHaveAttribute('aria-busy', 'false')
    await expect(city).toBeFocused()
  })

  await test.step('Tab reaches the hourly region, ArrowRight scrolls it, and Shift+Tab leaves it', async () => {
    await page.keyboard.press('Tab')
    await expect(search).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(hourlyScroll).toBeFocused()

    const initialScrollLeft = await hourlyScroll.evaluate((element) => element.scrollLeft)
    await page.keyboard.press('ArrowRight')
    // Native scrolling can animate; wait for movement without a fixed sleep.
    await expect.poll(() => hourlyScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initialScrollLeft)
    await expect(hourlyScroll).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(search).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(city).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(imperial).toBeFocused()
  })

  await test.step('Changing units with an arrow key preserves focus through the refetch', async () => {
    await withPendingWeatherRequest(
      page,
      { location: 'Tampa', units: 'metric' },
      () => page.keyboard.press('ArrowRight'),
      async () => {
        await expect(metric).toBeChecked()
        await expect(metric).toBeFocused()
        await expect(metric).toHaveAttribute('aria-disabled', 'true')
        await expect(results).toHaveAttribute('aria-busy', 'true')
        await page.keyboard.press('Tab')
        await expect(city).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(metric).toBeFocused()
      },
    )

    await expect(current.getByText(/^31\s*°C$/)).toBeVisible()
    await expect(results).toHaveAttribute('aria-busy', 'false')
    await expect(metric).toBeChecked()
    await expect(metric).toBeFocused()
  })
})
