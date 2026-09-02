# WeatherApp Agent Instructions

## Project Purpose

WeatherApp is a full-stack portfolio and learning project focused on:

* Software development
* QA automation
* SDET practices
* DevOps
* CI/CD
* Agentic engineering workflows

The application itself should remain intentionally small. The engineering practices around building, testing, integrating, and eventually deploying it are a major part of the project.

Milestone 1 established the backend API foundation.

Milestone 2 established the React MVP.

Milestone 3 is focused on deterministic automated quality gates and CI.

Do not add product features or engineering infrastructure outside the active GitHub Issue unless they are required to satisfy that issue's acceptance criteria.

---

## Current Application Scope

The application currently supports:

* Search for a city
* Current weather conditions
* Next 24-hour forecast
* 3-day forecast
* Temperature, condition, humidity, wind, and precipitation information
* Imperial and metric units
* Loading state
* Location-not-found state
* Weather-provider-error state
* Retry recovery
* Responsive desktop and mobile UI
* Keyboard-accessible forecast interaction

WeatherAPI is the external weather provider used by the application.

The React UI consumes the Weather App API rather than communicating directly with WeatherAPI.

---

## Repository Structure

The current high-level repository structure is:

```text
WeatherApp/
├── .config/
│   └── dotnet-tools.json
├── scripts/
│   └── test-environment.mjs
├── src/
│   ├── WeatherApp.Api/
│   └── WeatherApp.Ui/
├── tests/
│   ├── TestEnvironment/
│   └── WeatherApp.Api.Tests/
├── .node-version
├── .env.example
├── .gitignore
├── AGENTS.md
├── global.json
├── README.md
└── WeatherApp.slnx
```

Milestone 3 has introduced a shared deterministic full-stack test environment. Additional test and CI infrastructure will be added through its individual GitHub Issues.

Do not create planned folders or projects before the issue that requires them.

### `src/WeatherApp.Api`

ASP.NET Core Minimal API written in C#.

The API:

* Owns application-side weather behavior.
* Integrates with WeatherAPI through a typed `HttpClient`.
* Maps provider-specific data into the application's public response contract.
* Handles validation, provider errors, and timeouts.
* Implements weather-response caching.
* Implements public weather-endpoint rate limiting.
* Keeps WeatherAPI details isolated from the frontend.

### `src/WeatherApp.Ui`

React + TypeScript + Vite frontend.

The UI:

* Uses relative `/api` requests.
* Communicates with the Weather App API rather than WeatherAPI.
* Uses Tailwind CSS for styling.
* Uses accessible HTML and native controls where practical.
* Supports responsive desktop and mobile layouts.
* Contains frontend component and interaction tests using Vitest and React Testing Library.

### `tests/WeatherApp.Api.Tests`

xUnit integration tests for backend behavior.

The backend test suite uses tools including:

* xUnit
* FluentAssertions
* `WebApplicationFactory`
* WireMock.Net

Tests should verify meaningful application behavior and important boundaries rather than maximizing test count.

### `tests/TestEnvironment`

Repository-owned standalone WireMock mappings and fixed provider responses for deterministic full-stack testing.

Use `scripts/test-environment.mjs` to build, start, verify, and stop the fixed WireMock/API/Vite-preview process stack. Later full-stack suites should consume this environment instead of creating a separate provider boundary.

---

# Architecture Principles

## Prefer Simplicity

Prefer simple implementations over unnecessary abstractions.

Do not create:

* Folders
* Layers
* Interfaces
* Services
* Classes
* Helpers
* Framework wrappers

solely because they might be useful later.

Introduce abstractions when current requirements justify them.

## Preserve Application Boundaries

Keep WeatherAPI-specific behavior behind the Weather App API.

The frontend must not:

* Call WeatherAPI directly.
* Require a WeatherAPI key.
* Depend on WeatherAPI-specific response contracts.

Tests outside the provider boundary should prefer the Weather App's public behavior rather than provider implementation details.

## Dependency Discipline

Avoid adding dependencies unless they provide clear value for the active issue.

Before adding a dependency, confirm that:

1. The active issue requires the capability.
2. Existing project tools do not already provide it adequately.
3. The dependency does not introduce unnecessary architecture or operational complexity.

## Secrets

Keep secrets out of source control.

Never commit:

* WeatherAPI credentials
* Postman API keys
* GitHub secrets
* Personal tokens
* Generated secret files

Use appropriate environment configuration or local secret storage.

`.env.example` and other example configuration files may document required variable names but must never contain real credentials.

---

# Scope Discipline

