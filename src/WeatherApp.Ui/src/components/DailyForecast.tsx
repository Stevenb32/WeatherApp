import type { DailyForecastEntry, WeatherUnitSystem } from "../types/weather.ts";

interface DailyForecastProps {
  daily: DailyForecastEntry[];
  unitSystem: WeatherUnitSystem;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatForecastDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function DailyForecast({ daily, unitSystem }: DailyForecastProps) {
  const temperatureUnit = unitSystem === "imperial" ? "°F" : "°C";

  return (
    <section aria-labelledby="daily-forecast-heading" className="mt-8 min-w-0 border-t border-slate-200 pt-6">
      <h2 id="daily-forecast-heading" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Three-day forecast
      </h2>

      <ol className="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
        {daily.map((day) => (
          <li key={day.date} className="min-w-0 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <time dateTime={day.date} className="block break-words text-base font-semibold text-slate-800">
              {formatForecastDate(day.date)}
            </time>

            <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Minimum temperature</dt>
                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  <span>{day.minimumTemperature}</span>
                  <span className="ml-1 text-sm font-medium text-slate-600">{temperatureUnit}</span>
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Maximum temperature</dt>
                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  <span>{day.maximumTemperature}</span>
                  <span className="ml-1 text-sm font-medium text-slate-600">{temperatureUnit}</span>
                </dd>
              </div>

              <div className="col-span-2 min-w-0">
                <dt className="text-xs font-medium text-slate-500">Condition</dt>
                <dd className="mt-1 break-words text-sm leading-5 text-slate-700">{day.condition}</dd>
              </div>

              <div className="col-span-2 min-w-0">
                <dt className="text-xs font-medium text-slate-500">Precipitation chance</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-700">{day.precipitationChance}%</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default DailyForecast;
