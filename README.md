# WeatherApp

WeatherApp is an in-progress full-stack weather application built as a portfolio and learning project focused on software development, QA automation, SDET practices, DevOps, and agentic engineering workflows.

The backend uses an ASP.NET Core Minimal API to retrieve and process forecast data from [WeatherAPI](https://www.weatherapi.com/). The frontend uses React, TypeScript, and Vite and is being developed incrementally to present that data to users.

## Project Status

**Milestone 1 — API Foundation: Complete**

**Milestone 2 — React MVP: Complete**

**Milestone 3 — Automated Quality Gates and CI: In progress**

The backend currently supports:

* WeatherAPI integration through a typed `HttpClient`
* Strongly typed configuration with startup validation
* A public weather response contract independent of WeatherAPI
* Current weather conditions
* The next 24 hourly forecasts
* A 3-day daily forecast
* Imperial and metric unit systems
* In-memory weather-response caching
* Configurable fixed-window rate limiting
* A health-check endpoint that remains outside the weather rate limit
* Error handling for invalid locations, provider failures, and timeouts
* Integration testing with xUnit, FluentAssertions, and WireMock.Net
* Black-box public API testing with Postman CLI

The frontend currently includes:

* An accessible, responsive Weather App shell
* City search with inline blank-input validation
* Imperial and metric unit selection
* Loading feedback
* Persistent, category-specific error messages with Retry recovery
* Current conditions with temperature, condition, humidity, and wind
* A keyboard-accessible, horizontally scrollable next-24-hours forecast
* A responsive three-day forecast with daily temperature ranges and precipitation chance
* Tailwind CSS through its official Vite plugin
* A same-origin local development proxy for relative `/api` requests
* Component testing with Vitest, jsdom, and React Testing Library

## API

### Get weather

```http
GET /api/weather?location=Tampa&units=imperial
```

| Parameter  | Required | Accepted values                                          | Default    |
| ---------- | -------- | -------------------------------------------------------- | ---------- |
| `location` | Yes      | City, ZIP code, or another WeatherAPI-supported location | None       |
| `units`    | No       | `imperial` or `metric`                                   | `imperial` |

A successful response contains:

* Location information
* Current weather conditions
* The next 24 future hourly forecasts
* A 3-day daily forecast
* Temperature, humidity, wind, precipitation, and condition information

### Health check

```http
GET /health
```

The health endpoint is not affected by the weather endpoint’s rate limit.

## Local Development

Requirements:

* .NET SDK 10.0.303, pinned by `global.json`
* Node.js 24.20.0, pinned by `.node-version`
* npm, using the checked-in `package-lock.json`
* Postman CLI, available as `postman` on `PATH`, for the API test suite
* A WeatherAPI API key

### Install dependencies

Restore the backend dependencies from the repository root:

```powershell
dotnet tool restore
dotnet restore WeatherApp.slnx
```

Install the frontend dependencies exactly as recorded in the lockfile:

```powershell
cd src/WeatherApp.Ui
npm ci
```

### One-time backend configuration

Trust the ASP.NET Core HTTPS development certificate:

```powershell
dotnet dev-certs https --trust
```

Accept the operating-system trust prompt when it appears. This allows the browser and local development tools to trust the API's HTTPS endpoint.

Application defaults are stored in `src/WeatherApp.Api/appsettings.json`.

```json
{
  "WeatherApi": {
    "BaseUrl": "https://api.weatherapi.com/v1/",
    "Timeout": "00:00:10",
    "CacheDuration": "00:05:00"
  },
  "WeatherRateLimit": {
    "PermitLimit": 60,
    "Window": "00:01:00"
  }
}
```

The default rate limit permits 60 weather requests during each one-minute fixed window. Excess requests receive `429 Too Many Requests`.

The WeatherAPI key is not stored in source control. Configure it with .NET User Secrets:

```powershell
dotnet user-secrets set "WeatherApi:ApiKey" "your-api-key" --project src/WeatherApp.Api
```

### Run the API and UI

The API and UI run in two separate terminals. Run both commands from the repository root unless the instructions change directories.

In the first terminal, start the API with its HTTPS launch profile:

```powershell
dotnet run --project src/WeatherApp.Api --launch-profile https
```

The API listens at `https://localhost:7001`.

In the second terminal, start Vite:

```powershell
cd src/WeatherApp.Ui
npm run dev
```

The UI is available at `http://localhost:5173`.

During local development, the frontend uses relative paths such as `/api/weather`. Vite receives those requests on port `5173` and forwards them unchanged to the API at `https://localhost:7001`. The browser does not need a separate API base URL or a direct-development CORS policy, and the WeatherAPI key remains on the backend.

## Deterministic Full-Stack Test Environment

The repository includes a shared environment for automated and manual full-stack testing. It does not use the real WeatherAPI, the internet, or a WeatherAPI credential:

```text
Vite production preview :4173
          | relative /api proxy
          v
Weather App API :5100
          | typed HttpClient
          v
Standalone WireMock :9090
```

All three services bind to fixed loopback addresses. Startup fails if any required port is occupied; the runner never chooses a different port.

### Restore once

From the repository root:

```powershell
dotnet tool restore
dotnet restore WeatherApp.slnx

cd src/WeatherApp.Ui
npm ci
cd ../..
```

The local tool manifest pins standalone WireMock to version 2.15.0. The manifest allows its .NET 8 target framework to roll forward to the repository's pinned .NET 10 runtime.

### Build, start, verify, and stop

Run the complete smoke verification from the repository root:

```powershell
node scripts/test-environment.mjs verify
```

This command validates the pinned runtimes and provider isolation, builds the API in Release configuration, builds the React production output, starts all three processes, performs bounded readiness checks, exercises the shared fixtures through the real API and preview proxy, and always tears the processes down. Successful cleanup is not assumed: the runner confirms that ports `9090`, `5100`, and `4173` are released.

Keep the same environment running for manual use, the Postman API suite, or a
future browser test suite:

```powershell
node scripts/test-environment.mjs serve
```

The available addresses are:

| Service | Address |
| --- | --- |
| Production UI preview | `http://127.0.0.1:4173` |
| Weather App API | `http://127.0.0.1:5100` |
| WireMock admin API | `http://127.0.0.1:9090/__admin` |

Press `Ctrl+C` in the runner terminal to stop the complete environment. Vite preview serves built test output here; it is not production deployment hosting.

### Shared fixture selectors

Search for these exact locations through `/api/weather` or the UI:

| Location | Deterministic behavior |
| --- | --- |
| `Tampa` | Fixed three-day success data with Celsius/Fahrenheit and kph/mph values |
| `NotARealPlace` | Provider location error mapped to public `404 ProblemDetails` |
| `ProviderFailure` | Provider failure mapped to public `503 ProblemDetails` |
| `RetryRecovery` | First provider call fails; the second succeeds |
| `LongContent` | Success data with deliberately long location and condition text |

Before a stateful suite or manual retry check, reset both request history and scenario state:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:9090/__admin/requests/reset
Invoke-RestMethod -Method Post http://127.0.0.1:9090/__admin/scenarios/reset
```

The checked-in `E2E` API environment accepts only `http://127.0.0.1:9090/v1/` as its provider base address and uses the public placeholder key expected by the mappings. An E2E override to another provider address fails API startup. Normal Development and Production configuration continue to use the real WeatherAPI settings and are unchanged.

The Postman CLI suite starts from this environment's fixed API address and uses
the repository-owned fixture selectors. See the
[Postman API test instructions](tests/WeatherApp.Postman/README.md) for the
collection workflow. Future browser suites should consume the same environment
instead of creating separate providers or servers.

For lifecycle diagnostics, the verifier also supports deliberate failures. These commands are expected to exit unsuccessfully after releasing all managed ports:

```powershell
node scripts/test-environment.mjs verify --simulate-failure-after-ready
node scripts/test-environment.mjs verify --simulate-readiness-timeout=api
node scripts/test-environment.mjs verify --simulate-unexpected-child-exit=api
```

The unexpected-child-exit check stops the API after readiness and exercises the same service supervision used by `serve`. The runner must identify the API exit, stop WireMock and Vite preview, and confirm that all three fixed ports were released.

## Verification

### Backend

Build the solution and run the backend tests from the repository root:

```powershell
dotnet build WeatherApp.slnx
dotnet test WeatherApp.slnx
```

The integration tests use WireMock.Net to simulate WeatherAPI responses without calling the real provider.

### Frontend

Run frontend commands from `src/WeatherApp.Ui`:

```powershell
npm test
npm run test:watch
npm run test:coverage
npm run lint
npm run build
```

`npm test` runs the component tests once and exits. `npm run test:watch` stays active and reruns tests as files change. `npm run test:coverage` generates V8 coverage without enforcing a numerical threshold.

### Postman API

Start the deterministic environment from the repository root in one terminal:

```powershell
node scripts/test-environment.mjs serve
```

After the environment reports that it is ready, run the complete black-box API
suite from a second terminal:

```powershell
postman collection run `
  tests/WeatherApp.Postman/WeatherApp.postman_collection.json `
  --environment tests/WeatherApp.Postman/WeatherApp.local.postman_environment.json `
  --reporters "cli,junit,html" `
  --reporter-junit-export tests/WeatherApp.Postman/reports/postman-results.xml `
  --reporter-html-export tests/WeatherApp.Postman/reports/postman-report.html `
  --timeout 30000 `
  --timeout-request 5000 `
  --timeout-script 5000 `
  --color off
```

Press Ctrl+C in the environment terminal after the run. The generated reports
are written beneath `tests/WeatherApp.Postman/reports/` and are ignored by Git.
The suite runs from local JSON files without a Postman login or Postman API key.
See the [suite README](tests/WeatherApp.Postman/README.md) for focused runs and
report details.

### Full stack

Run the deterministic full-stack smoke contract from the repository root:

```powershell
node scripts/test-environment.mjs verify
```

Readiness polling is bounded and is used only to wait for processes. Smoke assertions have zero automatic retries.

## Technology

* .NET 10
* ASP.NET Core Minimal API
* C#
* React
* TypeScript
* Vite
* Tailwind CSS
* Vitest
* React Testing Library
* xUnit
* FluentAssertions
* WireMock.Net
* Standalone WireMock
* Postman CLI
* WeatherAPI

Playwright browser suites, CI/CD, containerization, and production deployment
capabilities will be introduced incrementally as the project develops.
