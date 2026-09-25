import { spawn, spawnSync } from 'node:child_process'
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = await realpath(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
)
const testDirectory = path.join(repositoryRoot, 'tests', 'WeatherApp.Api.Tests')
const reportsDirectory = path.join(testDirectory, 'reports')
const resultsDirectory = path.join(reportsDirectory, 'tests')
const coverageFile = path.join(reportsDirectory, 'coverage.cobertura.xml')
const coverageDirectory = path.join(reportsDirectory, 'coverage')
const commandTimeoutMilliseconds = 10 * 60 * 1000
const minimumLineCoverage = 80
const minimumBranchCoverage = 70
const outputReports = [
  ['TRX', path.join(resultsDirectory, 'backend-tests.trx')],
  ['Cobertura', coverageFile],
  ['HTML', path.join(coverageDirectory, 'index.html')],
  ['Markdown', path.join(coverageDirectory, 'SummaryGithub.md')],
  ['JSON', path.join(coverageDirectory, 'Summary.json')],
]

let activeChild
let interruptedExitCode
let testExitCode = 0

function stopActiveProcess() {
  if (!activeChild?.pid) {
    return
  }

  // Terminate the process tree, including testhost, on interruption or timeout.
  if (process.platform === 'win32') {
    const result = spawnSync(
      'taskkill',
      ['/PID', String(activeChild.pid), '/T', '/F'],
      { stdio: 'ignore', windowsHide: true, shell: false, timeout: 10_000 },
    )
    if (result.error || result.status !== 0) {
      console.error('[backend] Could not confirm process-tree termination.')
    }
  } else {
    try {
      process.kill(-activeChild.pid, 'SIGKILL')
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error
      }
    }
  }
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => {
    interruptedExitCode ??= exitCode
    stopActiveProcess()
  })
}

function throwIfInterrupted() {
  if (interruptedExitCode) {
    throw new Error('Verification interrupted.')
  }
}

async function runDotnet(name, args, allowFailure = false) {
  throwIfInterrupted()
  console.log(`[backend] ${name}`)

  const child = spawn('dotnet', args, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
  })
  activeChild = child
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    stopActiveProcess()
  }, commandTimeoutMilliseconds)

  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code) => resolve(code ?? 1))
    })
    throwIfInterrupted()
    if (timedOut) {
      throw new Error(`${name} exceeded the 10-minute limit.`)
    }
    if (exitCode !== 0 && !allowFailure) {
      throw Object.assign(new Error(`${name} failed with exit code ${exitCode}.`), {
        exitCode,
      })
    }
    return exitCode
  } finally {
    clearTimeout(timeout)
    activeChild = undefined
  }
}

async function prepareReportsDirectory() {
  // Keep recursive cleanup inside this project's dedicated output directory.
  if (await realpath(testDirectory) !== testDirectory) {
    throw new Error('Refusing to clean reports through a linked test directory.')
  }
  const existingReports = await lstat(reportsDirectory).catch((error) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
  })
  if (existingReports?.isSymbolicLink()) {
    throw new Error('Refusing to clean a linked reports directory.')
  }
  throwIfInterrupted()
  await rm(reportsDirectory, { recursive: true, force: true })
  await mkdir(resultsDirectory, { recursive: true })
}

