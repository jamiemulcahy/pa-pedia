import { describe, it, expect } from 'vitest'
import {
  getWeaponGroupKey,
  aggregateGroupStats,
  matchAggregatedWeapons,
  formatNumber,
  formatBooleanAggregation,
} from '../groupAggregation'
import type { Unit, Weapon } from '@/types/faction'
import type { AggregatedWeapon, GroupMember } from '@/types/group'

// Helper to create a minimal Unit for testing
function createMockUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    identifier: 'test_unit',
    displayName: 'Test Unit',
    unitTypes: ['Mobile', 'Land'],
    description: '',
    image: '',
    accessible: true,
    specs: {
      combat: {
        health: 100,
        weapons: [],
      },
      economy: {
        buildCost: 50,
      },
    },
    ...overrides,
  }
}

// Helper to create a minimal Weapon for testing
function createMockWeapon(
  safeName: string,
  targetLayers?: string[],
  options: Partial<Weapon> = {}
): Weapon {
  return {
    resourceName: `/pa/units/tools/${safeName}.json`,
    safeName,
    count: 1,
    rateOfFire: 1,
    damage: 100,
    dps: 100,
    targetLayers,
    ...options,
  }
}

// Helper to create AggregatedWeapon for testing
function createMockAggregatedWeapon(
  safeName: string,
  targetLayers: string[] = [],
  options: Partial<AggregatedWeapon> = {}
): AggregatedWeapon {
  return {
    safeName,
    displayName: safeName,
    targetLayers,
    totalCount: 1,
    totalDps: 100,
    totalDamage: 100,
    sourceUnits: [{ factionId: 'MLA', unitId: 'test', displayName: 'Test', quantity: 1 }],
    ...options,
  }
}

