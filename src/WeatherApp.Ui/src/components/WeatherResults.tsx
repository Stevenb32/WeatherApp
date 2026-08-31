import type { WeatherLocation, WeatherResponse } from "../types/weather.ts";
import CurrentWeather from "./CurrentWeather.tsx";
import HourlyForecast from "./HourlyForecast.tsx";

interface WeatherResultsProps {
  weather: WeatherResponse;
}

function formatResolvedLocation(location: WeatherLocation) {
  return [location.name, location.region, location.country]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(", ");
}

function WeatherResults({ weather }: WeatherResultsProps) {
  const resolvedLocation = formatResolvedLocation(weather.location);

  return (
    <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
      <section aria-labelledby="current-weather-heading">
        <h2
          id="current-weather-heading"
          className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
        >
          <span className="sr-only">Current weather for</span> {resolvedLocation}
        </h2>

        <CurrentWeather current={weather.current} unitSystem={weather.unitSystem} />
      </section>

      <HourlyForecast
        hourly={weather.hourly}
        unitSystem={weather.unitSystem}
        timeZoneId={weather.location.timeZoneId}
      />
    </div>
  );
}

export default WeatherResults;