Work from the active GitHub Issue and its acceptance criteria.

Before changing code:

1. Read the issue completely.
2. Inspect the relevant existing code.
3. Inspect relevant existing tests and configuration.
4. Identify which acceptance criteria require changes.
5. Identify explicit non-goals and out-of-scope work.
6. Confirm the proposed implementation stays within scope.

Do not implement work explicitly listed as out of scope.

Do not implement a later Milestone 3 issue early merely because the future requirement is known.

If additional work appears necessary to satisfy the active issue, explain why before expanding the implementation.

Avoid opportunistic refactoring unrelated to the active issue.

Do not introduce new Weather App product features during Milestone 3 unless a GitHub Issue explicitly requires them.

---

# Testing Strategy

Testing should focus on meaningful behavior and risk rather than maximizing test count or coverage percentage.

Use the lowest testing layer that can reliably verify the behavior.

Broader tests should exist when broader integration itself is the risk being verified.

## Testing-Layer Ownership

### Backend — xUnit

Backend tests are the primary layer for:

* WeatherAPI request construction
* Provider response deserialization
* Provider orchestration
* Provider failures and timeouts
* Public response mapping
* Next-24-hour forecast boundaries
* Cache keys
* Cache hits
* Cache expiration
* Provider call counts
* Rate limiting
* API validation
* HTTP status mapping
* `ProblemDetails`
* Health endpoint behavior
* Detailed backend error behavior

Do not move backend implementation-detail assertions into Postman or Playwright merely to duplicate existing coverage.

### Frontend — Vitest + React Testing Library

Frontend tests are the primary layer for:

* API-service behavior
* Request URL construction
* Unit selection behavior
* Request-state transitions
* Loading behavior
* Error-category mapping
* Retry behavior
* Stale-data clearing
* Conditional rendering
* Component interaction
* Semantic markup
* Keyboard behavior that jsdom can verify reliably

Prefer testing behavior visible to the component's consumer rather than implementation details.

### API — Postman CLI

During Milestone 3, Postman CLI is introduced as the black-box public API test layer.

Postman tests should verify the Weather App API as an external HTTP consumer would.

Appropriate Postman coverage includes:

* Health
* Public success contracts
* Imperial and metric behavior
* Validation responses
* Public HTTP status codes
* Sanitized error responses

Postman should not inspect:

* Cache internals
* Provider call counts
* Internal classes
* Internal orchestration
* Browser behavior

**Use Postman CLI, not Newman.**

Do not:

* Install Newman.
* Add Newman commands.
* Add Newman CI configuration.
* Document Newman as a supported test runner.

Postman CLI testing must not require:

* A Postman cloud login
* A Postman API key
* Workspace synchronization
* Cloud collection IDs

### Browser / Full Stack — Playwright

During Milestone 3, Playwright is introduced as the browser-level and full-stack test layer.

Playwright should verify valuable user journeys and browser-specific risks, including:

* Full-stack browser workflows
* Browser/UI/API integration
* Accessibility automation
* Keyboard interaction
* Responsive behavior
* Horizontal overflow
* Touch-target sizing
* Selected cross-browser behavior

Playwright must not become a duplicate copy of:

* Backend integration tests
* Frontend component tests
* Postman API tests

Prefer a small number of high-value browser journeys.

When locating UI elements, prefer:

* Roles
* Labels
* Accessible names
* Headings
* Visible user-facing text

Avoid selectors based primarily on:

* Tailwind classes
* DOM structure
* Implementation details

Do not use arbitrary fixed delays as test synchronization.

Do not use screenshot snapshots as the primary functional assertion strategy.

---

# Deterministic Automated Testing

Milestone 3 establishes deterministic testing as a repository-wide principle.

Required automated verification must not depend on:

* The real WeatherAPI
* Current live weather
* A real WeatherAPI credential
* Current date-dependent provider results
* External coverage services
* Postman cloud services
* Test execution order

Automated tests should use repository-owned deterministic fixtures where full-stack provider behavior is required.

Fixtures should use fixed:

* Timestamps
* Weather values
* Locations
* Conditions
* Error responses

Expected results should not change depending on when the test runs.

## Real-Provider Isolation

Automated tests and CI must never silently fall back to the real WeatherAPI.

Test configuration must make the deterministic provider boundary explicit.

A missing test dependency should cause a clear failure rather than accidentally contacting the production provider.

## Environment Synchronization

Use bounded readiness checks for application processes and test dependencies.

Readiness polling is acceptable for determining when a service is ready.

Readiness polling is not considered a test retry.

