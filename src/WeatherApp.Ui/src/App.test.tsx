import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { getWeather, WeatherServiceError } from './services/weatherApi.ts'
import type { WeatherErrorCategory } from './services/weatherApi.ts'
import type { WeatherResponse } from './types/weather.ts'

vi.mock('./services/weatherApi.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./services/weatherApi.ts')>()

  return {
    ...actual,
    getWeather: vi.fn(),
  }
})

const getWeatherMock = vi.mocked(getWeather)

const imperialWeatherResponse: WeatherResponse = {
  location: {
    name: 'Tampa',
    region: 'Florida',
    country: 'United States of America',
    timeZoneId: 'America/New_York',
  },
  unitSystem: 'imperial',
  current: {
    temperature: 87.8,
    condition: 'Partly cloudy',
    humidity: 70,
    windSpeed: 8.1,
    windDirection: 'E',
  },
  hourly: [
    {
      time: '2026-08-28T12:00:00.000Z',
      temperature: 80.6,
      condition: 'Hourly sunshine',
      precipitationChance: 10,
    },
  ],
  daily: [
    {
      date: '2026-08-28',
      minimumTemperature: 72.25,
      maximumTemperature: 92.75,
      condition: 'Daily sunshine',
      precipitationChance: 15,
    },
    {
      date: '2026-08-29',
      minimumTemperature: 70.5,
      maximumTemperature: 88.25,
      condition: 'Daily showers',
      precipitationChance: 55,
    },
    {
      date: '2026-08-30',
      minimumTemperature: 68.75,
      maximumTemperature: 84.5,
      condition: 'Daily clouds',
      precipitationChance: 35,
    },
  ],
}

const metricWeatherResponse: WeatherResponse = {
  ...imperialWeatherResponse,
  unitSystem: 'metric',
  current: {
    ...imperialWeatherResponse.current,
    temperature: 31,
    windSpeed: 13,
  },
  hourly: [
    {
      ...imperialWeatherResponse.hourly[0],
      temperature: 27,
      condition: 'Metric hourly sunshine',
    },
  ],
  daily: [
    {
      ...imperialWeatherResponse.daily[0],
      minimumTemperature: 22.25,
      maximumTemperature: 33.75,
      condition: 'Metric daily sunshine',
    },
    {
      ...imperialWeatherResponse.daily[1],
      minimumTemperature: 21.5,
      maximumTemperature: 31.25,
      condition: 'Metric daily showers',
    },
    {
      ...imperialWeatherResponse.daily[2],
      minimumTemperature: 20.75,
      maximumTemperature: 29.5,
      condition: 'Metric daily clouds',
    },
  ],
}

const orlandoWeatherResponse: WeatherResponse = {
  ...imperialWeatherResponse,
  location: {
    ...imperialWeatherResponse.location,
    name: 'Orlando',
  },
}

const errorCases: ReadonlyArray<{
  category: WeatherErrorCategory
  heading: string
  guidance: string
}> = [
  {
    category: 'location-not-found',
    heading: 'Location not found',
    guidance:
      'We couldn’t find that location. Check the city name and search again, or retry.',
  },
  {
    category: 'provider-unavailable',
    heading: 'Weather is temporarily unavailable',
    guidance:
      'The weather service is temporarily unavailable. Please try again.',
  },
  {
    category: 'provider-timeout',
    heading: 'Weather took too long',
    guidance: 'The weather took too long to load. Please try again.',
  },
  {
    category: 'unexpected-failure',
    heading: 'Weather couldn’t be loaded',
    guidance:
      'Something went wrong while loading the weather. Please try again.',
  },
]

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined
  let reject: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

