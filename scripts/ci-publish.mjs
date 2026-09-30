import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const digestPattern = /^sha256:[0-9a-f]{64}$/
const source = 'https://github.com/Stevenb32/WeatherApp'

async function docker(args) {
  const { stdout } = await execute('docker', args, { maxBuffer: 4 * 1024 * 1024 })
  return stdout
}

export async function verifyPublishedPair({ sourceSha, apiDigest, uiDigest, summaryPath }, runDocker = docker) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '')) {
    throw new Error('SOURCE_SHA must be a full lowercase commit SHA.')
  }
  if (!summaryPath) throw new Error('GITHUB_STEP_SUMMARY is required.')

  const images = [
    ['api', apiDigest],
    ['ui', uiDigest],
  ]

  for (const [name, digest] of images) {
    if (!digestPattern.test(digest ?? '')) throw new Error(`${name.toUpperCase()} digest is missing or invalid.`)
  }

  for (const [name, digest] of images) {
    const image = `ghcr.io/stevenb32/weatherapp-${name}`
    const reference = `${image}@${digest}`
    const index = JSON.parse(await runDocker(['buildx', 'imagetools', 'inspect', '--raw', reference]))
    if (!Array.isArray(index.manifests)) throw new Error(`${name.toUpperCase()} is not a multi-platform image index.`)

    // Buildx provenance adds unknown/unknown descriptors; only runnable Linux variants count.
    const variants = index.manifests.filter(entry => entry.platform?.os === 'linux')
    const architectures = variants.map(entry => entry.platform.architecture).sort()
    if (architectures.join(',') !== 'amd64,arm64') {
      throw new Error(`${name.toUpperCase()} must contain exactly linux/amd64 and linux/arm64 variants.`)
    }

    for (const architecture of ['amd64', 'arm64']) {
      const childDigest = variants.find(entry => entry.platform.architecture === architecture).digest
      if (!digestPattern.test(childDigest ?? '')) {
        throw new Error(`${name.toUpperCase()} linux/${architecture} manifest digest is invalid.`)
      }
      const childReference = `${image}@${childDigest}`
      await runDocker(['pull', '--platform', `linux/${architecture}`, childReference])
      const details = JSON.parse(await runDocker(['image', 'inspect', '--format', '{{json .}}', childReference]))
      if (details.Os !== 'linux' || details.Architecture !== architecture ||
          details.Config?.Labels?.['org.opencontainers.image.source'] !== source ||
          details.Config?.Labels?.['org.opencontainers.image.revision'] !== sourceSha) {
        throw new Error(`${name.toUpperCase()} linux/${architecture} has unexpected platform or OCI labels.`)
      }
    }
  }

  const apiReference = `ghcr.io/stevenb32/weatherapp-api@${apiDigest}`
  const uiReference = `ghcr.io/stevenb32/weatherapp-ui@${uiDigest}`
  await appendFile(summaryPath,
    `## Published image pair\n\nSource SHA: \`${sourceSha}\`\n\nAPI: \`${apiReference}\`\n\nUI: \`${uiReference}\`\n`,
    'utf8')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await verifyPublishedPair({
      sourceSha: process.env.SOURCE_SHA,
      apiDigest: process.env.API_DIGEST,
      uiDigest: process.env.UI_DIGEST,
      summaryPath: process.env.GITHUB_STEP_SUMMARY,
    })
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
