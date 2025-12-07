import { describe, it, expect } from 'vitest'
import { matchWeaponsByTargetLayers } from '../weaponMatching'
import type { Weapon } from '@/types/faction'

// Helper to create a minimal Weapon for testing
function createMockWeapon(
  resourceName: string,
  targetLayers?: string[]
): Weapon {
  return {
    resourceName,
    safeName: resourceName.split('/').pop() || resourceName,
    count: 1,
    rateOfFire: 1,
    damage: 100,
    dps: 100,
    targetLayers,
  }
}

describe('weaponMatching', () => {
  describe('matchWeaponsByTargetLayers', () => {
    it('should match weapons with identical target layers', () => {
      const weapons1 = [
        createMockWeapon('weapon_a', ['LandHorizontal', 'WaterSurface']),
      ]
      const weapons2 = [
        createMockWeapon('weapon_b', ['LandHorizontal', 'WaterSurface']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      expect(result).toHaveLength(1)
      expect(result[0][0]?.resourceName).toBe('weapon_a')
      expect(result[0][1]?.resourceName).toBe('weapon_b')
    })

    it('should match weapons with overlapping target layers', () => {
      const weapons1 = [
        createMockWeapon('land_weapon', ['LandHorizontal']),
      ]
      const weapons2 = [
        createMockWeapon('multi_weapon', ['LandHorizontal', 'WaterSurface']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      expect(result).toHaveLength(1)
      expect(result[0][0]?.resourceName).toBe('land_weapon')
      expect(result[0][1]?.resourceName).toBe('multi_weapon')
    })

    it('should not match weapons with no overlapping layers', () => {
      const weapons1 = [
        createMockWeapon('land_weapon', ['LandHorizontal']),
      ]
      const weapons2 = [
        createMockWeapon('air_weapon', ['Air']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      expect(result).toHaveLength(2)
      // First weapon has no match
      expect(result[0][0]?.resourceName).toBe('land_weapon')
      expect(result[0][1]).toBeUndefined()
      // Second weapon is unmatched from list 2
      expect(result[1][0]).toBeUndefined()
      expect(result[1][1]?.resourceName).toBe('air_weapon')
    })

    it('should match the Narwhal vs Talos scenario correctly', () => {
      // Narwhal: 1 AA weapon, 1 surface weapon (shell), 1 torpedo
      const narwhalWeapons = [
        createMockWeapon('frigate_tool_weapon_shell', ['LandHorizontal', 'WaterSurface']),
        createMockWeapon('frigate_tool_weapon_aa', ['Air']),
        createMockWeapon('frigate_tool_weapon_torpedo', ['Underwater']),
      ]

      // Talos: 3x AA weapons (same weapon, count 3)
      const talosWeapons = [
        createMockWeapon('l_frigate_tool_weapon_aa', ['Air']),
        createMockWeapon('l_frigate_tool_weapon_aa_2', ['Air']),
        createMockWeapon('l_frigate_tool_weapon_aa_3', ['Air']),
      ]

      const result = matchWeaponsByTargetLayers(narwhalWeapons, talosWeapons)

      // The AA weapon should match an AA weapon, not the shell
      const aaMatch = result.find(([w1]) => w1?.resourceName === 'frigate_tool_weapon_aa')
      expect(aaMatch).toBeDefined()
      expect(aaMatch![1]?.targetLayers).toContain('Air')

      // The shell weapon should have no match (no Talos weapon targets land/water)
      const shellMatch = result.find(([w1]) => w1?.resourceName === 'frigate_tool_weapon_shell')
      expect(shellMatch).toBeDefined()
      expect(shellMatch![1]).toBeUndefined()

      // The torpedo should have no match
      const torpedoMatch = result.find(([w1]) => w1?.resourceName === 'frigate_tool_weapon_torpedo')
      expect(torpedoMatch).toBeDefined()
      expect(torpedoMatch![1]).toBeUndefined()
    })

    it('should prefer weapons with more overlapping layers', () => {
      const weapons1 = [
        createMockWeapon('multi_target', ['LandHorizontal', 'WaterSurface', 'Air']),
      ]
      const weapons2 = [
        createMockWeapon('land_only', ['LandHorizontal']),
        createMockWeapon('land_water', ['LandHorizontal', 'WaterSurface']),
        createMockWeapon('all_three', ['LandHorizontal', 'WaterSurface', 'Air']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      // Should match with the weapon that has most overlap (all_three)
      expect(result[0][1]?.resourceName).toBe('all_three')
    })

    it('should handle empty weapons arrays', () => {
      const weapons1: Weapon[] = []
      const weapons2 = [createMockWeapon('weapon_a', ['LandHorizontal'])]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      // Unmatched weapon from list 2 should appear
      expect(result).toHaveLength(1)
      expect(result[0][0]).toBeUndefined()
      expect(result[0][1]?.resourceName).toBe('weapon_a')
    })

    it('should handle weapons with undefined target layers', () => {
      const weapons1 = [createMockWeapon('no_layers_1', undefined)]
      const weapons2 = [createMockWeapon('no_layers_2', undefined)]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      // No overlap possible when layers are undefined
      expect(result).toHaveLength(2)
      expect(result[0][0]?.resourceName).toBe('no_layers_1')
      expect(result[0][1]).toBeUndefined()
    })

    it('should handle weapons with empty target layers array', () => {
      const weapons1 = [createMockWeapon('empty_layers_1', [])]
      const weapons2 = [createMockWeapon('empty_layers_2', [])]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      // No overlap possible when layers are empty
      expect(result).toHaveLength(2)
      expect(result[0][0]?.resourceName).toBe('empty_layers_1')
      expect(result[0][1]).toBeUndefined()
    })

    it('should not reuse matched weapons', () => {
      const weapons1 = [
        createMockWeapon('land_1', ['LandHorizontal']),
        createMockWeapon('land_2', ['LandHorizontal']),
      ]
      const weapons2 = [
        createMockWeapon('land_target', ['LandHorizontal']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      // First weapon gets the match
      expect(result[0][0]?.resourceName).toBe('land_1')
      expect(result[0][1]?.resourceName).toBe('land_target')

      // Second weapon has no match (land_target already used)
      expect(result[1][0]?.resourceName).toBe('land_2')
      expect(result[1][1]).toBeUndefined()
    })

    it('should include unmatched weapons from second list', () => {
      const weapons1 = [
        createMockWeapon('air_weapon', ['Air']),
      ]
      const weapons2 = [
        createMockWeapon('air_target', ['Air']),
        createMockWeapon('land_target', ['LandHorizontal']),
        createMockWeapon('water_target', ['WaterSurface']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      expect(result).toHaveLength(3)
      // First: air matches air
      expect(result[0][0]?.resourceName).toBe('air_weapon')
      expect(result[0][1]?.resourceName).toBe('air_target')
      // Remaining unmatched from list 2
      const unmatchedNames = result
        .filter(([w1]) => w1 === undefined)
        .map(([, w2]) => w2?.resourceName)
      expect(unmatchedNames).toContain('land_target')
      expect(unmatchedNames).toContain('water_target')
    })

    it('should handle mixed scenario with some matches and some not', () => {
      const weapons1 = [
        createMockWeapon('land_weapon', ['LandHorizontal']),
        createMockWeapon('air_weapon', ['Air']),
        createMockWeapon('orbital_weapon', ['Orbital']),
      ]
      const weapons2 = [
        createMockWeapon('land_target', ['LandHorizontal', 'WaterSurface']),
        createMockWeapon('underwater_target', ['Underwater']),
      ]

      const result = matchWeaponsByTargetLayers(weapons1, weapons2)

      // Land matches land
      const landMatch = result.find(([w1]) => w1?.resourceName === 'land_weapon')
      expect(landMatch![1]?.resourceName).toBe('land_target')

      // Air has no match
      const airMatch = result.find(([w1]) => w1?.resourceName === 'air_weapon')
      expect(airMatch![1]).toBeUndefined()

      // Orbital has no match
      const orbitalMatch = result.find(([w1]) => w1?.resourceName === 'orbital_weapon')
      expect(orbitalMatch![1]).toBeUndefined()

      // Underwater is unmatched from list 2
      const underwaterMatch = result.find(([, w2]) => w2?.resourceName === 'underwater_target')
      expect(underwaterMatch![0]).toBeUndefined()
    })
  })
})
