/**
 * Build faction zips from source folders
 *
 * Reads faction folders from /factions/, creates versioned zip files with naming:
 * {FactionId}-{version}-pedia{timestamp}.zip
 *
 * Output to /factions/dist/
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import archiver from 'archiver'

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
}

const FACTIONS_DIR = path.join(import.meta.dirname, '..', 'factions')
const OUTPUT_DIR = path.join(FACTIONS_DIR, 'dist')

/**
 * Generate timestamp string for zip filename
 * Format: YYYYMMDDHHmmss
 */
function generateTimestamp(): string {
  const now = new Date()
  return (
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')
  )
}

/**
 * Read and validate faction metadata from metadata.json
 */
function readFactionMetadata(factionDir: string): FactionMetadata {
  const metadataPath = path.join(factionDir, 'metadata.json')
  const content = fs.readFileSync(metadataPath, 'utf-8')
  const data = JSON.parse(content) as FactionMetadata

  // Validate required fields
  if (!data.identifier) {
    throw new Error(`Invalid metadata.json in ${factionDir}: missing 'identifier' field`)
  }
  if (!data.version) {
    throw new Error(`Invalid metadata.json in ${factionDir}: missing 'version' field`)
  }
  if (!data.displayName) {
    throw new Error(`Invalid metadata.json in ${factionDir}: missing 'displayName' field`)
  }

  return data
}

/**
 * Get list of faction folder names
 */
function getFactionFolders(): string[] {
  const entries = fs.readdirSync(FACTIONS_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => {
      if (!entry.isDirectory()) return false
      if (entry.name === 'dist') return false
      // Must have metadata.json to be a valid faction
      const metadataPath = path.join(FACTIONS_DIR, entry.name, 'metadata.json')
      return fs.existsSync(metadataPath)
    })
    .map((entry) => entry.name)
}

/**
 * Create a zip file for a faction
 * Uses metadata.identifier (not folder name) for consistent casing in zip filenames
 */
async function createFactionZip(
  folderName: string,
  metadata: FactionMetadata,
  timestamp: string
): Promise<string> {
  const factionDir = path.join(FACTIONS_DIR, folderName)
  // Use metadata.identifier for zip filename to ensure consistent casing
  const zipFilename = `${metadata.identifier}-${metadata.version}-pedia${timestamp}.zip`
  const zipPath = path.join(OUTPUT_DIR, zipFilename)

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    })

    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`  Created ${zipFilename} (${sizeMB} MB)`)
      resolve(zipFilename)
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)

    // Add faction folder contents to zip
    // Files will be at root of zip (not nested in faction folder)
    archive.directory(factionDir, false)

    archive.finalize()
  })
}

/**
 * Main entry point
 */
async function main() {
  console.log('Building faction zips...')
  console.log(`Source: ${FACTIONS_DIR}`)
  console.log(`Output: ${OUTPUT_DIR}`)
  console.log()

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Get all faction folders
  const factionFolders = getFactionFolders()
  console.log(`Found ${factionFolders.length} factions: ${factionFolders.join(', ')}`)
  console.log()

  // Generate single timestamp for all zips in this build
  const timestamp = generateTimestamp()
  console.log(`Build timestamp: ${timestamp}`)
  console.log()

  // Build each faction
  const results: { factionId: string; filename: string; version: string }[] = []

  for (const folderName of factionFolders) {
    console.log(`Processing ${folderName}...`)
    try {
      const metadata = readFactionMetadata(path.join(FACTIONS_DIR, folderName))
      const filename = await createFactionZip(folderName, metadata, timestamp)
      // Use metadata.identifier as the canonical faction ID
      results.push({ factionId: metadata.identifier, filename, version: metadata.version })
    } catch (error) {
      console.error(`  Error: ${error}`)
      process.exit(1)
    }
  }

  console.log()
  console.log('Build complete!')
  console.log()

  // Output summary as JSON for CI consumption
  const summaryPath = path.join(OUTPUT_DIR, 'build-summary.json')
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        timestamp,
        factions: results,
      },
      null,
      2
    )
  )
  console.log(`Build summary written to ${summaryPath}`)
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
