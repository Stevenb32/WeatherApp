import type { WeatherLocation, WeatherResponse } from "../types/weather.ts";
import CurrentWeather from "./CurrentWeather.tsx";

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
    <section aria-labelledby="current-weather-heading" className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="current-weather-heading" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        <span className="sr-only">Current weather for</span> {resolvedLocation}
      </h2>

      <CurrentWeather current={weather.current} unitSystem={weather.unitSystem} />
    </section>
  );
}

export default WeatherResults;
