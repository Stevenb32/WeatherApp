# WeatherApp Postman CLI API tests

This directory contains black-box tests for the Weather App's public HTTP API.
The suite runs against the repository-owned deterministic test environment, so
it does not contact the real WeatherAPI or require a real provider credential.

## Suite files

| File | Purpose |
| --- | --- |
| `WeatherApp.postman_collection.json` | Collection v2.1 requests and assertions for health, successful weather responses, validation, and sanitized provider errors. |
| `WeatherApp.local.postman_environment.json` | Non-secret local values for the fixed API address and deterministic fixture locations. |
| `reports/` | Generated JUnit and HTML output. This directory is ignored by Git. |

The checked-in JSON files are the source of truth. Importing them into the
Postman desktop application is optional; the CLI reads them directly from the
repository and does not require a Postman login, Postman API key, cloud
collection ID, or workspace synchronization.

## Prerequisites

Restore the repository-owned tools and application dependencies once from the
repository root:

```powershell
dotnet tool restore
dotnet restore WeatherApp.slnx

cd src/WeatherApp.Ui
npm ci
cd ../..
```

The deterministic environment supplies its own public placeholder provider key;
do not configure a real WeatherAPI credential for this suite. Confirm that
Postman CLI is available on `PATH`:

```powershell
postman --version
```

Run the remaining commands from the repository root.

## Run the complete suite

Start the deterministic WireMock, API, and Vite preview stack in one terminal:

```powershell
node scripts/test-environment.mjs serve
```

Wait for `Deterministic test environment is ready.` Keep that terminal open,
then run the collection from a second terminal:

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

After the collection finishes, press Ctrl+C in the environment terminal. The
environment runner stops all three processes and confirms that ports `9090`,
`5100`, and `4173` were released.

## Reports and failures

The run produces three forms of output:

| Reporter | Location | Intended use |
| --- | --- | --- |
| CLI | Current terminal | Immediate, readable feedback. |
| JUnit | `tests/WeatherApp.Postman/reports/postman-results.xml` | Machine-readable test results. |
| HTML | `tests/WeatherApp.Postman/reports/postman-report.html` | Browsable run details and diagnostics. |

Postman CLI creates the report directory when needed. Generated reports must
not be committed.

The command intentionally does not use `--suppress-exit-code`. A failed request,
script, or assertion therefore returns a nonzero exit code. The suite also uses
zero automatic retries; investigate a failure instead of masking it with reruns.

## Run one request

Use `-i` with the exact request name for focused investigation. For example:

```powershell
postman collection run `
  tests/WeatherApp.Postman/WeatherApp.postman_collection.json `
  --environment tests/WeatherApp.Postman/WeatherApp.local.postman_environment.json `
  -i "Weather — metric" `
  --reporters cli `
  --timeout 30000 `
  --timeout-request 5000 `
  --timeout-script 5000 `
  --color off
```

Each request owns its inputs and assertions, so focused runs do not depend on a
previous collection item or mutable collection state.
