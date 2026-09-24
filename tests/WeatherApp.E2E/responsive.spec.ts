import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures.ts'

const widths = [320, 639, 640, 767, 768, 1280]
// Browser layout can round fractional CSS pixels differently from scroll metrics.
const tolerance = 1
const hourlyName = 'Next 24 hours hourly forecast'
const longLocation = 'The Long Coastal Municipality of North Weather Harbor, The Extended Metropolitan Weather Observation District, United States of America'
const longCondition = 'Patchy light rain with thunder expected throughout the afternoon'
const dates = ['Thursday, August 20, 2026', 'Friday, August 21, 2026', 'Saturday, August 22, 2026']

async function box(locator: Locator) {
  await expect(locator).toBeVisible()
  const bounds = await locator.boundingBox()
  expect(bounds, 'A visible element must have a layout box').not.toBeNull()
  return bounds!
}

async function expectPageContainment(page: Page, hasHourly: boolean) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(dimensions.document, `Document overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + tolerance)
  expect(dimensions.body, `Body overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + tolerance)

  // Inspect actual scroll containers, not wide descendants inside the hourly list.
  const scrollers = await page.getByRole('main').evaluate((main, epsilon) =>
    Array.from(main.querySelectorAll('*'))
      .filter((element) => {
        const style = getComputedStyle(element)
        return /^(auto|scroll)$/.test(style.overflowX) &&
          element.clientWidth > 0 && element.scrollWidth > element.clientWidth + epsilon
      })
      .map((element) => element.getAttribute('aria-label') ?? element.tagName),
  tolerance)
  expect(scrollers, 'Only the named hourly region may scroll horizontally').toEqual(hasHourly ? [hourlyName] : [])
}

async function expectSearchLayout(page: Page, width: number) {
  const city = await box(page.getByLabel('City', { exact: true }))
  const search = await box(page.getByRole('button', { name: 'Search', exact: true }))
  if (width < 640) {
    expect(search.y).toBeGreaterThanOrEqual(city.y + city.height - tolerance)
    expect(Math.abs(search.x - city.x)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(search.width - city.width)).toBeLessThanOrEqual(tolerance)
  } else {
    expect(search.x).toBeGreaterThanOrEqual(city.x + city.width - tolerance)
    expect(Math.abs(search.y - city.y)).toBeLessThanOrEqual(tolerance)
  }
}

async function expectTextContained(containers: Locator) {
  // Semantic text elements are measured within their section/card. Hourly cards
  // may be outside the viewport; their own text must still fit inside each card.
  const problems = await containers.evaluateAll((roots, epsilon) => {
    const failures: string[] = []
    for (const root of roots) {
      const outer = root.getBoundingClientRect()
      for (const element of root.querySelectorAll('h2, p, dt, dd, time')) {
        const label = element.textContent?.trim() ?? element.tagName
        const bounds = element.getBoundingClientRect()
        if (bounds.width <= 0 || bounds.height <= 0) {
          failures.push(`Hidden text: ${label}`)
          continue
        }
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          if (!node.textContent?.trim()) continue
          const parent = node.parentElement!
          // The location heading contains a deliberately screen-reader-only prefix.
          const parentStyle = getComputedStyle(parent)
          if (node.textContent.trim() === 'Current weather for' &&
              parent.getBoundingClientRect().width <= 1 &&
              (parentStyle.clip !== 'auto' || parentStyle.clipPath !== 'none')) continue
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.left < outer.left - epsilon || rect.right > outer.right + epsilon ||
                rect.top < outer.top - epsilon || rect.bottom > outer.bottom + epsilon) {
              failures.push(`Text escapes its section/card: ${label}`)
            }
            // Leaf text boxes must expand with their text, including wrapped lines.
            if (element.children.length === 0 &&
                (rect.left < bounds.left - epsilon || rect.right > bounds.right + epsilon ||
                 rect.top < bounds.top - epsilon || rect.bottom > bounds.bottom + epsilon)) {
              failures.push(`Text escapes its own box: ${label}`)
            }
            // Check clipping ancestors too; a page can hide overflow without fixing it.
            for (let ancestor: Element | null = parent; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
              const style = getComputedStyle(ancestor)
              const clip = ancestor.getBoundingClientRect()
              if ((style.overflowX !== 'visible' && (rect.left < clip.left - epsilon || rect.right > clip.right + epsilon)) ||
                  (style.overflowY !== 'visible' && (rect.top < clip.top - epsilon || rect.bottom > clip.bottom + epsilon)) ||
                  style.clipPath !== 'none' || style.clip !== 'auto' ||
                  style.textOverflow === 'ellipsis' || (style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '')) {
                failures.push(`Clipped or truncated text: ${label}`)
              }
            }
          }
        }
      }
    }
    return [...new Set(failures)]
  }, tolerance)
  expect(problems, 'Meaningful text must fit without clipping or truncation').toEqual([])
}

