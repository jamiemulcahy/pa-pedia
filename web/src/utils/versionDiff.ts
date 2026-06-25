/**
 * Computes a human-readable diff between two versions of a faction.
 *
 * PA-Pedia has no authored changelog, so "what changed" is derived by comparing
 * the embedded, fully-resolved unit specs of two faction indexes. Units are keyed
 * by `identifier`.
 *
 * The diff is comprehensive: it walks the whole resolved spec tree so any
 * meaningful change is surfaced (weapon damage, fire rate, ranges, ammo, economy,
 * mobility, recon, etc.) rather than a hand-picked subset. Two categories get
 * special treatment:
 *   - Internal/derived keys (ids, resource paths, icon paths, raw ammo blobs) are
 *     skipped — they're not player-facing.
 *   - `buildRelationships` (the build graph) is summarised, not diffed edge-by-edge:
 *     adding/removing a single builder unit otherwise produces hundreds of low-signal
 *     "now built by X" bullets that bury the real balance changes.
 */
import type { FactionIndex, UnitIndexEntry, Unit } from '@/types/faction'
import { formatNumber } from '@/utils/groupAggregation'

/** Lightweight reference to a unit, enough to render an icon + link. */
export interface UnitRef {
  identifier: string
  displayName: string
  image?: string
}

/** A single changed field on a unit, pre-formatted for display. */
export interface FieldChange {
  label: string
  before: number | boolean | string | null
  after: number | boolean | string | null
  /** Humanised one-line summary, e.g. "Health: 200 → 250 (+25%)". */
  display: string
}

export interface ChangedUnit extends UnitRef {
  fields: FieldChange[]
}

export interface VersionDiff {
  /** The older version being compared from. */
  fromVersion: string
  /** The newer version being compared to. */
  toVersion: string
  added: UnitRef[]
  removed: UnitRef[]
  changed: ChangedUnit[]
}

/**
 * Keys skipped while walking a unit. These are internal identifiers, file paths,
 * or raw sub-blobs whose meaningful values are already surfaced at a higher level
 * (e.g. resolved weapon stats supersede raw `ammoDetails`). `buildRelationships`
 * is excluded here because it's summarised separately.
 */
const INTERNAL_KEYS = new Set([
  'id',
  'resourceName',
  'safeName',
  'image',
  'baseTemplate',
  'buildRelationships',
  'ammoDetails',
  'buildableAmmo',
])

/**
 * Container keys whose own name is dropped from field labels, so nested leaves
 * read naturally: `specs.combat.health` → "Health", not "Specs combat health".
 */
const TRANSPARENT_KEYS = new Set(['specs', 'combat', 'economy', 'mobility', 'recon', 'special'])

/** Nicer labels for keys that don't humanise well from camelCase alone. */
const LABEL_OVERRIDES: Record<string, string> = {
  displayName: 'Name',
  dps: 'DPS',
  sustainedDps: 'Sustained DPS',
  buildCost: 'Build cost',
  buildRate: 'Build rate',
  buildRange: 'Build range',
  moveSpeed: 'Move speed',
  turnSpeed: 'Turn speed',
  rateOfFire: 'Rate of fire',
  maxRange: 'Range',
  salvoDamage: 'Salvo damage',
  splashDamage: 'Splash damage',
  splashRadius: 'Splash radius',
  unitTypes: 'Unit types',
  buildableTypes: 'Buildable types',
  metalRate: 'Metal rate',
  energyRate: 'Energy rate',
  visionRadius: 'Vision radius',
  radarRadius: 'Radar radius',
  sonarRadius: 'Sonar radius',
  muzzleVelocity: 'Muzzle velocity',
}

