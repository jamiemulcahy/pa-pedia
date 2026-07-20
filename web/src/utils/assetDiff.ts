/**
 * Diffs the raw PA source-file trees of two faction versions.
 *
 * The high-signal, player-facing diff (weapon stats, economy, …) is computed from
 * the resolved `units.json` by {@link module:versionDiff}. But `units.json` is a
 * lossy projection: many upstream version bumps change raw source files (ammo
 * fields like `collision_check`, tool tweaks, icons) that never reach the resolved
 * stats, so the resolved diff honestly reports "nothing changed".
 *
 * This module fills that gap. It compares the raw `assets/pa/**` files that the
 * web app already downloads and caches, surfacing ANY change as a secondary
 * "Other changes" section. Because these are the mod's actual source files, field
 * names are shown verbatim (snake_case, e.g. `collision_check`) rather than
 * humanised — the audience for this section wants the technical truth.
 */
import { formatNumber } from '@/utils/groupAggregation'
import type { UnitRef } from '@/utils/versionDiff'

export type FileStatus = 'changed' | 'added' | 'removed'

/** A single changed raw file, with pre-formatted field-change lines. */
export interface AssetFileChange {
  /** Full asset path, e.g. "assets/pa/units/land/tank/tank.json". */
  path: string
  /** Basename, e.g. "tank.json". */
  name: string
  /** Owning unit identifier parsed from the path, or null for shared files. */
  unitId: string | null
  status: FileStatus
  /**
   * Field-level change lines for a changed JSON file (verbatim PA field names).
   * Empty for added/removed files and for binary files (status/label carried by
   * `status` + a single summary line).
   */
  lines: string[]
  /** Per-file lines suppressed by the cap (0 when nothing was dropped). */
  truncatedLines: number
}

/** Max field-change lines shown per file before collapsing into "…and N more". */
const MAX_LINES_PER_FILE = 12

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function isJsonPath(path: string): boolean {
  return path.toLowerCase().endsWith('.json')
}

/**
 * Owning unit identifier for an asset path: the immediate parent directory of a
 * file living under `.../units/.../<unitDir>/<file>`. Shared resources (ammo,
 * tools, effects that aren't inside a unit folder) return null.
 */
export function unitIdFromPath(path: string): string | null {
  const m = path.match(/\/units\/(?:.*\/)?([^/]+)\/[^/]+$/)
  return m ? m[1] : null
}

