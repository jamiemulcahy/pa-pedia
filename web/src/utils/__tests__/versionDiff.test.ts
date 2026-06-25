import { describe, it, expect } from 'vitest'
import { diffFactionVersions, hasChanges } from '../versionDiff'
import type { FactionIndex, Unit, UnitIndexEntry } from '@/types/faction'

/** Minimal unit factory for diff tests. */
function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'tank',
    resourceName: '/pa/units/land/tank/tank.json',
    displayName: 'Tank',
    image: 'assets/pa/units/land/tank/tank_icon_buildbar.png',
    tier: 1,
    unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
    accessible: true,
    specs: {
      combat: { health: 200, dps: 50 },
      economy: { buildCost: 150, buildRate: 0 },
      mobility: { moveSpeed: 10 },
    },
    ...overrides,
  }
}

function makeEntry(identifier: string, unit: Unit, displayName?: string): UnitIndexEntry {
  return {
    identifier,
    displayName: displayName ?? unit.displayName,
    unitTypes: unit.unitTypes,
    source: unit.resourceName,
    files: [],
    unit,
  }
}

function makeIndex(entries: UnitIndexEntry[]): FactionIndex {
  return { units: entries }
}

describe('diffFactionVersions', () => {
  it('detects added units', () => {
    const previous = makeIndex([makeEntry('tank', makeUnit())])
    const current = makeIndex([
      makeEntry('tank', makeUnit()),
      makeEntry('bomber', makeUnit({ displayName: 'Bomber' }), 'Bomber'),
    ])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    expect(diff.added).toHaveLength(1)
    expect(diff.added[0]).toMatchObject({ identifier: 'bomber', displayName: 'Bomber' })
    expect(diff.removed).toHaveLength(0)
    expect(diff.changed).toHaveLength(0)
  })

  it('detects removed units', () => {
    const previous = makeIndex([
      makeEntry('tank', makeUnit()),
      makeEntry('mine', makeUnit({ displayName: 'Mine' }), 'Mine'),
    ])
    const current = makeIndex([makeEntry('tank', makeUnit())])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0].identifier).toBe('mine')
    expect(diff.added).toHaveLength(0)
  })

  it('detects changed numeric fields with signed percentage', () => {
    const previous = makeIndex([makeEntry('tank', makeUnit({ specs: { combat: { health: 200, dps: 50 }, economy: { buildCost: 150 } } }))])
    const current = makeIndex([makeEntry('tank', makeUnit({ specs: { combat: { health: 250, dps: 50 }, economy: { buildCost: 150 } } }))])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    expect(diff.changed).toHaveLength(1)
    const healthChange = diff.changed[0].fields.find((f) => f.label === 'Health')
    expect(healthChange).toBeDefined()
    expect(healthChange?.before).toBe(200)
    expect(healthChange?.after).toBe(250)
    expect(healthChange?.display).toBe('Health: 200 → 250 (+25%)')
  })

  it('renders a downward change with a negative percentage', () => {
    const previous = makeIndex([makeEntry('tank', makeUnit({ specs: { combat: { health: 200, dps: 50 }, economy: { buildCost: 200 } } }))])
    const current = makeIndex([makeEntry('tank', makeUnit({ specs: { combat: { health: 200, dps: 50 }, economy: { buildCost: 150 } } }))])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    const costChange = diff.changed[0].fields.find((f) => f.label === 'Build cost')
    expect(costChange?.display).toBe('Build cost: 200 → 150 (-25%)')
  })

  it('renders boolean accessibility changes without a percentage', () => {
    const previous = makeIndex([makeEntry('tank', makeUnit({ accessible: false }))])
    const current = makeIndex([makeEntry('tank', makeUnit({ accessible: true }))])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    const accessibleChange = diff.changed[0].fields.find((f) => f.label === 'Accessible')
    expect(accessibleChange?.display).toBe('Accessible: No → Yes')
  })

  it('skips fields absent on either version', () => {
    const previous = makeIndex([makeEntry('tank', makeUnit({ specs: { combat: { health: 200 }, economy: { buildCost: 150 } } }))])
    const current = makeIndex([makeEntry('tank', makeUnit({ specs: { combat: { health: 200, dps: 99 }, economy: { buildCost: 150 } } }))])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    // dps was undefined in the previous version, so it must not be reported as a change
    expect(diff.changed).toHaveLength(0)
  })

  it('returns an empty diff when nothing changed', () => {
    const previous = makeIndex([makeEntry('tank', makeUnit())])
    const current = makeIndex([makeEntry('tank', makeUnit())])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    expect(hasChanges(diff)).toBe(false)
  })

  it('sorts results alphabetically by display name', () => {
    const previous = makeIndex([])
    const current = makeIndex([
      makeEntry('zebra', makeUnit({ displayName: 'Zebra' }), 'Zebra'),
      makeEntry('alpha', makeUnit({ displayName: 'Alpha' }), 'Alpha'),
    ])

    const diff = diffFactionVersions(previous, current, '1.0.0', '1.1.0')

    expect(diff.added.map((u) => u.displayName)).toEqual(['Alpha', 'Zebra'])
  })

  it('preserves the from/to version labels', () => {
    const diff = diffFactionVersions(makeIndex([]), makeIndex([]), '0.7.0', '0.7.1')
    expect(diff.fromVersion).toBe('0.7.0')
    expect(diff.toVersion).toBe('0.7.1')
  })
})
