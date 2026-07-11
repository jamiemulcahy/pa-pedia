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
import { byTimestampDesc } from './manifest-ordering'

const FACTIONS_DIR = path.join(import.meta.dirname, '..', 'factions')
const OUTPUT_DIR = path.join(FACTIONS_DIR, 'dist')
const RELEASE_TAG = 'faction-data'
// Model bundles live on a separate release so they never slow the spec-zip flow.
const MODELS_RELEASE_TAG = 'faction-models'

// Model bundle filename: {factionId}-{version}-pedia{timestamp}-models.zip
const MODEL_ZIP_FILENAME_PATTERN =
  /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([0-9][0-9.-]*)-pedia(\d{14})-models\.zip$/i

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

interface ModelBundleInfo {
  filename: string
  downloadUrl: string
  size: number
  unitCount: number
}

interface VersionEntry {
  version: string
  filename: string
  downloadUrl: string
  size: number
  timestamp: number
  build?: string
  models?: ModelBundleInfo
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
 * Get model-bundle assets from the faction-models release.
 * Returns [] if the release does not exist yet (feature not shipped / no models
 * generated), so manifest generation degrades gracefully.
 */
function getModelReleaseAssets(): ReleaseAsset[] {
  try {
    const output = execSync(
      `gh release view ${MODELS_RELEASE_TAG} --json assets -q ".assets[] | {name, size, url}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ReleaseAsset)
  } catch {
    console.log(`No ${MODELS_RELEASE_TAG} release found (or no assets) — skipping model bundles`)
    return []
  }
}

/**
 * Read unitCount from a model bundle's models.json.
 *
 * NOTE (follow-up): this downloads the whole bundle (glb + textures, many MB)
 * just to read one integer. Fine at current scale, but for large backfills
 * consider a ranged read of the zip's models.json entry, or encoding the count
 * in the asset name / a small sidecar summary asset.
 */
async function readModelUnitCount(downloadUrl: string): Promise<number> {
  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) return 0
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    const indexFile = zip.file('models.json')
    if (!indexFile) return 0
    const index = JSON.parse(await indexFile.async('string')) as { unitCount?: number }
    return index.unitCount ?? 0
  } catch {
    return 0
  }
}

/**
 * Build a map of `${factionId}@${version}` -> newest model bundle asset.
 * When several bundles exist for the same faction+version (rebuilds), the one
 * with the newest timestamp wins.
 */
function buildModelBundleMap(assets: ReleaseAsset[]): Map<string, { asset: ReleaseAsset; timestamp: number }> {
  const map = new Map<string, { asset: ReleaseAsset; timestamp: number }>()
  for (const asset of assets) {
    const match = asset.name.match(MODEL_ZIP_FILENAME_PATTERN)
    if (!match) continue
    const [, factionId, version, ts] = match
    const key = `${factionId.toLowerCase()}@${version}`
    const timestamp = parseInt(ts, 10)
    const existing = map.get(key)
    if (!existing || timestamp > existing.timestamp) {
      map.set(key, { asset, timestamp })
    }
  }
  return map
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

  // Fetch model bundles from the separate faction-models release (may be empty).
  console.log('Fetching model bundle assets...')
  const modelBundleMap = buildModelBundleMap(getModelReleaseAssets())
  console.log(`Found ${modelBundleMap.size} model bundle(s)`)
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
    }
  >()

  for (const [key, zip] of versionMap) {
    const { factionId, version } = zip.parsed!
    const ghDownloadUrl = zip.asset.url

    console.log(`Processing ${factionId} v${version}...`)

    // Extract metadata for build number and display name
    const metadata = await extractMetadataFromZip(ghDownloadUrl)

    // Get or create faction entry
    let factionData = factionVersions.get(factionId)
    if (!factionData) {
      factionData = { versions: [] }
      factionVersions.set(factionId, factionData)
    }

    factionData.versions.push({ zip, metadata })
  }

  // Step 3: Build faction entries with version arrays
  const factionEntries: FactionEntry[] = []

  for (const [factionId, factionData] of factionVersions) {
    // Sort by extraction timestamp (newest first), NOT by version number.
    // Upstream mod versions are not guaranteed monotonic (e.g. Exiles went
    // 0.7.10 -> 0.7.20 -> 0.7.3 -> 0.7.4.3), so version-number ordering crowns
    // an old, numerically-largest build. The newest extraction always reflects
    // current upstream. See manifest-ordering.ts.
    factionData.versions.sort((a, b) =>
      byTimestampDesc(
        { version: a.zip.parsed!.version, timestamp: a.zip.parsed!.timestamp },
        { version: b.zip.parsed!.version, timestamp: b.zip.parsed!.timestamp }
      )
    )

    // Build version entries, attaching a model bundle when one exists for this
    // faction+version (correlated by id+version; newest bundle timestamp wins).
    const versions: VersionEntry[] = []
    for (const { zip, metadata } of factionData.versions) {
      const entry: VersionEntry = {
        version: zip.parsed!.version,
        filename: zip.asset.name,
        downloadUrl: `/factions/${zip.asset.name}`,
        size: zip.asset.size,
        timestamp: zip.parsed!.timestamp,
        build: metadata?.build,
      }

      const bundle = modelBundleMap.get(`${factionId.toLowerCase()}@${zip.parsed!.version}`)
      if (bundle) {
        const unitCount = await readModelUnitCount(bundle.asset.url)
        entry.models = {
          filename: bundle.asset.name,
          downloadUrl: `/${MODELS_RELEASE_TAG}/${bundle.asset.name}`,
          size: bundle.asset.size,
          unitCount,
        }
      }

      versions.push(entry)
    }

    // Latest is the first one (most recently extracted)
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
