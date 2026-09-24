# Playwright end-to-end tests

This separate TypeScript project verifies five user journeys, five accessibility
scan states, twelve responsive cases, and six target-size cases in Chromium through
the production-built React UI, the real Weather App API, and the shared WireMock
provider fixtures. Firefox desktop and WebKit mobile each run a successful-search
smoke test. Browser-test dependencies do not belong to the UI project.

## Setup

Use Node.js `24.20.0` and .NET SDK `10.0.303`, as pinned at the repository root.
From the repository root, restore the application and test dependencies:

```powershell
dotnet tool restore
dotnet restore WeatherApp.slnx
npm ci --prefix src/WeatherApp.Ui
npm ci --prefix tests/WeatherApp.E2E
```

Install the browser versions required by the locked Playwright dependency:

```powershell
cd tests/WeatherApp.E2E
npx playwright install chromium firefox webkit
```

Repeat browser installation after updating Playwright. On Linux machines that
also need browser system libraries, use
`npx playwright install --with-deps chromium firefox webkit`.
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
emitting JavaScript. `test` runs all 30 tests with one worker and zero automatic
retries. There is no E2E lint script; the frontend's lint command applies to the
separate UI project.

To run each journey independently, use a separate invocation:

```powershell
npm test -- --grep 'Tampa imperial search'
npm test -- --grep 'Metric unit change'
npm test -- --grep 'Unknown location'
npm test -- --grep 'Provider failure and Retry recovery'
npm test -- --grep 'Keyboard-only search'
```

Every invocation starts a fresh stack. Stop any manually started deterministic
environment before running Playwright. Existing servers are never reused, and a
port conflict fails startup rather than choosing another port.

## Browser matrix

| Project | Coverage | Viewport |
| --- | --- | --- |
| `chromium` | All 28 functional, axe, keyboard, responsive, and target-size tests | Default 1280×720; individual cases set their boundary/mobile sizes |
| `firefox` | Successful-search smoke | Desktop 1280×720 |
| `webkit` | Successful-search smoke plus idle/success page-overflow checks | Mobile/touch emulation at 320×720 |

The matrix targets different browser risks without repeating every scenario in
every engine. Chromium owns the detailed suite. Firefox checks the desktop path
in another engine; WebKit checks narrow mobile rendering and touch submission.
Mobile emulation is not a test on a physical iPhone or the Safari application.

`browser-smoke.spec.ts` is selected only by Firefox and WebKit using project
`testMatch`; Chromium excludes that file with `testIgnore`. Both projects use
the same smoke assertions and shared `Tampa` fixture: search through the UI,
verify current weather, and verify hourly/daily entry counts and representative
forecast values. The mobile case taps Search and checks document/body width
before and after success. It also checks the layout viewport width so a missing
viewport meta tag cannot mask overflow. No browser-specific weather expectations,
response mocks, retries, or skipped tests are used.

Run a project, or discover the selected cases without starting the stack:

```powershell
npm test -- --project=chromium
npm test -- --project=firefox
npm test -- --project=webkit
npm test -- --project=webkit --grep 'Successful Tampa search'
npm test -- --list
```

Run projects sequentially when using separate invocations because each owns the
same fixed ports. A plain `npm test` runs all three projects together against one
owned stack, with fresh browser contexts and the automatic WireMock reset for
each test. The combined HTML and JUnit reports identify each browser project.

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
1280×720 default viewport so fixture dates and times have consistent presentation.
Mobile axe tests and the WebKit smoke use 320×720 with mobile and touch emulation.

Before every test, the automatic `resetWireMock` fixture clears WireMock request
history and scenario state. Each test gets a fresh browser context and establishes
its own starting UI state. The API process, including its cache, is shared within
one invocation; these tests do not assert cache internals or provider call counts.

