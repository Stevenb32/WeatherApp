#requires -Version 7.0
<#
.SYNOPSIS
Validates existing CI reports or appends a compact GitHub job summary.
.DESCRIPTION
Run Validate before artifact uploads and Summary afterwards. Pass the producing
test step's outcome (skipped when setup prevented execution) and the current
job.status. For Backend, the producing step is the complete backend runner;
that runner remains responsible for required reports and coverage enforcement.

This helper does not run tests, enforce coverage floors, or upload artifacts.
Missing/invalid reports fail otherwise successful verification. After an earlier
failure they are diagnostic warnings; a successful helper exit does not change
the failed test step or job outcome. Skipped commands never consume old reports.

SummaryPath defaults to GITHUB_STEP_SUMMARY. RepositoryRoot and SummaryPath can
be supplied for local checks using temporary fixtures. Requires PowerShell 7.
.EXAMPLE
./scripts/ci-report.ps1 -Mode Validate -Layer frontend -TestOutcome success -JobStatus success
.EXAMPLE
./scripts/ci-report.ps1 -Mode Summary -Layer frontend -TestOutcome success -JobStatus success -ArtifactNames frontend-test-results-attempt-1
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Validate', 'Summary')]
    [string] $Mode,

    [Parameter(Mandatory)]
    [ValidateSet('backend', 'frontend', 'postman', 'playwright')]
    [string] $Layer,

    [Parameter(Mandatory)]
    [ValidateSet('success', 'failure', 'cancelled', 'skipped')]
    [string] $TestOutcome,

    [Parameter(Mandatory)]
    [ValidateSet('success', 'failure', 'cancelled')]
    [string] $JobStatus,

    [ValidatePattern('^[a-zA-Z0-9_.-]+$')]
    [string[]] $ArtifactNames = @(),

    [string] $RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
    [string] $SummaryPath = $env:GITHUB_STEP_SUMMARY
)

$ErrorActionPreference = 'Stop'
$culture = [Globalization.CultureInfo]::InvariantCulture
$reports = @{
    backend = @{
        Name = 'Backend'
        Tests = 'tests/WeatherApp.Api.Tests/reports/tests/backend-tests.trx'
        Coverage = 'tests/WeatherApp.Api.Tests/reports/coverage/Summary.json'
        Required = @() # The backend runner already validates its complete report set.
        Diagnosis = 'Start with the backend runner stage logs, TRX failures, and HTML coverage report.'
    }
    frontend = @{
        Name = 'Frontend'
        Tests = 'src/WeatherApp.Ui/reports/junit/results.xml'
        Coverage = 'src/WeatherApp.Ui/coverage/coverage-summary.json'
        Required = @('src/WeatherApp.Ui/coverage/index.html', 'src/WeatherApp.Ui/coverage/lcov.info')
        Diagnosis = 'Inspect lint/build logs, JUnit failures, and the four coverage totals in the HTML report.'
    }
    postman = @{
        Name = 'Postman API'
        Tests = 'tests/WeatherApp.Postman/reports/postman-results.xml'
        Required = @('tests/WeatherApp.Postman/reports/postman-report.html')
        Diagnosis = 'Inspect deterministic-environment startup/cleanup logs and the Postman HTML request details.'
    }
    playwright = @{
        Name = 'Playwright E2E'
        Tests = 'tests/WeatherApp.E2E/reports/junit/results.xml'
        Required = @('tests/WeatherApp.E2E/reports/html/index.html')
        Diagnosis = 'Inspect startup logs or the failed browser test in the HTML report; open retained traces when available.'
    }
}[$Layer]

function Get-ReportPath([string] $RelativePath) {
    $reportPath = Join-Path $RepositoryRoot $RelativePath
    $file = Get-Item -LiteralPath $reportPath -ErrorAction SilentlyContinue
    if ($null -eq $file -or $file.PSIsContainer -or $file.Length -eq 0) {
        throw "Missing or empty report: $RelativePath"
    }
    return $file.FullName
}

