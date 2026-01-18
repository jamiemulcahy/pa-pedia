import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { WeaponSection } from '../WeaponSection'
import { renderWithProviders } from '@/tests/helpers'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import type { Weapon } from '@/types/faction'

const mockBasicWeapon: Weapon = {
  resourceName: '/pa/units/land/tank/tank_tool_weapon.json',
  safeName: 'tank_tool_weapon',
  name: 'Tank Cannon',
  count: 1,
  rateOfFire: 2,
  damage: 75,
  dps: 150,
  maxRange: 100,
}

// Weapon with ammo system and sustained DPS (pre-calculated by CLI)
const mockAmmoWeapon: Weapon = {
  resourceName: '/pa/units/land/bot_tesla/bot_tesla_tool_weapon.json',
  safeName: 'bot_tesla_tool_weapon',
  name: 'Tesla Weapon',
  count: 1,
  rateOfFire: 0.5,
  damage: 160,
  dps: 80, // Burst DPS (at full ROF)
  sustainedDps: 40, // Sustained DPS (limited by ammo recovery)
  maxRange: 67.5,
  ammoSource: 'energy',
  ammoDemand: 200,
  ammoPerShot: 400,
  ammoCapacity: 400,
  ammoShotsToDrain: 5,
  ammoDrainTime: 8.0,
  ammoRechargeTime: 2.0,
}

function renderWeaponSection(weapon: Weapon) {
  return renderWithProviders(
    <CurrentFactionProvider factionId="MLA">
      <WeaponSection weapon={weapon} />
    </CurrentFactionProvider>
  )
}