| Journey | Behavior verified |
| --- | --- |
| Tampa imperial search | Initial state, default units, exact current values, 24 hourly entries, and three daily entries |
| Metric unit change | Its own Tampa search, loading transition, metric values, and removal of stale imperial results |
| Unknown location | Its own Tampa search followed by `NotARealPlace`, generic error, cleared weather, available search, and no raw provider details |
| Provider failure and Retry recovery | Keyboard search and Retry activation; City keeps focus on error and receives focus during/after recovery; submitted location and metric units survive an unsubmitted City edit |
| Keyboard-only search, native units, and hourly scrolling | Native radio navigation, Enter submission, focus through loading and a unit refetch, and actual keyboard scrolling with an exit back to search controls |

`RetryRecovery` is the shared stateful fixture; `ProviderFailure` always fails
and is not used for recovery. The `withPendingWeatherRequest` helper temporarily
holds one real request during keyboard search, metric changes, and Retry so
loading can be checked reliably. It continues the request unchanged in `finally`,
even if an assertion fails. It does not fabricate responses or add fixed sleeps.

## Keyboard and focus

`keyboard.spec.ts` uses real keyboard events throughout the journey: Tab enters
the selected radio, Left/Right arrows change selection, and Tab leaves the group
for City. Enter submits the typed `Tampa` search. While requests are held, the
test checks focus and Tab/Shift+Tab navigation on the guarded search and unit
controls. Completing a request must not steal focus from the active control.

Tab reaches the named hourly scroll region. ArrowRight must increase its
`scrollLeft`; the test only reads the position and polls for native movement,
without assigning it or sleeping. Shift+Tab must return to Search.

The existing Retry journey also uses keyboard events to select metric, submit
`RetryRecovery`, make an unsubmitted edit, reach Retry, and activate it with
Enter. The error leaves focus on City; Retry returns focus to City before its
button disappears, and focus stays there after success. Tab navigation must
still work after recovery. Keeping recovery in one test avoids a second test
being satisfied by the API's cached successful `RetryRecovery` response.

Run these two journeys together:

```powershell
npm test -- --project=chromium --grep 'Keyboard-only search|Provider failure and Retry recovery'
```

## Accessibility scans

