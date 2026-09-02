import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const apiDirectory = path.join(repositoryRoot, 'src', 'WeatherApp.Api')
const uiDirectory = path.join(repositoryRoot, 'src', 'WeatherApp.Ui')
const wireMockDirectory = path.join(
  repositoryRoot,
  'tests',
  'TestEnvironment',
  'WireMock',
)

const requiredNodeVersion = '24.20.0'
const requiredDotnetVersion = '10.0.303'
const placeholderApiKey = 'weatherapp-e2e-placeholder'
const wireMockUrl = 'http://127.0.0.1:9090'
const weatherApiBaseUrl = `${wireMockUrl}/v1/`
const apiUrl = 'http://127.0.0.1:5100'
const uiUrl = 'http://127.0.0.1:4173'
const readinessTimeoutMilliseconds = 30_000
const readinessPollMilliseconds = 200
const shutdownTimeoutMilliseconds = 5_000
const managedAddresses = [
  { name: 'WireMock', port: 9090 },
  { name: 'Weather App API', port: 5100 },
  { name: 'Vite preview', port: 4173 },
]

const argumentsSet = new Set(process.argv.slice(2))
const mode = process.argv[2]
const simulateFailureAfterReady = argumentsSet.has(
  '--simulate-failure-after-ready',
)
const simulatedReadinessTimeout = process.argv
  .slice(2)
  .find((argument) => argument.startsWith('--simulate-readiness-timeout='))
  ?.split('=', 2)[1]
const simulatedUnexpectedChildExit = process.argv
  .slice(2)
  .find((argument) => argument.startsWith('--simulate-unexpected-child-exit='))
  ?.split('=', 2)[1]

const allowedServiceTargets = new Set([
  'wiremock',
  'api',
  'ui',
])

if (!['verify', 'serve'].includes(mode)) {
  printUsageAndExit()
}

if (
  simulatedReadinessTimeout &&
  !allowedServiceTargets.has(simulatedReadinessTimeout)
) {
  printUsageAndExit()
}

if (
  simulatedUnexpectedChildExit &&
  !allowedServiceTargets.has(simulatedUnexpectedChildExit)
) {
  printUsageAndExit()
}

if (
  mode !== 'verify' &&
  (simulateFailureAfterReady ||
    simulatedReadinessTimeout ||
    simulatedUnexpectedChildExit)
) {
  printUsageAndExit()
}

const children = []
let shouldVerifyPortRelease = false
let receivedSignal
let resolveServeStop

process.once('SIGINT', () => handleSignal('SIGINT'))
process.once('SIGTERM', () => handleSignal('SIGTERM'))

function printUsageAndExit() {
  console.error(
    'Usage: node scripts/test-environment.mjs <verify|serve> ' +
      '[--simulate-failure-after-ready] ' +
      '[--simulate-readiness-timeout=<wiremock|api|ui>] ' +
      '[--simulate-unexpected-child-exit=<wiremock|api|ui>]',
  )
  process.exit(2)
}

function handleSignal(signal) {
  receivedSignal ??= signal
  resolveServeStop?.()
}

function throwIfInterrupted() {
  if (receivedSignal) {
    throw new Error(`Interrupted by ${receivedSignal}.`)
  }
}

function prefixStream(stream, name, destination) {
  let buffered = ''

  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffered += chunk
    const lines = buffered.split(/\r?\n/u)
    buffered = lines.pop() ?? ''

    for (const line of lines) {
      destination.write(`[${name}] ${line}\n`)
    }
  })

  stream.on('end', () => {
    if (buffered.length > 0) {
      destination.write(`[${name}] ${buffered}\n`)
    }
  })
}

