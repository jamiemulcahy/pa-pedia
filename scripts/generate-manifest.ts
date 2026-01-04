/**
 * Generate manifest.json from GitHub Release assets
 *
 * Queries the faction-data release to get all zip assets, parses filenames,
 * downloads each zip to extract metadata.json for PA build numbers,
 * generates manifest.json and uploads it to the release.
 *
 * Prerequisites:
 * - GitHub CLI (gh) must be installed and authenticated
 * - The faction-data release must exist with uploaded zips
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import JSZip from 'jszip'

const FACTIONS_DIR = path.join(import.meta.dirname, '..', 'factions')
const OUTPUT_DIR = path.join(FACTIONS_DIR, 'dist')
const RELEASE_TAG = 'faction-data'

/**
 * Check if GitHub CLI is installed and available
 */
function checkGhCli(): void {
  try {
    execSync('gh --version', { stdio: 'pipe' })
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed or not in PATH')
    console.error('Install from: https://cli.github.com/')
    process.exit(1)
  }
}

// Regex to parse zip filename: {FactionId}-{version}-pedia{timestamp}.zip
const ZIP_FILENAME_PATTERN = /^([A-Za-z0-9-]+)-([0-9.]+)-pedia(\d{14})\.zip$/

interface ReleaseAsset {
  name: string
  size: number
  url: string // API URL
  browser_download_url: string // Direct download URL
}

interface FactionMetadata {
  identifier: string
  displayName: string
  version: string
  author: string
  description: string
  type?: string
  backgroundImage?: string
  isAddon?: boolean
  baseFactions?: string[]
  build?: string
}

interface ManifestEntry {
  id: string
  version: string
  filename: string
  downloadUrl: string
  size: number
  timestamp: number
  build?: string
  displayName?: string
  isAddon?: boolean
  baseFactions?: string[]
}

interface Manifest {
  generated: string
  releaseTag: string
  factions: ManifestEntry[]
}

/**
 * Get release assets from GitHub
 */
function getReleaseAssets(): ReleaseAsset[] {
  const output = execSync(
    `gh release view ${RELEASE_TAG} --json assets -q ".assets[] | {name, size, url, browser_download_url}"`,
    { encoding: 'utf-8' }
  )

  // Parse JSONL output (one JSON object per line)
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReleaseAsset)
}

/**
 * Parse zip filename to extract faction info
 */
function parseZipFilename(
  filename: string
): { factionId: string; version: string; timestamp: number } | null {
  const match = filename.match(ZIP_FILENAME_PATTERN)
  if (!match) return null

  return {
    factionId: match[1],
    version: match[2],
    timestamp: parseInt(match[3], 10),
  }
}

/**
 * Download and extract metadata.json from a zip
 */
async function extractMetadataFromZip(downloadUrl: string): Promise<FactionMetadata | null> {
  try {
    // Download zip
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      console.warn(`  Failed to download: ${response.statusText}`)
      return null
    }

    const buffer = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    // Find metadata.json
    const metadataFile = zip.file('metadata.json')
    if (!metadataFile) {
      console.warn('  No metadata.json found in zip')
      return null
    }

    const content = await metadataFile.async('string')
    return JSON.parse(content) as FactionMetadata
  } catch (error) {
    console.warn(`  Error extracting metadata: ${error}`)
    return null
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Generating faction manifest...')
  console.log()

  // Pre-flight check: ensure gh CLI is available
  checkGhCli()

  // Get release assets
  console.log('Fetching release assets...')
  const assets = getReleaseAssets()
  console.log(`Found ${assets.length} assets`)
  console.log()

  // Filter to zip files and parse filenames
  const zipAssets = assets
    .filter((a) => a.name.endsWith('.zip'))
    .map((a) => ({
      asset: a,
      parsed: parseZipFilename(a.name),
    }))
    .filter((a) => a.parsed !== null)

  console.log(`Found ${zipAssets.length} faction zips`)
  console.log()

  // Group by faction ID, keep only latest timestamp for each faction+version
  const factionMap = new Map<string, (typeof zipAssets)[0]>()

  for (const zip of zipAssets) {
    const key = `${zip.parsed!.factionId}-${zip.parsed!.version}`
    const existing = factionMap.get(key)

    if (!existing || zip.parsed!.timestamp > existing.parsed!.timestamp) {
      factionMap.set(key, zip)
    }
  }

  console.log(`Unique faction versions: ${factionMap.size}`)
  console.log()

  // Build manifest entries
  const entries: ManifestEntry[] = []

  for (const [key, zip] of factionMap) {
    const { factionId, version, timestamp } = zip.parsed!
    // Use API-provided download URL instead of constructing manually
    const downloadUrl = zip.asset.browser_download_url

    console.log(`Processing ${factionId} v${version}...`)

    // Extract metadata for build number and display name
    const metadata = await extractMetadataFromZip(downloadUrl)

    entries.push({
      id: factionId,
      version,
      filename: zip.asset.name,
      downloadUrl,
      size: zip.asset.size,
      timestamp,
      build: metadata?.build,
      displayName: metadata?.displayName,
      isAddon: metadata?.isAddon,
      baseFactions: metadata?.baseFactions,
    })
  }

  // Sort by faction ID
  entries.sort((a, b) => a.id.localeCompare(b.id))

  // Build manifest
  const manifest: Manifest = {
    generated: new Date().toISOString(),
    releaseTag: RELEASE_TAG,
    factions: entries,
  }

  // Write manifest to file
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log()
  console.log(`Manifest written to ${manifestPath}`)

  // Upload manifest to release
  console.log()
  console.log('Uploading manifest to release...')
  execSync(`gh release upload ${RELEASE_TAG} "${manifestPath}" --clobber`, { stdio: 'inherit' })

  console.log()
  console.log('Manifest generation complete!')
  console.log()
  console.log('Manifest contents:')
  console.log(JSON.stringify(manifest, null, 2))
}

main().catch((error) => {
  console.error('Manifest generation failed:', error)
  process.exit(1)
})
