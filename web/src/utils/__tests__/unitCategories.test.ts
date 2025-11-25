import { describe, it, expect } from 'vitest'
import {
  getUnitCategory,
  groupUnitsByCategory,
  CATEGORY_ORDER,
  type UnitCategory,
} from '../unitCategories'

describe('unitCategories', () => {
  describe('getUnitCategory', () => {
    it('should categorize commanders', () => {
      expect(getUnitCategory(['Commander', 'Land', 'Mobile'])).toBe('Commanders')
    })

    it('should categorize titans', () => {
      expect(getUnitCategory(['Titan', 'Land', 'Bot'])).toBe('Titans')
      expect(getUnitCategory(['Titan', 'Air', 'Bomber'])).toBe('Titans')
      expect(getUnitCategory(['Titan', 'Orbital'])).toBe('Titans')
    })

    it('should categorize titan structures as titans (not structures)', () => {
      expect(getUnitCategory(['Titan', 'Structure', 'Land'])).toBe('Titans')
    })

    it('should categorize factories', () => {
      expect(getUnitCategory(['Structure', 'Factory', 'Land'])).toBe('Factories')
      expect(getUnitCategory(['Structure', 'Factory', 'Bot'])).toBe('Factories')
    })

    it('should categorize defenses', () => {
      expect(getUnitCategory(['Structure', 'Defense', 'Land'])).toBe('Defenses')
      expect(getUnitCategory(['Structure', 'Defense', 'AirDefense'])).toBe('Defenses')
    })

    it('should categorize factories over defenses when both present', () => {
      // Anti-Nuke Launcher has both Factory and Defense tags
      expect(getUnitCategory(['Structure', 'Factory', 'Defense'])).toBe('Factories')
    })

    it('should categorize other structures', () => {
      expect(getUnitCategory(['Structure', 'Economy'])).toBe('Structures')
      expect(getUnitCategory(['Structure', 'Radar'])).toBe('Structures')
    })

    it('should categorize bots', () => {
      expect(getUnitCategory(['Bot', 'Land', 'Mobile'])).toBe('Bots')
    })

    it('should categorize tanks', () => {
      expect(getUnitCategory(['Tank', 'Land', 'Mobile'])).toBe('Tanks')
    })

    it('should categorize land units without bot/tank as vehicles', () => {
      expect(getUnitCategory(['Land', 'Mobile'])).toBe('Vehicles')
    })

    it('should categorize air units', () => {
      expect(getUnitCategory(['Air', 'Mobile', 'Fighter'])).toBe('Air')
    })

    it('should categorize naval units', () => {
      expect(getUnitCategory(['Naval', 'Mobile', 'Sub'])).toBe('Naval')
    })

    it('should categorize orbital units', () => {
      expect(getUnitCategory(['Orbital', 'Mobile', 'Recon'])).toBe('Orbital')
    })

    it('should return Other for unknown types', () => {
      expect(getUnitCategory(['Custom58'])).toBe('Other')
      expect(getUnitCategory([])).toBe('Other')
    })

    it('should use priority order correctly', () => {
      // Commander takes precedence over everything
      expect(getUnitCategory(['Structure', 'Commander', 'Land'])).toBe('Commanders')
      expect(getUnitCategory(['Titan', 'Commander'])).toBe('Commanders')

      // Titan takes precedence over Structure, Bot, Tank
      expect(getUnitCategory(['Structure', 'Titan'])).toBe('Titans')
      expect(getUnitCategory(['Bot', 'Titan', 'Land'])).toBe('Titans')
      expect(getUnitCategory(['Tank', 'Titan', 'Land'])).toBe('Titans')

      // Structure subcategories take precedence over Bot, Tank
      expect(getUnitCategory(['Bot', 'Structure', 'Factory'])).toBe('Factories')
      expect(getUnitCategory(['Tank', 'Structure'])).toBe('Structures')

      // Bot takes precedence over Tank (if both present)
      expect(getUnitCategory(['Tank', 'Bot', 'Land'])).toBe('Bots')

      // Tank takes precedence over generic Land
      expect(getUnitCategory(['Land', 'Tank'])).toBe('Tanks')
    })
  })

  describe('groupUnitsByCategory', () => {
    const mockUnits = [
      { id: '1', unitTypes: ['Commander', 'Land'] },
      { id: '2', unitTypes: ['Titan', 'Land', 'Bot'] },
      { id: '3', unitTypes: ['Structure', 'Factory'] },
      { id: '4', unitTypes: ['Structure', 'Defense'] },
      { id: '5', unitTypes: ['Structure', 'Economy'] },
      { id: '6', unitTypes: ['Bot', 'Land', 'Mobile'] },
      { id: '7', unitTypes: ['Tank', 'Land', 'Mobile'] },
      { id: '8', unitTypes: ['Land', 'Mobile'] },
      { id: '9', unitTypes: ['Air', 'Fighter'] },
      { id: '10', unitTypes: ['Naval', 'Sub'] },
      { id: '11', unitTypes: ['Orbital', 'Recon'] },
      { id: '12', unitTypes: ['Custom58'] },
    ]

    it('should group units by category', () => {
      const groups = groupUnitsByCategory(mockUnits)

      expect(groups.get('Commanders')?.length).toBe(1)
      expect(groups.get('Titans')?.length).toBe(1)
      expect(groups.get('Factories')?.length).toBe(1)
      expect(groups.get('Defenses')?.length).toBe(1)
      expect(groups.get('Structures')?.length).toBe(1)
      expect(groups.get('Bots')?.length).toBe(1)
      expect(groups.get('Tanks')?.length).toBe(1)
      expect(groups.get('Vehicles')?.length).toBe(1)
      expect(groups.get('Air')?.length).toBe(1)
      expect(groups.get('Naval')?.length).toBe(1)
      expect(groups.get('Orbital')?.length).toBe(1)
      expect(groups.get('Other')?.length).toBe(1)
    })

    it('should preserve unit references', () => {
      const groups = groupUnitsByCategory(mockUnits)

      expect(groups.get('Commanders')?.[0]).toBe(mockUnits[0])
      expect(groups.get('Titans')?.[0]).toBe(mockUnits[1])
      expect(groups.get('Factories')?.[0]).toBe(mockUnits[2])
    })

    it('should include empty categories', () => {
      const emptyUnits: typeof mockUnits = []
      const groups = groupUnitsByCategory(emptyUnits)

      for (const category of CATEGORY_ORDER) {
        expect(groups.has(category)).toBe(true)
        expect(groups.get(category)).toEqual([])
      }
    })

    it('should maintain category order in map iteration', () => {
      const groups = groupUnitsByCategory(mockUnits)
      const keys = Array.from(groups.keys())

      expect(keys).toEqual(CATEGORY_ORDER)
    })
  })

  describe('CATEGORY_ORDER', () => {
    it('should contain all categories in display order', () => {
      const expectedCategories: UnitCategory[] = [
        'Factories',
        'Defenses',
        'Structures',
        'Bots',
        'Tanks',
        'Vehicles',
        'Air',
        'Naval',
        'Orbital',
        'Titans',
        'Commanders',
        'Other',
      ]
      expect(CATEGORY_ORDER).toEqual(expectedCategories)
    })
  })
})