function startManagedProcess(name, command, args, options = {}) {
  console.log(`[environment] Starting ${name}.`)

  const child = spawn(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? process.env,
    detached: process.platform !== 'win32',
    shell: options.shell ?? false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  const record = {
    name,
    child,
    exit: undefined,
    spawnError: undefined,
    exitPromise: undefined,
  }

  prefixStream(child.stdout, name, process.stdout)
  prefixStream(child.stderr, name, process.stderr)

  record.exitPromise = new Promise((resolve) => {
    child.once('error', (error) => {
      record.spawnError = error
      resolve()
    })

    child.once('exit', (code, signal) => {
      record.exit = { code, signal }
      resolve()
    })
  })

  children.push(record)
  return record
}

async function runCommand(name, command, args, options = {}) {
  const record = startManagedProcess(name, command, args, options)
  await record.exitPromise

  if (record.spawnError) {
    throw new Error(
      `${name} could not start: ${record.spawnError.message}`,
    )
  }

  throwIfInterrupted()

  if (record.exit.code !== 0) {
    throw new Error(`${name} exited with code ${record.exit.code}.`)
  }
}

async function captureCommand(command, args) {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stdout = ''
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })

  if (result.code !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with code ${result.code}: ` +
        stderr.trim(),
    )
  }

  return stdout.trim()
}

async function verifyToolchain() {
  const pinnedNodeVersion = (
    await readFile(path.join(repositoryRoot, '.node-version'), 'utf8')
  ).trim()

  assert.equal(
    pinnedNodeVersion,
    requiredNodeVersion,
    '.node-version does not contain the expected Node pin',
  )
  assert.equal(
    process.versions.node,
    requiredNodeVersion,
    `Node ${requiredNodeVersion} is required; running ${process.versions.node}`,
  )

  const dotnetVersion = await captureCommand('dotnet', ['--version'])
  assert.equal(
    dotnetVersion,
    requiredDotnetVersion,
    `.NET SDK ${requiredDotnetVersion} is required; running ${dotnetVersion}`,
  )

  console.log(
    `[environment] Toolchain verified: Node ${requiredNodeVersion}, ` +
      `.NET SDK ${requiredDotnetVersion}.`,
  )
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return files
}

async function verifyProviderIsolation() {
  const e2eSettingsPath = path.join(
    repositoryRoot,
    'src',
    'WeatherApp.Api',
    'appsettings.E2E.json',
  )
  const e2eSettingsText = await readFile(e2eSettingsPath, 'utf8')
  const e2eSettings = JSON.parse(e2eSettingsText)

  assert.equal(e2eSettings.WeatherApi?.BaseUrl, weatherApiBaseUrl)
  assert.equal(e2eSettings.WeatherApi?.ApiKey, placeholderApiKey)

  const fixtureFiles = await listFiles(wireMockDirectory)
  const scannedFiles = [e2eSettingsPath, ...fixtureFiles]

  for (const file of scannedFiles) {
    const contents = await readFile(file, 'utf8')
    assert.doesNotMatch(
      contents,
      /api\.weatherapi\.com/iu,
      `${path.relative(repositoryRoot, file)} contains the real provider host`,
    )
  }

  const mappingFiles = fixtureFiles.filter((file) =>
    file.includes(`${path.sep}__admin${path.sep}mappings${path.sep}`),
  )

  assert.equal(mappingFiles.length, 6, 'Expected six static WireMock mappings')

  for (const mappingFile of mappingFiles) {
    const mapping = JSON.parse(await readFile(mappingFile, 'utf8'))
    const keyParameter = mapping.Request?.Params?.find(
      (parameter) => parameter.Name === 'key',
    )
    const keyPatterns = keyParameter?.Matchers?.map(
      (matcher) => matcher.Pattern,
    )

    assert.deepEqual(
      keyPatterns,
      [placeholderApiKey],
      `${path.basename(mappingFile)} must match only the placeholder API key`,
    )
  }

  const tampaFixture = JSON.parse(
    await readFile(
      path.join(wireMockDirectory, 'responses', 'tampa-success.json'),
      'utf8',
    ),
  )
  const tampaHours = tampaFixture.forecast.forecastday.flatMap(
    (day) => day.hour,
  )

  assert.equal(tampaFixture.location.localtime_epoch, 1787270400)
  assert.equal(tampaFixture.current.temp_c, 31)
  assert.equal(tampaFixture.current.temp_f, 87.8)
  assert.equal(tampaFixture.current.wind_kph, 13)
  assert.equal(tampaFixture.current.wind_mph, 8.1)
  assert.equal(tampaFixture.forecast.forecastday.length, 3)
  assert.equal(tampaHours.length, 24)
  assert.ok(
    tampaHours.every(
      (hour) => hour.time_epoch > tampaFixture.location.localtime_epoch,
    ),
    'All shared hourly entries must be future entries',
  )

  console.log(
    '[environment] E2E provider isolation and deterministic fixtures verified.',
  )
}

async function probePort(port) {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        reject(error)
      }
    })

    server.once('listening', () => {
      server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve(true)
        }
      })
    })

    server.listen({ host: '127.0.0.1', port, exclusive: true })
  })
}

async function preflightPorts() {
  for (const address of managedAddresses) {
    const isAvailable = await probePort(address.port)

    if (!isAvailable) {
      throw new Error(
        `${address.name} requires 127.0.0.1:${address.port}, ` +
          'but that port is already in use. No alternate port will be selected.',
      )
    }
  }

  shouldVerifyPortRelease = true
  console.log('[environment] Fixed ports 9090, 5100, and 4173 are available.')
}

async function buildApplications() {
  await runCommand(
    'API build',
    'dotnet',
    [
      'build',
      'src/WeatherApp.Api/WeatherApp.Api.csproj',
      '--configuration',
      'Release',
      '--nologo',
    ],
  )

  await runCommand(
    'UI build',
    process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm',
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run build']
      : ['run', 'build'],
    {
      cwd: uiDirectory,
    },
  )
}

function startWireMock() {
  return startManagedProcess(
    'WireMock',
    'dotnet',
    [
      'tool',
      'run',
      'dotnet-wiremock',
      '--',
      '--Urls',
      wireMockUrl,
      '--ReadStaticMappings',
      'true',
      '--StartAdminInterface',
      'true',
      '--WireMockLogger',
      'WireMockConsoleLogger',
    ],
    { cwd: wireMockDirectory },
  )
}

function startApi() {
  return startManagedProcess(
    'Weather App API',
    'dotnet',
    [
      path.join(
        'bin',
        'Release',
        'net10.0',
        'WeatherApp.Api.dll',
      ),
      '--urls',
      apiUrl,
    ],
    {
      cwd: apiDirectory,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'E2E',
        DOTNET_ENVIRONMENT: 'E2E',
        WeatherApi__ApiKey: placeholderApiKey,
        WeatherApi__BaseUrl: weatherApiBaseUrl,
      },
    },
  )
}

function startUiPreview() {
  return startManagedProcess(
    'Vite preview',
    process.execPath,
    [path.join(uiDirectory, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview'],
    { cwd: uiDirectory },
  )
}

function checkProcessIsRunning(record) {
  if (record.spawnError) {
    throw new Error(
      `${record.name} could not start: ${record.spawnError.message}`,
    )
  }

  if (record.exit !== undefined) {
    const description = record.exit.signal
      ? `signal ${record.exit.signal}`
      : `code ${record.exit.code}`
    throw new Error(`${record.name} exited early with ${description}.`)
  }
}

function describeProcessExit(record) {
  if (record.spawnError) {
    return `spawn error: ${record.spawnError.message}`
  }

  if (record.exit?.signal) {
    return `signal ${record.exit.signal}`
  }

  if (record.exit?.code !== undefined && record.exit.code !== null) {
    return `code ${record.exit.code}`
  }

  return 'no exit code or signal'
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForReadiness(name, url, processRecord, simulationName) {
  const checkedUrl =
    simulatedReadinessTimeout === simulationName
      ? 'http://127.0.0.1:1/__weatherapp_never_ready__'
      : url
  const deadline = Date.now() + readinessTimeoutMilliseconds
  let lastFailure = 'no response received'

  while (Date.now() < deadline) {
    throwIfInterrupted()
    checkProcessIsRunning(processRecord)

    try {
      const response = await fetch(checkedUrl, {
        signal: AbortSignal.timeout(1_000),
      })

      if (response.ok) {
        console.log(`[environment] ${name} is ready at ${url}.`)
        return
      }

      lastFailure = `HTTP ${response.status}`
    } catch (error) {
      lastFailure = error.message
    }

    await delay(readinessPollMilliseconds)
  }

  throw new Error(
    `${name} was not ready within ` +
      `${readinessTimeoutMilliseconds / 1_000} seconds (${lastFailure}).`,
  )
}

async function startEnvironment() {
  const wireMock = startWireMock()
  await waitForReadiness(
    'WireMock',
    `${wireMockUrl}/__admin/health`,
    wireMock,
    'wiremock',
  )

  const api = startApi()
  await waitForReadiness(
    'Weather App API',
    `${apiUrl}/health`,
    api,
    'api',
  )

  const ui = startUiPreview()
  await waitForReadiness('Vite preview', uiUrl, ui, 'ui')

  return { wiremock: wireMock, api, ui }
}

async function requestJson(url, expectedStatus, options) {
  const response = await fetch(url, options)
  const responseText = await response.text()
  let responseBody

  try {
    responseBody = responseText ? JSON.parse(responseText) : undefined
  } catch {
    throw new Error(
      `${url} returned non-JSON content with HTTP ${response.status}.`,
    )
  }

  assert.equal(
    response.status,
    expectedStatus,
    `${url} returned an unexpected status: ${responseText}`,
  )

  return responseBody
}

async function resetWireMock() {
  for (const pathName of ['requests/reset', 'scenarios/reset']) {
    const response = await fetch(`${wireMockUrl}/__admin/${pathName}`, {
      method: 'POST',
    })
    assert.equal(
      response.status,
      200,
      `WireMock ${pathName} returned HTTP ${response.status}`,
    )
  }

  console.log('[environment] WireMock requests and scenarios reset.')
}

function weatherUrl(baseUrl, location, units) {
  const parameters = new URLSearchParams({ location, units })
  return `${baseUrl}/api/weather?${parameters}`
}

async function verifySmokeContract() {
  await resetWireMock()

  const imperial = await requestJson(
    weatherUrl(apiUrl, 'Tampa', 'imperial'),
    200,
  )
  assert.equal(imperial.location.name, 'Tampa')
  assert.equal(imperial.unitSystem, 'imperial')
  assert.equal(imperial.current.temperature, 87.8)
  assert.equal(imperial.current.windSpeed, 8.1)
  assert.equal(imperial.hourly.length, 24)
  assert.equal(imperial.daily.length, 3)

  const metricThroughPreview = await requestJson(
    weatherUrl(uiUrl, 'Tampa', 'metric'),
    200,
  )
  assert.equal(metricThroughPreview.unitSystem, 'metric')
  assert.equal(metricThroughPreview.current.temperature, 31)
  assert.equal(metricThroughPreview.current.windSpeed, 13)

  const unknownLocation = await requestJson(
    weatherUrl(apiUrl, 'NotARealPlace', 'imperial'),
    404,
  )
  assert.equal(unknownLocation.title, 'Location not found')

  const providerFailure = await requestJson(
    weatherUrl(apiUrl, 'ProviderFailure', 'imperial'),
    503,
  )
  assert.equal(providerFailure.title, 'Weather provider unavailable')

  await resetWireMock()

  const recoveryFailure = await requestJson(
    weatherUrl(apiUrl, 'RetryRecovery', 'imperial'),
    503,
  )
  assert.equal(recoveryFailure.title, 'Weather provider unavailable')

  const recovered = await requestJson(
    weatherUrl(apiUrl, 'RetryRecovery', 'imperial'),
    200,
  )
  assert.equal(recovered.location.name, 'Tampa')

  const longContent = await requestJson(
    weatherUrl(uiUrl, 'LongContent', 'imperial'),
    200,
  )
  assert.equal(
    longContent.location.name,
    'The Long Coastal Municipality of North Weather Harbor',
  )
  assert.equal(longContent.hourly.length, 24)
  assert.equal(longContent.daily.length, 3)

  console.log(
    '[environment] Smoke contract passed: success, units, errors, ' +
      'recovery, long content, and preview proxy.',
  )
}

async function runTaskkill(processId, force) {
  const args = ['/PID', String(processId), '/T']
  if (force) {
    args.push('/F')
  }

  const child = spawn('taskkill', args, {
    stdio: 'ignore',
    windowsHide: true,
  })

  await new Promise((resolve) => {
    child.once('error', resolve)
    child.once('exit', resolve)
  })
}

async function waitForExit(record, timeoutMilliseconds) {
  if (record.exit !== undefined || record.spawnError) {
    return true
  }

  return await Promise.race([
    record.exitPromise.then(() => true),
    delay(timeoutMilliseconds).then(() => false),
  ])
}

async function stopProcessTree(record) {
  if (record.exit !== undefined || record.spawnError || !record.child.pid) {
    return
  }

  console.log(`[environment] Stopping ${record.name}.`)

  if (process.platform === 'win32') {
    await runTaskkill(record.child.pid, false)

    if (!(await waitForExit(record, 2_000))) {
      await runTaskkill(record.child.pid, true)
      await waitForExit(record, 2_000)
    }
  } else {
    try {
      process.kill(-record.child.pid, 'SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error
      }
    }

    if (!(await waitForExit(record, 2_000))) {
      try {
        process.kill(-record.child.pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') {
          throw error
        }
      }

      await waitForExit(record, 2_000)
    }
  }

  if (record.exit === undefined && !record.spawnError) {
    throw new Error(`${record.name} did not exit after termination.`)
  }
}

async function verifyPortsReleased() {
  const deadline = Date.now() + shutdownTimeoutMilliseconds
  let occupied = []

  while (Date.now() < deadline) {
    occupied = []

    for (const address of managedAddresses) {
      if (!(await probePort(address.port))) {
        occupied.push(address)
      }
    }

    if (occupied.length === 0) {
      console.log('[environment] Ports 9090, 5100, and 4173 were released.')
      return
    }

    await delay(readinessPollMilliseconds)
  }

  throw new Error(
    'Cleanup did not release: ' +
      occupied
        .map((address) => `127.0.0.1:${address.port} (${address.name})`)
        .join(', '),
  )
}

async function cleanup() {
  const failures = []

  for (const record of children.toReversed()) {
    try {
      await stopProcessTree(record)
    } catch (error) {
      failures.push(error)
    }
  }

  if (shouldVerifyPortRelease) {
    try {
      await verifyPortsReleased()
    } catch (error) {
      failures.push(error)
    }
  }

  return failures
}

async function waitForManagedServiceExitOrSignal(services) {
  if (receivedSignal) {
    return
  }

  const result = await Promise.race([
    new Promise((resolve) => {
      resolveServeStop = () => resolve({ type: 'signal' })
    }),
    ...Object.values(services).map((record) =>
      record.exitPromise.then(() => ({ type: 'service-exit', record })),
    ),
  ])

  resolveServeStop = undefined

  if (result.type === 'signal') {
    return
  }

  await new Promise((resolve) => setImmediate(resolve))

  if (receivedSignal) {
    return
  }

  throw new Error(
    `${result.record.name} exited unexpectedly with ` +
      `${describeProcessExit(result.record)}.`,
  )
}

async function simulateUnexpectedServiceExit(services) {
  const service = services[simulatedUnexpectedChildExit]
  const supervisionResult = waitForManagedServiceExitOrSignal(services).then(
    () => ({ failure: undefined }),
    (failure) => ({ failure }),
  )

  console.log(
    `[environment] Simulating unexpected ${service.name} exit after readiness.`,
  )

  await stopProcessTree(service)
  const { failure } = await supervisionResult

  if (failure) {
    throw failure
  }

  throw new Error(`${service.name} exit was not detected.`)
}

async function waitForServeStop(services) {
  console.log('[environment] Deterministic test environment is ready.')
  console.log(`[environment] UI: ${uiUrl}`)
  console.log(`[environment] API health: ${apiUrl}/health`)
  console.log(`[environment] WireMock health: ${wireMockUrl}/__admin/health`)
  console.log('[environment] Press Ctrl+C to stop all three processes.')

  await waitForManagedServiceExitOrSignal(services)
}

async function run() {
  let primaryFailure

  try {
    await verifyToolchain()
    await verifyProviderIsolation()
    await preflightPorts()
    await buildApplications()
    const services = await startEnvironment()

    if (simulateFailureAfterReady) {
      throw new Error('Simulated post-readiness failure.')
    }

    if (simulatedUnexpectedChildExit) {
      await simulateUnexpectedServiceExit(services)
    }

    if (mode === 'verify') {
      await verifySmokeContract()
    } else {
      await resetWireMock()
      await waitForServeStop(services)
    }
  } catch (error) {
    primaryFailure = error
  }

  const cleanupFailures = await cleanup()

  if (primaryFailure) {
    if (cleanupFailures.length > 0) {
      primaryFailure.message +=
        '\nCleanup failures:\n' +
        cleanupFailures.map((failure) => `- ${failure.message}`).join('\n')
    }

    throw primaryFailure
  }

  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, 'Environment cleanup failed.')
  }

  if (receivedSignal) {
    console.log(`[environment] Stopped after ${receivedSignal}.`)
  } else {
    console.log('[environment] Verification completed successfully.')
  }
}

run().catch((error) => {
  console.error(`[environment] ERROR: ${error.message}`)
  process.exitCode = 1
})
