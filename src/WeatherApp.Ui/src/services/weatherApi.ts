import type { WeatherResponse, WeatherUnitSystem } from "../types/weather.ts";

export type WeatherErrorCategory = "location-not-found" | "provider-unavailable" | "provider-timeout" | "unexpected-failure";

export class WeatherServiceError extends Error {
  readonly category: WeatherErrorCategory;

  constructor(category: WeatherErrorCategory) {
    super("Unable to retrieve weather data.");
    this.name = "WeatherServiceError";
    this.category = category;
  }
}

function getErrorCategory(status: number): WeatherErrorCategory {
  switch (status) {
    case 404:
      return "location-not-found";
    case 503:
      return "provider-unavailable";
    case 504:
      return "provider-timeout";
    default:
      return "unexpected-failure";
  }
}

export async function getWeather(location: string, units: WeatherUnitSystem): Promise<WeatherResponse> {
  try {
    const query = new URLSearchParams({ location, units });
    const response = await fetch(`/api/weather?${query.toString()}`);

    if (!response.ok) {
      throw new WeatherServiceError(getErrorCategory(response.status));
    }

    return (await response.json()) as WeatherResponse;
  } catch (error) {
    if (error instanceof WeatherServiceError) {
      throw error;
    }

    throw new WeatherServiceError("unexpected-failure");
  }
}
