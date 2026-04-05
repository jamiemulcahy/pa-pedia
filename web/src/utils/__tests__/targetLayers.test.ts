import { describe, it, expect } from 'vitest'
import {
  formatLayerName,
  formatTargetLayers,
  calculateDpsByLayer,
  calculateGroupDpsByLayer,
  getSortedLayers,
  TARGET_LAYER_DISPLAY_NAMES,
  TARGET_LAYER_ORDER,
} from '../targetLayers'
import type { Weapon } from '@/types/faction'
import type { AggregatedWeapon } from '@/types/group'

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    safeName: 'test_weapon',
    count: 1,
    rateOfFire: 1,
    damage: 100,
    dps: 100,
    maxRange: 100,
    targetLayers: ['LandHorizontal'],
    ...overrides,
  } as Weapon
}

function makeAggWeapon(overrides: Partial<AggregatedWeapon> = {}): AggregatedWeapon {
  return {
    safeName: 'test_weapon',
    displayName: 'Test Weapon',
    targetLayers: ['LandHorizontal'],
    totalCount: 1,
    totalDps: 100,
    totalDamage: 100,
    sourceUnits: [],
    ...overrides,
  }
}

describe('formatLayerName', () => {
  it('returns display name for known layers', () => {
    expect(formatLayerName('LandHorizontal')).toBe('Land')
    expect(formatLayerName('WaterSurface')).toBe('Sea')
    expect(formatLayerName('Underwater')).toBe('Sub')
    expect(formatLayerName('Air')).toBe('Air')
    expect(formatLayerName('Orbital')).toBe('Orbital')
    expect(formatLayerName('Seafloor')).toBe('Seafloor')
  })

  it('falls back to raw name for unknown layers', () => {
    expect(formatLayerName('UnknownLayer')).toBe('UnknownLayer')
  })
})

describe('formatTargetLayers', () => {
  it('returns undefined for empty or undefined', () => {
    expect(formatTargetLayers(undefined)).toBeUndefined()
    expect(formatTargetLayers([])).toBeUndefined()
  })

  it('formats layers with display names', () => {
    expect(formatTargetLayers(['LandHorizontal', 'Air'])).toBe('Land, Air')
  })

  it('handles unknown layers in the mix', () => {
    expect(formatTargetLayers(['LandHorizontal', 'Custom'])).toBe('Land, Custom')
  })
})

describe('calculateDpsByLayer', () => {
  it('returns empty for undefined weapons', () => {
    expect(calculateDpsByLayer(undefined)).toEqual({})
  })

  it('returns empty for empty weapons array', () => {
    expect(calculateDpsByLayer([])).toEqual({})
  })

  it('calculates DPS for a single weapon with one layer', () => {
    const weapons = [makeWeapon({ dps: 100, targetLayers: ['LandHorizontal'] })]
    const result = calculateDpsByLayer(weapons)
    expect(result).toEqual({
      LandHorizontal: { burst: 100, sustained: 100, burn: 0 },
    })
  })

  it('applies weapon count multiplier', () => {
    const weapons = [makeWeapon({ dps: 50, count: 3, targetLayers: ['Air'] })]
    const result = calculateDpsByLayer(weapons)
    expect(result).toEqual({
      Air: { burst: 150, sustained: 150, burn: 0 },
    })
  })

  it('multi-layer weapon contributes to all layers', () => {
    const weapons = [makeWeapon({
      dps: 100,
      targetLayers: ['LandHorizontal', 'WaterSurface', 'Air'],
    })]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(100)
    expect(result.WaterSurface.burst).toBe(100)
    expect(result.Air.burst).toBe(100)
  })

  it('sums DPS from multiple weapons targeting the same layer', () => {
    const weapons = [
      makeWeapon({ dps: 100, targetLayers: ['LandHorizontal'] }),
      makeWeapon({ dps: 50, targetLayers: ['LandHorizontal', 'Air'] }),
    ]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(150)
    expect(result.Air.burst).toBe(50)
  })

  it('excludes death explosion weapons', () => {
    const weapons = [
      makeWeapon({ dps: 100, targetLayers: ['LandHorizontal'] }),
      makeWeapon({ dps: 500, targetLayers: ['LandHorizontal'], deathExplosion: true }),
    ]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(100)
  })

  it('excludes self-destruct weapons', () => {
    const weapons = [
      makeWeapon({ dps: 100, targetLayers: ['LandHorizontal'] }),
      makeWeapon({ dps: 500, targetLayers: ['LandHorizontal'], selfDestruct: true }),
    ]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(100)
  })

  it('tracks sustained DPS separately when available', () => {
    const weapons = [makeWeapon({
      dps: 200,
      sustainedDps: 100,
      targetLayers: ['LandHorizontal'],
    })]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(200)
    expect(result.LandHorizontal.sustained).toBe(100)
  })

  it('falls back sustained to burst when sustainedDps is undefined', () => {
    const weapons = [makeWeapon({
      dps: 150,
      sustainedDps: undefined,
      targetLayers: ['Air'],
    })]
    const result = calculateDpsByLayer(weapons)
    expect(result.Air.burst).toBe(150)
    expect(result.Air.sustained).toBe(150)
  })

  it('tracks burn DPS separately', () => {
    const weapons = [makeWeapon({
      dps: 100,
      burnDps: 25,
      targetLayers: ['LandHorizontal'],
    })]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burn).toBe(25)
  })

  it('burn DPS defaults to 0 when undefined', () => {
    const weapons = [makeWeapon({
      dps: 100,
      targetLayers: ['LandHorizontal'],
    })]
    const result = calculateDpsByLayer(weapons)
    expect(result.LandHorizontal.burn).toBe(0)
  })

  it('skips weapons with no targetLayers', () => {
    const weapons = [
      makeWeapon({ dps: 100, targetLayers: [] }),
      makeWeapon({ dps: 50, targetLayers: undefined }),
      makeWeapon({ dps: 75, targetLayers: ['Air'] }),
    ]
    const result = calculateDpsByLayer(weapons)
    expect(Object.keys(result)).toEqual(['Air'])
    expect(result.Air.burst).toBe(75)
  })

  it('rounds values to 1 decimal place', () => {
    const weapons = [
      makeWeapon({ dps: 33.333, targetLayers: ['Air'] }),
      makeWeapon({ dps: 33.333, targetLayers: ['Air'] }),
      makeWeapon({ dps: 33.333, targetLayers: ['Air'] }),
    ]
    const result = calculateDpsByLayer(weapons)
    expect(result.Air.burst).toBe(100)
  })
})

