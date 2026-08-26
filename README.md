# WeatherApp

WeatherApp is an in-progress full-stack weather application built as a portfolio and learning project focused on software development, QA automation, SDET practices, DevOps, and agentic engineering workflows.

The backend uses an ASP.NET Core Minimal API to retrieve and process forecast data from [WeatherAPI](https://www.weatherapi.com/). A React and TypeScript frontend will be developed to present the weather data to users.

## Project Status

**Milestone 1 — API Foundation: Complete**

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

## Configuration

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

## Run the API

Requirements:

* .NET 10 SDK
* A WeatherAPI API key

Restore and run the application:

```powershell
dotnet restore
dotnet run --project src/WeatherApp.Api
```

## Run the Tests

Run the complete automated test suite:

```powershell
dotnet test WeatherApp.slnx
```

The integration tests use WireMock.Net to simulate WeatherAPI responses without calling the real provider.

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
* xUnit
* FluentAssertions
* WireMock.Net
* WeatherAPI

Additional frontend development, automated testing, CI/CD, containerization, and production deployment capabilities will be introduced incrementally as the project develops.
