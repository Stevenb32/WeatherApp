import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const helper = fileURLToPath(new URL('./ci-report.ps1', import.meta.url))
const powershell = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh'
const paths = {
  backend: {
    tests: 'tests/WeatherApp.Api.Tests/reports/tests/backend-tests.trx',
    coverage: 'tests/WeatherApp.Api.Tests/reports/coverage/Summary.json',
  },
  frontend: {
    tests: 'src/WeatherApp.Ui/reports/junit/results.xml',
    coverage: 'src/WeatherApp.Ui/coverage/coverage-summary.json',
    html: 'src/WeatherApp.Ui/coverage/index.html',
    lcov: 'src/WeatherApp.Ui/coverage/lcov.info',
  },
  postman: {
    tests: 'tests/WeatherApp.Postman/reports/postman-results.xml',
    html: 'tests/WeatherApp.Postman/reports/postman-report.html',
  },
  playwright: {
    tests: 'tests/WeatherApp.E2E/reports/junit/results.xml',
    html: 'tests/WeatherApp.E2E/reports/html/index.html',
  },
}

function junit(outcomes = ['', '', '']) {
  const cases = outcomes.map((outcome, i) => `<testcase name="case ${i}">${outcome}</testcase>`)
  // Nested aggregate totals must not be added to the leaf case counts.
  return `<testsuites tests="3"><testsuite tests="3"><testsuite tests="3">${cases.join('')}</testsuite></testsuite></testsuites>`
}

function fixtureContents(layer) {
  const contents = { tests: junit(), html: '<html>Report</html>', lcov: 'TN:\nSF:src/App.tsx\nend_of_record\n' }
  if (layer === 'backend') {
    contents.tests = '<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><ResultSummary><Counters total="4" passed="4" failed="0" error="0" notExecuted="0" /></ResultSummary></TestRun>'
    contents.coverage = JSON.stringify({ summary: {
      coveredlines: 80, coverablelines: 100, linecoverage: 80,
      coveredbranches: 7, totalbranches: 10, branchcoverage: 70,
    } })
  }
  if (layer === 'frontend') {
    contents.coverage = JSON.stringify({ total: {
      lines: { covered: 9, total: 10, pct: 90 },
      branches: { covered: 3, total: 4, pct: 75 },
      functions: { covered: 4, total: 5, pct: 80 },
      statements: { covered: 9, total: 10, pct: 90 },
    } })
  }
  if (layer === 'postman') {
    // The real reporter counts requests at the root and assertions in test cases.
    contents.tests = '<testsuites tests="7">' + [1, 8, 6, 4, 4, 4, 4].map((count, i) =>
      `<testsuite name="request ${i}" tests="${count}">` +
      Array.from({ length: count }, (_, j) => `<testcase name="assertion ${j}" />`).join('') +
      '</testsuite>',
    ).join('') + '</testsuites>'
  }
  return contents
}

async function fixture(t, layer) {
  const temporaryRoot = await realpath(os.tmpdir())
  const prefix = 'weatherapp ci reports '
  const root = await mkdtemp(path.join(temporaryRoot, prefix))
  t.after(async () => {
    if (path.dirname(root) !== temporaryRoot || !path.basename(root).startsWith(prefix)) {
      throw new Error('Unexpected temporary cleanup target.')
    }
    await rm(root, { recursive: true, force: true })
  })
  const files = Object.fromEntries(Object.entries(paths[layer]).map(([key, value]) => [key, path.join(root, value)]))
  const contents = fixtureContents(layer)
  for (const [key, file] of Object.entries(files)) {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, contents[key])
  }
  const summaryPath = path.join(root, 'job-summary.md')
  return {
    files, summaryPath,
    async run({ mode = 'Summary', outcome = 'success', status = 'success', summaryOverride, noSummaryEnvironment = false } = {}) {
      const args = [
        '-NoProfile', '-NonInteractive', '-File', helper,
        '-Mode', mode, '-Layer', layer, '-TestOutcome', outcome,
        '-JobStatus', status, '-RepositoryRoot', root,
      ]
      if (mode === 'Summary') args.push('-ArtifactNames', `${layer}-report-attempt-3`)
      if (summaryOverride) args.push('-SummaryPath', summaryOverride)
      let result
      try {
        result = { ...await execute(powershell, args, {
          cwd: root, timeout: 15_000, windowsHide: true,
          env: { ...process.env, GITHUB_STEP_SUMMARY: noSummaryEnvironment ? '' : summaryPath, NO_COLOR: '1' },
        }), code: 0 }
      } catch (error) {
        if (!Number.isInteger(error.code)) throw error
        result = { code: error.code, stdout: error.stdout, stderr: error.stderr }
      }
      const summary = await readFile(summaryOverride ?? summaryPath, 'utf8').catch(error => {
        if (error.code !== 'ENOENT') throw error
        return null
      })
      return { ...result, summary }
    },
  }
}

