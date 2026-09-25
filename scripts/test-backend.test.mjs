import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const nodeVersion = await readFile(new URL('../.node-version', import.meta.url), 'utf8')
const reportNames = [
  'tests/backend-tests.trx',
  'coverage.cobertura.xml',
  'coverage/index.html',
  'coverage/SummaryGithub.md',
  'coverage/Summary.json',
]

function validSummary() {
  return {
    summary: {
      parser: 'Cobertura', assemblies: 1, classes: 2, files: 2,
      coveredlines: 80, uncoveredlines: 20, coverablelines: 100, linecoverage: 80,
      coveredbranches: 7, totalbranches: 10, branchcoverage: 70,
    },
    coverage: {
      assemblies: [{
        name: 'WeatherApp.Api',
        coveredlines: 80, coverablelines: 100, coveredbranches: 7, totalbranches: 10,
        classesinassembly: [
          { name: 'Program', coverage: 0, branchcoverage: 0 },
          { name: 'WeatherApp.Api.Weather.WeatherEndpoints', coverage: 100, branchcoverage: 100 },
        ],
      }],
    },
  }
}

// Written into each temporary fixture as a Node preload. Only the .NET process
// boundary is simulated; the real CLI, filesystem cleanup, and exit handling run.
async function installDotnetStub() {
  const { default: childProcess } = await import('node:child_process')
  const { EventEmitter } = await import('node:events')
  const { appendFile, mkdir, readFile, writeFile } = await import('node:fs/promises')
  const { syncBuiltinESMExports } = await import('node:module')
  const { default: path } = await import('node:path')
  const scenario = JSON.parse(await readFile(new URL('./scenario.json', import.meta.url), 'utf8'))

  childProcess.spawn = (command, args, options) => {
    const child = new EventEmitter()
    queueMicrotask(async () => {
      try {
        if (command !== 'dotnet' || options.shell !== false) {
          throw new Error('Expected a direct dotnet invocation without a shell.')
        }
        const stage = args[0] === 'tool'
          ? (args[1] === 'restore' ? 'tools' : 'report')
          : args[0]
        await appendFile(
          path.join(options.cwd, 'commands.jsonl'),
          JSON.stringify({ stage, args }) + '\n',
        )
        if (scenario.failStage === stage) {
          child.emit('close', 9)
          return
        }
        if (stage === 'test') {
          const results = args[args.indexOf('--results-directory') + 1]
          await mkdir(path.join(results, 'current-run'), { recursive: true })
          if (!scenario.missingTrx) {
            await writeFile(path.join(results, 'backend-tests.trx'), '<TestRun />')
          }
          if (!scenario.missingCoverage) {
            await writeFile(path.join(results, 'current-run', 'coverage.cobertura.xml'), '<coverage />')
            // VSTest also retains a nested TRX attachment copy; do not count it twice.
            await mkdir(path.join(results, 'trx-copy', 'In'), { recursive: true })
            await writeFile(path.join(results, 'trx-copy', 'In', 'coverage.cobertura.xml'), '<coverage />')
          }
          if (scenario.duplicateCoverage) {
            await mkdir(path.join(results, 'second-run'), { recursive: true })
            await writeFile(path.join(results, 'second-run', 'coverage.cobertura.xml'), '<coverage />')
          }
          child.emit('close', scenario.testExitCode ?? 0)
          return
        }
        if (stage === 'report') {
          const target = args.find((argument) => argument.startsWith('-targetdir:')).slice(11)
          await mkdir(target, { recursive: true })
          const files = {
            'index.html': '<html><body>Coverage</body></html>',
            'SummaryGithub.md': '# Coverage\n',
            'Summary.json': scenario.summaryText ?? JSON.stringify(scenario.summary),
          }
          for (const [name, contents] of Object.entries(files)) {
            if (scenario.missingReport !== name) {
              await writeFile(path.join(target, name), scenario.emptyReport === name ? '' : contents)
            }
          }
        }
        child.emit('close', 0)
      } catch (error) {
        child.emit('error', error)
      }
    })
    return child
  }
  syncBuiltinESMExports()
}