async function submitCity(
  user: ReturnType<typeof userEvent.setup>,
  location = 'Tampa',
) {
  const cityInput = screen.getByLabelText('City')

  await user.clear(cityInput)
  await user.type(cityInput, location)
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

describe('App', () => {
  beforeEach(() => {
    getWeatherMock.mockReset()
  })

  it('renders the initial controls and instructional state with imperial selected', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Weather App' }),
    ).toBeVisible()
    expect(screen.getByLabelText('City')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
    expect(
      screen.getByRole('radio', {
        name: 'Fahrenheit (imperial units)',
      }),
    ).toBeChecked()
    expect(
      screen.getByText('Search for a city to see its current weather.'),
    ).toBeVisible()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
    expect(getWeatherMock).not.toHaveBeenCalled()
  })

  it('does not call the service for invalid input', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByText('Enter a city.')).toBeVisible()
    expect(getWeatherMock).not.toHaveBeenCalled()
  })

  it('shows loading with controls present and disabled until the request completes', async () => {
    const user = userEvent.setup()
    const pendingRequest = createDeferred<WeatherResponse>()
    getWeatherMock.mockReturnValue(pendingRequest.promise)

    render(<App />)

    await submitCity(user)

    expect(getWeatherMock).toHaveBeenCalledWith('Tampa', 'imperial')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading weather for Tampa.',
    )
    expect(screen.getByText('Loading weather…')).toBeVisible()
    expect(screen.getByLabelText('City')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    expect(
      screen.getByRole('radio', {
        name: 'Fahrenheit (imperial units)',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('radio', { name: 'Celsius (metric units)' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('region', { name: 'Weather results' }),
    ).toHaveAttribute('aria-busy', 'true')

    pendingRequest.resolve(imperialWeatherResponse)

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Weather loaded for Tampa.',
    )
    expect(
      screen.getByRole('region', { name: 'Weather results' }),
    ).toHaveAttribute('aria-busy', 'false')
  })

  it('announces the resolved location without moving focus', async () => {
    const user = userEvent.setup()
    const pendingRequest = createDeferred<WeatherResponse>()
    getWeatherMock.mockReturnValue(pendingRequest.promise)

    render(<App />)

    const cityInput = screen.getByLabelText('City')

    await user.type(cityInput, '33601{Enter}')

    expect(cityInput).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading weather for 33601.',
    )

    pendingRequest.resolve(imperialWeatherResponse)

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Weather loaded for Tampa.',
    )
    expect(cityInput).toHaveFocus()
  })

  it('renders every required field after a successful request', async () => {
    const user = userEvent.setup()
    getWeatherMock.mockResolvedValue(imperialWeatherResponse)

    render(<App />)

    await submitCity(user, '  Tampa  ')

    expect(getWeatherMock).toHaveBeenCalledWith('Tampa', 'imperial')
    const currentWeatherRegion = await screen.findByRole('region', {
      name: 'Current weather for Tampa, Florida, United States of America',
    })

    expect(currentWeatherRegion).toBeVisible()
    expect(within(currentWeatherRegion).getByText('87.8')).toBeVisible()
    expect(within(currentWeatherRegion).getByText('°F')).toBeVisible()
    expect(
      within(currentWeatherRegion).getByText('Partly cloudy'),
    ).toBeVisible()
    expect(within(currentWeatherRegion).getByText('70%')).toBeVisible()
    expect(within(currentWeatherRegion).getByText('8.1 mph')).toBeVisible()
    expect(within(currentWeatherRegion).getByText('E')).toBeVisible()

    const hourlyForecastRegion = screen.getByRole('region', {
      name: 'Next 24 hours',
    })

    expect(within(hourlyForecastRegion).getByText('08:00')).toBeVisible()
    expect(within(hourlyForecastRegion).getByText('80.6')).toBeVisible()
    expect(within(hourlyForecastRegion).getByText('°F')).toBeVisible()
    expect(
      within(hourlyForecastRegion).getByText('Hourly sunshine'),
    ).toBeVisible()
    expect(
      within(hourlyForecastRegion).getByText('Precipitation chance: 10%'),
    ).toBeVisible()

    const dailyForecastRegion = screen.getByRole('region', {
      name: 'Three-day forecast',
    })

    expect(within(dailyForecastRegion).getByText('72.25')).toBeVisible()
    expect(within(dailyForecastRegion).getByText('92.75')).toBeVisible()
    expect(within(dailyForecastRegion).getAllByText('°F')).toHaveLength(6)
    expect(
      within(dailyForecastRegion).getByText('Daily sunshine'),
    ).toBeVisible()
    expect(within(dailyForecastRegion).getByText('15%')).toBeVisible()
  })

  it('removes previous results while a later request is pending and after it fails', async () => {
    const user = userEvent.setup()
    const pendingRequest = createDeferred<WeatherResponse>()

    getWeatherMock
      .mockResolvedValueOnce(imperialWeatherResponse)
      .mockReturnValueOnce(pendingRequest.promise)

    render(<App />)

    await submitCity(user)

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()
    expect(screen.getByText('Hourly sunshine')).toBeVisible()
    expect(screen.getByText('Daily sunshine')).toBeVisible()

    await submitCity(user, 'Orlando')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading weather for Orlando.',
    )
    expect(screen.getByText('Loading weather…')).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Next 24 hours' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Hourly sunshine')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Three-day forecast' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Daily sunshine')).not.toBeInTheDocument()

    pendingRequest.reject(new WeatherServiceError('location-not-found'))

    expect(
      await screen.findByRole('heading', {
        name: 'Location not found',
      }),
    ).toBeVisible()
    expect(screen.getByLabelText('City')).toHaveValue('Orlando')
    expect(
      screen.queryByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Next 24 hours' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Hourly sunshine')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Three-day forecast' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Daily sunshine')).not.toBeInTheDocument()
  })

  it('prevents duplicate submissions while a request is pending', async () => {
    const user = userEvent.setup()
    const pendingRequest = createDeferred<WeatherResponse>()
    getWeatherMock.mockReturnValue(pendingRequest.promise)

    render(<App />)

    await submitCity(user)

    const searchButton = screen.getByRole('button', { name: 'Search' })
    expect(searchButton).toBeDisabled()

    await user.click(searchButton)

    expect(getWeatherMock).toHaveBeenCalledOnce()

    pendingRequest.resolve(imperialWeatherResponse)

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()
  })

  it('refetches the submitted location when units change after success', async () => {
    const user = userEvent.setup()
    const pendingMetricRequest = createDeferred<WeatherResponse>()

    getWeatherMock
      .mockResolvedValueOnce(imperialWeatherResponse)
      .mockReturnValueOnce(pendingMetricRequest.promise)

    render(<App />)

    await submitCity(user, '  Tampa  ')

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()

    const imperialHourlyRegion = screen.getByRole('region', {
      name: 'Next 24 hours',
    })

    expect(within(imperialHourlyRegion).getByText('80.6')).toBeVisible()
    expect(within(imperialHourlyRegion).getByText('°F')).toBeVisible()
    expect(
      within(imperialHourlyRegion).getByText('Hourly sunshine'),
    ).toBeVisible()

    const imperialDailyRegion = screen.getByRole('region', {
      name: 'Three-day forecast',
    })

    expect(within(imperialDailyRegion).getByText('92.75')).toBeVisible()
    expect(within(imperialDailyRegion).getAllByText('°F')).toHaveLength(6)
    expect(
      within(imperialDailyRegion).getByText('Daily sunshine'),
    ).toBeVisible()

    await user.click(
      screen.getByRole('radio', { name: 'Celsius (metric units)' }),
    )

    expect(getWeatherMock).toHaveBeenNthCalledWith(2, 'Tampa', 'metric')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Updating weather for Tampa in metric units.',
    )
    expect(screen.getByText('Loading weather…')).toBeVisible()
    expect(screen.queryByText('87.8')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Next 24 hours' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Hourly sunshine')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Three-day forecast' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Daily sunshine')).not.toBeInTheDocument()

    pendingMetricRequest.resolve(metricWeatherResponse)

    const metricWeatherRegion = await screen.findByRole('region', {
      name: 'Current weather for Tampa, Florida, United States of America',
    })

    expect(within(metricWeatherRegion).getByText('31')).toBeVisible()
    expect(within(metricWeatherRegion).getByText('°C')).toBeVisible()
    expect(within(metricWeatherRegion).getByText('13 km/h')).toBeVisible()

    const metricHourlyRegion = screen.getByRole('region', {
      name: 'Next 24 hours',
    })

    expect(within(metricHourlyRegion).getByText('27')).toBeVisible()
    expect(within(metricHourlyRegion).getByText('°C')).toBeVisible()
    expect(
      within(metricHourlyRegion).getByText('Metric hourly sunshine'),
    ).toBeVisible()

    const metricDailyRegion = screen.getByRole('region', {
      name: 'Three-day forecast',
    })

    expect(within(metricDailyRegion).getByText('33.75')).toBeVisible()
    expect(within(metricDailyRegion).getAllByText('°C')).toHaveLength(6)
    expect(
      within(metricDailyRegion).getByText('Metric daily sunshine'),
    ).toBeVisible()
    expect(screen.queryByText('80.6')).not.toBeInTheDocument()
    expect(screen.queryByText('Hourly sunshine')).not.toBeInTheDocument()
    expect(screen.queryByText('92.75')).not.toBeInTheDocument()
    expect(screen.queryByText('Daily sunshine')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Weather loaded for Tampa.',
    )
  })

  it.each(errorCases)(
    'renders the $category error with safe, category-specific content',
    async ({ category, heading, guidance }) => {
      const user = userEvent.setup()
      getWeatherMock.mockRejectedValue(new WeatherServiceError(category))

      render(<App />)

      await submitCity(user)

      const resultsRegion = screen.getByRole('region', {
        name: 'Weather results',
      })
      const alert = await within(resultsRegion).findByRole('alert')

      expect(
        within(alert).getByRole('heading', { level: 2, name: heading }),
      ).toBeVisible()
      expect(within(alert).getByText(guidance)).toBeVisible()
      expect(alert).not.toHaveTextContent(category)
      expect(alert).not.toHaveTextContent('Unable to retrieve weather data.')
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    },
  )

  it('retries the submitted location with current units while preserving unsubmitted edits', async () => {
    const user = userEvent.setup()
    getWeatherMock
      .mockRejectedValueOnce(new WeatherServiceError('provider-unavailable'))
      .mockResolvedValueOnce(metricWeatherResponse)

    render(<App />)

    await submitCity(user)

    expect(
      await screen.findByRole('heading', {
        name: 'Weather is temporarily unavailable',
      }),
    ).toBeVisible()

    const cityInput = screen.getByLabelText('City')
    await user.clear(cityInput)
    await user.type(cityInput, 'Orlando')
    await user.click(
      screen.getByRole('radio', { name: 'Celsius (metric units)' }),
    )

    expect(getWeatherMock).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(getWeatherMock).toHaveBeenNthCalledWith(2, 'Tampa', 'metric')
    expect(cityInput).toHaveValue('Orlando')

    const metricWeatherRegion = await screen.findByRole('region', {
      name: 'Current weather for Tampa, Florida, United States of America',
    })

    expect(within(metricWeatherRegion).getByText('31')).toBeVisible()
    expect(within(metricWeatherRegion).getByText('°C')).toBeVisible()
  })

  it('uses the normal loading protection while Retry is pending', async () => {
    const user = userEvent.setup()
    const pendingRetry = createDeferred<WeatherResponse>()
    getWeatherMock
      .mockRejectedValueOnce(new WeatherServiceError('unexpected-failure'))
      .mockReturnValueOnce(pendingRetry.promise)

    render(<App />)

    await submitCity(user)

    await screen.findByRole('heading', {
      name: 'Weather couldn’t be loaded',
    })

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(getWeatherMock).toHaveBeenCalledTimes(2)
    expect(getWeatherMock).toHaveBeenNthCalledWith(2, 'Tampa', 'imperial')
    expect(screen.getByText('Loading weather…')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading weather for Tampa.',
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()

    const searchButton = screen.getByRole('button', { name: 'Search' })
    expect(searchButton).toBeDisabled()
    expect(
      screen.getByRole('radio', { name: 'Fahrenheit (imperial units)' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('radio', { name: 'Celsius (metric units)' }),
    ).toBeDisabled()

    await user.click(searchButton)

    expect(getWeatherMock).toHaveBeenCalledTimes(2)

    pendingRetry.resolve(imperialWeatherResponse)

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()
  })

  it('uses a newly submitted location as the next retry target', async () => {
    const user = userEvent.setup()
    getWeatherMock
      .mockRejectedValueOnce(new WeatherServiceError('location-not-found'))
      .mockRejectedValueOnce(new WeatherServiceError('provider-unavailable'))
      .mockResolvedValueOnce(orlandoWeatherResponse)

    render(<App />)

    await submitCity(user)

    expect(
      await screen.findByRole('heading', { name: 'Location not found' }),
    ).toBeVisible()

    await submitCity(user, 'Orlando')

    expect(
      await screen.findByRole('heading', {
        name: 'Weather is temporarily unavailable',
      }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(getWeatherMock).toHaveBeenNthCalledWith(3, 'Orlando', 'imperial')
    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Orlando, Florida, United States of America',
      }),
    ).toBeVisible()
  })

  it('uses typed error handling when a unit-change refetch fails', async () => {
    const user = userEvent.setup()
    getWeatherMock
      .mockResolvedValueOnce(imperialWeatherResponse)
      .mockRejectedValueOnce(new WeatherServiceError('provider-timeout'))

    render(<App />)

    await submitCity(user)

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('radio', { name: 'Celsius (metric units)' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Weather took too long' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Current weather for Tampa, Florida, United States of America',
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('87.8')).not.toBeInTheDocument()
    expect(screen.getByLabelText('City')).toHaveValue('Tampa')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('renders a safe unexpected-failure fallback without moving focus', async () => {
    const user = userEvent.setup()
    getWeatherMock.mockRejectedValue(
      new Error('Network details that must not reach the user.'),
    )

    render(<App />)

    const cityInput = screen.getByLabelText('City')

    await user.type(cityInput, 'Tampa{Enter}')

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByRole('heading')).toHaveTextContent(
      'Weather couldn’t be loaded',
    )
    expect(alert).toHaveTextContent(
      'Something went wrong while loading the weather. Please try again.',
    )
    expect(
      screen.queryByText('Network details that must not reach the user.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(cityInput).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })
})
