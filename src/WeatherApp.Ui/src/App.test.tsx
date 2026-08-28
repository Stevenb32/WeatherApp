import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { getWeather } from './services/weatherApi.ts'
import type { WeatherResponse } from './types/weather.ts'

vi.mock('./services/weatherApi.ts', () => ({
  getWeather: vi.fn(),
}))

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
  hourly: [],
  daily: [],
}

const metricWeatherResponse: WeatherResponse = {
  ...imperialWeatherResponse,
  unitSystem: 'metric',
  current: {
    ...imperialWeatherResponse.current,
    temperature: 31,
    windSpeed: 13,
  },
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
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
  })

  it('removes previous results while a later request is pending', async () => {
    const user = userEvent.setup()
    const pendingRequest = createDeferred<WeatherResponse>()
    const orlandoWeatherResponse: WeatherResponse = {
      ...imperialWeatherResponse,
      location: {
        ...imperialWeatherResponse.location,
        name: 'Orlando',
      },
    }

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

    pendingRequest.resolve(orlandoWeatherResponse)

    expect(
      await screen.findByRole('heading', {
        name: 'Current weather for Orlando, Florida, United States of America',
      }),
    ).toBeVisible()
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

    await user.click(
      screen.getByRole('radio', { name: 'Celsius (metric units)' }),
    )

    expect(getWeatherMock).toHaveBeenNthCalledWith(2, 'Tampa', 'metric')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Updating weather for Tampa in metric units.',
    )
    expect(screen.getByText('Loading weather…')).toBeVisible()
    expect(screen.queryByText('87.8')).not.toBeInTheDocument()

    pendingMetricRequest.resolve(metricWeatherResponse)

    const metricWeatherRegion = await screen.findByRole('region', {
      name: 'Current weather for Tampa, Florida, United States of America',
    })

    expect(within(metricWeatherRegion).getByText('31')).toBeVisible()
    expect(within(metricWeatherRegion).getByText('°C')).toBeVisible()
    expect(within(metricWeatherRegion).getByText('13 km/h')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Weather loaded for Tampa.',
    )
  })

  it('renders a safe fallback when the service rejects', async () => {
    const user = userEvent.setup()
    getWeatherMock.mockRejectedValue(
      new Error('Network details that must not reach the user.'),
    )

    render(<App />)

    await submitCity(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t load the weather. Please try another search.',
    )
    expect(
      screen.queryByText('Network details that must not reach the user.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })
})
