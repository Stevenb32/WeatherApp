import { test, expect, withPendingWeatherRequest } from './fixtures.ts'

test('Tampa imperial search', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Weather App', level: 1 })).toBeVisible()
  await expect(page.getByLabel('City', { exact: true })).toBeVisible()
  await expect(page.getByLabel('City', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled()
  await expect(page.getByRole('radio', { name: 'Fahrenheit (imperial units)' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Celsius (metric units)' })).not.toBeChecked()

  const results = page.getByRole('region', { name: 'Weather results', exact: true })
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.getByText('Search for a city to see its current weather.', { exact: true })).toBeVisible()

  await page.getByLabel('City', { exact: true }).fill('Tampa')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  const resolvedLocation = 'Current weather for Tampa, Florida, United States of America'
  const current = results.getByRole('region', { name: resolvedLocation, exact: true })
  await expect(current.getByRole('heading', { name: resolvedLocation, level: 2 })).toBeVisible()
  await expect(current.getByText(/^87\.8\s*°F$/)).toBeVisible()
  await expect(current.getByText('Partly cloudy', { exact: true })).toBeVisible()
  await expect(current.getByRole('definition')).toHaveText(['70%', '8.1 mph', 'E'])

  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.getByText('Loading weather…', { exact: true })).toHaveCount(0)

  const hourly = results.getByRole('region', { name: 'Next 24 hours', exact: true })
  const hours = hourly.getByRole('list').getByRole('listitem')
  await expect(hours).toHaveCount(24)

  const representativeHours = [
    { index: 0, time: '21:00' },
    { index: 12, time: '09:00' },
    { index: 23, time: '20:00' },
  ]

  for (const { index, time } of representativeHours) {
    const hour = hours.nth(index)
    await hour.scrollIntoViewIfNeeded()
    await expect(hour.getByText(time, { exact: true })).toBeVisible()
    await expect(hour.getByText(/^80\.6\s*°F$/)).toBeVisible()
    await expect(hour.getByText('Sunny', { exact: true })).toBeVisible()
    await expect(hour.getByText('Precipitation chance: 10%', { exact: true })).toBeVisible()
  }

  const daily = results.getByRole('region', { name: 'Three-day forecast', exact: true })
  const days = daily.getByRole('list').getByRole('listitem')
  await expect(days).toHaveCount(3)

  const expectedDates = [
    'Thursday, August 20, 2026',
    'Friday, August 21, 2026',
    'Saturday, August 22, 2026',
  ]

  for (const [index, date] of expectedDates.entries()) {
    const day = days.nth(index)
    await day.scrollIntoViewIfNeeded()
    await expect(day.getByText(date, { exact: true })).toBeVisible()
    await expect(day.getByRole('definition')).toHaveText([
      /^77\s*°F$/,
      /^91\.4\s*°F$/,
      'Partly cloudy',
      '40%',
    ])
  }
})

test('Metric unit change', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('City', { exact: true }).fill('Tampa')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  const results = page.getByRole('region', { name: 'Weather results', exact: true })
  const resolvedLocation = 'Current weather for Tampa, Florida, United States of America'
  const current = results.getByRole('region', { name: resolvedLocation, exact: true })
  const hourly = results.getByRole('region', { name: 'Next 24 hours', exact: true })
  const daily = results.getByRole('region', { name: 'Three-day forecast', exact: true })
  const hours = hourly.getByRole('list').getByRole('listitem')
  const days = daily.getByRole('list').getByRole('listitem')
  const imperial = page.getByRole('radio', { name: 'Fahrenheit (imperial units)' })
  const metric = page.getByRole('radio', { name: 'Celsius (metric units)' })

  await expect(imperial).toBeChecked()
  await expect(current.getByText(/^87\.8\s*°F$/)).toBeVisible()
  await expect(current.getByRole('definition')).toHaveText(['70%', '8.1 mph', 'E'])
  await expect(hours.first().getByText(/^80\.6\s*°F$/)).toBeVisible()
  await expect(days.first().getByRole('definition')).toHaveText([
    /^77\s*°F$/,
    /^91\.4\s*°F$/,
    'Partly cloudy',
    '40%',
  ])

  await withPendingWeatherRequest(
    page,
    { location: 'Tampa', units: 'metric' },
    () => metric.press('Space'),
    async () => {
      await expect(metric).toBeChecked()
      await expect(results).toHaveAttribute('aria-busy', 'true')
      await expect(results.getByText('Loading weather…', { exact: true })).toBeVisible()
      await expect(current).toHaveCount(0)
      await expect(hourly).toHaveCount(0)
      await expect(daily).toHaveCount(0)
    },
  )

  await expect(current.getByRole('heading', { name: resolvedLocation, level: 2 })).toBeVisible()
  await expect(current.getByText(/^31\s*°C$/)).toBeVisible()
  await expect(current.getByText('Partly cloudy', { exact: true })).toBeVisible()
  await expect(current.getByRole('definition')).toHaveText(['70%', '13 km/h', 'E'])
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.getByText('Loading weather…', { exact: true })).toHaveCount(0)
  await expect(metric).toBeChecked()
  await expect(imperial).not.toBeChecked()

  await expect(hours).toHaveCount(24)
  const middleHour = hours.nth(12)
  await middleHour.scrollIntoViewIfNeeded()
  await expect(middleHour.getByText('09:00', { exact: true })).toBeVisible()
  await expect(middleHour.getByText(/^27\s*°C$/)).toBeVisible()
  await expect(middleHour.getByText('Sunny', { exact: true })).toBeVisible()
  await expect(middleHour.getByText('Precipitation chance: 10%', { exact: true })).toBeVisible()

  await expect(days).toHaveCount(3)
  const firstDay = days.first()
  await firstDay.scrollIntoViewIfNeeded()
  await expect(firstDay.getByText('Thursday, August 20, 2026', { exact: true })).toBeVisible()
  await expect(firstDay.getByRole('definition')).toHaveText([
    /^25\s*°C$/,
    /^33\s*°C$/,
    'Partly cloudy',
    '40%',
  ])

  // Scope to results because the unit selector still offers Fahrenheit.
  await expect(results).not.toContainText(/°F|\bmph\b/)
  await expect(results).not.toContainText(/87\.8|80\.6|\b77\b|91\.4/)
})