function humanise(key: string): string {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key]
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/** Combine a parent label with a child key, keeping the first word capitalised. */
function appendLabel(parent: string, key: string): string {
  const h = humanise(key)
  return parent ? `${parent} ${h.toLowerCase()}` : h
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Format a single scalar (number/boolean/string) change into a display bullet. */
function formatScalarChange(label: string, before: unknown, after: unknown): FieldChange {
  const beforeIsNum = typeof before === 'number'
  const afterIsNum = typeof after === 'number'
  const beforeIsBool = typeof before === 'boolean'
  const afterIsBool = typeof after === 'boolean'

  let display: string
  let beforeVal: FieldChange['before']
  let afterVal: FieldChange['after']

  if (beforeIsBool || afterIsBool) {
    const bs = before === undefined ? '–' : before ? 'Yes' : 'No'
    const as_ = after === undefined ? '–' : after ? 'Yes' : 'No'
    display = `${label}: ${bs} → ${as_}`
    beforeVal = beforeIsBool ? (before as boolean) : null
    afterVal = afterIsBool ? (after as boolean) : null
  } else if (beforeIsNum || afterIsNum) {
    const bs = beforeIsNum ? formatNumber(before as number) : '–'
    const as_ = afterIsNum ? formatNumber(after as number) : '–'
    display = `${label}: ${bs} → ${as_}`
    if (beforeIsNum && afterIsNum && (before as number) > 0) {
      const pct = Math.round((((after as number) - (before as number)) / (before as number)) * 100)
      if (Math.abs(pct) >= 1) display += ` (${pct > 0 ? '+' : ''}${pct}%)`
    }
    beforeVal = beforeIsNum ? (before as number) : null
    afterVal = afterIsNum ? (after as number) : null
  } else {
    const bs = before === undefined || before === null ? '–' : `"${truncate(String(before))}"`
    const as_ = after === undefined || after === null ? '–' : `"${truncate(String(after))}"`
    display = `${label}: ${bs} → ${as_}`
    beforeVal = typeof before === 'string' ? before : null
    afterVal = typeof after === 'string' ? after : null
  }

  return { label, before: beforeVal, after: afterVal, display }
}

/** Render an added/removed set as a single bullet, e.g. "Unit types: +Stealth  −Bot". */
function formatSetChange(label: string, added: string[], removed: string[]): FieldChange {
  const parts: string[] = []
  if (added.length) parts.push(`+${added.join(', ')}`)
  if (removed.length) parts.push(`−${removed.join(', ')}`)
  return { label, before: null, after: null, display: `${label}: ${parts.join('  ')}` }
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object'
}

/** Stable key for matching objects across versions (weapons, build arms, …). */
function elementKey(element: unknown): string {
  if (isObject(element)) {
    return String(element.safeName ?? element.resourceName ?? element.name ?? JSON.stringify(element))
  }
  return JSON.stringify(element)
}

/** A `name` is only used as a label if it reads as human text, not an internal id. */
function looksHuman(name: string): boolean {
  return /[ A-Z]/.test(name) && !name.includes('_')
}

/** Raw name for add/remove lines — informative even when not pretty. */
function rawElementName(element: unknown, fallback: string): string {
  if (isObject(element) && typeof element.name === 'string' && element.name) {
    return element.name
  }
  return fallback
}

/**
 * Label used when diffing the fields of a matched array element. Prefers a human
 * weapon name; otherwise falls back to a singularised container label (e.g.
 * "Weapons" → "Weapon", numbered when there are several).
 */
function elementFieldLabel(element: unknown, containerLabel: string, ordinal: number | null): string {
  if (isObject(element) && typeof element.name === 'string' && looksHuman(element.name)) {
    return element.name
  }
  const base = containerLabel.replace(/s$/, '')
  return ordinal != null ? `${base} ${ordinal}` : base
}

function walkArray(prev: unknown[], curr: unknown[], label: string, out: FieldChange[]): void {
  // Arrays of scalars (unitTypes, targetLayers, …) → set difference.
  if (prev.every(isScalar) && curr.every(isScalar)) {
    const prevSet = new Set(prev.map((v) => String(v)))
    const currSet = new Set(curr.map((v) => String(v)))
    const added = [...currSet].filter((v) => !prevSet.has(v))
    const removed = [...prevSet].filter((v) => !currSet.has(v))
    if (added.length || removed.length) out.push(formatSetChange(label, added, removed))
    return
  }

  // Arrays of objects → match by key, diff per element, report add/remove.
  const prevMap = new Map(prev.map((e) => [elementKey(e), e]))
  const currMap = new Map(curr.map((e) => [elementKey(e), e]))
  const multiple = currMap.size > 1

  let ordinal = 0
  for (const [key, currEl] of currMap) {
    ordinal += 1
    const prevEl = prevMap.get(key)
    if (!prevEl) {
      out.push({ label, before: null, after: null, display: `${label}: + ${rawElementName(currEl, key)}` })
      continue
    }
    walk(prevEl, currEl, elementFieldLabel(currEl, label, multiple ? ordinal : null), out)
  }
  for (const [key, prevEl] of prevMap) {
    if (!currMap.has(key)) {
      out.push({ label, before: null, after: null, display: `${label}: − ${rawElementName(prevEl, key)}` })
    }
  }
}

/** Recursively diff two values, appending humanised field changes to `out`. */
function walk(prev: unknown, curr: unknown, label: string, out: FieldChange[]): void {
  const prevIsObj = prev !== null && typeof prev === 'object'
  const currIsObj = curr !== null && typeof curr === 'object'

  if (prevIsObj || currIsObj) {
    if (Array.isArray(prev) || Array.isArray(curr)) {
      walkArray((prev as unknown[]) ?? [], (curr as unknown[]) ?? [], label, out)
      return
    }
    const prevObj = (prevIsObj ? prev : {}) as Record<string, unknown>
    const currObj = (currIsObj ? curr : {}) as Record<string, unknown>
    const keys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)])
    for (const key of keys) {
      if (INTERNAL_KEYS.has(key)) continue
      const childLabel = TRANSPARENT_KEYS.has(key) ? label : appendLabel(label, key)
      walk(prevObj[key], currObj[key], childLabel, out)
    }
    return
  }

  // Both scalar (or undefined).
  if (prev === undefined && curr === undefined) return
  if (prev !== curr) out.push(formatScalarChange(label, prev, curr))
}

