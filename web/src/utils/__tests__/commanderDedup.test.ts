import { describe, it, expect } from 'vitest'
import {
  isCommander,
  computeCommanderStatsHash,
  groupCommanderVariants,
  getTotalCommanderCount,
  getHiddenVariantCount,
} from '../commanderDedup'
import type { UnitIndexEntry, Unit } from '@/types/faction'

// Helper to create a minimal Unit object
function createMockUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test-unit',
    resourceName: '/pa/units/commanders/test.json',
    displayName: 'Test Unit',
    tier: 1,
    unitTypes: ['Commander', 'Land', 'Mobile'],
    accessible: true,
    specs: {
      combat: {
        health: 12500,
        dps: 985,
        salvoDamage: 100,
        weapons: [],
      },
      economy: {
        buildCost: 0,
        buildRate: 90,
        metalRate: 20,
        energyRate: 2000,
      },
      mobility: {
        moveSpeed: 10,
        turnSpeed: 90,
        acceleration: 30,
        brake: 30,
      },
    },
    ...overrides,
  }
}

// Helper to create a minimal UnitIndexEntry
function createMockUnitEntry(
  identifier: string,
  displayName: string,
  unit: Partial<Unit> = {},
  unitTypes: string[] = ['Commander', 'Land', 'Mobile']
): UnitIndexEntry {
  return {
    identifier,
    displayName,
    unitTypes,
    source: 'base',
    files: [],
    unit: createMockUnit({ id: identifier, displayName, unitTypes, ...unit }),
  }
}