`accessibility.spec.ts` scans the whole page using `@axe-core/playwright` with
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa`. Every violation of an
included rule fails the test, regardless of severity. There are no region
exclusions or disabled rules.

| Viewport | States | Fixture searches |
| --- | --- | --- |
| Desktop, 1280×720 | Idle, success, error | None, `Tampa`, `ProviderFailure` |
| Mobile, 320×720 | Success, error | `Tampa`, `ProviderFailure` |

Each scan starts from its own browser context, reaches the state through the UI,
and waits for the expected content and `aria-busy="false"` before scanning.
The error scans use the always-failing fixture so they do not consume the
stateful recovery journey. No browser responses are mocked.

Run the scans or an individual state from this directory:

```powershell
npm test -- --project=chromium accessibility.spec.ts
npm test -- --project=chromium accessibility.spec.ts --grep 'Mobile error'
```

On violations, the test attaches the complete `axe-results` JSON to its report,
including rule IDs, affected elements, and failure explanations. Automated axe
checks do not establish formal WCAG conformance or accessibility certification;
manual keyboard and assistive-technology assessment cover additional risks.

To check the failure path, temporarily remove the City label's `for` attribute
in a local scan before analysis, run that state, and confirm an axe `label`
violation, nonzero exit, and retained evidence. Restore the temporary change
before running the suite again; never commit the deliberate violation.

## Responsive layouts and long content

`responsive.spec.ts` tests widths of 320, 639, 640, 767, 768, and 1280 CSS pixels
at a viewport height of 720. These cover a narrow screen, both sides of the
existing layout breakpoints, and desktop. They use viewport sizing without
mobile/touch emulation.

| Width | Search and current condition | Daily forecast |
| --- | --- | --- |
| 320, 639 | Stacked | One column |
| 640, 767 | Side by side | One column |
| 768, 1280 | Side by side | Three columns |

Each width has two independent tests. The first checks idle containment, searches
`Tampa` and checks the weather layout, then searches `ProviderFailure` and checks
error containment. The second establishes its own `Tampa` baseline, searches the
shared `LongContent` fixture, and verifies the full location, condition, dates,
and forecast entries through the real API.

Assertions measure rendered boxes and text lines rather than CSS class names.
The document and body must fit the viewport; the named hourly region must be the
only overflowing horizontal scroll container in the main content. Meaningful
text must fit its section/card and avoid clipping or truncation, including in
hourly cards outside the viewport. The intentionally screen-reader-only
"Current weather for" prefix is exempt from visual text measurements.

Long location headings and hourly cards must grow compared with normal content.
Current conditions and daily cards must grow when their condition text wraps
onto more lines; text that still fits on one line does not require extra height.
Geometry comparisons allow one CSS pixel for browser rounding. There are no
screenshot baselines or fixed synchronization delays.

Run the responsive matrix or one boundary from this directory:

```powershell
npm test -- --project=chromium responsive.spec.ts
npm test -- --project=chromium responsive.spec.ts --grep '768px'
```

To check the overflow failure path, temporarily inject a body `min-width` of
1600px at the start of `expectPageContainment`, run the 320px Tampa case, and
confirm a document-overflow assertion, nonzero exit, and retained diagnostics.
Remove the injected style before verification; never commit it. Visual review
at the six widths supplements these geometry checks.

## Primary target sizes

`target-size.spec.ts` measures Search, both unit choices, and Retry at the same
six boundary widths (320, 639, 640, 767, 768, and 1280px), with a viewport height
of 720. Every target must be at least 44 CSS pixels wide and 44 CSS pixels tall.
Unlike the responsive containment checks, this minimum has no rounding allowance.

Search and Retry are measured directly. The unit radios are visually hidden, so
the test uses each input's native `labels` association to measure its clickable
label. A real pointer click at that label's center must select the corresponding
radio. Each test selects Celsius and then Fahrenheit before searching the
always-failing `ProviderFailure` fixture to reveal and measure Retry. It does not
consume the stateful Retry recovery scenario or broaden the size rule to every
inline or browser-native control.

Run only these checks from this directory:

```powershell
npm test -- --project=chromium target-size.spec.ts
```

Failures include the target name and measured dimensions in the normal report.
To verify the assertion locally, temporarily constrain Search to 43px high
(overriding its minimum height and padding), run the 320px case, and confirm the
size assertion fails. Remove the constraint before rerunning verification; never
commit the intentional defect.

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

## Manual review alongside automation

After a complete `npm test`, open `npm run report` and confirm the successful
report includes all three projects: 28 Chromium tests, one Firefox smoke, and
one WebKit smoke. Open a test from each project to inspect its steps and outcome.
Close the report server with Ctrl+C when finished.

For a hands-on layout and keyboard pass, start a fresh deterministic environment
from the repository root with `node scripts/test-environment.mjs serve`. Wait for
the ready message, then open `http://127.0.0.1:4173`. This manual session is
separate from Playwright; stop it before running the automated suite.

1. Use browser responsive tools at 320, 639, 640, 767, 768, and 1280 CSS pixels.
   Search `Tampa` and `LongContent`. Check that search/current conditions reflow
   at 640px, daily cards become three columns at 768px, full text remains readable,
   and horizontal scrolling stays within the hourly forecast.
2. Reload the page and use only the keyboard within the application. Tab into
   the unit group, use Left/Right arrows to change units, then Tab to City. Type
   `Tampa` and submit with Enter. Check visible focus, Tab through Search to the
   hourly region, use ArrowRight to scroll it, and Shift+Tab back to Search/City.
3. From City, replace the query with `RetryRecovery` and submit with Enter. On
   error, City should retain focus. Tab through Search to Retry and press Enter.
   Recovery should return focus to City; Tab and Shift+Tab should still work.
   Use a fresh environment if this fixture has already recovered: the API can
   cache its success, so reloading the browser alone does not reset the scenario.

Observe focus during any visible loading transition; the automated keyboard
tests additionally hold a real request to check this brief state deterministically.
Record the browser, viewport, observed results, and any gaps with the verification
notes for the change. These checks supplement automated assertions and do not
establish formal accessibility conformance. Stop the environment with Ctrl+C and
confirm its three ports are released when finished.

The broader backend and frontend verification commands remain in the
[root README](../../README.md#verification). CI workflows have not yet been
introduced.