function Read-ReportXml([string] $RelativePath) {
    $settings = [System.Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create((Get-ReportPath $RelativePath), $settings)
    try {
        $document = [System.Xml.XmlDocument]::new()
        $document.Load($reader)
        return ,$document
    }
    finally {
        $reader.Dispose()
    }
}

function Get-Count($Value, [string] $Label) {
    $number = 0L
    if ("$Value" -notmatch '^\d+$' -or -not [long]::TryParse("$Value", [ref] $number)) {
        throw "Invalid count: $Label"
    }
    return $number
}

function Read-TestTotals {
    $document = Read-ReportXml $reports.Tests
    $totals = [ordered]@{ Total = 0L; Passed = 0L; Failed = 0L; Errors = 0L; Skipped = 0L; Other = 0L }
    if ($Layer -eq 'backend') {
        # TRX uses a default XML namespace; local-name also accepts fixture XML.
        $counters = $document.SelectSingleNode("/*[local-name()='TestRun']/*[local-name()='ResultSummary']/*[local-name()='Counters']")
        if ($null -eq $counters) { throw 'TRX has no result counters.' }
        foreach ($pair in @(@('Total', 'total'), @('Passed', 'passed'), @('Failed', 'failed'), @('Errors', 'error'), @('Skipped', 'notExecuted'))) {
            $totals[$pair[0]] = Get-Count ($counters.GetAttribute($pair[1])) $pair[1]
        }
        $totals.Other = $totals.Total - $totals.Passed - $totals.Failed - $totals.Errors - $totals.Skipped
        if ($totals.Other -lt 0) { throw 'TRX result counters exceed the total.' }
    }
    else {
        if ($document.DocumentElement.LocalName -notin @('testsuites', 'testsuite')) {
            throw 'Expected a JUnit testsuites or testsuite document.'
        }
        # Count leaf test cases, not aggregate attributes. Postman's root tests
        # attribute counts requests, while its test cases represent assertions.
        $cases = $document.SelectNodes("//*[local-name()='testcase']")
        $totals.Total = $cases.Count
        foreach ($case in $cases) {
            if ($case.SelectSingleNode("*[local-name()='error']")) { $totals.Errors++ }
            elseif ($case.SelectSingleNode("*[local-name()='failure']")) { $totals.Failed++ }
            elseif ($case.SelectSingleNode("*[local-name()='skipped']")) { $totals.Skipped++ }
            else { $totals.Passed++ }
        }
        if ($Layer -eq 'postman') {
            # A request that fails before its assertions can still have an empty suite.
            $totals.Scenarios = $document.SelectNodes("/*[local-name()='testsuites']/*[local-name()='testsuite'] | /*[local-name()='testsuite']").Count
        }
    }
    if ($totals.Total -eq 0) { throw 'Test report contains no test results.' }
    return $totals
}

function Format-Coverage($Covered, $Total, $Percent, [string] $Label) {
    $coveredCount = Get-Count $Covered "$Label covered"
    $totalCount = Get-Count $Total "$Label total"
    $percentage = 0.0
    if ($totalCount -eq 0 -or $coveredCount -gt $totalCount -or
        -not [double]::TryParse("$Percent", [Globalization.NumberStyles]::Float, $culture, [ref] $percentage) -or
        -not [double]::IsFinite($percentage) -or $percentage -lt 0 -or $percentage -gt 100) {
        throw "Invalid coverage totals: $Label"
    }
    return "$Label`: $coveredCount/$totalCount ($($percentage.ToString('0.##', $culture))%)"
}

function Read-CoverageTotals {
    $data = Get-Content -LiteralPath (Get-ReportPath $reports.Coverage) -Raw | ConvertFrom-Json -AsHashtable
    if ($Layer -eq 'backend') {
        $summary = $data.summary
        Format-Coverage $summary.coveredlines $summary.coverablelines $summary.linecoverage 'Lines'
        Format-Coverage $summary.coveredbranches $summary.totalbranches $summary.branchcoverage 'Branches'
    }
    else {
        foreach ($metric in @('lines', 'branches', 'functions', 'statements')) {
            $counts = $data.total[$metric]
            Format-Coverage $counts.covered $counts.total $counts.pct $culture.TextInfo.ToTitleCase($metric)
        }
    }
}

function ConvertTo-MarkdownText([string] $Text) {
    # Report errors may contain paths or XML text. Keep them as plain text.
    return [System.Net.WebUtility]::HtmlEncode(($Text -replace '[\r\n]+', ' ')) -replace '([\\`*_|\[\]])', '\$1'
}

try {
    if ($Mode -eq 'Summary' -and ([string]::IsNullOrWhiteSpace($SummaryPath) -or $ArtifactNames.Count -eq 0)) {
        throw 'Summary requires ArtifactNames and SummaryPath (or GITHUB_STEP_SUMMARY).'
    }
    if ($Layer -eq 'backend' -and $Mode -eq 'Validate') {
        Write-Output '[ci-report] Backend report validation is owned by scripts/test-backend.mjs.'
        exit 0
    }

    $problems = [System.Collections.Generic.List[string]]::new()
    $testTotals = $null
    $coverageTotals = @()
    if ($TestOutcome -ne 'skipped') {
        foreach ($reportPath in $reports.Required) {
            try { $null = Get-ReportPath $reportPath }
            catch { $problems.Add($_.Exception.Message) }
        }
        try { $testTotals = Read-TestTotals }
        catch { $problems.Add("Test results unavailable: $($_.Exception.Message)") }
        if ($reports.Coverage) {
            try { $coverageTotals = @(Read-CoverageTotals) }
            catch { $problems.Add("Coverage unavailable: $($_.Exception.Message)") }
        }
        if ($TestOutcome -eq 'success' -and $null -ne $testTotals -and $testTotals.Passed -ne $testTotals.Total) {
            $problems.Add('A successful test command reported non-passing test results.')
        }
    }
    elseif ($JobStatus -eq 'success') {
        $problems.Add('The test command did not run in an otherwise successful job.')
    }

    $priorFailure = $JobStatus -ne 'success' -or $TestOutcome -in @('failure', 'cancelled')
    $result = $JobStatus
    if ($result -eq 'success' -and $TestOutcome -in @('failure', 'cancelled')) { $result = $TestOutcome }
    if ($result -eq 'success' -and $problems.Count -gt 0) { $result = 'failure' }

    foreach ($problem in $problems) { Write-Warning "[ci-report] $problem" }
    if ($Mode -eq 'Summary') {
        $lines = [System.Collections.Generic.List[string]]::new()
        $lines.Add("## $($reports.Name)")
        $lines.Add('')
        $lines.Add("Result: **$result**. Verification command: **$TestOutcome**.")
        $lines.Add('')
        if ($TestOutcome -eq 'skipped') {
            $lines.Add('Tests did not run; existing reports were not read. Inspect the earlier setup steps.')
        }
        elseif ($null -ne $testTotals) {
            $label = if ($Layer -eq 'postman') { "Assertions ($($testTotals.Scenarios) request scenarios)" } else { 'Tests' }
            $lines.Add("$label`: $($testTotals.Total) total; $($testTotals.Passed) passed; $($testTotals.Failed) failed; $($testTotals.Errors) errors; $($testTotals.Skipped) skipped; $($testTotals.Other) other.")
        }
        else { $lines.Add('Test counts unavailable; inspect the verification logs.') }
        if ($coverageTotals.Count -gt 0) { $lines.Add('') }
        foreach ($coverage in $coverageTotals) { $lines.Add("- $coverage") }
        if ($reports.Coverage -and $coverageTotals.Count -eq 0) { $lines.Add('Coverage totals unavailable.') }
        $lines.Add('')
        $lines.Add('Artifacts (see upload steps for availability): ' + (($ArtifactNames | ForEach-Object { '`' + $_ + '`' }) -join ', ') + '.')
        $lines.Add('')
        $lines.Add($reports.Diagnosis)
        if ($problems.Count -gt 0) {
            $lines.Add('')
            $lines.Add('Report diagnostics:')
            $lines.Add('')
            foreach ($problem in $problems) { $lines.Add('- ' + (ConvertTo-MarkdownText $problem)) }
        }
        [System.IO.File]::AppendAllText($SummaryPath, ($lines -join "`n") + "`n`n", [System.Text.UTF8Encoding]::new($false))
        Write-Output "[ci-report] $($reports.Name) summary written; result: $result."
    }
    else { Write-Output "[ci-report] $($reports.Name): $($problems.Count) report issue(s)." }

    if ($problems.Count -gt 0 -and -not $priorFailure) { exit 1 }
    exit 0
}
catch {
    [Console]::Error.WriteLine("[ci-report] $($_.Exception.Message)")
    exit 1
}
