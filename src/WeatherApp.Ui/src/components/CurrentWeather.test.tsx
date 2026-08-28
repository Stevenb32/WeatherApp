import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CurrentWeather as CurrentWeatherData } from "../types/weather.ts";
import CurrentWeather from "./CurrentWeather.tsx";

const imperialCurrentWeather: CurrentWeatherData = {
  temperature: 87.8,
  condition: "Partly cloudy",
  humidity: 70,
  windSpeed: 8.1,
  windDirection: "E",
};

describe("CurrentWeather", () => {
  it("renders every required current-weather field with imperial labels", () => {
    render(<CurrentWeather current={imperialCurrentWeather} unitSystem="imperial" />);

    expect(screen.getByText("87.8")).toBeVisible();
    expect(screen.getByText("°F")).toBeVisible();
    expect(screen.getByText("Partly cloudy")).toBeVisible();
    expect(screen.getByText("70%")).toBeVisible();
    expect(screen.getByText("8.1 mph")).toBeVisible();
    expect(screen.getByText("E")).toBeVisible();
  });

  it("uses metric labels without converting returned values", () => {
    const metricCurrentWeather: CurrentWeatherData = {
      ...imperialCurrentWeather,
      temperature: 31,
      windSpeed: 13,
    };

    render(<CurrentWeather current={metricCurrentWeather} unitSystem="metric" />);

    expect(screen.getByText("31")).toBeVisible();
    expect(screen.getByText("°C")).toBeVisible();
    expect(screen.getByText("13 km/h")).toBeVisible();
    expect(screen.queryByText("°F")).not.toBeInTheDocument();
    expect(screen.queryByText(/mph/)).not.toBeInTheDocument();
  });
});
