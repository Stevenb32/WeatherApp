import type { WeatherErrorCategory } from "../services/weatherApi.ts";

interface WeatherErrorStateProps {
  category: WeatherErrorCategory;
  onRetry: () => void;
}

interface ErrorContent {
  heading: string;
  guidance: string;
}

const errorContentByCategory = {
  "location-not-found": {
    heading: "Location not found",
    guidance: "We couldn’t find that location. Check the city name and search again, or retry.",
  },
  "provider-unavailable": {
    heading: "Weather is temporarily unavailable",
    guidance: "The weather service is temporarily unavailable. Please try again.",
  },
  "provider-timeout": {
    heading: "Weather took too long",
    guidance: "The weather took too long to load. Please try again.",
  },
  "unexpected-failure": {
    heading: "Weather couldn’t be loaded",
    guidance: "Something went wrong while loading the weather. Please try again.",
  },
} satisfies Record<WeatherErrorCategory, ErrorContent>;

function WeatherErrorState({ category, onRetry }: WeatherErrorStateProps) {
  const content = errorContentByCategory[category];

  return (
    <div className="flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm sm:p-8">
      <div role="alert" className="max-w-xl">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{content.heading}</h2>
        <p className="mt-3 text-base text-slate-700">{content.guidance}</p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="mt-6 min-h-11 rounded-lg bg-sky-700 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        Retry
      </button>
    </div>
  );
}

export default WeatherErrorState;