async function runFixture(t, scenario = {}) {
  const temporaryRoot = await realpath(os.tmpdir())
  const prefix = 'weatherapp backend '
  const root = await mkdtemp(path.join(temporaryRoot, prefix))
  t.after(async () => {
    if (path.dirname(root) !== temporaryRoot || !path.basename(root).startsWith(prefix)) {
      throw new Error('Unexpected temporary cleanup target.')
    }
    await rm(root, { recursive: true, force: true })
  })
  const script = path.join(root, 'scripts', 'test-backend.mjs')
  const reports = path.join(root, 'tests', 'WeatherApp.Api.Tests', 'reports')
  await mkdir(path.dirname(script), { recursive: true })
  await mkdir(path.join(reports, 'tests', 'old-run'), { recursive: true })
  await mkdir(path.join(reports, 'coverage'), { recursive: true })
  await copyFile(new URL('./test-backend.mjs', import.meta.url), script)
  await writeFile(path.join(root, '.node-version'), nodeVersion)
  await writeFile(path.join(root, 'scenario.json'), JSON.stringify({
    summary: validSummary(), ...scenario,
  }))
  const preload = path.join(root, 'stub-dotnet.mjs')
  await writeFile(preload, 'await (' + installDotnetStub.toString() + ')()\n')

  // Start with plausible old output so missing new reports cannot pass unnoticed.
  for (const reportName of reportNames) {
    await writeFile(path.join(reports, reportName),
      reportName.endsWith('Summary.json') ? JSON.stringify(validSummary()) : 'stale')
  }
  await writeFile(path.join(reports, 'tests', 'old-run', 'coverage.cobertura.xml'), '<coverage />')

  let result
  try {
    result = { ...await execute(process.execPath, ['--import', pathToFileURL(preload).href, script], {
      cwd: root, timeout: 15_000, windowsHide: true,
    }), code: 0 }
  } catch (error) {
    if (!Number.isInteger(error.code)) {
      throw error
    }
    result = { code: error.code, stdout: error.stdout, stderr: error.stderr }
  }
  const calls = (await readFile(path.join(root, 'commands.jsonl'), 'utf8').catch((error) => {
    throw new Error('CLI did not reach the .NET boundary: ' + result.stderr, { cause: error })
  }))
    .trim().split('\n').map((line) => JSON.parse(line))
  return { ...result, reports, calls }
}

test('global floors are passed to ReportGenerator; valid reports succeed even with a low-coverage class', async (t) => {
  const result = await runFixture(t)
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(result.calls.map((call) => call.stage), ['tools', 'restore', 'build', 'test', 'report'])
  const thresholdArguments = result.calls.at(-1).args
    .filter((argument) => argument.startsWith('minimumCoverageThresholds:'))
  assert.deepEqual(thresholdArguments, [
    'minimumCoverageThresholds:lineCoverage=80',
    'minimumCoverageThresholds:branchCoverage=70',
  ])
  for (const reportName of reportNames) {
    assert.ok((await stat(path.join(result.reports, reportName))).size > 0)
  }
  await assert.rejects(stat(path.join(result.reports, 'tests', 'old-run')), { code: 'ENOENT' })
  assert.equal(await readFile(path.join(result.reports, 'coverage.cobertura.xml'), 'utf8'), '<coverage />')
  assert.match(result.stdout, /coverage gate passed/)
})

for (const stage of ['tools', 'restore', 'build']) {
  test(stage + ' failure stops before tests and clears stale reports', async (t) => {
    const result = await runFixture(t, { failStage: stage })
    assert.equal(result.code, 9)
    assert.equal(result.calls.at(-1).stage, stage)
    assert.ok(!result.calls.some((call) => call.stage === 'test'))
    await assert.rejects(stat(path.join(result.reports, 'coverage', 'Summary.json')), { code: 'ENOENT' })
  })
}

test('failed tests still generate reports and preserve their exit code', async (t) => {
  const result = await runFixture(t, { testExitCode: 7 })
  assert.equal(result.code, 7)
  assert.equal(result.calls.at(-1).stage, 'report')
  assert.ok((await stat(path.join(result.reports, 'coverage', 'index.html'))).size > 0)
  assert.match(result.stdout, /backend tests failed with exit code 7/)
  assert.doesNotMatch(result.stdout, /coverage gate passed/)
})

