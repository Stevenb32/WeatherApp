import type { WeatherUnitSystem } from "../types/weather.ts";

interface UnitSelectorProps {
  units: WeatherUnitSystem;
  isDisabled: boolean;
  onChange: (units: WeatherUnitSystem) => void;
}

function UnitSelector({ units, isDisabled, onChange }: UnitSelectorProps) {
  return (
    <fieldset className="shrink-0">
      <legend className="sr-only">Temperature units</legend>

      <div className="inline-grid grid-cols-2 rounded-xl border border-slate-300 bg-white p-1 shadow-sm">
        <label>
          <input
            type="radio"
            name="weather-units"
            value="imperial"
            checked={units === "imperial"}
            disabled={isDisabled}
            onChange={() => onChange("imperial")}
            aria-label="Fahrenheit (imperial units)"
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-3 font-semibold text-slate-700 transition hover:bg-sky-100 peer-checked:bg-sky-700 peer-checked:text-white peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-sky-700 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 peer-disabled:hover:bg-transparent peer-checked:peer-disabled:hover:bg-sky-700 motion-reduce:transition-none"
          >
            °F
          </span>
        </label>

        <label>
          <input
            type="radio"
            name="weather-units"
            value="metric"
            checked={units === "metric"}
            disabled={isDisabled}
            onChange={() => onChange("metric")}
            aria-label="Celsius (metric units)"
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-3 font-semibold text-slate-700 transition hover:bg-sky-100 peer-checked:bg-sky-700 peer-checked:text-white peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-sky-700 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 peer-disabled:hover:bg-transparent peer-checked:peer-disabled:hover:bg-sky-700 motion-reduce:transition-none"
          >
            °C
          </span>
        </label>
      </div>
    </fieldset>
  );
}

export default UnitSelector;
