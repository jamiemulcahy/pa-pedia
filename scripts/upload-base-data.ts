/**
 * Upload encrypted PA base data to GitHub Release
 *
 * Uploads the encrypted archive and metadata to the 'pa-base-data' release tag.
 * Replaces any existing assets on that release.
 *
 * Requires: gh CLI authenticated with repo permissions
 *
 * Usage:
 *   tsx upload-base-data.ts [--dist-dir <path>]
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const RELEASE_TAG = 'pa-base-data'

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
}

function runPassthrough(cmd: string): void {
  execSync(cmd, { stdio: 'inherit' })
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dist-dir': {
        type: 'string',
        default: path.join(import.meta.dirname, '..', 'factions', 'dist'),
      },
    },
  })

  const distDir = values['dist-dir']!

  // Find the encrypted archive and metadata
  const metaPath = path.join(distDir, 'pa-base-data-meta.json')
  if (!fs.existsSync(metaPath)) {
    console.error(`Error: No metadata found at ${metaPath}`)
    console.error('Run extract-base-data first.')
    process.exit(1)
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  const archivePath = path.join(distDir, meta.archiveFile)

  if (!fs.existsSync(archivePath)) {
    console.error(`Error: Archive not found at ${archivePath}`)
    process.exit(1)
  }

  const archiveSize = fs.statSync(archivePath).size
  console.log('PA Base Data Upload')
  console.log('===================')
  console.log(`Archive: ${meta.archiveFile} (${(archiveSize / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`Build: ${meta.build}`)
  console.log(`Timestamp: ${meta.timestamp}`)
  console.log(`Files: ${meta.stats.totalFiles} (${meta.stats.jsonFiles} JSON, ${meta.stats.pngFiles} PNG)`)
  console.log()

  // Check gh CLI is available
  try {
    run('gh --version')
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed or not in PATH')
    process.exit(1)
  }

  // Ensure release exists
  console.log(`Ensuring release '${RELEASE_TAG}' exists...`)
  try {
    run(`gh release view ${RELEASE_TAG}`)
    console.log('  Release exists')
  } catch {
    console.log('  Creating release...')
    runPassthrough(
      `gh release create ${RELEASE_TAG} --title "PA Base Game Data" --notes "Encrypted PA base game data for automated faction updates. This data is encrypted and can only be used by the CI pipeline."`
    )
  }

  // Delete existing assets with pa-base-data prefix
  console.log('Cleaning old assets...')
  try {
    const assetsJson = run(`gh release view ${RELEASE_TAG} --json assets -q ".assets[].name"`)
    const existingAssets = assetsJson.split('\n').filter((a) => a.startsWith('pa-base-data'))
    for (const asset of existingAssets) {
      console.log(`  Deleting: ${asset}`)
      run(`gh release delete-asset ${RELEASE_TAG} "${asset}" --yes`)
    }
  } catch {
    // No existing assets, that's fine
  }

  // Upload new assets
  console.log('Uploading...')
  runPassthrough(`gh release upload ${RELEASE_TAG} "${archivePath}" "${metaPath}" --clobber`)

  console.log()
  console.log('Upload complete!')
  console.log(`Release: ${RELEASE_TAG}`)
}

main().catch((error) => {
  console.error('Upload failed:', error)
  process.exit(1)
})