/**
 * Summarise build-graph changes for a unit into at most two bullets, mapping unit
 * identifiers to display names where possible.
 */
function diffBuildRelationships(
  prev: Unit,
  curr: Unit,
  nameMap: Map<string, string>,
  out: FieldChange[]
): void {
  const pretty = (id: string) => nameMap.get(id) ?? id
  const summarise = (label: string, prevList?: string[], currList?: string[]) => {
    const prevSet = new Set(prevList ?? [])
    const currSet = new Set(currList ?? [])
    const added = [...currSet].filter((id) => !prevSet.has(id)).map(pretty)
    const removed = [...prevSet].filter((id) => !currSet.has(id)).map(pretty)
    if (added.length || removed.length) out.push(formatSetChange(label, added, removed))
  }
  summarise('Built by', prev.buildRelationships?.builtBy, curr.buildRelationships?.builtBy)
  summarise('Builds', prev.buildRelationships?.builds, curr.buildRelationships?.builds)
}

function buildMap(index: FactionIndex): Map<string, UnitIndexEntry> {
  const map = new Map<string, UnitIndexEntry>()
  for (const entry of index.units) {
    map.set(entry.identifier, entry)
  }
  return map
}

function toRef(entry: UnitIndexEntry): UnitRef {
  return {
    identifier: entry.identifier,
    displayName: entry.displayName || entry.unit?.displayName || entry.identifier,
    image: entry.unit?.image,
  }
}

function buildNameMap(...indexes: FactionIndex[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const index of indexes) {
    for (const entry of index.units) {
      map.set(entry.identifier, entry.displayName || entry.unit?.displayName || entry.identifier)
    }
  }
  return map
}

const byDisplayName = (a: UnitRef, b: UnitRef): number =>
  a.displayName.localeCompare(b.displayName)

/**
 * Diff two faction versions. `previous` is the older index, `current` the newer.
 * `fromVersion`/`toVersion` are the human-facing version labels for each.
 */
export function diffFactionVersions(
  previous: FactionIndex,
  current: FactionIndex,
  fromVersion: string,
  toVersion: string
): VersionDiff {
  const prevMap = buildMap(previous)
  const currMap = buildMap(current)
  const nameMap = buildNameMap(previous, current)

  const added: UnitRef[] = []
  const changed: ChangedUnit[] = []

  for (const [identifier, entry] of currMap) {
    const prev = prevMap.get(identifier)
    if (!prev) {
      added.push(toRef(entry))
      continue
    }
    const fields: FieldChange[] = []
    walk(prev.unit, entry.unit, '', fields)
    diffBuildRelationships(prev.unit, entry.unit, nameMap, fields)
    if (fields.length > 0) {
      changed.push({ ...toRef(entry), fields })
    }
  }

  const removed: UnitRef[] = []
  for (const [identifier, entry] of prevMap) {
    if (!currMap.has(identifier)) {
      removed.push(toRef(entry))
    }
  }

  added.sort(byDisplayName)
  removed.sort(byDisplayName)
  changed.sort(byDisplayName)

  return { fromVersion, toVersion, added, removed, changed }
}

/** True when a diff contains at least one added, removed, or changed unit. */
export function hasChanges(diff: VersionDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0
}
