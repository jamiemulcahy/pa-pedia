import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { OverviewSection } from '../OverviewSection'
import { renderWithProviders } from '@/tests/helpers'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import type { Unit } from '@/types/faction'

const mockUnit: Unit = {
  id: 'tank',
  resourceName: '/pa/units/land/tank/tank.json',
  displayName: 'Tank',
  description: 'Basic tank unit',
  unitTypes: ['Mobile', 'Land', 'Basic'],
  tier: 1,
  accessible: true,
  specs: {
    combat: {
      health: 1000,
      dps: 50,
      weapons: [{
        resourceName: '/pa/units/land/tank/tank_tool_weapon.json',
        safeName: 'tank_tool_weapon',
        name: 'Tank Cannon',
        count: 1,
        rateOfFire: 1,
        damage: 50,
        maxRange: 100,
        dps: 50,
      }],
    },
    economy: {
      buildCost: 500,
    },
  },
}

const mockCompareUnit: Unit = {
  id: 'heavy_tank',
  resourceName: '/pa/units/land/heavy_tank/heavy_tank.json',
  displayName: 'Heavy Tank',
  description: 'Heavy tank unit',
  unitTypes: ['Mobile', 'Land', 'Advanced'],
  tier: 2,
  accessible: true,
  specs: {
    combat: {
      health: 2000,
      dps: 100,
      weapons: [{
        resourceName: '/pa/units/land/heavy_tank/heavy_tank_tool_weapon.json',
        safeName: 'heavy_tank_tool_weapon',
        name: 'Heavy Cannon',
        count: 1,
        rateOfFire: 1,
        damage: 100,
        maxRange: 150,
        dps: 100,
      }],
    },
    economy: {
      buildCost: 1500,
    },
  },
}

function renderOverviewSection(unit: Unit, compareUnit?: Unit) {
  return renderWithProviders(
    <CurrentFactionProvider factionId="MLA">
      <OverviewSection unit={unit} compareUnit={compareUnit} />
    </CurrentFactionProvider>
  )
}

describe('OverviewSection', () => {
  it('should render HP', () => {
    renderOverviewSection(mockUnit)

    expect(screen.getByText('HP:')).toBeInTheDocument()
    // HP value rendered - check the value is present
    expect(screen.getByText('1000')).toBeInTheDocument()
  })

  it('should render build cost', () => {
    renderOverviewSection(mockUnit)

    expect(screen.getByText('Build cost:')).toBeInTheDocument()
    expect(screen.getByText(/500/)).toBeInTheDocument()
    expect(screen.getByText(/metal/)).toBeInTheDocument()
  })

  it('should render maximum range', () => {
    renderOverviewSection(mockUnit)

    expect(screen.getByText('Maximum range:')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should render DPS', () => {
    renderOverviewSection(mockUnit)

    expect(screen.getByText('DPS:')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('should render View Blueprint link', () => {
    renderOverviewSection(mockUnit)

    expect(screen.getByText('View Blueprint')).toBeInTheDocument()
  })

  it('should show comparison values when compareUnit provided', () => {
    renderOverviewSection(mockUnit, mockCompareUnit)

    // HP: 1000 compared to 2000 = -1000
    // Build cost: 500 compared to 1500 = -1000 (lower is better, so green)
    // Both show (-1,000) so we check there are at least 2
    const diffElements = screen.getAllByText('(-1,000)')
    expect(diffElements.length).toBeGreaterThanOrEqual(2)
  })

  it('should not show comparison values when no compareUnit', () => {
    renderOverviewSection(mockUnit)

    // Should not have any diff indicators
    expect(screen.queryByText(/\([+-]/)).not.toBeInTheDocument()
  })

  it('should render Overview title', () => {
    renderOverviewSection(mockUnit)

    expect(screen.getByText('Overview')).toBeInTheDocument()
  })
})
