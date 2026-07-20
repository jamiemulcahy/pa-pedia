import { describe, it, expect } from 'vitest'
import {
  diffAssets,
  groupAssetChanges,
  unitIdFromPath,
  type AssetFileChange,
} from '../assetDiff'
import type { UnitRef } from '../versionDiff'

/** Build an asset map from a plain object of path → string/blob content. */
function assets(entries: Record<string, string>): Map<string, Blob> {
  const map = new Map<string, Blob>()
  for (const [path, content] of Object.entries(entries)) {
    map.set(path, new Blob([content]))
  }
  return map
}

const json = (obj: unknown) => JSON.stringify(obj, null, 2)

describe('unitIdFromPath', () => {
  it('extracts the owning unit folder for a unit file', () => {
    expect(unitIdFromPath('assets/pa/units/land/tank/tank.json')).toBe('tank')
  })

  it('extracts the unit folder for a nested tool/ammo file', () => {
    expect(unitIdFromPath('assets/pa/units/commanders/exiles_taurus/exiles_taurus_ammo.json')).toBe(
      'exiles_taurus'
    )
  })

  it('returns null for shared resources outside a unit folder', () => {
    expect(unitIdFromPath('assets/pa/ammo/base_ammo.json')).toBeNull()
    expect(unitIdFromPath('assets/pa/tools/base_tool.json')).toBeNull()
  })
})

describe('diffAssets', () => {
  it('surfaces a raw ammo field change with the verbatim PA field name', async () => {
    // The real-world Exiles 0.7.4.2 → 0.7.4.3 case that currently shows "no changes".
    const path = 'assets/pa/units/commanders/exiles_taurus/exiles_taurus_ammo.json'
    const prev = assets({ [path]: json({ damage: 180, collision_check: 'Enemies' }) })
    const curr = assets({ [path]: json({ damage: 180, collision_check: 'target' }) })

    const changes = await diffAssets(prev, curr)

    expect(changes).toHaveLength(1)
    expect(changes[0].status).toBe('changed')
    expect(changes[0].unitId).toBe('exiles_taurus')
    expect(changes[0].lines).toEqual(['collision_check: "Enemies" → "target"'])
  })

  it('formats numeric changes with a percent delta', async () => {
    const path = 'assets/pa/units/land/tank/tank_ammo.json'
    const prev = assets({ [path]: json({ damage: 180 }) })
    const curr = assets({ [path]: json({ damage: 150 }) })

    const [change] = await diffAssets(prev, curr)
    expect(change.lines).toEqual(['damage: 180 → 150 (-17%)'])
  })

  it('reports added and removed files', async () => {
    const prev = assets({ 'assets/pa/units/land/a/a.json': json({ x: 1 }) })
    const curr = assets({ 'assets/pa/units/land/b/b.json': json({ y: 2 }) })

    const changes = await diffAssets(prev, curr)
    const byStatus = Object.fromEntries(changes.map((c) => [c.status, c.name]))
    expect(byStatus).toEqual({ removed: 'a.json', added: 'b.json' })
  })

  it('flags a changed binary icon without field detail', async () => {
    const path = 'assets/pa/units/land/tank/tank_icon_buildbar.png'
    const prev = assets({ [path]: 'PNGDATA-old' })
    const curr = assets({ [path]: 'PNGDATA-new-longer' })

    const [change] = await diffAssets(prev, curr)
    expect(change.status).toBe('changed')
    expect(change.lines).toEqual(['Icon changed'])
  })

  it('ignores whitespace-only JSON differences', async () => {
    const path = 'assets/pa/units/land/tank/tank.json'
    const prev = assets({ [path]: '{"damage":180}' })
    const curr = assets({ [path]: '{\n  "damage": 180\n}' })

    expect(await diffAssets(prev, curr)).toHaveLength(0)
  })

  it('ignores byte-identical binaries', async () => {
    const path = 'assets/pa/units/land/tank/tank_icon_buildbar.png'
    const prev = assets({ [path]: 'SAME' })
    const curr = assets({ [path]: 'SAME' })
    expect(await diffAssets(prev, curr)).toHaveLength(0)
  })

  it('handles a field changing between array and non-array without throwing', async () => {
    // Regression: a raw field that flips array <-> scalar/object once crashed the
    // whole diff (arr.every is not a function), swallowing every change.
    const path = 'assets/pa/units/air/t/t.json'
    const prev = assets({ [path]: json({ caps: 'ORDER_Attack', payload: [1, 2] }) })
    const curr = assets({ [path]: json({ caps: ['ORDER_Attack'], payload: { count: 2 } }) })

    const changes = await diffAssets(prev, curr)
    expect(changes).toHaveLength(1)
    expect(changes[0].status).toBe('changed')
    expect(changes[0].lines.length).toBeGreaterThan(0)
  })

  it('reports array length changes (e.g. a weapon added)', async () => {
    const path = 'assets/pa/units/land/tank/tank.json'
    const prev = assets({ [path]: json({ weapons: [{ id: 'w1' }] }) })
    const curr = assets({ [path]: json({ weapons: [{ id: 'w1' }, { id: 'w2' }] }) })

    const [change] = await diffAssets(prev, curr)
    expect(change.lines[0]).toBe('weapons: 1 → 2 items')
  })
})

describe('groupAssetChanges', () => {
  const file = (over: Partial<AssetFileChange>): AssetFileChange => ({
    path: 'assets/pa/units/land/tank/tank.json',
    name: 'tank.json',
    unitId: 'tank',
    status: 'changed',
    lines: ['x: 1 → 2'],
    truncatedLines: 0,
    ...over,
  })

  it('groups by owning unit and attaches the unit ref for icon/link', () => {
    const refs = new Map<string, UnitRef>([
      ['tank', { identifier: 'tank', displayName: 'Tank', image: 'tank.png' }],
    ])
    const { groups, changedFileCount } = groupAssetChanges([file({})], new Set(), refs)

    expect(changedFileCount).toBe(1)
    expect(groups[0].label).toBe('Tank')
    expect(groups[0].ref?.image).toBe('tank.png')
  })

  it('drops files whose unit already appears in the resolved diff', () => {
    const { groups, changedFileCount } = groupAssetChanges([file({})], new Set(['tank']), new Map())
    expect(changedFileCount).toBe(0)
    expect(groups).toHaveLength(0)
  })

  it('collects unmapped files under "Shared files", sorted last', () => {
    const shared = file({
      path: 'assets/pa/ammo/base_ammo.json',
      name: 'base_ammo.json',
      unitId: null,
    })
    const { groups } = groupAssetChanges([shared, file({})], new Set(), new Map())
    expect(groups.map((g) => g.label)).toEqual(['tank', 'Shared files'])
  })
})
