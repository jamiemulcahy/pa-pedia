/**
 * Build faction model bundles from CLI model output folders.
 *
 * The CLI `extract-models` command writes, per faction, a folder:
 *   models/{FactionName}/models.json
 *   models/{FactionName}/models/*.glb
 *   models/{FactionName}/textures/*.png
 *
 * This script zips each such folder into a versioned model bundle:
 *   {factionId}-{version}-pedia{timestamp}-models.zip
 * matching the faction spec-zip naming so the manifest can correlate them.
 * The faction identifier + version are read from the matching faction spec
 * folder (factions/{FactionName}/metadata.json).
 *
 * Output to /models/dist/. Bundles are uploaded to the `faction-models`
 * release (separate from the `faction-data` release that serves spec zips).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { ZipArchive } from 'archiver'
import {
  modelBundleSidecarName,
  type ModelBundleSidecar,
  type ModelsIndex,
} from './model-bundles'

interface FactionMetadata {
  identifier: string
  displayName: string
  version: string
}

const ROOT = path.join(import.meta.dirname, '..')
const MODELS_DIR = path.join(ROOT, 'models')
const FACTIONS_DIR = path.join(ROOT, 'factions')
const OUTPUT_DIR = path.join(MODELS_DIR, 'dist')

/** Timestamp string for bundle filenames. Format: YYYYMMDDHHmmss */
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
 * Model output folders are those under /models that contain a models.json.
 * (Skips /models/dist and anything without an index.)
 */
function getModelFolders(): string[] {
  if (!fs.existsSync(MODELS_DIR)) return []
  return fs
    .readdirSync(MODELS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'dist')
    .filter((e) => fs.existsSync(path.join(MODELS_DIR, e.name, 'models.json')))
    .map((e) => e.name)
}

/**
 * Read the faction's identifier + version from its spec folder metadata.
 * The model folder and spec folder share the same sanitized name.
 */
function readFactionMetadata(folderName: string): FactionMetadata {
  const metadataPath = path.join(FACTIONS_DIR, folderName, 'metadata.json')
  if (!fs.existsSync(metadataPath)) {
    throw new Error(
      `No faction metadata for model folder '${folderName}' (expected ${metadataPath}). ` +
        `Model bundles require a matching faction spec folder for identifier/version.`
    )
  }
  const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as FactionMetadata
  if (!data.identifier || !data.version) {
    throw new Error(`Invalid metadata.json for '${folderName}': missing identifier or version`)
  }
  return data
}

function readModelsIndex(folderName: string): ModelsIndex {
  const indexPath = path.join(MODELS_DIR, folderName, 'models.json')
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as ModelsIndex
}

async function createModelZip(
  folderName: string,
  metadata: FactionMetadata,
  timestamp: string
): Promise<string> {
  const modelDir = path.join(MODELS_DIR, folderName)
  const zipFilename = `${metadata.identifier}-${metadata.version}-pedia${timestamp}-models.zip`
  const zipPath = path.join(OUTPUT_DIR, zipFilename)

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`  Created ${zipFilename} (${sizeMB} MB)`)
      resolve(zipFilename)
    })
    archive.on('error', reject)
    archive.pipe(output)
    // Contents (models.json, models/, textures/) at the zip root.
    archive.directory(modelDir, false)
    archive.finalize()
  })
}

/**
 * Write the sidecar index next to a bundle: the bundle's `models.json`, so the
 * web app and the manifest generator never open tens of MB to read it. See
 * `ModelBundleSidecar` in `model-bundles.ts`.
 */
function createSidecar(
  zipFilename: string,
  metadata: FactionMetadata,
  timestamp: string,
  index: ModelsIndex
): string {
  const sidecarName = modelBundleSidecarName(zipFilename)
  const sidecar: ModelBundleSidecar = {
    factionId: metadata.identifier,
    version: metadata.version,
    timestamp: parseInt(timestamp, 10),
    ...index,
  }
  // Compact: the web app downloads this, and indentation is ~30% of its size.
  fs.writeFileSync(path.join(OUTPUT_DIR, sidecarName), JSON.stringify(sidecar))
  console.log(`  Created ${sidecarName}`)
  return sidecarName
}

async function main() {
  console.log('Building faction model bundles...')
  console.log(`Source: ${MODELS_DIR}`)
  console.log(`Output: ${OUTPUT_DIR}`)
  console.log()

  const folders = getModelFolders()
  if (folders.length === 0) {
    console.log('No model folders found (nothing with a models.json under /models).')
    console.log('Run `just generate-models` first.')
    return
  }
  console.log(`Found ${folders.length} model folders: ${folders.join(', ')}`)
  console.log()

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const timestamp = generateTimestamp()
  console.log(`Build timestamp: ${timestamp}`)
  console.log()

  const results: {
    factionId: string
    filename: string
    sidecar: string
    version: string
    unitCount: number
  }[] = []

  for (const folderName of folders) {
    console.log(`Processing ${folderName}...`)
    try {
      const metadata = readFactionMetadata(folderName)
      const index = readModelsIndex(folderName)
      const unitCount = index.unitCount ?? 0
      const filename = await createModelZip(folderName, metadata, timestamp)
      const sidecar = createSidecar(filename, metadata, timestamp, index)
      results.push({
        factionId: metadata.identifier,
        filename,
        sidecar,
        version: metadata.version,
        unitCount,
      })
    } catch (error) {
      console.error(`  Error: ${error}`)
      process.exit(1)
    }
  }

  console.log()
  const summaryPath = path.join(OUTPUT_DIR, 'model-build-summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify({ timestamp, bundles: results }, null, 2))
  console.log(`Model bundle build complete! Summary written to ${summaryPath}`)
}

main().catch((error) => {
  console.error('Model bundle build failed:', error)
  process.exit(1)
})
