import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const composeFile = path.join(repositoryRoot, 'tests', 'ContainerSmoke', 'compose.yaml')
const proxyUrl = 'http://127.0.0.1:18080'
const project = process.env.CONTAINER_SMOKE_PROJECT_NAME
  ?? `weatherapp-smoke-${process.pid}-${randomBytes(4).toString('hex')}`
const composeArgs = ['compose', '-p', project, '-f', composeFile]
const abortController = new AbortController()
let interruptedSignal

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interruptedSignal ??= signal
    abortController.abort()
  })
}

const args = process.argv.slice(2)
const simulateFailureAfterReady = args[1] === '--simulate-failure-after-ready'

if (args[0] !== 'verify' || args.length > 2 || (args.length === 2 && !simulateFailureAfterReady)) {
  console.error('Usage: node scripts/container-smoke.mjs verify [--simulate-failure-after-ready]')
  process.exitCode = 2
} else {
  run().catch((error) => {
    console.error(`[container-smoke] ERROR: ${error.message}`)
    process.exitCode = interruptedSignal === 'SIGINT' ? 130 : interruptedSignal === 'SIGTERM' ? 143 : 1
  })
}

function throwIfInterrupted() {
  if (interruptedSignal) {
    throw new Error(`Interrupted by ${interruptedSignal}.`)
  }
}

async function execute(command, commandArgs, { capture = false, env = process.env, abortable = true } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: repositoryRoot,
      env,
      signal: abortable ? abortController.signal : undefined,
      stdio: ['ignore', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let spawnError

    if (capture) {
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })
    }

    child.once('error', (error) => { spawnError = error })
    child.once('close', (code, signal) => {
      if (spawnError) {
        reject(spawnError)
      } else if (code !== 0) {
        reject(new Error(`${command} ${commandArgs.join(' ')} exited with ${signal ?? `code ${code}`}: ${stderr.trim()}`))
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

async function verifyComposeConfiguration(env) {
  const { stdout } = await execute('docker', [...composeArgs, 'config', '--format', 'json'], {
    capture: true,
    env,
  })
  const config = JSON.parse(stdout)
  assert.deepEqual(Object.keys(config.services).sort(), ['api', 'provider-mock', 'test-proxy', 'ui'])
  assert.equal(config.networks.private.internal, true)

  const published = Object.entries(config.services).flatMap(([service, settings]) =>
    (settings.ports ?? []).map((port) => ({
      service,
      host: port.host_ip,
      published: String(port.published),
      target: port.target,
    })),
  )
  assert.deepEqual(published, [{ service: 'test-proxy', host: '127.0.0.1', published: '18080', target: 8080 }])
  console.log('[container-smoke] Compose configuration has one loopback-only published port.')
}

async function verifyPortAvailable() {
  const server = net.createServer()
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen({ host: '127.0.0.1', port: 18080, exclusive: true }, resolve)
    })
  } catch (error) {
    throw new Error(`127.0.0.1:18080 is unavailable: ${error.message}`)
  }
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

function requestSignal(timeoutMilliseconds) {
  return AbortSignal.any([abortController.signal, AbortSignal.timeout(timeoutMilliseconds)])
}

async function waitForApi() {
  const deadline = Date.now() + 30_000
  let lastFailure = 'no response'

  while (Date.now() < deadline) {
    throwIfInterrupted()
    try {
      const response = await fetch(`${proxyUrl}/health`, { signal: requestSignal(2_000) })
      if (response.status === 200) {
        console.log('[container-smoke] API is ready through the proxy.')
        return
      }
      lastFailure = `HTTP ${response.status}`
    } catch (error) {
      throwIfInterrupted()
      lastFailure = error.message
    }
    await delay(200, undefined, { signal: abortController.signal })
  }

  throw new Error(`API was not ready through the proxy within 30 seconds (${lastFailure}).`)
}

async function requestJson(url, expectedStatus) {
  const response = await fetch(url, { signal: requestSignal(5_000) })
  const body = await response.text()
  assert.equal(response.status, expectedStatus, `${url} returned HTTP ${response.status}: ${body}`)
  assert.match(response.headers.get('content-type') ?? '', /application\/(?:problem\+)?json/i)
  let json
  try {
    json = JSON.parse(body)
  } catch {
    throw new Error(`${url} returned invalid JSON.`)
  }
  return { json, body }
}

async function verifySmokeContract() {
  const tampaUrl = new URL('/api/weather', proxyUrl)
  tampaUrl.search = new URLSearchParams({ location: 'Tampa', units: 'imperial' }).toString()
  const { json: tampa } = await requestJson(tampaUrl, 200)
  assert.equal(tampa.location.name, 'Tampa')
  assert.equal(tampa.unitSystem, 'imperial')
  assert.equal(tampa.current.temperature, 87.8)
  assert.equal(tampa.current.windSpeed, 8.1)
  assert.equal(tampa.hourly.length, 24)
  assert.equal(tampa.daily.length, 3)

  const failureUrl = new URL('/api/weather', proxyUrl)
  failureUrl.search = new URLSearchParams({ location: 'ProviderFailure', units: 'imperial' }).toString()
  const { json: failure, body: failureBody } = await requestJson(failureUrl, 503)
  assert.equal(failure.title, 'Weather provider unavailable')
  assert.equal(failure.status, 503)
  assert.equal(failure.detail, 'Weather data is temporarily unavailable. Please try again later.')
  assert.doesNotMatch(failureBody, /Deterministic provider failure|weatherapp-e2e-placeholder/i)

  const page = await fetch(proxyUrl, { signal: requestSignal(5_000) })
  const html = await page.text()
  assert.equal(page.status, 200)
  assert.match(html, /<title>Weather App<\/title>/)
  const assets = [...new Set(html.match(/\/assets\/[^"'<>\s]+/g) ?? [])]
  assert.ok(assets.some((asset) => asset.endsWith('.js')), 'Built JavaScript asset is missing.')
  assert.ok(assets.some((asset) => asset.endsWith('.css')), 'Built CSS asset is missing.')

  for (const asset of assets) {
    const response = await fetch(new URL(asset, proxyUrl), { signal: requestSignal(5_000) })
    const content = await response.text()
    assert.equal(response.status, 200, `${asset} returned HTTP ${response.status}.`)
    assert.ok(content.length > 0, `${asset} was empty.`)
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/html/i)
  }

  console.log(`[container-smoke] Passed: Tampa 200, ProviderFailure 503, UI 200, ${assets.length} assets 200.`)
}

async function cleanup(env) {
  const failures = []
  try {
    await execute('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans', '--rmi', 'local'], {
      env,
      abortable: false,
    })
  } catch (error) {
    failures.push(error)
  }

  try {
    const { stdout: containers } = await execute('docker', [...composeArgs, 'ps', '--all', '--quiet'], {
      capture: true,
      env,
      abortable: false,
    })
    assert.equal(containers.trim(), '', 'Compose containers remain after cleanup.')
  } catch (error) {
    failures.push(error)
  }

  try {
    const { stdout: networks } = await execute('docker', [
      'network', 'ls', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.Name}}',
    ], { capture: true, abortable: false })
    assert.equal(networks.trim(), '', 'Compose networks remain after cleanup.')
  } catch (error) {
    failures.push(error)
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, failures.map((error) => error.message).join('\n'))
  }
  console.log('[container-smoke] Containers and networks removed.')
}

