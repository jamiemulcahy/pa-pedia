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
// Faction ID: starts with letter, contains only letters/digits/dashes, ends with letter
// Version: starts with digit, may contain digits/dots/dashes (e.g., "1.32.1-124615")
// The key insight is that faction IDs end with a letter, versions start with a digit
const ZIP_FILENAME_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([0-9][0-9.-]*)-pedia(\d{14})\.zip$/i

interface ReleaseAsset {
  name: string
  size: number
  url: string // Direct download URL (gh CLI returns this, not browser_download_url)
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

interface VersionEntry {
  version: string
  filename: string
  downloadUrl: string
  size: number
  timestamp: number
  build?: string
}

interface FactionEntry {
  id: string
  displayName?: string
  isAddon?: boolean
  baseFactions?: string[]
  latest: VersionEntry
  versions: VersionEntry[]
}

interface Manifest {
  generated: string
  releaseTag: string
  factions: FactionEntry[]
}

/**
 * Get release assets from GitHub
 */
function getReleaseAssets(): ReleaseAsset[] {
  const output = execSync(
    `gh release view ${RELEASE_TAG} --json assets -q ".assets[] | {name, size, url}"`,
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

  // Step 1: Dedupe same-version timestamps (keep latest timestamp per faction+version)
  const versionMap = new Map<string, (typeof zipAssets)[0]>()

  for (const zip of zipAssets) {
    const key = `${zip.parsed!.factionId}-${zip.parsed!.version}`
    const existing = versionMap.get(key)

    if (!existing || zip.parsed!.timestamp > existing.parsed!.timestamp) {
      versionMap.set(key, zip)
    }
  }

  console.log(`Unique faction versions: ${versionMap.size}`)
  console.log()

  // Step 2: Group versions by faction ID and extract metadata
  const factionVersions = new Map<
    string,
    {
      versions: Array<{ zip: (typeof zipAssets)[0]; metadata: FactionMetadata | null }>
      latestTimestamp: number
    }
  >()

  for (const [key, zip] of versionMap) {
    const { factionId, version, timestamp } = zip.parsed!
    const ghDownloadUrl = zip.asset.url

    console.log(`Processing ${factionId} v${version}...`)

    // Extract metadata for build number and display name
    const metadata = await extractMetadataFromZip(ghDownloadUrl)

    // Get or create faction entry
    let factionData = factionVersions.get(factionId)
    if (!factionData) {
      factionData = { versions: [], latestTimestamp: 0 }
      factionVersions.set(factionId, factionData)
    }

    factionData.versions.push({ zip, metadata })

    // Track latest timestamp for determining the "latest" version
    if (timestamp > factionData.latestTimestamp) {
      factionData.latestTimestamp = timestamp
    }
  }

  // Step 3: Build faction entries with version arrays
  const factionEntries: FactionEntry[] = []

  for (const [factionId, factionData] of factionVersions) {
    // Sort versions by timestamp (newest first)
    factionData.versions.sort((a, b) => b.zip.parsed!.timestamp - a.zip.parsed!.timestamp)

    // Build version entries
    const versions: VersionEntry[] = factionData.versions.map(({ zip, metadata }) => ({
      version: zip.parsed!.version,
      filename: zip.asset.name,
      downloadUrl: `/factions/${zip.asset.name}`,
      size: zip.asset.size,
      timestamp: zip.parsed!.timestamp,
      build: metadata?.build,
    }))

    // Latest is the first one (highest timestamp)
    const latestVersion = factionData.versions[0]
    const latestMetadata = latestVersion.metadata

    factionEntries.push({
      id: factionId,
      displayName: latestMetadata?.displayName,
      isAddon: latestMetadata?.isAddon,
      baseFactions: latestMetadata?.baseFactions,
      latest: versions[0],
      versions,
    })
  }

  // Sort factions by ID
  factionEntries.sort((a, b) => a.id.localeCompare(b.id))

  // Build manifest
  const manifest: Manifest = {
    generated: new Date().toISOString(),
    releaseTag: RELEASE_TAG,
    factions: factionEntries,
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
