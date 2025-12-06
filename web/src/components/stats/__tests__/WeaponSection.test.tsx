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

const mockBurstWeapon: Weapon = {
  resourceName: '/pa/units/land/bot_tesla/bot_tesla_tool_weapon.json',
  safeName: 'bot_tesla_tool_weapon',
  name: 'Tesla Weapon',
  count: 1,
  rateOfFire: 0.5,
  damage: 160,
  dps: 80,
  maxRange: 67.5,
  ammoSource: 'energy',
  ammoDemand: 200,
  ammoPerShot: 400,
  ammoCapacity: 400,
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

      expect(screen.getByText('tank_tool_weapon.json')).toBeInTheDocument()
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

    it('should render DPS', () => {
      renderWeaponSection(mockBasicWeapon)

      expect(screen.getByText('DPS:')).toBeInTheDocument()
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

    it('should not render burst DPS for weapons without ammo system', () => {
      renderWeaponSection(mockBasicWeapon)

      expect(screen.queryByText('DPS (Burst):')).not.toBeInTheDocument()
    })
  })

  describe('burst DPS display', () => {
    it('should render burst DPS for weapons with ammo system', () => {
      renderWeaponSection(mockBurstWeapon)

      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      // Burst DPS = (ammoPerShot / ammoDemand) * damage = (400 / 200) * 160 = 320
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '320' || false
      })).toBeInTheDocument()
    })

    it('should calculate burst DPS correctly', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        ammoDemand: 100,
        ammoPerShot: 200,
        damage: 50,
        dps: 25,
      }
      renderWeaponSection(weapon)

      // Burst DPS = (200 / 100) * 50 = 100
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '100' || false
      })).toBeInTheDocument()
    })

    it('should not render burst DPS when equal to regular DPS', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        ammoDemand: 1,
        ammoPerShot: 1,
        damage: 50,
        dps: 50,
      }
      renderWeaponSection(weapon)

      // Burst DPS = (1 / 1) * 50 = 50, same as regular DPS
      expect(screen.queryByText('DPS (Burst):')).not.toBeInTheDocument()
    })

    it('should render ammo source for burst weapons', () => {
      renderWeaponSection(mockBurstWeapon)

      expect(screen.getByText('Ammo source:')).toBeInTheDocument()
      expect(screen.getByText('energy')).toBeInTheDocument()
    })

    it('should not render burst DPS when ammo fields are incomplete', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        ammoPerShot: 200,
        // ammoDemand missing
        damage: 50,
        dps: 50,
      }
      renderWeaponSection(weapon)

      expect(screen.queryByText('DPS (Burst):')).not.toBeInTheDocument()
    })

    it('should not render burst DPS when ammoDemand is zero', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        ammoPerShot: 200,
        ammoDemand: 0,
        damage: 50,
        dps: 50,
      }
      renderWeaponSection(weapon)

      expect(screen.queryByText('DPS (Burst):')).not.toBeInTheDocument()
    })

    it('should include projectilesPerFire in burst DPS calculation', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        ammoDemand: 100,
        ammoPerShot: 200,
        damage: 50,
        dps: 25,
        projectilesPerFire: 3,
      }
      renderWeaponSection(weapon)

      // Burst DPS = (200 / 100) * 50 * 3 = 300
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '300' || false
      })).toBeInTheDocument()
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

    it('should multiply burst DPS by count', () => {
      const weapon: Weapon = {
        ...mockBasicWeapon,
        count: 2,
        ammoDemand: 100,
        ammoPerShot: 200,
        damage: 50,
        dps: 25,
      }
      renderWeaponSection(weapon)

      // Burst DPS per turret = (200 / 100) * 50 = 100
      // Total burst DPS = 100 * 2 = 200
      expect(screen.getByText('DPS (Burst):')).toBeInTheDocument()
      expect(screen.getByText((_, element) => {
        return element?.tagName === 'SPAN' && element?.textContent === '200' || false
      })).toBeInTheDocument()
    })
  })
})
