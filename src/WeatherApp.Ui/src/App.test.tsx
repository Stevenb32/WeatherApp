import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App.tsx'

test('renders the Weather App shell', () => {
  render(<App />)

  expect(
    screen.getByRole('heading', { level: 1, name: 'Weather App' }),
  ).toBeInTheDocument()
})
