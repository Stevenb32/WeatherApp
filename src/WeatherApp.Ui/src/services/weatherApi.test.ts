import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherResponse } from "../types/weather.ts";
import type { WeatherErrorCategory } from "./weatherApi.ts";
import { getWeather, WeatherServiceError } from "./weatherApi.ts";

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
      time: "2026-08-28T01:00:00+00:00",
      temperature: 80.6,
      condition: "Sunny",
      precipitationChance: 10,
    },
  ],
  daily: [
    {
      date: "2026-08-28",
      minimumTemperature: 77,
      maximumTemperature: 91.4,
      condition: "Partly cloudy",
      precipitationChance: 40,
    },
  ],
};

const fetchMock = vi.fn<typeof fetch>();

function mockSuccessfulResponse() {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(weatherResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockErrorResponse(status: number) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ detail: "Provider-specific failure." }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function getRequestedUrl() {
  const request = fetchMock.mock.calls[0]?.[0];

  if (typeof request !== "string") {
    throw new Error("Expected fetch to receive a string URL.");
  }

  return request;
}

function parseRequestedUrl() {
  return new URL(getRequestedUrl(), "https://weather.test");
}

async function expectWeatherError(request: Promise<WeatherResponse>, expectedCategory: WeatherErrorCategory) {
  const error = await request.catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(WeatherServiceError);
  expect(error).toMatchObject({
    name: "WeatherServiceError",
    message: "Unable to retrieve weather data.",
    category: expectedCategory,
  });
  expect(error).not.toHaveProperty("response");
  expect(error).not.toHaveProperty("status");
}

describe("getWeather", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockSuccessfulResponse();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encodes a multi-word location containing punctuation", async () => {
    await getWeather("St. John's", "imperial");

    const requestedUrl = getRequestedUrl();
    const parsedUrl = parseRequestedUrl();

    expect(requestedUrl).not.toContain(" ");
    expect(requestedUrl).toContain("St.+John%27s");
    expect(parsedUrl.pathname).toBe("/api/weather");
    expect(parsedUrl.searchParams.get("location")).toBe("St. John's");
  });

  it("includes imperial units in the query", async () => {
    await getWeather("Tampa", "imperial");

    const parsedUrl = parseRequestedUrl();

    expect(parsedUrl.pathname).toBe("/api/weather");
    expect(parsedUrl.searchParams.get("units")).toBe("imperial");
  });

  it("includes metric units in the query", async () => {
    await getWeather("Tampa", "metric");

    const parsedUrl = parseRequestedUrl();

    expect(parsedUrl.pathname).toBe("/api/weather");
    expect(parsedUrl.searchParams.get("units")).toBe("metric");
  });

  it("parses and returns a successful weather response", async () => {
    const result = await getWeather("Tampa", "imperial");

    expect(result).toEqual(weatherResponse);
  });

  it.each([
    [404, "location-not-found"],
    [503, "provider-unavailable"],
    [504, "provider-timeout"],
    [500, "unexpected-failure"],
  ] as const)("maps a %i response to %s", async (status, expectedCategory) => {
    mockErrorResponse(status);

    await expectWeatherError(getWeather("Tampa", "imperial"), expectedCategory);
  });

  it("maps a rejected fetch to an unexpected failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network connection failed with technical details."));

    await expectWeatherError(getWeather("Tampa", "imperial"), "unexpected-failure");
  });
});
