import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { verifyPublishedPair } from './ci-publish.mjs'

const execute = promisify(execFile)
const sourceSha = 'a'.repeat(40)
const apiDigest = `sha256:${'1'.repeat(64)}`
const uiDigest = `sha256:${'2'.repeat(64)}`
const source = 'https://github.com/Stevenb32/WeatherApp'
const children = {
  api: { amd64: `sha256:${'3'.repeat(64)}`, arm64: `sha256:${'4'.repeat(64)}` },
  ui: { amd64: `sha256:${'5'.repeat(64)}`, arm64: `sha256:${'6'.repeat(64)}` },
}

function fakeDocker({ missingUiArm64 = false, wrongUiArm64Label = false, failUiArm64Pull = false } = {}) {
  const calls = []
  const run = async args => {
    calls.push(args)
    const reference = args.at(-1)
    if (args[0] === 'buildx') {
      const name = reference.includes('weatherapp-api') ? 'api' : 'ui'
      const manifests = Object.entries(children[name])
        .filter(([architecture]) => !(name === 'ui' && architecture === 'arm64' && missingUiArm64))
        .map(([architecture, digest]) => ({ digest, platform: { os: 'linux', architecture } }))
      manifests.push({ platform: { os: 'unknown', architecture: 'unknown' } })
      return JSON.stringify({ manifests })
    }
    if (args[0] === 'pull') {
      if (failUiArm64Pull && reference.endsWith(children.ui.arm64)) throw new Error('Pull failed')
      return ''
    }
    if (args[0] === 'image') {
      const architecture = reference.endsWith(children.api.arm64) || reference.endsWith(children.ui.arm64)
        ? 'arm64' : 'amd64'
      const revision = wrongUiArm64Label && reference.endsWith(children.ui.arm64)
        ? 'b'.repeat(40) : sourceSha
      return JSON.stringify({
        Os: 'linux',
        Architecture: architecture,
        Config: { Labels: {
          'org.opencontainers.image.source': source,
          'org.opencontainers.image.revision': revision,
        } },
      })
    }
    throw new Error(`Unexpected Docker command: ${args.join(' ')}`)
  }
  return { run, calls }
}

async function summaryFor(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'weatherapp-ci-publish-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return path.join(directory, 'summary.md')
}

test('a verified pair writes both immutable digests and one source SHA', async t => {
  const summaryPath = await summaryFor(t)
  const docker = fakeDocker()
  await verifyPublishedPair({ sourceSha, apiDigest, uiDigest, summaryPath }, docker.run)

  assert.equal(await readFile(summaryPath, 'utf8'),
    `## Published image pair\n\nSource SHA: \`${sourceSha}\`\n\n` +
    `API: \`ghcr.io/stevenb32/weatherapp-api@${apiDigest}\`\n\n` +
    `UI: \`ghcr.io/stevenb32/weatherapp-ui@${uiDigest}\`\n`)
  assert.equal(docker.calls.filter(args => args[0] === 'pull').length, 4)
  assert.equal(docker.calls.filter(args => args[0] === 'image').length, 4)
})

test('CLI exits with failure and no summary when a push digest is missing', async t => {
  const summaryPath = await summaryFor(t)
  const script = fileURLToPath(new URL('./ci-publish.mjs', import.meta.url))
  await assert.rejects(
    execute(process.execPath, [script], {
      env: { ...process.env, SOURCE_SHA: sourceSha, API_DIGEST: apiDigest, UI_DIGEST: '', GITHUB_STEP_SUMMARY: summaryPath },
      timeout: 10_000,
    }),
    error => error.code === 1 && error.stderr.includes('UI digest is missing or invalid'),
  )
  await assert.rejects(readFile(summaryPath), { code: 'ENOENT' })
})

for (const scenario of [
  { name: 'a missing image digest', input: { uiDigest: '' }, error: /UI digest is missing or invalid/ },
  { name: 'an incomplete UI manifest', docker: { missingUiArm64: true }, error: /UI must contain exactly/ },
  { name: 'a wrong ARM64 revision label', docker: { wrongUiArm64Label: true }, error: /UI linux\/arm64 has unexpected/ },
  { name: 'a failed image pull', docker: { failUiArm64Pull: true }, error: /Pull failed/ },
]) {
  test(`${scenario.name} fails without a deployable-pair summary`, async t => {
    const summaryPath = await summaryFor(t)
    const docker = fakeDocker(scenario.docker)
    await assert.rejects(
      verifyPublishedPair({ sourceSha, apiDigest, uiDigest, summaryPath, ...scenario.input }, docker.run),
      scenario.error,
    )
    await assert.rejects(readFile(summaryPath), { code: 'ENOENT' })
  })
}
