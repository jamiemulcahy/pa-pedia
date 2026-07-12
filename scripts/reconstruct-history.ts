/**
 * Reconstruct faction version-history zips from git history.
 *
 * Context: the `faction-data` GitHub release was accidentally deleted in full by
 * release.yml's cleanup step (fixed in #420), permanently destroying every
 * historical version zip. GitHub cannot restore deleted release assets, but the
 * `/factions/` folders are committed in full at every version bump, so we can
 * rebuild the missing zips straight from git history.
 *
 * PA-Pedia only shows ONE entry per distinct version string (the manifest dedups
 * same-version timestamps, keeping the newest). So for each faction we take each
 * distinct `version` and the NEWEST commit whose tree carried it — that captures
 * the latest snapshot of same-version re-extractions (notably Exiles, which is
 * often re-extracted without a version bump).
 *
 * Each zip is stamped with its commit's date (`pedia{YYYYMMDDHHmmss}` UTC) so the
 * manifest's newest-first ordering is chronological. Versions already present on
 * the release (the current extraction) are skipped, so today's live zip keeps the
 * newest timestamp and stays "latest".
 *
 * Usage:
 *   tsx reconstruct-history.ts            # dry-run: print the plan, touch nothing
 *   tsx reconstruct-history.ts --write    # build zips into factions/dist/
 *
 * Uploading is deliberately NOT automated — review dist/ then:
 *   gh release upload faction-data factions/dist/<file>.zip
 *   npm run generate:manifest
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REPO = path.join(import.meta.dirname, '..')
const FACTIONS_DIR = path.join(REPO, 'factions')
const OUTPUT_DIR = path.join(FACTIONS_DIR, 'dist')
const RELEASE_TAG = 'faction-data'

// {factionId}-{version}-pedia{timestamp}.zip — id ends with a letter, version starts with a digit.
const ZIP_FILENAME_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([0-9][0-9.-]*)-pedia(\d{14})\.zip$/i

const WRITE = process.argv.includes('--write')

// Bootstrap/placeholder pseudo-versions that were never real upstream releases and
// should not appear in the public version dropdown. Keyed by `${id}-${version}`.
//  - mla-1.0.0 / legion-1.0.0: the default "1.0.0" version later removed as a bug (#235)
//  - exiles-0.6..6: malformed version string from the initial /factions bootstrap commit
const EXCLUDE = new Set(['mla-1.0.0', 'legion-1.0.0', 'exiles-0.6..6'])

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', cwd: REPO, stdio: ['pipe', 'pipe', 'pipe'] })
}

/** Commit ISO date -> pedia timestamp (YYYYMMDDHHmmss, UTC). */
function isoToStamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => n.toString().padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds())
  )
}

/** Versions currently on the release, as a set of `${id}-${version}` (id lowercased). */
function existingReleaseVersions(): Set<string> {
  const set = new Set<string>()
  try {
    const out = sh(`gh release view ${RELEASE_TAG} --json assets -q ".assets[].name"`)
    for (const name of out.trim().split('\n').filter(Boolean)) {
      const m = name.match(ZIP_FILENAME_PATTERN)
      if (m) set.add(`${m[1].toLowerCase()}-${m[2]}`)
    }
  } catch {
    console.warn(`Warning: could not read ${RELEASE_TAG} release — nothing will be treated as already-present`)
  }
  return set
}

function factionFolders(): string[] {
  return fs
    .readdirSync(FACTIONS_DIR, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        e.name !== 'dist' &&
        fs.existsSync(path.join(FACTIONS_DIR, e.name, 'metadata.json'))
    )
    .map((e) => e.name)
    .sort()
}

interface PlanEntry {
  id: string
  version: string
  commit: string
  iso: string
  stamp: string
  folder: string
  onRelease: boolean
}

/** Distinct versions for one faction folder, each mapped to its newest commit. */
function planForFolder(folder: string, present: Set<string>): PlanEntry[] {
  const rel = `factions/${folder}`
  const log = sh(`git log --format="%H %cI" -- "${rel}"`).trim().split('\n').filter(Boolean)

  const seen = new Map<string, PlanEntry>()
  for (const line of log) {
    const sp = line.indexOf(' ')
    const commit = line.slice(0, sp)
    const iso = line.slice(sp + 1)

    let meta: { version?: string; identifier?: string }
    try {
      meta = JSON.parse(sh(`git show "${commit}:${rel}/metadata.json"`))
    } catch {
      continue // metadata.json absent at this commit (folder added/renamed later)
    }
    if (!meta.version) continue

    const id = (meta.identifier ?? folder).toLowerCase()
    const key = `${id}-${meta.version}`
    if (seen.has(key) || EXCLUDE.has(key)) continue // log is newest-first, so first hit is the newest commit

    seen.set(key, {
      id,
      version: meta.version,
      commit,
      iso,
      stamp: isoToStamp(iso),
      folder,
      onRelease: present.has(key),
    })
  }

  return [...seen.values()].sort((a, b) => b.stamp.localeCompare(a.stamp))
}

function buildZip(entry: PlanEntry): string {
  const filename = `${entry.id}-${entry.version}-pedia${entry.stamp}.zip`
  const out = path.join(OUTPUT_DIR, filename)
  sh(`git archive --format=zip -o "${out}" "${entry.commit}:factions/${entry.folder}"`)
  return filename
}

function main() {
  console.log(`Reconstructing faction history from git (${WRITE ? 'WRITE' : 'dry-run'})`)
  console.log()

  const present = existingReleaseVersions()
  console.log(`Versions currently on ${RELEASE_TAG}: ${present.size ? [...present].sort().join(', ') : '(none)'}`)
  console.log()

  const folders = factionFolders()
  let built = 0
  const toBuild: PlanEntry[] = []

  for (const folder of folders) {
    const plan = planForFolder(folder, present)
    console.log(`── ${folder} — ${plan.length} distinct version(s) in history`)
    for (const e of plan) {
      const tag = e.onRelease ? 'on-release (skip)' : 'RECONSTRUCT'
      console.log(
        `   ${e.version.padEnd(12)} ${e.stamp}  ${e.commit.slice(0, 8)}  ${e.iso.slice(0, 10)}  ${tag}`
      )
      if (!e.onRelease) toBuild.push(e)
    }
    console.log()
  }

  console.log(`Plan: ${toBuild.length} zip(s) to reconstruct, ${present.size} already on release.`)

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --write to build zips into factions/dist/.')
    return
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log('\nBuilding zips...')
  for (const e of toBuild) {
    const name = buildZip(e)
    const sizeMB = (fs.statSync(path.join(OUTPUT_DIR, name)).size / 1024 / 1024).toFixed(2)
    console.log(`  ✓ ${name} (${sizeMB} MB)`)
    built++
  }

  console.log(`\nDone. Built ${built} zip(s) in ${OUTPUT_DIR}`)
  console.log('\nNext steps (review first):')
  console.log(`  gh release upload ${RELEASE_TAG} factions/dist/*.zip`)
  console.log('  npm run generate:manifest')
}

main()
