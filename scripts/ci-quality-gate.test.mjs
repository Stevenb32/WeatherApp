import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const bash = process.platform === 'win32'
  ? path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/bin/bash.exe')
  : 'bash'
const workflow = (await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
  .replaceAll('\r\n', '\n')
test('Only superseded pull-request runs are cancelled', () => {
  const concurrency = workflow.split('\nconcurrency:\n')[1]?.split('\nenv:\n')[0]
  assert.ok(concurrency, 'Workflow concurrency is missing')
  assert.match(concurrency, /group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name == 'pull_request' && format\('pr-\{0\}', github\.event\.pull_request\.number\) \|\| format\('run-\{0\}', github\.run_id\) \}\}/)
  assert.match(concurrency, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/)
})
const gate = workflow.split('\n  quality_gate:\n')[1]?.split('\n  publish:\n')[0]
assert.ok(gate, 'Quality Gate job is missing')
assert.match(gate, /\n    needs: \[backend, frontend, postman_api, playwright_e2e, container_smoke\]\n    if: always\(\)/)
assert.match(gate, /CONTAINER_SMOKE_RESULT: \$\{\{ needs\.container_smoke\.result \}\}/)
const publish = workflow.split('\n  publish:\n')[1]
assert.ok(publish, 'Publish job is missing')
test('Publish runs only after a successful main push and owns package-write permission', () => {
  assert.match(publish, /\n    needs: quality_gate\n/)
  assert.match(publish, /\n    if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\n/)
  assert.match(publish, /\n    runs-on: ubuntu-24\.04\n/)
  assert.match(publish, /\n    permissions:\n      contents: read\n      packages: write\n/)
  assert.equal((workflow.match(/^      packages: write$/gm) ?? []).length, 1)
})
test('Publish builds both architecture variants from the triggering commit', () => {
  assert.match(publish, /uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n        with:\n          persist-credentials: false/)
  assert.match(publish, /uses: docker\/login-action@[0-9a-f]{40}/)
  assert.match(publish, /registry: ghcr\.io\n          username: \$\{\{ github\.actor \}\}\n          password: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
  assert.match(publish, /uses: docker\/setup-qemu-action@[0-9a-f]{40}/)
  assert.match(publish, /uses: docker\/setup-buildx-action@[0-9a-f]{40}/)

  for (const [name, image] of [['API', 'api'], ['UI', 'ui']]) {
    const step = publish.split(`      - name: Build and push ${name}\n`)[1]?.split('\n      - name: ')[0]
    assert.ok(step, `${name} build step is missing`)
    assert.match(step, /uses: docker\/build-push-action@[0-9a-f]{40}/)
    assert.match(step, new RegExp(`file: src/WeatherApp\\.${name === 'API' ? 'Api' : 'Ui'}/Dockerfile`))
    assert.match(step, /context: \.\n/)
    assert.match(step, /platforms: linux\/amd64,linux\/arm64\n/)
    assert.match(step, /push: true\n/)
    assert.ok(step.includes(`tags: ghcr.io/stevenb32/weatherapp-${image}:\${{ github.sha }}`))
    assert.ok(step.includes('SOURCE_REVISION=${{ github.sha }}'))
  }
  assert.doesNotMatch(publish, /:latest\b/)
  assert.match(publish, /uses: actions\/setup-node@[0-9a-f]{40}/)
  assert.match(publish, /\n      - name: Verify published pair and summarize\n        env:\n          SOURCE_SHA: \$\{\{ github\.sha \}\}\n          API_DIGEST: \$\{\{ steps\.api_image\.outputs\.digest \}\}\n          UI_DIGEST: \$\{\{ steps\.ui_image\.outputs\.digest \}\}\n        run: node scripts\/ci-publish\.mjs\n?$/)
  assert.doesNotMatch(publish, /if: always\(\)/)
})
const script = gate.split('      - name: Evaluate verification jobs\n')[1]
  .split('        run: |\n')[1]
  .split('\n').map(line => line.replace(/^ {10}/, '')).join('\n')
assert.ok(script, 'Quality Gate evaluation script is missing')

const jobs = ['Backend', 'Frontend', 'Postman API', 'Playwright E2E', 'Container Smoke']
const successful = jobs.map(() => 'success')
const cases = [
  { name: 'all successful', results: successful, code: 0 },
  ...jobs.map((name, index) => ({
    name: `${name} failed`,
    results: successful.map((value, i) => i === index ? 'failure' : value),
    code: 1,
  })),
  { name: 'cancelled dependency', results: ['success', 'success', 'cancelled', 'success', 'success'], code: 1 },
  { name: 'skipped dependency', results: ['success', 'success', 'success', 'success', 'skipped'], code: 1 },
  { name: 'missing result', results: ['success', '', 'success', 'success', 'success'], code: 1 },
  { name: 'unexpected result', results: ['success', 'timed_out', 'success', 'success', 'success'], code: 1 },
]

for (const scenario of cases) {
  test(`Quality Gate: ${scenario.name}`, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'weatherapp-quality-gate-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const summaryPath = path.join(directory, 'summary.md')
    let result
    try {
      result = { ...await execute(bash, ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
        cwd: directory,
        timeout: 10_000,
        windowsHide: true,
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: summaryPath,
          BACKEND_RESULT: scenario.results[0],
          FRONTEND_RESULT: scenario.results[1],
          POSTMAN_RESULT: scenario.results[2],
          PLAYWRIGHT_RESULT: scenario.results[3],
          CONTAINER_SMOKE_RESULT: scenario.results[4],
        },
      }), code: 0 }
    } catch (error) {
      if (!Number.isInteger(error.code)) throw error
      result = { code: error.code, stdout: error.stdout, stderr: error.stderr }
    }

    assert.equal(result.code, scenario.code, result.stdout + result.stderr)
    const summary = await readFile(summaryPath, 'utf8')
    assert.match(summary, /^## Quality Gate\n\n\| Job \| Result \|/)
    for (const [name, status] of jobs.map((name, index) => [name, scenario.results[index]])) {
      assert.ok(summary.includes(`| ${name} | \`${status}\` |`), `${name} must appear with its actual result`)
    }
    assert.equal((summary.match(/^\| (?:Backend|Frontend|Postman API|Playwright E2E|Container Smoke) \|/gm) ?? []).length, 5)
    assert.match(summary, scenario.code === 0 ? /\*\*Result: passed\.\*\*/ : /\*\*Result: failed\.\*\*/)
  })
}
