/**
 * Upload faction model bundles to the `faction-models` GitHub Release.
 *
 * Mirrors upload-to-releases.ts but targets a SEPARATE release tag so the heavy
 * model bundles never interfere with the fast `faction-data` (spec zip) release.
 * Reads models/dist/model-build-summary.json (written by build-model-bundles.ts)
 * and uploads each `{id}-{version}-pedia{ts}-models.zip`. All prior bundles are
 * preserved (both older versions AND older rebuilds of the same version): the
 * manifest generator always selects the newest stamp per faction+version, and
 * keeping the previous bundle avoids 404-ing the baked prod manifest until the
 * next deploy.
 *
 * Prerequisites: GitHub CLI (gh) authenticated (GITHUB_TOKEN in CI).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

const MODELS_DIR = path.join(import.meta.dirname, '..', 'models')
const OUTPUT_DIR = path.join(MODELS_DIR, 'dist')
const RELEASE_TAG = 'faction-models'

interface ModelBuildSummary {
  timestamp: string
  bundles: { factionId: string; filename: string; version: string; unitCount: number }[]
}

function checkGhCli(): void {
  try {
    execSync('gh --version', { stdio: 'pipe' })
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed or not in PATH')
    process.exit(1)
  }
}

function exec(command: string, options?: { silent?: boolean }): string {
  if (!options?.silent) console.log(`$ ${command}`)
  try {
    return execSync(command, { encoding: 'utf-8', stdio: options?.silent ? 'pipe' : 'inherit' })
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      return (error as { stdout: string }).stdout || ''
    }
    throw error
  }
}

function releaseExists(): boolean {
  try {
    execSync(`gh release view ${RELEASE_TAG}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function ensureReleaseExists(): void {
  if (releaseExists()) {
    console.log(`Release '${RELEASE_TAG}' already exists`)
    return
  }
  console.log(`Creating release '${RELEASE_TAG}'...`)
  exec(
    `gh release create ${RELEASE_TAG} --title "Faction Models" --notes "Auto-generated 3D model bundles (glb + textures) for PA-Pedia. Updated by the Faction Models workflow."`
  )
}

function uploadZip(filename: string): void {
  const zipPath = path.join(OUTPUT_DIR, filename)
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Model bundle not found: ${zipPath}`)
  }
  console.log(`Uploading ${filename}...`)
  // Use raw execSync (not the error-swallowing exec wrapper): a failed upload
  // MUST fail the step, otherwise the manifest regen finds no bundle and the 3D
  // button silently never appears.
  execSync(`gh release upload ${RELEASE_TAG} "${zipPath}" --clobber`, { stdio: 'inherit' })
}

async function main() {
  console.log('Uploading model bundles to GitHub Releases...')
  console.log(`Release tag: ${RELEASE_TAG}`)
  console.log()

  checkGhCli()

  const summaryPath = path.join(OUTPUT_DIR, 'model-build-summary.json')
  if (!fs.existsSync(summaryPath)) {
    console.error('Model build summary not found. Run build:model-bundles first.')
    process.exit(1)
  }

  const summary: ModelBuildSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
  console.log(`Build timestamp: ${summary.timestamp}`)
  console.log(`Bundles to upload: ${summary.bundles.length}`)
  console.log()

  ensureReleaseExists()
  console.log()

  for (const bundle of summary.bundles) {
    console.log(`Processing ${bundle.factionId} v${bundle.version} (${bundle.unitCount} units)...`)
    // Old timestamps of the same faction+version are intentionally KEPT. The
    // baked prod manifest (deployed from the previous run) still points at the
    // previous bundle until the next deploy; deleting it here would 404 the 3D
    // viewer in that window. `buildModelBundleMap` (generate-manifest) always
    // picks the newest stamp per faction+version, so keeping older rebuilds is
    // harmless — and preserves model history alongside the spec-zip history.
    uploadZip(bundle.filename)
    console.log()
  }

  console.log('Model bundle upload complete!')
}

main().catch((error) => {
  console.error('Upload failed:', error)
  process.exit(1)
})