Avoid arbitrary sleeps as the primary synchronization strategy.

Any process started for automated testing must be stopped after:

* Success
* Assertion failure
* Setup failure
* Timeout

Do not leave orphaned processes that can affect later test runs.

---

# Flaky-Test Policy

Milestone 3 uses a zero-retry quality policy.

Required automated tests should use **zero automatic retries**.

Do not hide instability through:

* Automatic retries
* Quarantined required tests
* Disabled required tests
* Skipped required tests
* `continue-on-error` on required verification

A required test that fails and then passes unchanged should be treated as a suspected flaky test rather than assumed to be healthy.

The expected response is to investigate and repair:

* The product
* The test
* The deterministic environment

Manual reruns are acceptable for identifiable infrastructure failures such as a GitHub runner or external package-download failure.

Do not use reruns to normalize unexplained application or test instability.

---

# Coverage Philosophy

Coverage is a guardrail, not the objective of the test suite.

Tests should exist because they protect meaningful behavior or risk.

Do not add low-value tests solely to increase a coverage percentage.

Do not target 100% coverage.

Do not exclude handwritten production code from coverage merely because it is difficult to test.

Milestone 3's planned global minimum coverage floors are:

| Codebase | Lines | Branches | Functions | Statements |
| -------- | ----: | -------: | --------: | ---------: |
| Backend  |   80% |      70% | Not gated |  Not gated |
| Frontend |   80% |      75% |       80% |        80% |

These are Milestone 3 targets.

Do not implement or enforce a coverage gate before the active GitHub Issue introduces it.

When the relevant issue is implemented, preserve these principles:

* Global thresholds rather than per-file thresholds.
* No changed-lines/diff-coverage requirement during Milestone 3.
* No external coverage service.
* No application-code coverage collection from Postman or Playwright.
* Generated code, tests, test utilities, build output, and third-party code may be excluded appropriately.
* Handwritten first-party production code should remain included.

---

# Milestone 3 Quality Principles

Milestone 3 — Automated Quality Gates and CI follows these principles:

1. Test behavior at the lowest useful layer.
2. Keep full-stack automation deterministic.
3. Use production-like application boundaries for full-stack testing.
4. Make failures diagnosable.
5. Do not hide test instability.
6. Keep CI self-contained and secret-free.
7. Protect `main` through a stable final quality-gate contract.

These principles apply throughout Milestone 3 even when the implementation supporting them is introduced incrementally.

---

# Milestone 3 Scope Guardrails

Milestone 3 is about automated quality gates and CI.

Expected work includes, when required by the corresponding active issue:

* Deterministic full-stack test infrastructure
* Repository-owned provider fixtures
* Postman CLI API automation
* Playwright end-to-end automation
* Accessibility automation
* Responsive automation
* Selected cross-browser automation
* Backend test reporting
* Frontend test reporting
* Coverage enforcement
* GitHub Actions
* Diagnostic artifacts
* Flaky-test handling
* Branch-protection quality gates
* Documentation of local and CI verification

The following are outside Milestone 3 unless a later approved issue explicitly changes scope:

* New Weather App product features
* Deployment automation
* Publishing
* Release automation
* Docker
* Docker Compose
* Nginx
* Raspberry Pi deployment
* Production hosting
* Scheduled real-provider smoke tests
* Performance testing
* Load testing
* Stress testing
* Endurance testing
* Visual-regression screenshot baselines
* Formal accessibility certification
* External reporting services such as Codecov, Coveralls, or SonarCloud
* Automatic flaky-test quarantine
* Automatic test retries
* PR auto-merge

---

# Build and Verification Commands

Run commands from the repository root unless otherwise noted.

The repository pins .NET SDK `10.0.303` in `global.json`, Node.js `24.20.0` in `.node-version`, and standalone WireMock `2.15.0` in the local .NET tool manifest. Restore dependencies with `dotnet tool restore`, `dotnet restore`, and `npm ci` before verification.

## Backend

### Restore

```powershell
dotnet restore WeatherApp.slnx
```

### Build the solution

```powershell
dotnet build WeatherApp.slnx
```

### Run backend tests

```powershell
dotnet test tests/WeatherApp.Api.Tests/WeatherApp.Api.Tests.csproj
```

The full solution may also be tested where appropriate:

```powershell
dotnet test WeatherApp.slnx
```

## Frontend

Run frontend commands from:

```text
src/WeatherApp.Ui
```

### Install dependencies

```powershell
npm install
```

For clean, deterministic dependency restoration where the workflow requires it:

```powershell
npm ci
```

### Run frontend tests