describe('groupAggregation', () => {
  describe('getWeaponGroupKey', () => {
    it('should generate key from safeName and sorted target layers', () => {
      const weapon = createMockWeapon('uber_cannon', ['WaterSurface', 'LandHorizontal'])
      const key = getWeaponGroupKey(weapon)
      expect(key).toBe('uber_cannon|LandHorizontal,WaterSurface')
    })

    it('should handle empty target layers', () => {
      const weapon = createMockWeapon('cannon', [])
      const key = getWeaponGroupKey(weapon)
      expect(key).toBe('cannon|')
    })

    it('should handle undefined target layers', () => {
      const weapon = createMockWeapon('cannon', undefined)
      const key = getWeaponGroupKey(weapon)
      expect(key).toBe('cannon|')
    })

    it('should produce same key for same weapon regardless of layer order', () => {
      const weapon1 = createMockWeapon('cannon', ['Air', 'Land', 'Water'])
      const weapon2 = createMockWeapon('cannon', ['Water', 'Air', 'Land'])
      expect(getWeaponGroupKey(weapon1)).toBe(getWeaponGroupKey(weapon2))
    })
  })

  describe('aggregateGroupStats', () => {
    it('should return null for empty members', () => {
      const result = aggregateGroupStats([], () => undefined)
      expect(result).toBeNull()
    })

    it('should return null when no units are found', () => {
      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'nonexistent', quantity: 1 },
      ]
      const result = aggregateGroupStats(members, () => undefined)
      expect(result).toBeNull()
    })

    it('should sum HP and build cost across units', () => {
      const unit1 = createMockUnit({
        identifier: 'tank1',
        specs: { combat: { health: 100 }, economy: { buildCost: 50 } },
      })
      const unit2 = createMockUnit({
        identifier: 'tank2',
        specs: { combat: { health: 200 }, economy: { buildCost: 100 } },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'tank1', quantity: 2 },
        { factionId: 'MLA', unitId: 'tank2', quantity: 3 },
      ]

      const getUnit = (factionId: string, unitId: string) => {
        if (unitId === 'tank1') return unit1
        if (unitId === 'tank2') return unit2
        return undefined
      }

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      // 2 * 100 + 3 * 200 = 800
      expect(result!.totalHp).toBe(800)
      // 2 * 50 + 3 * 100 = 400
      expect(result!.totalBuildCost).toBe(400)
      expect(result!.unitCount).toBe(5) // 2 + 3
      expect(result!.distinctUnitTypes).toBe(2)
    })

    it('should calculate MIN for mobility stats', () => {
      const fastUnit = createMockUnit({
        identifier: 'fast',
        specs: {
          combat: { health: 100 },
          economy: { buildCost: 50 },
          mobility: { moveSpeed: 20, acceleration: 10, brake: 8, turnSpeed: 90 },
        },
      })
      const slowUnit = createMockUnit({
        identifier: 'slow',
        specs: {
          combat: { health: 100 },
          economy: { buildCost: 50 },
          mobility: { moveSpeed: 10, acceleration: 5, brake: 4, turnSpeed: 45 },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'fast', quantity: 5 },
        { factionId: 'MLA', unitId: 'slow', quantity: 1 },
      ]

      const getUnit = (factionId: string, unitId: string) => {
        if (unitId === 'fast') return fastUnit
        if (unitId === 'slow') return slowUnit
        return undefined
      }

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      // Group moves at slowest unit's pace
      expect(result!.minMoveSpeed).toBe(10)
      expect(result!.minAcceleration).toBe(5)
      expect(result!.minBrake).toBe(4)
      expect(result!.minTurnSpeed).toBe(45)
    })

    it('should calculate MAX for recon stats', () => {
      const scoutUnit = createMockUnit({
        identifier: 'scout',
        specs: {
          combat: { health: 50 },
          economy: { buildCost: 30 },
          recon: { visionRadius: 200, radarRadius: 300 },
        },
      })
      const tankUnit = createMockUnit({
        identifier: 'tank',
        specs: {
          combat: { health: 200 },
          economy: { buildCost: 100 },
          recon: { visionRadius: 100, radarRadius: 0 },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'scout', quantity: 1 },
        { factionId: 'MLA', unitId: 'tank', quantity: 10 },
      ]

      const getUnit = (factionId: string, unitId: string) => {
        if (unitId === 'scout') return scoutUnit
        if (unitId === 'tank') return tankUnit
        return undefined
      }

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      // Best vision/radar in group
      expect(result!.maxVisionRadius).toBe(200)
      expect(result!.maxRadarRadius).toBe(300)
    })

    it('should aggregate economy production and consumption', () => {
      const mex = createMockUnit({
        identifier: 'mex',
        specs: {
          combat: { health: 500 },
          economy: {
            buildCost: 200,
            production: { metal: 7, energy: 0 },
            consumption: { metal: 0, energy: 5 },
          },
        },
      })
      const pgen = createMockUnit({
        identifier: 'pgen',
        specs: {
          combat: { health: 1000 },
          economy: {
            buildCost: 500,
            production: { metal: 0, energy: 1000 },
            consumption: { metal: 5, energy: 0 },
          },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'mex', quantity: 4 },
        { factionId: 'MLA', unitId: 'pgen', quantity: 2 },
      ]

      const getUnit = (factionId: string, unitId: string) => {
        if (unitId === 'mex') return mex
        if (unitId === 'pgen') return pgen
        return undefined
      }

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      // 4 * 7 + 2 * 0 = 28
      expect(result!.totalMetalProduction).toBe(28)
      // 4 * 0 + 2 * 1000 = 2000
      expect(result!.totalEnergyProduction).toBe(2000)
      // 4 * 0 + 2 * 5 = 10
      expect(result!.totalMetalConsumption).toBe(10)
      // 4 * 5 + 2 * 0 = 20
      expect(result!.totalEnergyConsumption).toBe(20)
    })

    it('should aggregate weapons and exclude self-destruct/death explosions', () => {
      const unit = createMockUnit({
        identifier: 'bomber',
        specs: {
          combat: {
            health: 100,
            weapons: [
              createMockWeapon('bomb', ['LandHorizontal'], { dps: 50, damage: 500 }),
              createMockWeapon('death_explosion', ['LandHorizontal'], {
                dps: 1000,
                damage: 1000,
                deathExplosion: true,
              }),
              createMockWeapon('self_destruct', ['LandHorizontal'], {
                dps: 2000,
                damage: 2000,
                selfDestruct: true,
              }),
            ],
          },
          economy: { buildCost: 200 },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'bomber', quantity: 3 },
      ]

      const getUnit = () => unit

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      // Only the bomb weapon should be included
      expect(result!.weapons).toHaveLength(1)
      expect(result!.weapons[0].safeName).toBe('bomb')
      expect(result!.weapons[0].totalCount).toBe(3)
      expect(result!.weapons[0].totalDps).toBe(150) // 3 * 50
    })

    it('should combine same weapons from multiple units', () => {
      const ant = createMockUnit({
        identifier: 'ant',
        specs: {
          combat: {
            health: 50,
            dps: 20,
            weapons: [createMockWeapon('light_laser', ['LandHorizontal'], { dps: 20, damage: 10 })],
          },
          economy: { buildCost: 75 },
        },
      })
      const dox = createMockUnit({
        identifier: 'dox',
        specs: {
          combat: {
            health: 40,
            dps: 15,
            weapons: [createMockWeapon('light_laser', ['LandHorizontal'], { dps: 15, damage: 8 })],
          },
          economy: { buildCost: 60 },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'ant', quantity: 10 },
        { factionId: 'MLA', unitId: 'dox', quantity: 5 },
      ]

      const getUnit = (factionId: string, unitId: string) => {
        if (unitId === 'ant') return ant
        if (unitId === 'dox') return dox
        return undefined
      }

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      // Same weapon combined
      expect(result!.weapons).toHaveLength(1)
      expect(result!.weapons[0].safeName).toBe('light_laser')
      expect(result!.weapons[0].totalCount).toBe(15) // 10 + 5
      expect(result!.weapons[0].totalDps).toBe(275) // 10*20 + 5*15
      expect(result!.weapons[0].sourceUnits).toHaveLength(2)
    })

    it('should calculate derived metrics (DPS/metal, HP/metal)', () => {
      const unit = createMockUnit({
        identifier: 'tank',
        specs: {
          combat: { health: 1000, dps: 50 },
          economy: { buildCost: 500 },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'tank', quantity: 2 },
      ]

      const result = aggregateGroupStats(members, () => unit)

      expect(result).not.toBeNull()
      // Total HP: 2000, Total cost: 1000, Total DPS: 100
      expect(result!.totalHp).toBe(2000)
      expect(result!.totalBuildCost).toBe(1000)
      expect(result!.totalDps).toBe(100)
      // HP/metal = 2000/1000 = 2
      expect(result!.hpPerMetal).toBe(2)
      // DPS/metal = 100/1000 = 0.1
      expect(result!.dpsPerMetal).toBe(0.1)
    })

    it('should handle boolean aggregations (amphibious, hover)', () => {
      const hoverUnit = createMockUnit({
        identifier: 'hover',
        specs: {
          combat: { health: 100 },
          economy: { buildCost: 100 },
          special: { hover: true, amphibious: false },
        },
      })
      const amphUnit = createMockUnit({
        identifier: 'amph',
        specs: {
          combat: { health: 100 },
          economy: { buildCost: 100 },
          special: { hover: false, amphibious: true },
        },
      })
      const normalUnit = createMockUnit({
        identifier: 'normal',
        specs: {
          combat: { health: 100 },
          economy: { buildCost: 100 },
          special: { hover: false, amphibious: false },
        },
      })

      const members: GroupMember[] = [
        { factionId: 'MLA', unitId: 'hover', quantity: 1 },
        { factionId: 'MLA', unitId: 'amph', quantity: 1 },
        { factionId: 'MLA', unitId: 'normal', quantity: 1 },
      ]

      const getUnit = (factionId: string, unitId: string) => {
        if (unitId === 'hover') return hoverUnit
        if (unitId === 'amph') return amphUnit
        if (unitId === 'normal') return normalUnit
        return undefined
      }

      const result = aggregateGroupStats(members, getUnit)

      expect(result).not.toBeNull()
      expect(result!.anyHover).toBe(true)
      expect(result!.allHover).toBe(false)
      expect(result!.anyAmphibious).toBe(true)
      expect(result!.allAmphibious).toBe(false)
    })
  })

  describe('matchAggregatedWeapons', () => {
    describe('two-pass matching algorithm', () => {
      it('should match weapons with exact safeName first', () => {
        const weapons1 = [
          createMockAggregatedWeapon('uber_cannon', ['LandHorizontal']),
          createMockAggregatedWeapon('aa_gun', ['Air']),
        ]
        const weapons2 = [
          createMockAggregatedWeapon('aa_gun', ['Air']),
          createMockAggregatedWeapon('uber_cannon', ['LandHorizontal']),
        ]

        const result = matchAggregatedWeapons(weapons1, weapons2)

        // Should match by safeName regardless of order
        expect(result).toHaveLength(2)
        expect(result[0][0]?.safeName).toBe('uber_cannon')
        expect(result[0][1]?.safeName).toBe('uber_cannon')
        expect(result[1][0]?.safeName).toBe('aa_gun')
        expect(result[1][1]?.safeName).toBe('aa_gun')
      })

      it('should prioritize exact safeName over target layer match', () => {
        // This tests the bug that was fixed - tank_light_laser should match tank_light_laser,
        // not tank_armor which also targets LandHorizontal
        const weapons1 = [
          createMockAggregatedWeapon('tank_armor_tool_weapon', ['LandHorizontal']),
          createMockAggregatedWeapon('tank_light_laser_tool_weapon', ['LandHorizontal']),
        ]
        const weapons2 = [
          createMockAggregatedWeapon('tank_light_laser_tool_weapon', ['LandHorizontal']),
          createMockAggregatedWeapon('tank_armor_tool_weapon', ['LandHorizontal']),
        ]

        const result = matchAggregatedWeapons(weapons1, weapons2)

        // Exact safeName matches should be found
        expect(result).toHaveLength(2)

        const armorMatch = result.find(([w1]) => w1?.safeName === 'tank_armor_tool_weapon')
        expect(armorMatch![1]?.safeName).toBe('tank_armor_tool_weapon')

        const laserMatch = result.find(([w1]) => w1?.safeName === 'tank_light_laser_tool_weapon')
        expect(laserMatch![1]?.safeName).toBe('tank_light_laser_tool_weapon')
      })

      it('should fall back to target layer matching for non-matching safeNames', () => {
        const weapons1 = [
          createMockAggregatedWeapon('weapon_a', ['LandHorizontal', 'WaterSurface']),
        ]
        const weapons2 = [
          createMockAggregatedWeapon('weapon_b', ['LandHorizontal', 'WaterSurface']),
        ]

        const result = matchAggregatedWeapons(weapons1, weapons2)

        // Different names but same targets - should match by target layer
        expect(result).toHaveLength(1)
        expect(result[0][0]?.safeName).toBe('weapon_a')
        expect(result[0][1]?.safeName).toBe('weapon_b')
      })

      it('should not match weapons with no target layer overlap', () => {
        const weapons1 = [
          createMockAggregatedWeapon('land_weapon', ['LandHorizontal']),
        ]
        const weapons2 = [
          createMockAggregatedWeapon('air_weapon', ['Air']),
        ]

        const result = matchAggregatedWeapons(weapons1, weapons2)

        // No match possible
        expect(result).toHaveLength(2)
        expect(result[0][0]?.safeName).toBe('land_weapon')
        expect(result[0][1]).toBeUndefined()
        expect(result[1][0]).toBeUndefined()
        expect(result[1][1]?.safeName).toBe('air_weapon')
      })

      it('should handle mixed scenario with safeName and target layer matches', () => {
        // Primary: cannon (land), missile (air), torpedo (underwater)
        // Comparison: cannon (land), laser (land), depth_charge (underwater)
        const weapons1 = [
          createMockAggregatedWeapon('cannon', ['LandHorizontal']),
          createMockAggregatedWeapon('missile', ['Air']),
          createMockAggregatedWeapon('torpedo', ['Underwater']),
        ]
        const weapons2 = [
          createMockAggregatedWeapon('cannon', ['LandHorizontal']),
          createMockAggregatedWeapon('laser', ['LandHorizontal']),
          createMockAggregatedWeapon('depth_charge', ['Underwater']),
        ]

        const result = matchAggregatedWeapons(weapons1, weapons2)

        // cannon matches cannon (safeName)
        const cannonMatch = result.find(([w1]) => w1?.safeName === 'cannon')
        expect(cannonMatch![1]?.safeName).toBe('cannon')

        // torpedo matches depth_charge (target layer)
        const torpedoMatch = result.find(([w1]) => w1?.safeName === 'torpedo')
        expect(torpedoMatch![1]?.safeName).toBe('depth_charge')

        // missile has no match
        const missileMatch = result.find(([w1]) => w1?.safeName === 'missile')
        expect(missileMatch![1]).toBeUndefined()

        // laser is unmatched (cannon took land target)
        const laserUnmatched = result.find(([, w2]) => w2?.safeName === 'laser')
        expect(laserUnmatched![0]).toBeUndefined()
      })
    })

    it('should handle empty arrays', () => {
      expect(matchAggregatedWeapons([], [])).toHaveLength(0)

      const weapons = [createMockAggregatedWeapon('cannon', ['LandHorizontal'])]

      const resultEmpty1 = matchAggregatedWeapons([], weapons)
      expect(resultEmpty1).toHaveLength(1)
      expect(resultEmpty1[0][0]).toBeUndefined()
      expect(resultEmpty1[0][1]?.safeName).toBe('cannon')

      const resultEmpty2 = matchAggregatedWeapons(weapons, [])
      expect(resultEmpty2).toHaveLength(1)
      expect(resultEmpty2[0][0]?.safeName).toBe('cannon')
      expect(resultEmpty2[0][1]).toBeUndefined()
    })

    it('should not reuse matched weapons', () => {
      const weapons1 = [
        createMockAggregatedWeapon('gun_a', ['LandHorizontal']),
        createMockAggregatedWeapon('gun_b', ['LandHorizontal']),
      ]
      const weapons2 = [
        createMockAggregatedWeapon('gun_c', ['LandHorizontal']),
      ]

      const result = matchAggregatedWeapons(weapons1, weapons2)

      // gun_a gets the match, gun_b has no match
      expect(result[0][0]?.safeName).toBe('gun_a')
      expect(result[0][1]?.safeName).toBe('gun_c')
      expect(result[1][0]?.safeName).toBe('gun_b')
      expect(result[1][1]).toBeUndefined()
    })

    it('should prefer weapons with more target layer overlap', () => {
      const weapons1 = [
        createMockAggregatedWeapon('multi_weapon', ['LandHorizontal', 'WaterSurface', 'Air']),
      ]
      const weapons2 = [
        createMockAggregatedWeapon('land_only', ['LandHorizontal']),
        createMockAggregatedWeapon('land_water', ['LandHorizontal', 'WaterSurface']),
        createMockAggregatedWeapon('all_three', ['LandHorizontal', 'WaterSurface', 'Air']),
      ]

      const result = matchAggregatedWeapons(weapons1, weapons2)

      // Should match with all_three (most overlap)
      expect(result[0][1]?.safeName).toBe('all_three')
    })

    it('should include max range from aggregated weapons', () => {
      const weapons1 = [
        createMockAggregatedWeapon('cannon', ['LandHorizontal'], { maxRange: 100 }),
      ]
      const weapons2 = [
        createMockAggregatedWeapon('cannon', ['LandHorizontal'], { maxRange: 150 }),
      ]

      const result = matchAggregatedWeapons(weapons1, weapons2)

      expect(result[0][0]?.maxRange).toBe(100)
      expect(result[0][1]?.maxRange).toBe(150)
    })
  })

  describe('formatNumber', () => {
    it('should format integers without decimals', () => {
      expect(formatNumber(1000)).toBe('1,000')
      expect(formatNumber(1234567)).toBe('1,234,567')
    })

    it('should format decimals up to 2 places', () => {
      expect(formatNumber(1234.567)).toBe('1,234.57')
      expect(formatNumber(1234.5)).toBe('1,234.5')
      expect(formatNumber(0.123)).toBe('0.12')
    })

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0')
    })
  })

  describe('formatBooleanAggregation', () => {
    it('should return "Yes (all)" when all units have the property', () => {
      expect(formatBooleanAggregation(true, true)).toBe('Yes (all)')
    })

    it('should return "Some" when some units have the property', () => {
      expect(formatBooleanAggregation(true, false)).toBe('Some')
    })

    it('should return "None" when no units have the property', () => {
      expect(formatBooleanAggregation(false, false)).toBe('None')
    })
  })
})
