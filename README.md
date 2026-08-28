# WeatherApp

WeatherApp is an in-progress full-stack weather application built as a portfolio and learning project focused on software development, QA automation, SDET practices, DevOps, and agentic engineering workflows.

The backend uses an ASP.NET Core Minimal API to retrieve and process forecast data from [WeatherAPI](https://www.weatherapi.com/). The frontend uses React, TypeScript, and Vite and is being developed incrementally to present that data to users.

## Project Status

**Milestone 1 — API Foundation: Complete**

**Milestone 2 — React MVP: In progress**

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

The frontend currently includes:

* An accessible, responsive Weather App shell
* City search with inline blank-input validation
* Imperial and metric unit selection
* Loading and general failure feedback
* Current conditions with temperature, condition, humidity, and wind
* Tailwind CSS through its official Vite plugin
* A same-origin local development proxy for relative `/api` requests
* Component testing with Vitest, jsdom, and React Testing Library

Hourly and daily forecast presentation and category-specific recovery are not implemented yet.

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

* .NET 10 SDK
* Node.js and npm
* A WeatherAPI API key

### One-time backend configuration

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

In the second terminal, install the frontend dependencies and start Vite:

```powershell
cd src/WeatherApp.Ui
npm install
npm run dev
```

The UI is available at `http://localhost:5173`.

During local development, the frontend uses relative paths such as `/api/weather`. Vite receives those requests on port `5173` and forwards them unchanged to the API at `https://localhost:7001`. The browser does not need a separate API base URL or a direct-development CORS policy, and the WeatherAPI key remains on the backend.

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

## Planned Frontend MVP

The React and TypeScript frontend will support:

* Searching for a city
* Displaying current weather
* Displaying an hourly forecast
* Displaying a 3-day forecast
* Showing temperature, conditions, humidity, wind, and precipitation chance
* Switching between °F and °C
* Loading, location-not-found, and weather-provider-error states
* Responsive desktop and mobile layouts

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
* WeatherAPI

Additional frontend features, end-to-end testing, CI/CD, containerization, and production deployment capabilities will be introduced incrementally as the project develops.
