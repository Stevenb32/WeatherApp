import type { CurrentWeather as CurrentWeatherData, WeatherUnitSystem } from "../types/weather.ts";

interface CurrentWeatherProps {
  current: CurrentWeatherData;
  unitSystem: WeatherUnitSystem;
}

function CurrentWeather({ current, unitSystem }: CurrentWeatherProps) {
  const temperatureUnit = unitSystem === "imperial" ? "°F" : "°C";
  const windSpeedUnit = unitSystem === "imperial" ? "mph" : "km/h";

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="flex items-start text-6xl font-semibold tracking-tight text-slate-950 sm:text-7xl">
          <span>{current.temperature}</span>
          <span className="mt-1 text-2xl font-medium text-slate-600 sm:text-3xl">{temperatureUnit}</span>
        </p>

        <p className="min-w-0 break-words text-lg font-medium text-slate-700 sm:pb-2">{current.condition}</p>
      </div>

      <dl className="mt-6 grid border-t border-slate-200 pt-5 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
        <div className="py-2 sm:px-5 sm:py-0 sm:first:pl-0">
          <dt className="text-sm font-medium text-slate-500">Humidity</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{current.humidity}%</dd>
        </div>

        <div className="py-2 sm:px-5 sm:py-0">
          <dt className="text-sm font-medium text-slate-500">Wind speed</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">
            {current.windSpeed} {windSpeedUnit}
          </dd>
        </div>

        <div className="py-2 sm:px-5 sm:py-0 sm:last:pr-0">
          <dt className="text-sm font-medium text-slate-500">Wind direction</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{current.windDirection}</dd>
        </div>
      </dl>
    </div>
  );
}

export default CurrentWeather;