test('Unknown location', async ({ page }) => {
  await page.goto('/')

  const city = page.getByLabel('City', { exact: true })
  const search = page.getByRole('button', { name: 'Search', exact: true })
  const results = page.getByRole('region', { name: 'Weather results', exact: true })
  const current = results.getByRole('region', {
    name: 'Current weather for Tampa, Florida, United States of America',
    exact: true,
  })
  const hourly = results.getByRole('region', { name: 'Next 24 hours', exact: true })
  const daily = results.getByRole('region', { name: 'Three-day forecast', exact: true })

  // Load prior results within this test to prove the error clears them.
  await city.fill('Tampa')
  await search.click()
  await expect(current).toBeVisible()
  await expect(hourly).toBeVisible()
  await expect(daily).toBeVisible()

  await city.fill('NotARealPlace')
  await search.click()

  const alert = results.getByRole('alert')
  await expect(alert.getByRole('heading', { name: 'Location not found', level: 2, exact: true })).toBeVisible()
  await expect(alert.getByText(
    'We couldn’t find that location. Check the city name and search again, or retry.',
    { exact: true },
  )).toBeVisible()
  await expect(current).toHaveCount(0)
  await expect(hourly).toHaveCount(0)
  await expect(daily).toHaveCount(0)
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.getByText('Loading weather…', { exact: true })).toHaveCount(0)

  await expect(city).toHaveValue('NotARealPlace')
  await expect(city).toBeEditable()
  await expect(search).toBeEnabled()

  // These are the raw provider fixture details, not user-facing error copy.
  await expect(page.getByRole('main')).not.toContainText(/1006|No matching location found\.|WeatherAPI/i)
})

test('Provider failure and Retry recovery', async ({ page }) => {
  await page.goto('/')

  const city = page.getByLabel('City', { exact: true })
  const metric = page.getByRole('radio', { name: 'Celsius (metric units)' })
  const results = page.getByRole('region', { name: 'Weather results', exact: true })
  const alert = results.getByRole('alert')
  const retry = results.getByRole('button', { name: 'Retry', exact: true })
  const resolvedLocation = 'Current weather for Tampa, Florida, United States of America'
  const current = results.getByRole('region', { name: resolvedLocation, exact: true })

  await metric.press('Space')
  await expect(metric).toBeChecked()
  await city.fill('RetryRecovery')
  await page.getByRole('button', { name: 'Search', exact: true }).click()

  await expect(alert.getByRole('heading', {
    name: 'Weather is temporarily unavailable',
    level: 2,
    exact: true,
  })).toBeVisible()
  await expect(alert.getByText(
    'The weather service is temporarily unavailable. Please try again.',
    { exact: true },
  )).toBeVisible()
  await expect(retry).toBeVisible()
  await expect(retry).toBeEnabled()
  await expect(results).toHaveAttribute('aria-busy', 'false')

  // An unsubmitted edit must not replace the location used by Retry.
  await city.fill('NotARealPlace')
  await withPendingWeatherRequest(
    page,
    { location: 'RetryRecovery', units: 'metric' },
    () => retry.click(),
    async () => {
      await expect(results).toHaveAttribute('aria-busy', 'true')
      await expect(results.getByText('Loading weather…', { exact: true })).toBeVisible()
      await expect(alert).toHaveCount(0)
      await expect(retry).toHaveCount(0)
      await expect(current).toHaveCount(0)
    },
  )

  // The recovery fixture resolves RetryRecovery to the fixed Tampa weather.
  await expect(current.getByRole('heading', { name: resolvedLocation, level: 2 })).toBeVisible()
  await expect(current.getByText(/^31\s*°C$/)).toBeVisible()
  await expect(current.getByRole('definition')).toHaveText(['70%', '13 km/h', 'E'])
  await expect(results.getByRole('region', { name: 'Next 24 hours', exact: true })).toBeVisible()
  await expect(results.getByRole('region', { name: 'Three-day forecast', exact: true })).toBeVisible()
  await expect(metric).toBeChecked()
  await expect(city).toHaveValue('NotARealPlace')
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.getByText('Loading weather…', { exact: true })).toHaveCount(0)
  await expect(alert).toHaveCount(0)
  await expect(retry).toHaveCount(0)
})