describe('commanderDedup', () => {
  describe('isCommander', () => {
    it('should return true for units with Commander type', () => {
      const commander = createMockUnitEntry('able', 'Able Commander')
      expect(isCommander(commander)).toBe(true)
    })

    it('should return false for non-commander units', () => {
      const tank = createMockUnitEntry('tank', 'Tank', {}, ['Tank', 'Land', 'Mobile'])
      expect(isCommander(tank)).toBe(false)
    })

    it('should return false for units with empty unit types', () => {
      const unknown = createMockUnitEntry('unknown', 'Unknown', {}, [])
      expect(isCommander(unknown)).toBe(false)
    })
  })

  describe('computeCommanderStatsHash', () => {
    it('should produce identical hashes for identical stats', () => {
      const unit1 = createMockUnit({ displayName: 'Able' })
      const unit2 = createMockUnit({ displayName: 'Ajax' })

      expect(computeCommanderStatsHash(unit1)).toBe(computeCommanderStatsHash(unit2))
    })

    it('should produce different hashes for different health', () => {
      const unit1 = createMockUnit({ specs: { ...createMockUnit().specs, combat: { ...createMockUnit().specs.combat, health: 12500 } } })
      const unit2 = createMockUnit({ specs: { ...createMockUnit().specs, combat: { ...createMockUnit().specs.combat, health: 15000 } } })

      expect(computeCommanderStatsHash(unit1)).not.toBe(computeCommanderStatsHash(unit2))
    })

    it('should produce different hashes for different DPS', () => {
      const unit1 = createMockUnit({ specs: { ...createMockUnit().specs, combat: { ...createMockUnit().specs.combat, dps: 985 } } })
      const unit2 = createMockUnit({ specs: { ...createMockUnit().specs, combat: { ...createMockUnit().specs.combat, dps: 1970 } } })

      expect(computeCommanderStatsHash(unit1)).not.toBe(computeCommanderStatsHash(unit2))
    })

    it('should produce different hashes for different build rates', () => {
      const unit1 = createMockUnit({ specs: { ...createMockUnit().specs, economy: { ...createMockUnit().specs.economy, buildRate: 90 } } })
      const unit2 = createMockUnit({ specs: { ...createMockUnit().specs, economy: { ...createMockUnit().specs.economy, buildRate: 120 } } })

      expect(computeCommanderStatsHash(unit1)).not.toBe(computeCommanderStatsHash(unit2))
    })

    it('should produce different hashes for different move speeds', () => {
      const unit1 = createMockUnit()
      const unit2 = createMockUnit({
        specs: {
          ...createMockUnit().specs,
          mobility: { ...createMockUnit().specs.mobility, moveSpeed: 15 },
        },
      })

      expect(computeCommanderStatsHash(unit1)).not.toBe(computeCommanderStatsHash(unit2))
    })

    it('should produce different hashes for hover vs non-hover', () => {
      const unit1 = createMockUnit()
      const unit2 = createMockUnit({
        specs: {
          ...createMockUnit().specs,
          special: { hover: true },
        },
      })

      expect(computeCommanderStatsHash(unit1)).not.toBe(computeCommanderStatsHash(unit2))
    })

    it('should produce different hashes when weapons differ', () => {
      const unit1 = createMockUnit()
      const unit2 = createMockUnit({
        specs: {
          ...createMockUnit().specs,
          combat: {
            ...createMockUnit().specs.combat,
            weapons: [
              {
                resourceName: '/weapon.json',
                safeName: 'laser',
                count: 1,
                rateOfFire: 2,
                damage: 100,
                dps: 200,
                maxRange: 100,
              },
            ],
          },
        },
      })

      expect(computeCommanderStatsHash(unit1)).not.toBe(computeCommanderStatsHash(unit2))
    })
  })

  describe('groupCommanderVariants', () => {
    it('should separate commanders from non-commanders', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander'),
        createMockUnitEntry('tank', 'Tank', {}, ['Tank', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander'),
      ]

      const result = groupCommanderVariants(units)

      expect(result.commanders.length).toBe(1) // 1 group with 2 identical commanders
      expect(result.nonCommanders.length).toBe(1)
      expect(result.nonCommanders[0].identifier).toBe('tank')
    })

    it('should group identical commanders together', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander'),
        createMockUnitEntry('ajax', 'Ajax Commander'),
        createMockUnitEntry('alpha', 'Alpha Commander'),
      ]

      const result = groupCommanderVariants(units)

      expect(result.commanders.length).toBe(1) // All 3 are identical
      expect(result.commanders[0].variants.length).toBe(2) // 2 variants besides representative
    })

    it('should pick alphabetically first as representative', () => {
      const units = [
        createMockUnitEntry('zeta', 'Zeta Commander'),
        createMockUnitEntry('able', 'Able Commander'),
        createMockUnitEntry('beta', 'Beta Commander'),
      ]

      const result = groupCommanderVariants(units)

      expect(result.commanders[0].representative.displayName).toBe('Able Commander')
    })

    it('should create separate groups for commanders with different stats', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander'),
        createMockUnitEntry('ajax', 'Ajax Commander'),
        createMockUnitEntry('hover', 'Hover Commander', {
          specs: {
            ...createMockUnit().specs,
            special: { hover: true },
          },
        }),
      ]

      const result = groupCommanderVariants(units)

      expect(result.commanders.length).toBe(2) // 2 groups: normal and hover
    })

    it('should handle single commander with no variants', () => {
      const units = [createMockUnitEntry('unique', 'Unique Commander')]

      const result = groupCommanderVariants(units)

      expect(result.commanders.length).toBe(1)
      expect(result.commanders[0].representative.displayName).toBe('Unique Commander')
      expect(result.commanders[0].variants.length).toBe(0)
    })

    it('should handle empty unit list', () => {
      const result = groupCommanderVariants([])

      expect(result.commanders.length).toBe(0)
      expect(result.nonCommanders.length).toBe(0)
    })

    it('should sort groups by representative display name', () => {
      const units = [
        createMockUnitEntry('zeta', 'Zeta Commander'),
        createMockUnitEntry('able', 'Able Commander', {
          specs: {
            ...createMockUnit().specs,
            special: { hover: true },
          },
        }),
      ]

      const result = groupCommanderVariants(units)

      expect(result.commanders[0].representative.displayName).toBe('Able Commander')
      expect(result.commanders[1].representative.displayName).toBe('Zeta Commander')
    })
  })

  describe('getTotalCommanderCount', () => {
    it('should count all commanders including variants', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander'),
        createMockUnitEntry('ajax', 'Ajax Commander'),
        createMockUnitEntry('alpha', 'Alpha Commander'),
      ]

      const result = groupCommanderVariants(units)
      const count = getTotalCommanderCount(result)

      expect(count).toBe(3) // 1 representative + 2 variants
    })

    it('should return 0 for empty result', () => {
      const result = groupCommanderVariants([])
      expect(getTotalCommanderCount(result)).toBe(0)
    })
  })

  describe('getHiddenVariantCount', () => {
    it('should count only variants (not representatives)', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander'),
        createMockUnitEntry('ajax', 'Ajax Commander'),
        createMockUnitEntry('alpha', 'Alpha Commander'),
      ]

      const result = groupCommanderVariants(units)
      const hidden = getHiddenVariantCount(result)

      expect(hidden).toBe(2) // 2 hidden, 1 shown as representative
    })

    it('should return 0 when no variants', () => {
      const units = [
        createMockUnitEntry('unique1', 'Unique 1', {
          specs: { ...createMockUnit().specs, special: { hover: true } },
        }),
        createMockUnitEntry('unique2', 'Unique 2'),
      ]

      const result = groupCommanderVariants(units)
      const hidden = getHiddenVariantCount(result)

      expect(hidden).toBe(0) // Each is unique, no variants
    })
  })
})