for (const layer of Object.keys(paths)) {
  test(`${layer}: valid reports produce a summary with counts and artifact guidance`, async t => {
    const data = await fixture(t, layer)
    const validation = await data.run({ mode: 'Validate', noSummaryEnvironment: true })
    assert.equal(validation.code, 0, validation.stderr + validation.stdout)
    assert.equal(validation.summary, null, 'Validation must not write a summary')
    const result = await data.run()
    assert.equal(result.code, 0, result.stderr + result.stdout)
    assert.match(result.summary, /Result: \*\*success\*\*/)
    assert.match(result.summary, new RegExp(`${layer}-report-attempt-3`))
    assert.match(result.summary, /see upload steps for availability/)
    const total = layer === 'postman' ? 31 : layer === 'backend' ? 4 : 3
    assert.match(result.summary, new RegExp(`${total} total; ${total} passed; 0 failed; 0 errors; 0 skipped`))
    if (layer === 'postman') assert.match(result.summary, /Assertions \(7 request scenarios\)/)
    if (layer === 'backend') assert.match(result.summary, /Lines: 80\/100 \(80%\)/)
    if (layer === 'frontend') {
      assert.match(result.summary, /Lines: 9\/10 \(90%\)/)
      assert.match(result.summary, /Branches: 3\/4 \(75%\)/)
      assert.match(result.summary, /Functions: 4\/5 \(80%\)/)
      assert.match(result.summary, /Statements: 9\/10 \(90%\)/)
    }
  })
}

