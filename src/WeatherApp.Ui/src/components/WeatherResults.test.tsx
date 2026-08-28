import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WeatherResponse } from "../types/weather.ts";
import WeatherResults from "./WeatherResults.tsx";

const weatherResponse: WeatherResponse = {
  location: {
    name: "Tampa",
    region: "Florida",
    country: "United States of America",
    timeZoneId: "America/New_York",
  },
  unitSystem: "imperial",
  current: {
    temperature: 87.8,
    condition: "Partly cloudy",
    humidity: 70,
    windSpeed: 8.1,
    windDirection: "E",
  },
  hourly: [],
  daily: [],
};

describe("WeatherResults", () => {
  it("renders the resolved location and current-weather content", () => {
    render(<WeatherResults weather={weatherResponse} />);

    expect(
      screen.getByRole("region", {
        name: "Current weather for Tampa, Florida, United States of America",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Current weather for Tampa, Florida, United States of America",
      }),
    ).toBeVisible();
    expect(screen.getByText("87.8")).toBeVisible();
    expect(screen.getByText("Partly cloudy")).toBeVisible();
  });

  it("omits empty location parts without leaving extra punctuation", () => {
    const weatherWithoutRegion: WeatherResponse = {
      ...weatherResponse,
      location: {
        ...weatherResponse.location,
        name: "London",
        region: "   ",
        country: "United Kingdom",
      },
    };

    render(<WeatherResults weather={weatherWithoutRegion} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Current weather for London, United Kingdom",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/London,\s*,/)).not.toBeInTheDocument();
  });
});
