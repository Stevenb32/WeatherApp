# WeatherApp Agent Instructions

## Project Purpose

WeatherApp is a full-stack portfolio and learning project focused on software development, QA automation, SDET practices, DevOps, and agentic engineering workflows.

The application itself should remain intentionally small. The engineering practices around building, testing, integrating, and deploying it are a major part of the project.

## MVP Scope

The MVP will support:

* Search for a city
* Display current weather
* Display an hourly forecast
* Display a 3-day forecast
* Show temperature, conditions, humidity, wind, and precipitation chance
* °F / °C temperature toggle
* Loading state
* Location-not-found state
* Weather-provider-error state
* Responsive desktop and mobile UI

WeatherAPI is the planned external weather provider.

Do not add features outside the active GitHub Issue unless they are required to complete its acceptance criteria.

## Repository Structure

```text
WeatherApp/
├── src/
│   ├── WeatherApp.Api/
│   └── WeatherApp.Ui/
├── tests/
│   └── WeatherApp.Api.Tests/
├── .env.example
├── .gitignore
├── AGENTS.md
├── README.md
└── WeatherApp.slnx
```

### `src/WeatherApp.Api`

ASP.NET Core API written in C#.

The API is responsible for application-side weather behavior and will eventually isolate the frontend from direct WeatherAPI access.

### `src/WeatherApp.Ui`

React + TypeScript + Vite frontend.

The UI should consume the application's API rather than communicating directly with WeatherAPI.

### `tests/WeatherApp.Api.Tests`

xUnit tests for API behavior.

Add tests when meaningful application behavior exists. Do not create placeholder tests solely to increase test count.

## Architecture Principles

* Prefer simple implementations over unnecessary abstractions.
* Do not create folders, layers, interfaces, services, or classes solely because they may be useful later.
* Introduce abstractions when current requirements justify them.
* Keep external weather-provider concerns behind the application API.
* Keep secrets out of source control.
* Use environment variables for secrets such as WeatherAPI credentials.
* `.env.example` may document required variable names but must never contain real credentials.
* Avoid adding dependencies unless they provide clear value for the active issue.

## Scope Discipline

Work from the active GitHub Issue and its acceptance criteria.

Before changing code:

1. Read the issue completely.
2. Inspect the relevant existing code.
3. Identify which acceptance criteria require changes.
4. Confirm that proposed changes are within scope.

Do not implement work explicitly listed as out of scope.

If additional work appears necessary, explain why before expanding the implementation.

Avoid opportunistic refactoring unrelated to the active issue.

## Testing Strategy

Testing should focus on meaningful behavior and risk rather than maximizing test count.

### API Testing

Use xUnit for automated API tests.

As API behavior is introduced, tests should cover appropriate areas such as:

* Successful requests
* Validation
* Error handling
* External-provider failures
* Response contracts
* Caching behavior
* Rate-limiting behavior

Do not add tests for behavior that does not yet exist.

### UI and End-to-End Testing

Playwright testing will be introduced in a later issue.

Do not add Playwright infrastructure before the issue that introduces it.

### API Collection Testing

Postman/Newman testing will be introduced in a later issue.

Do not add Postman collections or Newman configuration before the issue that introduces them.

## Build and Test Commands

Run commands from the repository root unless otherwise noted.

### Build the API

```powershell
dotnet build src/WeatherApp.Api/WeatherApp.Api.csproj
```

### Build the .NET solution

```powershell
dotnet build WeatherApp.slnx
```

### Run API tests

```powershell
dotnet test tests/WeatherApp.Api.Tests/WeatherApp.Api.Tests.csproj
```

### Build the UI

```powershell
cd src/WeatherApp.Ui
npm run build
```

When a change affects a project, run the relevant build and test commands before considering the work complete.

## Agent Workflow

The user is intentionally using this project to learn software engineering and agentic engineering practices.

Agents should support that goal rather than unnecessarily replacing the learning process.

### When Asked to Review or Plan

If the user asks for:

* A review
* An explanation
* Recommendations
* An implementation plan
* Step-by-step guidance

do not modify repository files unless explicitly asked.

Explain:

* What should change
* Why it should change
* Which files are involved
* How the user can verify the result

Prefer smaller, understandable steps over one large implementation plan.

### When Asked to Implement

If explicitly asked to implement changes:

* Stay within the active issue.
* Make the smallest reasonable change that satisfies the acceptance criteria.
* Preserve existing behavior unless the issue requires changing it.
* Avoid unrelated cleanup.
* Avoid speculative architecture.
* Add or update tests when behavior changes.
* Run relevant builds and tests.
* Clearly summarize what changed and what was verified.

### When Requirements Are Unclear

Do not silently make a major architectural decision.

Identify the ambiguity and explain the relevant tradeoffs before proceeding when the decision would materially affect the project.

For small implementation details that do not affect architecture or scope, use reasonable conventions and keep the solution simple.

## Git Workflow

Use an issue-based branch workflow.

Branch names should identify the type of work and GitHub Issue where practical.

Example:

```text
chore/1-initialize-repository
```

Do not work directly on `main` for normal feature or maintenance work.

Keep commits focused on the active issue.

Before committing:

* Review `git status`.
* Confirm generated files are not being committed.
* Confirm secrets are not being committed.
* Confirm changes belong to the active issue.
* Run relevant builds and tests.

## Documentation

Documentation should describe the repository as it actually exists.

Do not document planned functionality as though it is already implemented.

Update documentation when an issue materially changes:

* Architecture
* Setup
* Testing
* API behavior
* Deployment
* Developer workflow

Prefer concise documentation over duplicating information across multiple files.

## Definition of Done

An issue is complete when:

* Its acceptance criteria are satisfied.
* The implementation stays within scope.
* Relevant builds succeed.
* Relevant automated tests pass.
* No secrets or generated files are accidentally included.
* Documentation is updated when required.
* The final diff contains only intentional changes.