test('JUnit failures, errors, and skips remain distinct after an earlier failure', async t => {
  const data = await fixture(t, 'playwright')
  await writeFile(data.files.tests, junit(['<failure message="wrong value"/>', '<error message="crash"/>', '<skipped/>']))
  const result = await data.run({ outcome: 'failure', status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Result: \*\*failure\*\*/)
  assert.match(result.summary, /3 total; 0 passed; 1 failed; 1 errors; 1 skipped/)
})

test('Postman counts a request scenario even when it produced no assertions', async t => {
  const data = await fixture(t, 'postman')
  const report = fixtureContents('postman').tests
    .replace('<testsuite name="request 0" tests="1">', '<testsuite name="request 0" tests="0" errors="1">')
    .replace('<testcase name="assertion 0" />', '')
  await writeFile(data.files.tests, report)
  const result = await data.run({ outcome: 'failure', status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Result: \*\*failure\*\*/)
  assert.match(result.summary, /Assertions \(7 request scenarios\): 30 total; 30 passed/)
})

test('successful exit with non-passing JUnit results fails validation', async t => {
  const data = await fixture(t, 'frontend')
  await writeFile(data.files.tests, junit(['<skipped/>', '', '']))
  const result = await data.run({ mode: 'Validate' })
  assert.equal(result.code, 1)
  assert.match(result.stdout, /successful test command reported non-passing/)
})

test('TRX failed and unexecuted tests are counted through the XML namespace', async t => {
  const data = await fixture(t, 'backend')
  await writeFile(data.files.tests, fixtureContents('backend').tests.replace('passed="4" failed="0"', 'passed="2" failed="1"').replace('notExecuted="0"', 'notExecuted="1"'))
  const result = await data.run({ outcome: 'failure', status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /4 total; 2 passed; 1 failed; 0 errors; 1 skipped/)
})

for (const [layer, key, damage] of [
  ['frontend', 'tests', 'missing'],
  ['frontend', 'coverage', 'missing'],
  ['frontend', 'html', 'empty'],
  ['frontend', 'lcov', 'missing'],
  ['postman', 'html', 'missing'],
  ['playwright', 'html', 'empty'],
]) {
  test(`${layer}: ${damage} ${key} fails otherwise successful validation`, async t => {
    const data = await fixture(t, layer)
    if (damage === 'empty') await writeFile(data.files[key], '')
    else await rm(data.files[key])
    const result = await data.run({ mode: 'Validate' })
    assert.equal(result.code, 1)
    assert.match(result.stdout, /Missing or empty report/)
  })
}

for (const [layer, key, contents, message] of [
  ['frontend', 'tests', '<testsuites>', /Test results unavailable/],
  ['frontend', 'coverage', '{broken', /Coverage unavailable/],
  ['frontend', 'coverage', '{}', /Coverage unavailable/],
  ['postman', 'tests', '<testsuites tests="7"/>', /no test results/],
  ['backend', 'tests', '<TestRun/>', /no result counters/],
]) {
  test(`${layer}: invalid ${key} yields a failed summary with useful diagnostics`, async t => {
    const data = await fixture(t, layer)
    await writeFile(data.files[key], contents)
    const result = await data.run()
    assert.equal(result.code, 1)
    assert.match(result.summary, /Result: \*\*failure\*\*/)
    assert.match(result.summary, message)
    assert.match(result.summary, /Report diagnostics:/)
  })
}

test('invalid coverage counts cannot produce plausible summary totals', async t => {
  const data = await fixture(t, 'frontend')
  const coverage = JSON.parse(fixtureContents('frontend').coverage)
  coverage.total.lines.covered = 11
  await writeFile(data.files.coverage, JSON.stringify(coverage))
  const result = await data.run()
  assert.equal(result.code, 1)
  assert.match(result.summary, /Invalid coverage totals: Lines/)
  assert.doesNotMatch(result.summary, /Lines: 11/)
  assert.match(result.summary, /3 total; 3 passed/)
})

test('test failures retain available counts when a coverage report is missing', async t => {
  const data = await fixture(t, 'frontend')
  await rm(data.files.coverage)
  const result = await data.run({ outcome: 'failure', status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Result: \*\*failure\*\*/)
  assert.match(result.summary, /3 total; 3 passed/)
  assert.match(result.summary, /Coverage totals unavailable/)
  assert.match(result.summary, /Report diagnostics:/)
})

test('a setup failure skips validation and does not consume plausible stale reports', async t => {
  const data = await fixture(t, 'frontend')
  const validation = await data.run({ mode: 'Validate', outcome: 'skipped', status: 'failure' })
  assert.equal(validation.code, 0, validation.stderr)
  const result = await data.run({ outcome: 'skipped', status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Result: \*\*failure\*\*/)
  assert.match(result.summary, /existing reports were not read/)
  assert.doesNotMatch(result.summary, /3 total|Lines:|Report diagnostics:/)
})

test('cancellation without reports remains cancellation instead of a missing-file failure', async t => {
  const data = await fixture(t, 'playwright')
  for (const file of Object.values(data.files)) await rm(file)
  const result = await data.run({ outcome: 'cancelled', status: 'cancelled' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Result: \*\*cancelled\*\*/)
  assert.match(result.summary, /Test counts unavailable/)
})

test('skipping tests in an otherwise successful job fails instead of appearing green', async t => {
  const data = await fixture(t, 'postman')
  const result = await data.run({ outcome: 'skipped' })
  assert.equal(result.code, 1)
  assert.match(result.summary, /Result: \*\*failure\*\*/)
  assert.match(result.summary, /did not run in an otherwise successful job/)
})

test('a later build or artifact failure overrides passing test counts in the summary', async t => {
  const data = await fixture(t, 'frontend')
  const result = await data.run({ status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Result: \*\*failure\*\*\. Verification command: \*\*success\*\*/)
  assert.match(result.summary, /3 total; 3 passed/)
})

test('backend validation remains owned by the existing runner', async t => {
  const data = await fixture(t, 'backend')
  for (const file of Object.values(data.files)) await rm(file)
  const result = await data.run({ mode: 'Validate' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /owned by scripts\/test-backend.mjs/)
})

test('coverage values are reported without adding a second threshold policy', async t => {
  const data = await fixture(t, 'backend')
  const coverage = JSON.parse(fixtureContents('backend').coverage)
  coverage.summary.coveredlines = 50
  coverage.summary.linecoverage = 50
  await writeFile(data.files.coverage, JSON.stringify(coverage))
  const result = await data.run({ outcome: 'failure', status: 'failure' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /Lines: 50\/100 \(50%\)/)
  assert.match(result.summary, /Result: \*\*failure\*\*/)
})

test('summary output appends, supports an explicit path, and preserves existing content', async t => {
  const data = await fixture(t, 'postman')
  const destination = data.summaryPath + '.override'
  await writeFile(destination, '# Existing summary\n\n')
  const result = await data.run({ summaryOverride: destination, noSummaryEnvironment: true })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.summary, /^# Existing summary\n\n## Postman API/)
})

test('missing summary destination is an actionable error', async t => {
  const data = await fixture(t, 'frontend')
  const result = await data.run({ noSummaryEnvironment: true })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Summary requires ArtifactNames and SummaryPath/)
})

test('XML reports cannot resolve external entities', async t => {
  const data = await fixture(t, 'postman')
  await writeFile(data.files.tests, '<!DOCTYPE testsuites [<!ENTITY external SYSTEM "http://127.0.0.1:1/never-fetch">]><testsuites>&external;</testsuites>')
  const result = await data.run()
  assert.equal(result.code, 1)
  assert.match(result.summary, /Test results unavailable/)
})
