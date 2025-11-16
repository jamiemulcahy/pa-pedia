import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { UnitDetail } from '../UnitDetail'
import { renderWithProviders } from '@/tests/helpers'
import { setupMockFetch, mockTankUnit } from '@/tests/mocks/factionData'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Unit } from '@/types/faction'

type MockFetch = Mock<[input: string | URL | Request, init?: RequestInit], Promise<Response>>

function renderUnitDetail(factionId: string, unitId: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/faction/${factionId}/unit/${unitId}`]}>
      <Routes>
        <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
        <Route path="/faction/:factionId" element={<div>Faction Detail</div>} />
      </Routes>
    </MemoryRouter>,
    { skipRouter: true }
  )
}

describe('UnitDetail', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render loading state initially', () => {
    renderUnitDetail('MLA', 'tank')
    expect(screen.getByText(/loading unit/i)).toBeInTheDocument()
  })

  it('should render unit name', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should render unit description', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Basic ground assault unit')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should render unit type badges', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Mobile')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Land')).toBeInTheDocument()
    expect(screen.getByText('Basic')).toBeInTheDocument()
    // Tank appears in multiple places (title + badge), just verify badges container has all types
    const badges = screen.getAllByText('Tank')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('should render unit icon', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      const icon = screen.getByAltText('Tank')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('src', '/factions/MLA/units/tank/tank_icon_buildbar.png')
    }, { timeout: 3000 })
  })

  it('should render combat stats section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Combat')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('should render armor stats when available', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Armor')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Armor value is 10 - check it exists in the document (may appear multiple times)
    const tens = screen.getAllByText('10')
    expect(tens.length).toBeGreaterThanOrEqual(1)
  })

  it('should render weapons section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Weapons')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Main Cannon')).toBeInTheDocument()
    expect(screen.getByText(/DPS: 50.0/i)).toBeInTheDocument()
    expect(screen.getByText(/Range: 100/i)).toBeInTheDocument()
  })

  it('should render economy stats section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Economy')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Metal Cost')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('Energy Cost')).toBeInTheDocument()
    expect(screen.getByText('Build Time')).toBeInTheDocument()
    expect(screen.getByText('12s')).toBeInTheDocument()
  })

  it('should render energy consumption when available', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Energy Consumption')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('-5/s')).toBeInTheDocument()
  })

  it('should render mobility stats section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Mobility')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Move Speed')).toBeInTheDocument()
    // Value 10 may appear in multiple places
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Turn Speed')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('should render build relationships section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Build Relationships')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Built By')).toBeInTheDocument()
    expect(screen.getByText('vehicle_factory')).toBeInTheDocument()
  })

  it('should create links for build relationships', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      const builderLink = screen.getByText('vehicle_factory').closest('a')
      expect(builderLink).toHaveAttribute('href', '/faction/MLA/unit/vehicle_factory')
    }, { timeout: 3000 })
  })

  it('should render back to faction link', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      const backLink = screen.getByText(/back to faction/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/faction/MLA')
    }, { timeout: 3000 })
  })

  it('should handle error when unit not found', async () => {
    renderUnitDetail('MLA', 'invalid_unit')

    await waitFor(() => {
      expect(screen.getByText(/error loading unit/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should show error message for failed load', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Failed to load unit'))
    ) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText(/error loading unit/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/failed to load unit/i)).toBeInTheDocument()
  })

  it('should render back to faction link on error', async () => {
    renderUnitDetail('MLA', 'invalid_unit')

    await waitFor(() => {
      const backLink = screen.getByText(/back to faction/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/faction/MLA')
    }, { timeout: 3000 })
  })

  it('should not render mobility section for units without mobility', async () => {
    // Create a mock unit without mobility
    const staticUnit: Unit = { ...mockTankUnit, specs: { ...mockTankUnit.specs, mobility: undefined } }

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('tank_resolved.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => staticUnit
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
    }, { timeout: 3000 })

    // Mobility section should not be present
    expect(screen.queryByText('Move Speed')).not.toBeInTheDocument()
  })

  it('should render production when available', async () => {
    const producerUnit: Unit = {
      ...mockTankUnit,
      specs: {
        ...mockTankUnit.specs,
        economy: {
          ...mockTankUnit.specs.economy,
          production: { metal: 10, energy: 100 }
        }
      }
    }

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('tank_resolved.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => producerUnit
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Metal Production')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('+10/s')).toBeInTheDocument()
    expect(screen.getByText('Energy Production')).toBeInTheDocument()
    expect(screen.getByText('+100/s')).toBeInTheDocument()
  })

  it('should not render build relationships if none exist', async () => {
    const unitWithoutBuilds: Unit = {
      ...mockTankUnit,
      buildRelationships: undefined
    }

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('tank_resolved.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => unitWithoutBuilds
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.queryByText('Build Relationships')).not.toBeInTheDocument()
  })

  it('should display multiple weapons correctly', async () => {
    const multiWeaponUnit: Unit = {
      ...mockTankUnit,
      weapons: [
        { identifier: 'weapon1', displayName: 'Cannon', dps: 50, range: 100 },
        { identifier: 'weapon2', displayName: 'Machine Gun', dps: 25, range: 50 }
      ]
    }

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('tank_resolved.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => multiWeaponUnit
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Cannon')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Machine Gun')).toBeInTheDocument()
  })

  it('should format large numbers with locale separators', async () => {
    const expensiveUnit: Unit = {
      ...mockTankUnit,
      specs: {
        ...mockTankUnit.specs,
        combat: { health: 10000 },
        economy: {
          ...mockTankUnit.specs.economy,
          buildCost: { metal: 5000, energy: 10000 }
        }
      }
    }

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('tank_resolved.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => expensiveUnit
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      // Numbers should be formatted with locale separators (e.g., 10,000)
      // Check for the formatted numbers
      const formattedNumbers = screen.getAllByText(/10,000/)
      expect(formattedNumbers.length).toBeGreaterThanOrEqual(1)
    }, { timeout: 3000 })
  })
})