async function searchWeather(page: Page, location: 'Tampa' | 'LongContent') {
  await page.getByLabel('City', { exact: true }).fill(location)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('heading', {
    name: `Current weather for ${location === 'Tampa' ? 'Tampa, Florida, United States of America' : longLocation}`,
    exact: true,
  })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Weather results', exact: true })).toHaveAttribute('aria-busy', 'false')
}

async function lineCount(text: Locator) {
  return text.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size
  })
}

async function expectWeatherLayout(page: Page, width: number, long: boolean) {
  const current = page.getByRole('region', { name: /^Current weather for / })
  const heading = current.getByRole('heading', { level: 2 })
  const condition = current.getByText(long ? longCondition : 'Partly cloudy', { exact: true })
  const temperature = current.getByText(/^87\.8\s*°F$/)
  const hourly = page.getByRole('region', { name: hourlyName, exact: true })
  const hours = hourly.getByRole('listitem')
  const daily = page.getByRole('region', { name: 'Three-day forecast', exact: true })
  const days = daily.getByRole('listitem')

  await expect(condition).toBeVisible()
  await expect(current.getByRole('term')).toHaveText(['Humidity', 'Wind speed', 'Wind direction'])
  await expect(current.getByRole('definition')).toHaveText(['70%', '8.1 mph', long ? 'ENE' : 'E'])
  const tempBox = await box(temperature)
  const conditionBox = await box(condition)
  if (width < 640) {
    expect(conditionBox.y).toBeGreaterThanOrEqual(tempBox.y + tempBox.height - tolerance)
  } else {
    expect(conditionBox.x).toBeGreaterThanOrEqual(tempBox.x + tempBox.width - tolerance)
  }

  await expect(hours).toHaveCount(24)
  await expect(days).toHaveCount(3)
  await expect(daily.locator('time')).toHaveText(dates)
  await expect(hourly.getByText(long ? longCondition : 'Sunny', { exact: true })).toHaveCount(24)
  await expect(daily.getByText(long ? longCondition : 'Partly cloudy', { exact: true })).toHaveCount(3)
  const dayBoxes = await Promise.all([0, 1, 2].map((index) => box(days.nth(index))))
  for (let index = 1; index < dayBoxes.length; index++) {
    const previous = dayBoxes[index - 1]
    const next = dayBoxes[index]
    if (width < 768) {
      expect(next.y).toBeGreaterThanOrEqual(previous.y + previous.height - tolerance)
      expect(Math.abs(next.x - previous.x)).toBeLessThanOrEqual(tolerance)
    } else {
      expect(next.x).toBeGreaterThanOrEqual(previous.x + previous.width - tolerance)
      expect(Math.abs(next.y - previous.y)).toBeLessThanOrEqual(tolerance)
    }
  }

  await expectTextContained(current)
  await expectTextContained(hours)
  await expectTextContained(days)
  await expectSearchLayout(page, width)
  await expectPageContainment(page, true)
  return {
    heading: (await box(heading)).height,
    condition: conditionBox.height,
    hourlyCard: (await box(hours.first())).height,
    dailyCard: dayBoxes[0].height,
    conditionLines: await lineCount(condition),
    dailyConditionLines: await lineCount(days.first().getByText(long ? longCondition : 'Partly cloudy', { exact: true })),
  }
}

for (const width of widths) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 720 } })

    test('Tampa layout and idle/error containment', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Search for a city to see its current weather.', { exact: true })).toBeVisible()
      await expectSearchLayout(page, width)
      await expectPageContainment(page, false)

      await searchWeather(page, 'Tampa')
      await expectWeatherLayout(page, width, false)

      await page.getByLabel('City', { exact: true }).fill('ProviderFailure')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await expect(page.getByRole('alert').getByRole('heading', { name: 'Weather is temporarily unavailable', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Weather results', exact: true })).toHaveAttribute('aria-busy', 'false')
      await expectTextContained(page.getByRole('alert'))
      await expectSearchLayout(page, width)
      await expectPageContainment(page, false)
    })

    test('LongContent wraps and grows without clipping', async ({ page }) => {
      await page.goto('/')
      await searchWeather(page, 'Tampa')
      const normal = await expectWeatherLayout(page, width, false)
      await searchWeather(page, 'LongContent')
      const expanded = await expectWeatherLayout(page, width, true)
      for (const key of ['heading', 'hourlyCard'] as const) {
        expect(expanded[key], `${key} must grow for the long-content fixture`).toBeGreaterThan(normal[key] + tolerance)
      }
      // Longer text can still fit on one line at wider layouts. Require growth
      // where the browser actually wrapped it, rather than forcing extra lines.
      if (expanded.conditionLines > normal.conditionLines) {
        expect(expanded.condition).toBeGreaterThan(normal.condition + tolerance)
      }
      if (expanded.dailyConditionLines > normal.dailyConditionLines) {
        expect(expanded.dailyCard).toBeGreaterThan(normal.dailyCard + tolerance)
      }
    })
  })
}
