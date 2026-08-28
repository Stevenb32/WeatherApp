export type WeatherUnitSystem = "imperial" | "metric";

export interface WeatherResponse {
  location: WeatherLocation;
  unitSystem: WeatherUnitSystem;
  current: CurrentWeather;
  hourly: HourlyForecastEntry[];
  daily: DailyForecastEntry[];
}

export interface WeatherLocation {
  name: string;
  region: string;
  country: string;
  timeZoneId: string;
}

export interface CurrentWeather {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
}

export interface HourlyForecastEntry {
  time: string;
  temperature: number;
  condition: string;
  precipitationChance: number;
}

export interface DailyForecastEntry {
  date: string;
  minimumTemperature: number;
  maximumTemperature: number;
  condition: string;
  precipitationChance: number;
}
