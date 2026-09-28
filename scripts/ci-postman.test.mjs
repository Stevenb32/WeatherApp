import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const bash = process.platform === 'win32'
  ? path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/bin/bash.exe')
  : 'bash'
const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
// Execute the actual lifecycle step with fake command boundaries, not a second implementation.
const step = workflow.replaceAll('\r\n', '\n')
  .split('        id: postman_tests\n')[1]
  .split('\n      - name: ')[0]
  .split('        run: |\n')[1]
  .split('\n').map(line => line.replace(/^ {10}/, '')).join('\n')

async function runScenario(t, scenario) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weatherapp-postman-ci-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'bin'))
  await writeFile(path.join(root, 'step.sh'), step)
  const commands = {
    node: `#!/usr/bin/env bash
echo "$$" > environment.pid
echo "environment arguments: $*"
trap 'echo "environment stopped"; exit "$CLEANUP_CODE"' TERM
if [[ "$SCENARIO" == 'startup-failure' ]]; then exit 7; fi
if [[ "$SCENARIO" != 'readiness-timeout' ]]; then
  echo '[environment] Deterministic test environment is ready.'
fi
while true; do sleep 0.05; done
`,
    postman: `#!/usr/bin/env bash
echo 'collection ran' > collection-ran
printf '%s\\n' "$@" > collection-arguments
echo 'collection diagnostic output'
if [[ "$SCENARIO" == 'interrupted' ]]; then kill -TERM "$PPID"; fi
if [[ "$SCENARIO" == 'environment-exit' ]]; then
  kill -TERM "$(cat environment.pid)"
  while kill -0 "$(cat environment.pid)" 2>/dev/null; do sleep 0.05; done
fi
exit "$COLLECTION_CODE"
`,
    // Advance only the readiness clock; no fixed wait or test-only workflow switch.
    date: `#!/usr/bin/env bash
if [[ "$SCENARIO" == 'readiness-timeout' ]]; then
  tick=0
  if [[ -f clock ]]; then read -r tick < clock; fi
  tick=$((tick + 100))
  echo "$tick" > clock
  echo "$tick"
else
  /usr/bin/date "$@"
fi
`,
  }
  for (const [name, contents] of Object.entries(commands)) {
    const file = path.join(root, 'bin', name)
    await writeFile(file, contents)
    await chmod(file, 0o755)
  }
  let result
  try {
    result = { ...await execute(bash, ['--noprofile', '--norc', '-c',
      'export PATH="$PWD/bin:$PATH"; export GITHUB_OUTPUT="$PWD/output"; exec bash --noprofile --norc -eo pipefail ./step.sh',
    ], {
      cwd: root, windowsHide: true, timeout: 15_000,
      env: { ...process.env, SCENARIO: scenario.name, COLLECTION_CODE: String(scenario.collection ?? 0), CLEANUP_CODE: String(scenario.cleanup ?? 0) },
    }), code: 0 }
  } catch (error) {
    if (!Number.isInteger(error.code)) throw error
    result = { code: error.code, stdout: error.stdout, stderr: error.stderr }
  }
  assert.equal(result.code, scenario.expected, result.stdout + result.stderr)
  const output = await readFile(path.join(root, 'output'), 'utf8')
  assert.match(output, /collection_started=false/)
  if (scenario.started !== false) {
    assert.match(output, /collection_started=true/)
    assert.match(await readFile(path.join(root, 'collection-arguments'), 'utf8'), /cli,junit,html/)
    assert.match(result.stdout, /collection diagnostic output/)
  } else {
    assert.doesNotMatch(output, /collection_started=true/)
    await assert.rejects(readFile(path.join(root, 'collection-ran')), { code: 'ENOENT' })
  }
  const cleanup = await readFile(path.join(root, 'tests/WeatherApp.Postman/reports/cleanup.log'), 'utf8')
  assert.match(cleanup, /environment cleanup exit:/)
  if (scenario.name !== 'startup-failure') assert.match(result.stdout, /environment stopped/)
  if (scenario.name === 'readiness-timeout') assert.match(result.stderr, /within 180 seconds/)
  // A successful test must not leave the background shell running.
  await execute(bash, ['-c', '! kill -0 "$(cat environment.pid)" 2>/dev/null'], { cwd: root, windowsHide: true })
}

for (const scenario of [
  { name: 'success', expected: 0 },
  { name: 'collection-failure', collection: 23, expected: 23 },
  { name: 'cleanup-failure', cleanup: 9, expected: 9 },
  { name: 'both-fail', collection: 23, cleanup: 9, expected: 23 },
  { name: 'startup-failure', started: false, expected: 1 },
  { name: 'readiness-timeout', started: false, expected: 1 },
  { name: 'environment-exit', expected: 1 },
  { name: 'interrupted', expected: 143 },
]) {
  test(`Postman lifecycle: ${scenario.name}`, t => runScenario(t, scenario))
}