```powershell
npm test
```

### Watch frontend tests

```powershell
npm run test:watch
```

### Run frontend coverage

```powershell
npm run test:coverage
```

### Lint

```powershell
npm run lint
```

### Production build

```powershell
npm run build
```

## Deterministic Full Stack

Run the self-contained smoke contract from the repository root:

```powershell
node scripts/test-environment.mjs verify
```

Keep the same fixed environment running for manual verification or a later Postman/Playwright suite:

```powershell
node scripts/test-environment.mjs serve
```

The fixed addresses are WireMock at `127.0.0.1:9090`, the API at `127.0.0.1:5100`, and Vite production preview at `127.0.0.1:4173`. The runner must fail on port conflicts, use bounded readiness polling, and release all process trees and ports on every exit path.

When a change affects a project, run the relevant build, lint, and test commands before considering the work complete.

As Milestone 3 introduces repository-owned Postman, Playwright, reporting, coverage, and CI commands, use the commands established by the corresponding issue and update repository documentation when they become part of the actual workflow.

Do not invent commands for planned infrastructure that has not yet been implemented.

---

# Agent Workflow

The user is intentionally using this project to learn software engineering, QA automation, SDET, DevOps, and agentic engineering practices.

Agents should support that learning process rather than unnecessarily replacing it.

## Before Starting Issue Work

For an implementation issue:

1. Read the complete GitHub Issue.
2. Inspect the current branch and working tree.
3. Inspect the relevant code.
4. Inspect relevant tests.
5. Inspect relevant configuration and documentation.
6. Identify dependencies on work from previous issues.
7. Break the issue into understandable implementation subtasks.
8. Identify ambiguities that materially affect architecture, scope, or test strategy.
9. Establish how each subtask will be verified.

Do not assume the repository still matches an earlier conversation or plan.

The current repository is the source of truth for implemented behavior.

The active GitHub Issue is the source of truth for issue-specific requirements.

`AGENTS.md` is the source of truth for standing repository and agent-working rules.

## When Asked to Review or Plan

If the user asks for:

* A review
* An explanation
* Recommendations
* An implementation plan
* A subtask plan
* Step-by-step guidance
* An architecture discussion

do not modify repository files unless explicitly asked.

Explain:

* What should change
* Why it should change
* Which files are involved
* Important alternatives or tradeoffs
* How the result should be tested
* How the user can verify the result

Prefer smaller understandable steps over one large opaque implementation.

When the user requests a plan-first workflow, do not begin implementation until the requested plan review is complete.

## When Asked to Implement

When explicitly asked to implement:

* Stay within the active issue.
* Follow the approved plan where one exists.
* Make the smallest reasonable change satisfying the acceptance criteria.
* Preserve existing behavior unless the issue requires changing it.
* Avoid unrelated cleanup.
* Avoid speculative architecture.
* Add or update tests when behavior changes.
* Use the appropriate testing layer.
* Run relevant verification.
* Review the resulting diff.
* Clearly summarize what changed and what was verified.

Do not silently expand implementation into future milestone work.

## When Requirements Are Unclear

Do not silently make a major architectural, workflow, or testing-strategy decision.

Identify significant ambiguity and explain the relevant tradeoffs before proceeding when it materially affects:

* Architecture
* Public contracts
* Security
* Testing strategy
* Repository structure
* CI behavior
* Developer workflow
* Scope

For small implementation details that do not materially affect architecture or scope, use reasonable conventions and keep the solution simple.

---

# Git Workflow

Use an issue-based, short-lived branch workflow.

Do not perform normal feature or maintenance work directly on `main`.

## Start Work

Normal feature work should begin from an up-to-date `main`:

```powershell
git status

git switch main

git pull --ff-only origin main

git switch -c feature/<issue-number>-<description>

git push -u origin feature/<issue-number>-<description>
```

Other prefixes such as `fix/`, `chore/`, or `docs/` may be used when they better describe the issue.

Keep the GitHub Issue number in the branch name where practical.

## During Work

Use focused checkpoints.

Before staging:

```powershell
git status
git diff
```

Before committing:

```powershell
git status
git diff --staged
```

Confirm that:

* Changes belong to the active issue.
* Generated files are not accidentally staged.
* Test reports are not accidentally staged.
* Coverage output is not accidentally staged.
* Browser traces/screenshots/videos are not accidentally staged.
* Secrets are not staged.
* Debugging code is not staged.
* Relevant verification has passed.

Keep commits understandable and focused on the active issue.

## Pull Requests

Open the pull request from the issue branch into `main`.

