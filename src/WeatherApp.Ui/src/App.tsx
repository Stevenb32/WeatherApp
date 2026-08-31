import { useState } from "react";
import SearchForm from "./components/SearchForm.tsx";
import UnitSelector from "./components/UnitSelector.tsx";
import WeatherErrorState from "./components/WeatherErrorState.tsx";
import WeatherResults from "./components/WeatherResults.tsx";
import { getWeather, WeatherServiceError } from "./services/weatherApi.ts";
import type { WeatherErrorCategory } from "./services/weatherApi.ts";
import type { WeatherResponse, WeatherUnitSystem } from "./types/weather.ts";

type WeatherRequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; weather: WeatherResponse }
  | { status: "error"; category: WeatherErrorCategory };

function App() {
  const [units, setUnits] = useState<WeatherUnitSystem>("imperial");
  const [lastSubmittedLocation, setLastSubmittedLocation] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<WeatherRequestState>({ status: "idle" });
  const [announcement, setAnnouncement] = useState("");

  const isLoading = requestState.status === "loading";

  async function loadWeather(location: string, requestedUnits: WeatherUnitSystem, loadingAnnouncement: string) {
    setRequestState({ status: "loading" });
    setAnnouncement(loadingAnnouncement);

    try {
      const weather = await getWeather(location, requestedUnits);
      setRequestState({ status: "success", weather });
      setAnnouncement(`Weather loaded for ${weather.location.name}.`);
    } catch (error: unknown) {
      const category = error instanceof WeatherServiceError ? error.category : "unexpected-failure";

      setRequestState({ status: "error", category });
      setAnnouncement("");
    }
  }

  function handleSearch(location: string) {
    if (isLoading) {
      return;
    }

    setLastSubmittedLocation(location);
    void loadWeather(location, units, `Loading weather for ${location}.`);
  }

  function handleRetry() {
    if (isLoading || lastSubmittedLocation === null) {
      return;
    }

    void loadWeather(lastSubmittedLocation, units, `Loading weather for ${lastSubmittedLocation}.`);
  }

  function handleUnitsChange(nextUnits: WeatherUnitSystem) {
    if (isLoading || nextUnits === units) {
      return;
    }

    setUnits(nextUnits);

    if (requestState.status === "success" && lastSubmittedLocation !== null) {
      void loadWeather(lastSubmittedLocation, nextUnits, `Updating weather for ${lastSubmittedLocation} in ${nextUnits} units.`);
    }
  }

  function renderResults() {
    switch (requestState.status) {
      case "idle":
        return <p className="text-base text-slate-600">Search for a city to see its current weather.</p>;
      case "loading":
        return <p className="text-base font-medium text-sky-800">Loading weather…</p>;
      case "success":
        return <WeatherResults weather={requestState.weather} />;
      case "error":
        return <WeatherErrorState category={requestState.category} onRetry={handleRetry} />;
    }
  }

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Weather App</h1>

          <UnitSelector units={units} isDisabled={isLoading} onChange={handleUnitsChange} />
        </header>

        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>

        <SearchForm isSubmitting={isLoading} onSearch={handleSearch} />

        <section aria-label="Weather results" aria-busy={isLoading} className="min-h-56">
          {requestState.status === "success" || requestState.status === "error" ? (
            renderResults()
          ) : (
            <div className="flex min-h-56 items-center justify-center rounded-3xl border border-dashed border-sky-200 bg-white/70 p-6 text-center shadow-sm">
              {renderResults()}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