describe('WeaponSection', () => {
  describe('basic weapon display', () => {
    it('should render weapon title', () => {
      renderWeaponSection(mockBasicWeapon)

      // Weapon name is displayed (uses weapon.name when available, falls back to weapon ID)
      expect(screen.getByText('Tank Cannon')).toBeInTheDocument()
    })

    it('should render damage', () => {
      renderWeaponSection(mockBasicWeapon)

      expect(screen.getByText('Damage:')).toBeInTheDocument()
      expect(screen.getByText('75')).toBeInTheDocument()
    })

    it('should render rate of fire', () => {
      renderWeaponSection(mockBasicWeapon)

      expect(screen.getByText('Rate of Fire:')).toBeInTheDocument()
      // Number(2.0.toFixed(1)) converts "2.0" to number 2, rendered as "2"
      // Look for the span containing value+suffix
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '2/s' || false
      })).toBeInTheDocument()
    })

    it('should render DPS (Sustained)', () => {
      renderWeaponSection(mockBasicWeapon)

      // All weapons show "DPS (Sustained)" for consistency
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
      // Number(150.0.toFixed(1)) converts to 150, rendered as "150"
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '150' || false
      })).toBeInTheDocument()
    })

    it('should render range', () => {
      renderWeaponSection(mockBasicWeapon)

      expect(screen.getByText('Range:')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('should not render burst DPS label for weapons without ammo limits', () => {
      renderWeaponSection(mockBasicWeapon)

      // All weapons show "DPS (Sustained)" for consistency, but no burst row
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
      expect(screen.queryByText('DPS (Burst):')).not.toBeInTheDocument()
    })
  })

  describe('sustained DPS display', () => {
    it('should render DPS (Burst) and DPS (Sustained) for ammo-limited weapons', () => {
      renderWeaponSection(mockAmmoWeapon)

      // When sustainedDps differs from dps, show both labels
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '80' || false
      })).toBeInTheDocument()

      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '40' || false
      })).toBeInTheDocument()
    })

    it('should not show DPS (Burst) label when sustainedDps equals dps', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        sustainedDps: 150, // Same as dps
      }
      renderWeaponSection(weapon)

      // When sustainedDps equals dps, just show "DPS (Sustained)"
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
      expect(screen.queryByText('DPS (Burst):')).not.toBeInTheDocument()
    })

    it('should render ammo source for ammo-limited weapons', () => {
      renderWeaponSection(mockAmmoWeapon)

      expect(screen.getByText('Ammo source:')).toBeInTheDocument()
      expect(screen.getByText('energy')).toBeInTheDocument()
    })

    it('should render stored shots for ammo-limited weapons', () => {
      renderWeaponSection(mockAmmoWeapon)

      expect(screen.getByText('Stored shots:')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should render ammo drain time for ammo-limited weapons', () => {
      renderWeaponSection(mockAmmoWeapon)

      expect(screen.getByText('Ammo drain time:')).toBeInTheDocument()
      expect(screen.getByText('8.0s')).toBeInTheDocument()
    })

    it('should render ammo recharge time for ammo-limited weapons', () => {
      renderWeaponSection(mockAmmoWeapon)

      expect(screen.getByText('Ammo recharge time:')).toBeInTheDocument()
      expect(screen.getByText('2.0s')).toBeInTheDocument()
    })
  })

  describe('weapon count display', () => {
    it('should show "Weapon" title when count is 1', () => {
      renderWeaponSection(mockBasicWeapon)

      expect(screen.getByText('Weapon')).toBeInTheDocument()
    })

    it('should show "Weapon ×3" title when count is 3', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        count: 3,
      }
      renderWeaponSection(weapon)

      expect(screen.getByText('Weapon ×3')).toBeInTheDocument()
    })

    it('should show "Death Explosion" title for death explosion weapons', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        deathExplosion: true,
      }
      renderWeaponSection(weapon)

      expect(screen.getByText('Death Explosion')).toBeInTheDocument()
    })

    it('should show "Self-Destruct" title for self-destruct weapons', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        selfDestruct: true,
      }
      renderWeaponSection(weapon)

      expect(screen.getByText('Self-Destruct')).toBeInTheDocument()
    })

    it('should show "Death Explosion ×2" when death explosion has count > 1', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        deathExplosion: true,
        count: 2,
      }
      renderWeaponSection(weapon)

      expect(screen.getByText('Death Explosion ×2')).toBeInTheDocument()
    })

    it('should show "Self-Destruct ×2" when self-destruct has count > 1', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        selfDestruct: true,
        count: 2,
      }
      renderWeaponSection(weapon)

      expect(screen.getByText('Self-Destruct ×2')).toBeInTheDocument()
    })

    it('should multiply DPS by count', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        count: 3,
        dps: 40, // per-turret DPS
      }
      renderWeaponSection(weapon)

      // Total DPS = 40 * 3 = 120
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '120' || false
      })).toBeInTheDocument()
    })

    it('should multiply sustained DPS by count', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        count: 2,
        dps: 100, // Burst DPS per turret
        sustainedDps: 50, // Sustained DPS per turret
      }
      renderWeaponSection(weapon)

      // Total burst DPS = 100 * 2 = 200
      // Total sustained DPS = 50 * 2 = 100
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '200' || false
      })).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '100' || false
      })).toBeInTheDocument()
    })
  })

  describe('DPS comparison logic', () => {
    function renderWeaponSectionWithComparison(weapon: Weapon, compareWeapon: Weapon) {
      return renderWithProviders(
        <CurrentFactionProvider factionId="MLA">
          <WeaponSection weapon={weapon} compareWeapon={compareWeapon} />
        </CurrentFactionProvider>
      )
    }

    it('should compare sustained DPS against regular DPS for weapons with ammo limits', () => {
      // Weapon with burst/sustained DPS
      const burstWeapon: Weapon = {
        resourceName: '/pa/units/land/tank/burst_weapon.json',
        safeName: 'burst_weapon',
        name: 'Burst Weapon',
        count: 1,
        rateOfFire: 10,
        damage: 70,
        dps: 700, // Burst DPS
        sustainedDps: 106.1, // Sustained DPS (effective)
        maxRange: 67.5,
        ammoCapacity: 400,
      }

      // Weapon with only regular DPS (no ammo system)
      const regularWeapon: Weapon = {
        resourceName: '/pa/units/land/bot/regular_weapon.json',
        safeName: 'regular_weapon',
        name: 'Regular Weapon',
        count: 1,
        rateOfFire: 0.5,
        damage: 160,
        dps: 80, // Regular DPS
        maxRange: 67.5,
      }

      renderWeaponSectionWithComparison(burstWeapon, regularWeapon)

      // DPS (Burst) should NOT show comparison diff since compare weapon doesn't have burst DPS
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()

      // DPS (Sustained) should compare against regular weapon's DPS (80 vs 106.1)
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
    })

    it('should compare regular DPS against sustained DPS when comparing weapon has ammo limits', () => {
      // Weapon with only regular DPS
      const regularWeapon: Weapon = {
        resourceName: '/pa/units/land/bot/regular_weapon.json',
        safeName: 'regular_weapon',
        name: 'Regular Weapon',
        count: 1,
        rateOfFire: 0.5,
        damage: 160,
        dps: 80, // Regular DPS
        maxRange: 67.5,
      }

      // Compare weapon with burst/sustained DPS
      const burstWeapon: Weapon = {
        resourceName: '/pa/units/land/tank/burst_weapon.json',
        safeName: 'burst_weapon',
        name: 'Burst Weapon',
        count: 1,
        rateOfFire: 10,
        damage: 70,
        dps: 700, // Burst DPS
        sustainedDps: 106.1, // Sustained DPS (effective)
        maxRange: 67.5,
        ammoCapacity: 400,
      }

      renderWeaponSectionWithComparison(regularWeapon, burstWeapon)

      // Regular weapon's DPS (Sustained) should compare against burst weapon's sustained DPS (not burst)
      // 80 vs 106.1 = -26.1 difference
      // Two "DPS (Sustained)" labels - one for placeholder burst row context, one for the actual value
      expect(screen.getAllByText('DPS (Sustained):').length).toBeGreaterThanOrEqual(1)
    })

    it('should compare burst-to-burst when both weapons have sustained DPS', () => {
      const weapon1: Weapon = {
        resourceName: '/pa/units/land/tank1/weapon1.json',
        safeName: 'weapon1',
        name: 'Weapon 1',
        count: 1,
        rateOfFire: 10,
        damage: 70,
        dps: 700,
        sustainedDps: 100,
        maxRange: 67.5,
        ammoCapacity: 400,
      }

      const weapon2: Weapon = {
        resourceName: '/pa/units/land/tank2/weapon2.json',
        safeName: 'weapon2',
        name: 'Weapon 2',
        count: 1,
        rateOfFire: 8,
        damage: 80,
        dps: 640,
        sustainedDps: 90,
        maxRange: 67.5,
        ammoCapacity: 300,
      }

      renderWeaponSectionWithComparison(weapon1, weapon2)

      // Both weapons have burst DPS, so burst should compare to burst
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
    })

    it('should show placeholder DPS (Burst) row for alignment when compare weapon has burst', () => {
      // Regular weapon (no sustained DPS)
      const regularWeapon: Weapon = {
        resourceName: '/pa/units/land/bot/regular_weapon.json',
        safeName: 'regular_weapon',
        name: 'Regular Weapon',
        count: 1,
        rateOfFire: 0.5,
        damage: 160,
        dps: 80,
        maxRange: 67.5,
      }

      // Burst weapon (has sustained DPS)
      const burstWeapon: Weapon = {
        resourceName: '/pa/units/land/tank/burst_weapon.json',
        safeName: 'burst_weapon',
        name: 'Burst Weapon',
        count: 1,
        rateOfFire: 10,
        damage: 70,
        dps: 700,
        sustainedDps: 106.1,
        maxRange: 67.5,
        ammoCapacity: 400,
      }

      renderWeaponSectionWithComparison(regularWeapon, burstWeapon)

      // Should show placeholder DPS (Burst) row with em-dash for alignment
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()

      // Should show DPS (Sustained) row (aligned with DPS (Sustained) on compare weapon)
      expect(screen.getByText('DPS (Sustained):')).toBeInTheDocument()
    })
  })
})