Before considering the pull request ready:

* Review the final diff.
* Confirm the issue's acceptance criteria.
* Run relevant local verification.
* Allow required CI checks to complete when available.
* Record important manual verification where the issue requires it.

Use squash merging for normal issue branches unless there is a specific reason not to.

The user retains final human review and merge control unless explicitly delegated.

Do not merge a pull request merely because implementation is complete.

## After Merge

After the pull request has been merged:

```powershell
git switch main

git pull --ff-only origin main

git branch -d feature/<issue-number>-<description>

git push origin --delete feature/<issue-number>-<description>
```

Clean up merged branches after confirming `main` contains the merged work.

---

# GitHub Actions and Quality Gates

Milestone 3 will establish GitHub Actions as the automated verification system for pull requests and pushes to `main`.

Until the GitHub Actions issue is implemented, do not document planned CI behavior as though it already exists.

Once introduced, the milestone's quality-gate design is:

```text
Backend
Frontend
Postman API
Playwright E2E
        ↓
Quality Gate
```

The final `Quality Gate` is intended to become the single required status check protecting `main`.

Individual implementation jobs may evolve internally, but the final gate should remain the stable branch-protection contract.

Required verification jobs must not depend on servers or state created by another job.

CI should remain:

* Deterministic
* Provider-independent
* Secret-free
* Read-only
* Diagnosable

Do not use `pull_request_target` for the Milestone 3 verification workflow.

Do not add deployment or publishing behavior to the Milestone 3 CI workflow.

Do not allow a required verification failure to be hidden with `continue-on-error`.

---

# Test Reports and Generated Artifacts

Generated verification output should not be committed to source control.

This includes items such as:

* Coverage reports
* TRX results
* JUnit results
* HTML test reports
* Playwright reports
* Playwright traces
* Screenshots
* Videos
* Temporary deterministic-environment output

Generated output should be written to predictable locations and ignored by Git.

When Milestone 3 CI artifact handling is introduced, failures should retain enough evidence for useful diagnosis.

A failing automated quality gate should leave evidence that helps identify:

1. Which testing layer failed.
2. Which scenario or assertion failed.
3. Whether the application or environment failed to become ready.
4. Where the relevant report or browser evidence can be found.

---

# Accessibility and Responsive Testing

Accessibility is part of application quality rather than a cosmetic enhancement.

Use semantic HTML and native browser behavior where practical.

Automated accessibility testing should supplement, not replace:

* Component semantics
* Keyboard testing
* Browser interaction testing
* Human judgment

Do not describe automated accessibility scans as formal accessibility certification.

Responsive behavior should be verified at meaningful layout boundaries rather than only at arbitrary popular device sizes.

Intentional horizontal scrolling should remain limited to components designed for it, such as the hourly forecast.

Page-level horizontal overflow should be treated as a defect.

---

# Documentation

Documentation must describe the repository as it actually exists.

Do not document planned functionality as though it has already been implemented.

Update documentation when an issue materially changes:

* Architecture
* Repository structure
* Setup
* Runtime prerequisites
* Testing
* API behavior
* CI
* Developer workflow
* Verification commands
* Quality gates
* Deployment

Prefer concise authoritative documentation over duplicating the same detailed instructions across multiple files.

## Updating `AGENTS.md`

Update `AGENTS.md` when an issue changes a durable rule that future agents need to know.

Examples include:

* Repository structure changes
* New standard verification commands
* New testing layers
* Testing-layer ownership changes
* Architecture boundaries
* CI requirements
* Git workflow
* Definition of Done
* Required agent behavior

Do not turn `AGENTS.md` into:

* A milestone blueprint
* An issue tracker
* A changelog
* A repository history
* A copy of every acceptance criterion

Issue-specific requirements belong in the GitHub Issue.

Implemented setup and usage instructions belong in appropriate repository documentation.

Standing agent and engineering rules belong here.

---

# Definition of Done

An issue is complete when:

* Its acceptance criteria are satisfied.
* The implementation stays within scope.
* Relevant builds succeed.
* Relevant linting succeeds.
* Relevant automated tests pass.
* The correct testing layer was used.
* No required test is hidden through retries, skipping, quarantine, or `continue-on-error`.
* No secrets are included.
* No generated reports or browser artifacts are accidentally committed.
* Documentation is updated when the issue changes actual repository behavior or workflow.
* The final diff contains only intentional changes.
* Required manual verification is complete.
* The pull request clearly records meaningful verification performed.

When CI quality gates become part of the implemented repository workflow, the required CI gate must also pass before the issue is considered merge-ready.
