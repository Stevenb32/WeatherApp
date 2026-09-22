# Playwright end-to-end tests

This separate TypeScript project verifies four user journeys in Chromium through
the production-built React UI, the real Weather App API, and the shared WireMock
provider fixtures. Browser-test dependencies do not belong to the UI project.

## Setup

Use Node.js `24.20.0` and .NET SDK `10.0.303`, as pinned at the repository root.
From the repository root, restore the application and test dependencies:

```powershell
dotnet tool restore
dotnet restore WeatherApp.slnx
npm ci --prefix src/WeatherApp.Ui
npm ci --prefix tests/WeatherApp.E2E
```

Install the Chromium version required by the locked Playwright dependency:

```powershell
cd tests/WeatherApp.E2E
npx playwright install chromium
```

Repeat browser installation after updating Playwright. On Linux machines that
also need browser system libraries, use `npx playwright install --with-deps chromium`.
Dependency and browser installation may require internet access; test execution
uses only local services. No real WeatherAPI request, credential, or Postman
installation is required.

## Run

Run these commands from `tests/WeatherApp.E2E`:

```powershell
npm run typecheck
npm test
```

`typecheck` checks the TypeScript configuration, fixtures, and tests without
emitting JavaScript. `test` runs all four Chromium journeys with one worker and
zero automatic retries. There is no E2E lint script; the frontend's lint command
applies to the separate UI project.

To run each journey independently, use a separate invocation:

```powershell
npm test -- --grep 'Tampa imperial search'
npm test -- --grep 'Metric unit change'
npm test -- --grep 'Unknown location'
npm test -- --grep 'Provider failure and Retry recovery'
```

Every invocation starts a fresh stack. Stop any manually started deterministic
environment before running Playwright. Existing servers are never reused, and a
port conflict fails startup rather than choosing another port.

## How the stack and tests work

`playwright.config.ts` owns the process lifecycle through `webServer`, which runs
`node scripts/test-environment.mjs serve` from the repository root. The runner:

1. Checks the pinned toolchain, provider isolation, fixtures, and available ports.
2. Builds the API in Release configuration and the UI with TypeScript and Vite.
3. Starts WireMock at `127.0.0.1:9090`, the API in its `E2E` environment at
   `127.0.0.1:5100`, and Vite production preview at `127.0.0.1:4173`.
4. Polls readiness with a bounded timeout, resets WireMock, and prints the ready
   message that Playwright waits for before running tests.

The browser sends relative `/api` requests through Vite preview to the real API.
The API's E2E configuration restricts its provider address to local WireMock and
uses a non-secret placeholder key. A missing dependency fails the run; there is
no fallback to the real WeatherAPI. Playwright tears down its owned process tree
after success, assertion failure, or startup timeout.

Startup has a 180-second Playwright limit; each runner service-readiness check
has a 30-second limit. Tests have a 30-second limit and web assertions have a
5-second limit. Readiness polling and Playwright's waiting assertions do not
rerun failed tests. The browser uses `en-US`, `America/New_York`, and a fixed
1280×720 viewport so fixture dates and times have consistent presentation.

Before every test, the automatic `resetWireMock` fixture clears WireMock request
history and scenario state. Each test gets a fresh browser context and establishes
its own starting UI state. The API process, including its cache, is shared within
one invocation; these tests do not assert cache internals or provider call counts.

| Journey | Behavior verified |
| --- | --- |
| Tampa imperial search | Initial state, default units, exact current values, 24 hourly entries, and three daily entries |
| Metric unit change | Its own Tampa search, loading transition, metric values, and removal of stale imperial results |
| Unknown location | Its own Tampa search followed by `NotARealPlace`, generic error, cleared weather, available search, and no raw provider details |
| Provider failure and Retry recovery | `RetryRecovery` fails first and returns fixed Tampa data on Retry; the submitted location and metric units survive an unsubmitted City edit |

`RetryRecovery` is the shared stateful fixture; `ProviderFailure` always fails
and is not used for recovery. The `withPendingWeatherRequest` helper temporarily
holds one real request during metric changes and Retry so loading can be checked
reliably. It continues the request unchanged in `finally`, even if an assertion
fails. It does not fabricate responses or add fixed sleeps.

## Reports and failure diagnosis

Paths below are relative to this directory and are ignored by Git:

| Output | Location |
| --- | --- |
| Line reporter | Terminal output, including application startup logs |
| JUnit report | `reports/junit/results.xml` |
| HTML report | `reports/html/index.html` |
| Failed-test evidence | `test-results/<test-and-project>/` |

Failed browser tests retain `trace.zip`, `test-failed-1.png`, and `video.webm`.
Playwright may also write `error-context.md`. Passing tests retain no trace,
screenshot, or video. The HTML report does not open automatically.

Open the current report explicitly:

```powershell
npm run report
```

Select the failed test to inspect its assertion, source location, actions, and
attachments. Use **View Trace** to inspect DOM snapshots, console messages, and
network requests. Alternatively, open a retained trace directly, for example:

```powershell
npx playwright show-trace test-results/weather-Provider-failure-and-Retry-recovery-chromium/trace.zip
```

Inspect or copy evidence before another run replaces the standard output paths.
Keep any copies under the ignored `reports/` directory. Stop a report or trace
viewer with Ctrl+C when finished. If startup fails before a browser test begins,
inspect terminal output; there may be no browser trace to inspect.

To validate diagnostics deliberately, temporarily change one exact expected
fixture value, run only that test, and confirm a nonzero exit with usable HTML,
trace, screenshot, and video evidence. Restore the assertion and run the suite
again. Never commit the broken assertion or generated evidence. An unexplained
failure requires investigation; an unchanged rerun is not a fix.

The broader backend and frontend verification commands remain in the
[root README](../../README.md#verification). Accessibility scans, responsive
boundary checks, other browser projects, and CI workflows are outside this suite's
current scope.
