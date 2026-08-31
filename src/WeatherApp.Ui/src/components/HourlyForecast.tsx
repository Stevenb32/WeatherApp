import type { HourlyForecastEntry, WeatherUnitSystem } from "../types/weather.ts";

interface HourlyForecastProps {
  hourly: HourlyForecastEntry[];
  unitSystem: WeatherUnitSystem;
  timeZoneId: string;
}

function HourlyForecast({ hourly, unitSystem, timeZoneId }: HourlyForecastProps) {
  const temperatureUnit = unitSystem === "imperial" ? "°F" : "°C";
  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timeZoneId,
  });

  return (
    <section aria-labelledby="hourly-forecast-heading" className="mt-8 min-w-0 border-t border-slate-200 pt-6">
      <h2 id="hourly-forecast-heading" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Next 24 hours
      </h2>

      <div
        role="region"
        aria-label="Next 24 hours hourly forecast"
        tabIndex={0}
        className="mt-4 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        <ol className="flex w-max min-w-full gap-3">
          {hourly.map((hour) => (
            <li key={hour.time} className="flex w-36 shrink-0 flex-col rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:w-40">
              <time dateTime={hour.time} className="text-sm font-semibold text-slate-600">
                {hourFormatter.format(new Date(hour.time))}
              </time>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                <span>{hour.temperature}</span>
                <span className="ml-1 text-base font-medium text-slate-600">{temperatureUnit}</span>
              </p>

              <p className="mt-3 grow break-words text-sm leading-5 text-slate-700">{hour.condition}</p>

              <p className="mt-4 text-xs font-medium text-slate-600">Precipitation chance: {hour.precipitationChance}%</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default HourlyForecast;