async function findCoverageReport() {
  const candidates = []
  for (const entry of await readdir(resultsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const runDirectory = path.join(resultsDirectory, entry.name)
    const files = await readdir(runDirectory, { withFileTypes: true })
    if (files.some((file) => file.isFile() && file.name === 'coverage.cobertura.xml')) {
      candidates.push(path.join(runDirectory, 'coverage.cobertura.xml'))
    }
  }
  // One test project produces one immediate run attachment. Ignore nested TRX copies.
  if (candidates.length !== 1) {
    throw new Error(`Expected one current coverage report; found ${candidates.length}.`)
  }
  return candidates[0]
}

async function validateReports() {
  for (const [label, reportPath] of outputReports) {
    const reportFile = await lstat(reportPath).catch((error) => {
      throw new Error(`Cannot read ${label} report: ${reportPath}`, { cause: error })
    })
    if (!reportFile.isFile() || reportFile.size === 0) {
      throw new Error(`Missing or empty ${label} report: ${reportPath}`)
    }
  }

  let report
  try {
    report = JSON.parse(await readFile(path.join(coverageDirectory, 'Summary.json'), 'utf8'))
  } catch (error) {
    throw new Error('Invalid coverage summary JSON.', { cause: error })
  }
  const summary = report?.summary
  const assemblies = report?.coverage?.assemblies
  if (summary?.parser !== 'Cobertura' || summary.assemblies !== 1
    || !Array.isArray(assemblies) || assemblies.length !== 1
    || assemblies[0]?.name !== 'WeatherApp.Api') {
    throw new Error('Coverage must contain only the WeatherApp.Api assembly from Cobertura.')
  }

  for (const metric of ['classes', 'files', 'coverablelines', 'totalbranches']) {
    if (!Number.isSafeInteger(summary[metric]) || summary[metric] <= 0) {
      throw new Error(`Coverage summary must have a positive ${metric} count.`)
    }
  }
  for (const [covered, total] of [
    ['coveredlines', 'coverablelines'],
    ['coveredbranches', 'totalbranches'],
  ]) {
    if (!Number.isSafeInteger(summary[covered]) || summary[covered] < 0
      || summary[covered] > summary[total]) {
      throw new Error(`Invalid coverage summary count: ${covered}.`)
    }
    if (assemblies[0][covered] !== summary[covered]
      || assemblies[0][total] !== summary[total]) {
      throw new Error(`Coverage summary and API assembly counts disagree: ${covered}.`)
    }
  }
  if (summary.uncoveredlines !== summary.coverablelines - summary.coveredlines) {
    throw new Error('Coverage summary line counts are inconsistent.')
  }
  for (const metric of ['linecoverage', 'branchcoverage']) {
    if (!Number.isFinite(summary[metric]) || summary[metric] < 0 || summary[metric] > 100) {
      throw new Error(`Missing or invalid coverage percentage: ${metric}.`)
    }
  }
  return summary
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error('Usage: node scripts/test-backend.mjs')
  }
  const requiredNodeVersion = (await readFile(
    path.join(repositoryRoot, '.node-version'), 'utf8',
  )).trim()
  if (process.versions.node !== requiredNodeVersion) {
    throw new Error(`Node.js ${requiredNodeVersion} is required; found ${process.versions.node}.`)
  }

  await prepareReportsDirectory()
  await runDotnet('Restore local tools', ['tool', 'restore'])
  await runDotnet('Restore backend dependencies', ['restore', 'WeatherApp.slnx'])
  await runDotnet('Build Release', [
    'build', 'WeatherApp.slnx', '--configuration', 'Release', '--no-restore',
  ])
  testExitCode = await runDotnet('Run backend tests with coverage', [
    'test', path.join(testDirectory, 'WeatherApp.Api.Tests.csproj'),
    '--configuration', 'Release', '--no-build', '--no-restore',
    '--settings', path.join(testDirectory, 'coverage.runsettings'),
    '--collect', 'XPlat Code Coverage',
    '--logger', 'trx;LogFileName=backend-tests.trx',
    '--results-directory', resultsDirectory,
  ], true)

  // An assertion failure can still produce useful coverage and test reports.
  throwIfInterrupted()
  await copyFile(await findCoverageReport(), coverageFile)
  await runDotnet('Generate coverage reports', [
    'tool', 'run', 'reportgenerator',
    `-reports:${coverageFile}`,
    `-targetdir:${coverageDirectory}`,
    '-reporttypes:Html;MarkdownSummaryGithub;JsonSummary',
    `minimumCoverageThresholds:lineCoverage=${minimumLineCoverage}`,
    `minimumCoverageThresholds:branchCoverage=${minimumBranchCoverage}`,
  ])
  const summary = await validateReports()

  for (const [label, reportPath] of outputReports) {
    console.log(`[backend] ${label}: ${reportPath}`)
  }
  console.log(
    `[backend] Coverage: ${summary.coveredlines}/${summary.coverablelines} lines ` +
      `(${summary.linecoverage}%), ${summary.coveredbranches}/${summary.totalbranches} branches ` +
      `(${summary.branchcoverage}%). Required global floors: ` +
      `${minimumLineCoverage}% lines, ${minimumBranchCoverage}% branches.`,
  )
  console.log(testExitCode === 0
    ? '[backend] Backend tests, reports, and coverage gate passed.'
    : `[backend] Reports generated; backend tests failed with exit code ${testExitCode}.`)
  process.exitCode = testExitCode
}

try {
  await main()
} catch (error) {
  console.error(`[backend] ${error.message}`)
  console.error(`[backend] Available diagnostics: ${reportsDirectory}`)
  process.exitCode = interruptedExitCode ?? (testExitCode || error.exitCode || 1)
}
