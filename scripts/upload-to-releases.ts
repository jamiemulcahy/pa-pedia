/**
 * Upload faction zips to GitHub Releases
 *
 * Uses the GitHub CLI (gh) to upload zip files from /factions/dist/ to a release.
 * The release tag is 'faction-data' - a single release that contains all faction zips.
 *
 * Prerequisites:
 * - GitHub CLI (gh) must be installed and authenticated
 * - GITHUB_TOKEN environment variable (for CI) or gh auth login (for local)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

const FACTIONS_DIR = path.join(import.meta.dirname, '..', 'factions')
const OUTPUT_DIR = path.join(FACTIONS_DIR, 'dist')
const RELEASE_TAG = 'faction-data'

interface BuildSummary {
  timestamp: string
  factions: { factionId: string; filename: string; version: string }[]
}

/**
 * Execute a shell command and return stdout
 */
function exec(command: string, options?: { silent?: boolean }): string {
  if (!options?.silent) {
    console.log(`$ ${command}`)
  }
  try {
    return execSync(command, { encoding: 'utf-8', stdio: options?.silent ? 'pipe' : 'inherit' })
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return (error as { stdout: string }).stdout || ''
    }
    throw error
  }
}

/**
 * Check if the release exists
 */
function releaseExists(): boolean {
  try {
    execSync(`gh release view ${RELEASE_TAG}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Create the release if it doesn't exist
 */
function ensureReleaseExists(): void {
  if (releaseExists()) {
    console.log(`Release '${RELEASE_TAG}' already exists`)
    return
  }

  console.log(`Creating release '${RELEASE_TAG}'...`)
  exec(
    `gh release create ${RELEASE_TAG} --title "Faction Data" --notes "Auto-generated faction data zips for PA-Pedia. This release is automatically updated when faction data changes."`
  )
}

/**
 * Delete old versions of a faction from the release
 * Keeps only the zip being uploaded
 */
async function deleteOldVersions(factionId: string, newFilename: string): Promise<void> {
  // List current release assets
  const output = execSync(`gh release view ${RELEASE_TAG} --json assets -q ".assets[].name"`, {
    encoding: 'utf-8',
  })

  const assets = output.trim().split('\n').filter(Boolean)

  // Find assets for this faction (pattern: FactionId-*.zip)
  const factionPattern = new RegExp(`^${factionId}-.*\\.zip$`)
  const oldAssets = assets.filter((name) => factionPattern.test(name) && name !== newFilename)

  for (const asset of oldAssets) {
    console.log(`  Deleting old version: ${asset}`)
    exec(`gh release delete-asset ${RELEASE_TAG} "${asset}" --yes`, { silent: true })
  }
}

/**
 * Upload a single zip file to the release
 */
async function uploadZip(filename: string): Promise<void> {
  const zipPath = path.join(OUTPUT_DIR, filename)

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip file not found: ${zipPath}`)
  }

  console.log(`Uploading ${filename}...`)
  exec(`gh release upload ${RELEASE_TAG} "${zipPath}" --clobber`)
}

/**
 * Main entry point
 */
async function main() {
  console.log('Uploading faction zips to GitHub Releases...')
  console.log(`Release tag: ${RELEASE_TAG}`)
  console.log()

  // Check for build summary
  const summaryPath = path.join(OUTPUT_DIR, 'build-summary.json')
  if (!fs.existsSync(summaryPath)) {
    console.error('Build summary not found. Run build:zips first.')
    process.exit(1)
  }

  const summary: BuildSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
  console.log(`Build timestamp: ${summary.timestamp}`)
  console.log(`Factions to upload: ${summary.factions.length}`)
  console.log()

  // Ensure release exists
  ensureReleaseExists()
  console.log()

  // Upload each faction, removing old versions
  for (const faction of summary.factions) {
    console.log(`Processing ${faction.factionId}...`)

    // Delete old versions first
    await deleteOldVersions(faction.factionId, faction.filename)

    // Upload new version
    await uploadZip(faction.filename)
    console.log()
  }

  console.log('Upload complete!')
}

main().catch((error) => {
  console.error('Upload failed:', error)
  process.exit(1)
})
