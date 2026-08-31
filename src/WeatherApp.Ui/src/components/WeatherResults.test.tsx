import { render, screen, within } from "@testing-library/react";
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
  hourly: [
    {
      time: "2026-08-28T12:00:00.000Z",
      temperature: 80.6,
      condition: "Sunny intervals",
      precipitationChance: 10,
    },
    {
      time: "2026-08-28T13:00:00.000Z",
      temperature: 81.4,
      condition: "Light rain showers",
      precipitationChance: 35,
    },
  ],
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

  it("renders the hourly forecast after current conditions with response context", () => {
    render(<WeatherResults weather={weatherResponse} />);

    const currentWeatherRegion = screen.getByRole("region", {
      name: "Current weather for Tampa, Florida, United States of America",
    });
    const hourlySection = screen.getByRole("region", { name: "Next 24 hours" });
    const hourlyEntries = within(hourlySection).getAllByRole("listitem");

    expect(
      currentWeatherRegion.compareDocumentPosition(hourlySection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(hourlyEntries).toHaveLength(2);

    const firstHourlyEntry = within(hourlyEntries[0]);

    expect(firstHourlyEntry.getByText("08:00")).toBeVisible();
    expect(firstHourlyEntry.getByText("80.6")).toBeVisible();
    expect(firstHourlyEntry.getByText("°F")).toBeVisible();
    expect(firstHourlyEntry.getByText("Sunny intervals")).toBeVisible();
    expect(firstHourlyEntry.getByText("Precipitation chance: 10%")).toBeVisible();
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