test('reporting failure makes passing tests fail verification', async (t) => {
  const result = await runFixture(t, { failStage: 'report' })
  assert.equal(result.code, 9)
  assert.match(result.stderr, /Generate coverage reports failed/)
})

test('a reporting failure cannot replace the original test exit code', async (t) => {
  const result = await runFixture(t, { testExitCode: 7, failStage: 'report' })
  assert.equal(result.code, 7)
  assert.match(result.stderr, /Generate coverage reports failed/)
})

for (const [label, scenario, count] of [
  ['missing', { missingCoverage: true }, 0],
  ['ambiguous', { duplicateCoverage: true }, 2],
]) {
  test(label + ' coverage fails without reusing old output', async (t) => {
    const result = await runFixture(t, scenario)
    assert.equal(result.code, 1)
    assert.match(result.stderr, new RegExp('Expected one current coverage report; found ' + count))
    assert.ok(!result.calls.some((call) => call.stage === 'report'))
    await assert.rejects(stat(path.join(result.reports, 'coverage.cobertura.xml')), { code: 'ENOENT' })
  })
}

for (const reportName of ['index.html', 'SummaryGithub.md', 'Summary.json']) {
  test('missing ' + reportName + ' fails despite a successful reporting process', async (t) => {
    const result = await runFixture(t, { missingReport: reportName })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /Cannot read .+ report/)
  })
}

test('an empty summary is rejected', async (t) => {
  const result = await runFixture(t, { emptyReport: 'Summary.json' })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Missing or empty JSON report/)
})

test('malformed summary JSON is rejected', async (t) => {
  const result = await runFixture(t, { summaryText: '{not json}' })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Invalid coverage summary JSON/)
})

test('missing TRX fails even when coverage reports exist', async (t) => {
  const result = await runFixture(t, { missingTrx: true })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Cannot read TRX report/)
})

const invalidSummaries = [
  ['zero measured lines', (report) => { report.summary.coverablelines = 0 }, /positive coverablelines/],
  ['zero measured branches', (report) => { report.summary.totalbranches = 0 }, /positive totalbranches/],
  ['missing measured branches', (report) => { delete report.summary.totalbranches }, /positive totalbranches/],
  ['unexpected assembly', (report) => { report.coverage.assemblies[0].name = 'WeatherApp.Api.Tests' }, /only the WeatherApp.Api assembly/],
  ['extra assembly', (report) => { report.coverage.assemblies.push({ name: 'ThirdParty' }) }, /only the WeatherApp.Api assembly/],
  ['negative covered count', (report) => { report.summary.coveredlines = -1 }, /Invalid coverage summary count/],
  ['covered count exceeds total', (report) => { report.summary.coveredbranches = 11 }, /Invalid coverage summary count/],
  ['fractional count', (report) => { report.summary.coveredlines = 80.5 }, /Invalid coverage summary count/],
  ['assembly totals disagree', (report) => { report.coverage.assemblies[0].coveredlines = 90 }, /counts disagree/],
  ['inconsistent uncovered count', (report) => { report.summary.uncoveredlines = 0 }, /line counts are inconsistent/],
  ['missing percentage', (report) => { report.summary.branchcoverage = null }, /Missing or invalid coverage percentage/],
]

for (const [label, mutate, message] of invalidSummaries) {
  test(label + ' cannot yield a successful gate', async (t) => {
    const summary = validSummary()
    mutate(summary)
    const result = await runFixture(t, { summary })
    assert.equal(result.code, 1)
    assert.match(result.stderr, message)
    assert.doesNotMatch(result.stdout, /coverage gate passed/)
  })
}

test('invalid reporting cannot replace a failing test result', async (t) => {
  const result = await runFixture(t, { testExitCode: 7, summaryText: '{}' })
  assert.equal(result.code, 7)
  assert.match(result.stderr, /only the WeatherApp.Api assembly/)
})
