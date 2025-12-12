import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { AmmoSection } from '../AmmoSection'
import { renderWithProviders } from '@/tests/helpers'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import type { Ammo } from '@/types/faction'

const mockAmmo: Ammo = {
  resourceName: '/pa/ammo/test_ammo/test_ammo.json',
  safeName: 'test_ammo',
  damage: 100,
  splashDamage: 20,
  splashRadius: 5,
  muzzleVelocity: 150.5,
  maxVelocity: 200.3,
}

const mockCompareAmmo: Ammo = {
  resourceName: '/pa/ammo/compare_ammo/compare_ammo.json',
  safeName: 'compare_ammo',
  damage: 80,
  splashDamage: 25,
  splashRadius: 5,
  muzzleVelocity: 120.5,
  maxVelocity: 200.3,
}

function renderAmmoSection(props: React.ComponentProps<typeof AmmoSection>) {
  return renderWithProviders(
    <CurrentFactionProvider factionId="MLA">
      <AmmoSection {...props} />
    </CurrentFactionProvider>
  )
}

describe('AmmoSection', () => {
  it('should render damage', () => {
    renderAmmoSection({ ammo: mockAmmo })

    expect(screen.getByText('Damage:')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should render splash damage separately from radius', () => {
    renderAmmoSection({ ammo: mockAmmo })

    expect(screen.getByText('Splash damage:')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('Splash radius:')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should render full damage radius when present', () => {
    const ammoWithFullDamageRadius: Ammo = {
      ...mockAmmo,
      fullDamageRadius: 10,
    }
    renderAmmoSection({ ammo: ammoWithFullDamageRadius })

    expect(screen.getByText('Full damage radius:')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('should use base damage as splash damage for falloff weapons', () => {
    // Falloff weapons have splashRadius but no splashDamage
    const falloffAmmo: Ammo = {
      resourceName: '/pa/ammo/nuke/nuke.json',
      safeName: 'nuke',
      damage: 3000,
      splashRadius: 130,
      fullDamageRadius: 30,
    }
    renderAmmoSection({ ammo: falloffAmmo })

    expect(screen.getByText('Damage:')).toBeInTheDocument()
    expect(screen.getByText('Splash damage:')).toBeInTheDocument()
    // Splash damage should equal base damage (3000) for falloff weapons
    expect(screen.getAllByText('3000')).toHaveLength(2) // Once for damage, once for splash
    expect(screen.getByText('Splash radius:')).toBeInTheDocument()
    expect(screen.getByText('130')).toBeInTheDocument()
    expect(screen.getByText('Full damage radius:')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('should compare falloff weapons correctly', () => {
    const falloffAmmo1: Ammo = {
      resourceName: '/pa/ammo/nuke1/nuke1.json',
      safeName: 'nuke1',
      damage: 3000,
      splashRadius: 130,
    }
    const falloffAmmo2: Ammo = {
      resourceName: '/pa/ammo/nuke2/nuke2.json',
      safeName: 'nuke2',
      damage: 2500,
      splashRadius: 130,
    }
    renderAmmoSection({
      ammo: falloffAmmo1,
      compareAmmo: falloffAmmo2,
    })

    // Both damage and splash damage show +500 diff (splash derives from base damage)
    expect(screen.getAllByText('(+500)')).toHaveLength(2)
  })

  it('should not show splash damage when splashRadius is 0', () => {
    const noSplashAmmo: Ammo = {
      resourceName: '/pa/ammo/bullet/bullet.json',
      safeName: 'bullet',
      damage: 50,
      splashRadius: 0,
    }
    renderAmmoSection({ ammo: noSplashAmmo })

    expect(screen.getByText('Damage:')).toBeInTheDocument()
    expect(screen.queryByText('Splash damage:')).not.toBeInTheDocument()
    expect(screen.queryByText('Splash radius:')).not.toBeInTheDocument()
  })

  it('should render muzzle velocity', () => {
    renderAmmoSection({ ammo: mockAmmo })

    expect(screen.getByText('Muzzle velocity:')).toBeInTheDocument()
    expect(screen.getByText('150.5')).toBeInTheDocument()
  })

  it('should render max velocity', () => {
    renderAmmoSection({ ammo: mockAmmo })

    expect(screen.getByText('Max velocity:')).toBeInTheDocument()
    expect(screen.getByText('200.3')).toBeInTheDocument()
  })

  it('should render Ammo title', () => {
    renderAmmoSection({ ammo: mockAmmo })

    expect(screen.getByText('Ammo')).toBeInTheDocument()
  })

  it('should show comparison values when compareAmmo provided', () => {
    renderAmmoSection({ ammo: mockAmmo, compareAmmo: mockCompareAmmo })

    // Damage: 100 vs 80 = +20
    expect(screen.getByText('(+20)')).toBeInTheDocument()

    // Muzzle velocity: 150.5 vs 120.5 = +30
    expect(screen.getByText('(+30)')).toBeInTheDocument()
  })

  it('should not show comparison values when no compareAmmo', () => {
    renderAmmoSection({ ammo: mockAmmo })

    expect(screen.queryByText(/\([+-]/)).not.toBeInTheDocument()
  })

  describe('showDifferencesOnly', () => {
    it('should show only rows with differences when enabled', () => {
      renderAmmoSection({
        ammo: mockAmmo,
        compareAmmo: mockCompareAmmo,
        showDifferencesOnly: true,
      })

      // Damage and muzzle velocity have differences, should be shown
      expect(screen.getByText('Damage:')).toBeInTheDocument()
      expect(screen.getByText('Muzzle velocity:')).toBeInTheDocument()

      // Max velocity is equal (200.3 vs 200.3), should be hidden
      expect(screen.queryByText('Max velocity:')).not.toBeInTheDocument()

      // Splash damage differs (20 vs 25), should show
      expect(screen.getByText('Splash damage:')).toBeInTheDocument()

      // Splash radius is equal (5 vs 5), should be hidden
      expect(screen.queryByText('Splash radius:')).not.toBeInTheDocument()
    })

    it('should return null when all values are equal and showDifferencesOnly is enabled', () => {
      const equalAmmo: Ammo = {
        resourceName: '/pa/ammo/equal/equal.json',
        safeName: 'equal',
        damage: 100,
        muzzleVelocity: 150,
      }
      const { container } = renderAmmoSection({
        ammo: equalAmmo,
        compareAmmo: equalAmmo,
        showDifferencesOnly: true,
      })

      expect(container.querySelector('.space-y-4')).toBeNull()
    })

    it('should show all rows when showDifferencesOnly is false', () => {
      renderAmmoSection({
        ammo: mockAmmo,
        compareAmmo: mockCompareAmmo,
        showDifferencesOnly: false,
      })

      expect(screen.getByText('Damage:')).toBeInTheDocument()
      expect(screen.getByText('Muzzle velocity:')).toBeInTheDocument()
      expect(screen.getByText('Max velocity:')).toBeInTheDocument()
    })

    it('should show all rows when no compareAmmo even with showDifferencesOnly', () => {
      renderAmmoSection({
        ammo: mockAmmo,
        showDifferencesOnly: true,
      })

      expect(screen.getByText('Damage:')).toBeInTheDocument()
      expect(screen.getByText('Muzzle velocity:')).toBeInTheDocument()
      expect(screen.getByText('Max velocity:')).toBeInTheDocument()
    })
  })

  describe('hideDiff', () => {
    it('should hide diff indicators when hideDiff is true', () => {
      renderAmmoSection({
        ammo: mockAmmo,
        compareAmmo: mockCompareAmmo,
        hideDiff: true,
      })

      // Values should show but no diff indicators
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.queryByText('(+20)')).not.toBeInTheDocument()
      expect(screen.queryByText('(+30)')).not.toBeInTheDocument()
    })

    it('should show diff indicators when hideDiff is false', () => {
      renderAmmoSection({
        ammo: mockAmmo,
        compareAmmo: mockCompareAmmo,
        hideDiff: false,
      })

      expect(screen.getByText('(+20)')).toBeInTheDocument()
      expect(screen.getByText('(+30)')).toBeInTheDocument()
    })
  })
})