async function run() {
  assert.match(project, /^[a-z0-9][a-z0-9_-]*$/, 'Invalid Compose project name.')
  const { stdout: revision } = await execute('git', ['rev-parse', 'HEAD'], { capture: true })
  const sourceRevision = revision.trim()
  assert.match(sourceRevision, /^[0-9a-f]{40}$/)
  const env = { ...process.env, SOURCE_REVISION: sourceRevision }
  let stackAttempted = false
  let failure

  try {
    await verifyComposeConfiguration(env)
    await verifyPortAvailable()
    console.log(`[container-smoke] Building and starting project ${project}.`)
    stackAttempted = true
    await execute('docker', [...composeArgs, 'up', '--build', '--detach', '--wait', '--wait-timeout', '90'], { env })
    await waitForApi()
    if (simulateFailureAfterReady) {
      throw new Error('Simulated failure after readiness.')
    }
    await verifySmokeContract()
  } catch (error) {
    failure = interruptedSignal ? new Error(`Interrupted by ${interruptedSignal}.`) : error
    if (stackAttempted) {
      console.error('[container-smoke] Service logs for diagnosis:')
      try {
        await execute('docker', [...composeArgs, 'logs', '--no-color', '--tail', '50'], {
          env,
          abortable: false,
        })
      } catch (logError) {
        console.error(`[container-smoke] Could not read service logs: ${logError.message}`)
      }
    }
  } finally {
    if (stackAttempted) {
      try {
        await cleanup(env)
      } catch (cleanupError) {
        failure = failure
          ? new AggregateError(
              [failure, cleanupError],
              `Verification failed: ${failure.message}\nCleanup failed: ${cleanupError.message}`,
            )
          : cleanupError
      }
    }
  }

  if (failure) {
    throw failure
  }
  throwIfInterrupted()
  console.log('[container-smoke] Verification completed successfully.')
}
