import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TargetPrioritiesSection } from '../TargetPrioritiesSection'
import type { Weapon } from '@/types/faction'

const mockWeapons: Weapon[] = [
  {
    resourceName: '/pa/units/land/tank/tank_tool_weapon.json',
    safeName: 'tank_tool_weapon',
    count: 1,
    rateOfFire: 1,
    damage: 100,
    dps: 100,
    targetLayers: ['Land', 'Naval'],
  },
]

const mockWeaponsMultiple: Weapon[] = [
  {
    resourceName: '/pa/units/land/tank/tank_tool_weapon.json',
    safeName: 'tank_tool_weapon',
    count: 1,
    rateOfFire: 1,
    damage: 100,
    dps: 100,
    targetLayers: ['Land', 'Naval'],
  },
  {
    resourceName: '/pa/units/land/tank/tank_aa_weapon.json',
    safeName: 'tank_aa_weapon',
    count: 1,
    rateOfFire: 2,
    damage: 50,
    dps: 100,
    targetLayers: ['Air'],
  },
]

const mockCompareWeapons: Weapon[] = [
  {
    resourceName: '/pa/units/land/bot/bot_tool_weapon.json',
    safeName: 'bot_tool_weapon',
    count: 1,
    rateOfFire: 1.5,
    damage: 80,
    dps: 120,
    targetLayers: ['Land', 'Orbital'],
  },
]

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('TargetPrioritiesSection', () => {
  it('should render target priorities', () => {
    renderWithRouter(<TargetPrioritiesSection weapons={mockWeapons} />)

    expect(screen.getByText('Target Priorities')).toBeInTheDocument()
    expect(screen.getByText('Land')).toBeInTheDocument()
    expect(screen.getByText('Naval')).toBeInTheDocument()
  })

  it('should combine targets from multiple weapons', () => {
    renderWithRouter(<TargetPrioritiesSection weapons={mockWeaponsMultiple} />)

    expect(screen.getByText('Air')).toBeInTheDocument()
    expect(screen.getByText('Land')).toBeInTheDocument()
    expect(screen.getByText('Naval')).toBeInTheDocument()
  })

  it('should return null when no weapons provided', () => {
    const { container } = renderWithRouter(
      <TargetPrioritiesSection weapons={undefined} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should return null when weapons have no target layers', () => {
    const weaponsNoTargets: Weapon[] = [
      { resourceName: '/pa/test.json', safeName: 'test', count: 1, rateOfFire: 1, damage: 0, dps: 0 },
    ]
    const { container } = renderWithRouter(
      <TargetPrioritiesSection weapons={weaponsNoTargets} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should sort targets alphabetically', () => {
    renderWithRouter(<TargetPrioritiesSection weapons={mockWeaponsMultiple} />)

    const targets = screen.getAllByText(/Air|Land|Naval/)
    expect(targets[0]).toHaveTextContent('Air')
    expect(targets[1]).toHaveTextContent('Land')
    expect(targets[2]).toHaveTextContent('Naval')
  })

  describe('showDifferencesOnly', () => {
    it('should show section when targets differ', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Target Priorities')).toBeInTheDocument()
    })

    it('should return null when targets are identical and showDifferencesOnly is enabled', () => {
      const { container } = renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockWeapons}
          showDifferencesOnly={true}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show all targets when showDifferencesOnly is false', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockWeapons}
          showDifferencesOnly={false}
        />
      )

      expect(screen.getByText('Target Priorities')).toBeInTheDocument()
    })

    it('should show all targets when no compareWeapons even with showDifferencesOnly', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Target Priorities')).toBeInTheDocument()
    })
  })

  describe('isComparisonSide', () => {
    it('should show + indicator for targets only in comparison unit', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          isComparisonSide={true}
        />
      )

      // Naval is only in this (comparison) unit, should show +
      expect(screen.getByText('+')).toBeInTheDocument()
    })

    it('should show - indicator for targets only in primary unit', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          isComparisonSide={true}
        />
      )

      // Orbital is only in compare (primary) unit, should show -
      expect(screen.getByText('−')).toBeInTheDocument()
    })

    it('should show merged list with all targets on comparison side', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          isComparisonSide={true}
        />
      )

      // Should show all targets from both
      expect(screen.getByText('Land')).toBeInTheDocument()
      expect(screen.getByText('Naval')).toBeInTheDocument()
      expect(screen.getByText('Orbital')).toBeInTheDocument()
    })

    it('should not show indicators on primary side', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          isComparisonSide={false}
        />
      )

      expect(screen.queryByText('+')).not.toBeInTheDocument()
      expect(screen.queryByText('−')).not.toBeInTheDocument()
    })

    it('should apply green styling to added targets', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          isComparisonSide={true}
        />
      )

      // Naval is added (only in this unit)
      const navalElement = screen.getByText('Naval').closest('p')
      expect(navalElement).toHaveClass('text-green-600')
    })

    it('should apply red styling to removed targets', () => {
      renderWithRouter(
        <TargetPrioritiesSection
          weapons={mockWeapons}
          compareWeapons={mockCompareWeapons}
          isComparisonSide={true}
        />
      )

      // Orbital is removed (only in primary unit)
      const orbitalElement = screen.getByText('Orbital').closest('p')
      expect(orbitalElement).toHaveClass('text-red-600')
    })
  })
})
