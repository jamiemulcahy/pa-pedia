/**
 * Computes a human-readable diff between two versions of a faction.
 *
 * PA-Pedia has no authored changelog, so "what changed" is derived by comparing
 * the embedded, fully-resolved unit specs of two faction indexes. Units are keyed
 * by `identifier`; a curated set of high-signal fields is compared to keep the
 * resulting list readable.
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
  before: number | boolean | null
  after: number | boolean | null
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

type FieldKind = 'number' | 'bool'

interface TrackedField {
  label: string
  kind: FieldKind
  accessor: (unit: Unit) => number | boolean | undefined
}

/**
 * High-signal fields compared between versions. Order here is the display order.
 * Note: `economy.buildCost` is a flat metal cost in the data model (not a
 * {metal, energy} object), so it is tracked as a single number.
 */
const TRACKED_FIELDS: TrackedField[] = [
  { label: 'Tier', kind: 'number', accessor: (u) => u.tier },
  { label: 'Accessible', kind: 'bool', accessor: (u) => u.accessible },
  { label: 'Health', kind: 'number', accessor: (u) => u.specs?.combat?.health },
  { label: 'DPS', kind: 'number', accessor: (u) => u.specs?.combat?.dps },
  { label: 'Build cost', kind: 'number', accessor: (u) => u.specs?.economy?.buildCost },
  { label: 'Build rate', kind: 'number', accessor: (u) => u.specs?.economy?.buildRate },
  { label: 'Move speed', kind: 'number', accessor: (u) => u.specs?.mobility?.moveSpeed },
]

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

function formatNumberChange(label: string, before: number, after: number): string {
  let display = `${label}: ${formatNumber(before)} → ${formatNumber(after)}`
  if (before > 0) {
    const pct = Math.round(((after - before) / before) * 100)
    if (Math.abs(pct) >= 1) {
      display += ` (${pct > 0 ? '+' : ''}${pct}%)`
    }
  }
  return display
}

function formatBoolChange(label: string, before: boolean, after: boolean): string {
  return `${label}: ${before ? 'Yes' : 'No'} → ${after ? 'Yes' : 'No'}`
}

/**
 * Compare the tracked fields of two unit versions. Fields that are absent on
 * either side are skipped (we can't meaningfully diff a missing value).
 */
function diffUnitFields(previous: Unit, current: Unit): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of TRACKED_FIELDS) {
    const before = field.accessor(previous)
    const after = field.accessor(current)
    if (before === undefined || after === undefined) continue
    if (before === after) continue

    const display =
      field.kind === 'number'
        ? formatNumberChange(field.label, before as number, after as number)
        : formatBoolChange(field.label, before as boolean, after as boolean)

    changes.push({ label: field.label, before, after, display })
  }
  return changes
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

  const added: UnitRef[] = []
  const changed: ChangedUnit[] = []

  for (const [identifier, entry] of currMap) {
    const prev = prevMap.get(identifier)
    if (!prev) {
      added.push(toRef(entry))
      continue
    }
    const fields = diffUnitFields(prev.unit, entry.unit)
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