describe('calculateGroupDpsByLayer', () => {
  it('returns empty for empty weapons', () => {
    expect(calculateGroupDpsByLayer([])).toEqual({})
  })

  it('calculates per-layer DPS from aggregated weapons', () => {
    const weapons = [
      makeAggWeapon({ totalDps: 200, targetLayers: ['LandHorizontal', 'Air'] }),
      makeAggWeapon({ totalDps: 100, targetLayers: ['Air'] }),
    ]
    const result = calculateGroupDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(200)
    expect(result.Air.burst).toBe(300)
  })

  it('tracks sustained DPS from aggregated weapons', () => {
    const weapons = [
      makeAggWeapon({ totalDps: 200, totalSustainedDps: 100, targetLayers: ['LandHorizontal'] }),
    ]
    const result = calculateGroupDpsByLayer(weapons)
    expect(result.LandHorizontal.burst).toBe(200)
    expect(result.LandHorizontal.sustained).toBe(100)
  })

  it('falls back sustained to burst when undefined', () => {
    const weapons = [
      makeAggWeapon({ totalDps: 150, totalSustainedDps: undefined, targetLayers: ['Air'] }),
    ]
    const result = calculateGroupDpsByLayer(weapons)
    expect(result.Air.sustained).toBe(150)
  })

  it('tracks burn DPS from aggregated weapons', () => {
    const weapons = [
      makeAggWeapon({ totalDps: 100, totalBurnDps: 30, targetLayers: ['LandHorizontal'] }),
    ]
    const result = calculateGroupDpsByLayer(weapons)
    expect(result.LandHorizontal.burn).toBe(30)
  })
})

describe('getSortedLayers', () => {
  it('sorts layers in canonical order', () => {
    const dpsByLayer = {
      Air: { burst: 1, sustained: 1, burn: 0 },
      LandHorizontal: { burst: 1, sustained: 1, burn: 0 },
      Orbital: { burst: 1, sustained: 1, burn: 0 },
    }
    expect(getSortedLayers(dpsByLayer)).toEqual(['LandHorizontal', 'Air', 'Orbital'])
  })

  it('puts unknown layers at end alphabetically', () => {
    const dpsByLayer = {
      CustomLayer: { burst: 1, sustained: 1, burn: 0 },
      Air: { burst: 1, sustained: 1, burn: 0 },
      AnotherCustom: { burst: 1, sustained: 1, burn: 0 },
    }
    const sorted = getSortedLayers(dpsByLayer)
    expect(sorted).toEqual(['Air', 'AnotherCustom', 'CustomLayer'])
  })

  it('returns empty array for empty input', () => {
    expect(getSortedLayers({})).toEqual([])
  })
})

describe('constants', () => {
  it('TARGET_LAYER_DISPLAY_NAMES covers all standard layers', () => {
    expect(Object.keys(TARGET_LAYER_DISPLAY_NAMES)).toHaveLength(6)
  })

  it('TARGET_LAYER_ORDER matches display names keys', () => {
    for (const layer of TARGET_LAYER_ORDER) {
      expect(TARGET_LAYER_DISPLAY_NAMES[layer]).toBeDefined()
    }
  })
})