function quote(value: unknown): string {
  if (value === undefined || value === null) return '–'
  if (typeof value === 'number') return formatNumber(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const s = String(value)
  return `"${s.length > 60 ? `${s.slice(0, 59)}…` : s}"`
}

/** Format one scalar change as "field: before → after (+x%)". */
function formatScalar(path: string, before: unknown, after: unknown): string {
  let display = `${path}: ${quote(before)} → ${quote(after)}`
  if (typeof before === 'number' && typeof after === 'number' && before > 0) {
    const pct = Math.round(((after - before) / before) * 100)
    if (Math.abs(pct) >= 1) display += ` (${pct > 0 ? '+' : ''}${pct}%)`
  }
  return display
}

/**
 * Recursively diff two parsed JSON values, appending change lines to `out`.
 * Field names are kept verbatim; nested paths are dotted (`a.b`) and array
 * elements indexed (`a[0].b`).
 */
function walkRaw(prev: unknown, curr: unknown, path: string, out: string[]): void {
  const prevIsObj = prev !== null && typeof prev === 'object'
  const currIsObj = curr !== null && typeof curr === 'object'

  if (prevIsObj || currIsObj) {
    if (Array.isArray(prev) || Array.isArray(curr)) {
      // Only one side may be an array (a field changed type); coerce the other to
      // [] so array handling never runs against a non-array value.
      const p = Array.isArray(prev) ? prev : []
      const c = Array.isArray(curr) ? curr : []
      // Arrays of STRINGS → set difference (order-independent tags, e.g. target
      // layers). Numeric arrays are positional (coordinates, offsets) so they fall
      // through to index-wise comparison instead — "+0/−0" set output would read as
      // signed zero and lose position.
      const allStrings = (arr: unknown[]) => arr.length > 0 && arr.every((v) => typeof v === 'string')
      if (allStrings(p) && allStrings(c)) {
        const ps = new Set(p as string[])
        const cs = new Set(c as string[])
        const added = [...cs].filter((v) => !ps.has(v)).map((v) => `+${v}`)
        const removed = [...ps].filter((v) => !cs.has(v)).map((v) => `−${v}`)
        if (added.length || removed.length) out.push(`${path}: ${[...added, ...removed].join(', ')}`)
        return
      }
      if (p.length !== c.length) out.push(`${path}: ${p.length} → ${c.length} items`)
      const n = Math.max(p.length, c.length)
      for (let i = 0; i < n; i++) walkRaw(p[i], c[i], `${path}[${i}]`, out)
      return
    }
    const po = (prevIsObj ? prev : {}) as Record<string, unknown>
    const co = (currIsObj ? curr : {}) as Record<string, unknown>
    for (const key of new Set([...Object.keys(po), ...Object.keys(co)])) {
      walkRaw(po[key], co[key], path ? `${path}.${key}` : key, out)
    }
    return
  }

  if (prev === undefined && curr === undefined) return
  if (prev !== curr) out.push(formatScalar(path, prev, curr))
}

/** Byte-equality for two blobs (size check first, then contents). */
async function blobsEqual(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false
  const [ba, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
  const va = new Uint8Array(ba)
  const vb = new Uint8Array(bb)
  for (let i = 0; i < va.length; i++) {
    if (va[i] !== vb[i]) return false
  }
  return true
}

function binaryLabel(path: string): string {
  return path.toLowerCase().endsWith('.png') ? 'Icon changed' : 'File changed'
}

function cap(lines: string[]): { lines: string[]; truncatedLines: number } {
  if (lines.length <= MAX_LINES_PER_FILE) return { lines, truncatedLines: 0 }
  return {
    lines: lines.slice(0, MAX_LINES_PER_FILE),
    truncatedLines: lines.length - MAX_LINES_PER_FILE,
  }
}

/**
 * Compare two raw asset maps (path → Blob) and return every changed, added, or
 * removed file. Files whose contents are byte-identical are omitted, as are JSON
 * files that differ only in whitespace.
 */
export async function diffAssets(
  prev: Map<string, Blob>,
  curr: Map<string, Blob>
): Promise<AssetFileChange[]> {
  const out: AssetFileChange[] = []
  const paths = new Set([...prev.keys(), ...curr.keys()])

  for (const path of paths) {
    const a = prev.get(path)
    const b = curr.get(path)
    const meta = { path, name: basename(path), unitId: unitIdFromPath(path) }

    if (a && !b) {
      out.push({ ...meta, status: 'removed', lines: [], truncatedLines: 0 })
      continue
    }
    if (!a && b) {
      out.push({ ...meta, status: 'added', lines: [], truncatedLines: 0 })
      continue
    }
    if (!a || !b) continue

    if (isJsonPath(path)) {
      const [ta, tb] = await Promise.all([a.text(), b.text()])
      if (ta === tb) continue
      let pa: unknown
      let pb: unknown
      try {
        pa = JSON.parse(ta)
        pb = JSON.parse(tb)
      } catch {
        out.push({ ...meta, status: 'changed', lines: ['File changed'], truncatedLines: 0 })
        continue
      }
      const changes: string[] = []
      try {
        walkRaw(pa, pb, '', changes)
      } catch (err) {
        // A single malformed/edge-case file must not sink the whole comparison;
        // fall back to a file-level note so its change is still surfaced.
        console.warn(`Field diff failed for ${path}, reporting file-level change:`, err)
        out.push({ ...meta, status: 'changed', lines: ['File changed'], truncatedLines: 0 })
        continue
      }
      if (changes.length === 0) continue // whitespace / key-order only
      out.push({ ...meta, status: 'changed', ...cap(changes) })
    } else {
      if (await blobsEqual(a, b)) continue
      out.push({ ...meta, status: 'changed', lines: [binaryLabel(path)], truncatedLines: 0 })
    }
  }

  return out
}

/** A group of raw file changes, keyed by owning unit (or shared/other). */
export interface AssetChangeGroup {
  key: string
  /** Present when the group maps to a known current unit (enables icon + link). */
  ref?: UnitRef
  label: string
  files: AssetFileChange[]
}

export interface GroupedAssetChanges {
  groups: AssetChangeGroup[]
  changedFileCount: number
}

const SHARED_KEY = '__shared__'

/**
 * Group raw file changes for display: by owning unit, with unmapped/shared files
 * collected under "Shared files". Files whose owning unit already appears in the
 * resolved diff are dropped (`excludeUnitIds`) so the two sections don't overlap.
 *
 * @param unitRefs - Current-version units by identifier, for icons/links/names.
 */
export function groupAssetChanges(
  files: AssetFileChange[],
  excludeUnitIds: Set<string>,
  unitRefs: Map<string, UnitRef>
): GroupedAssetChanges {
  const groups = new Map<string, AssetChangeGroup>()

  for (const file of files) {
    if (file.unitId && excludeUnitIds.has(file.unitId)) continue

    const key = file.unitId ?? SHARED_KEY
    let group = groups.get(key)
    if (!group) {
      const ref = file.unitId ? unitRefs.get(file.unitId) : undefined
      const label = ref?.displayName ?? file.unitId ?? 'Shared files'
      group = { key, ref, label, files: [] }
      groups.set(key, group)
    }
    group.files.push(file)
  }

  const ordered = [...groups.values()].sort((a, b) => {
    // Shared group always sorts last; otherwise alphabetical by label.
    if (a.key === SHARED_KEY) return 1
    if (b.key === SHARED_KEY) return -1
    return a.label.localeCompare(b.label)
  })
  for (const group of ordered) {
    group.files.sort((a, b) => a.name.localeCompare(b.name))
  }

  const changedFileCount = ordered.reduce((n, g) => n + g.files.length, 0)
  return { groups: ordered, changedFileCount }
}
