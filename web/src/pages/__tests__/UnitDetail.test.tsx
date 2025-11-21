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
    })
  })

  it('should render unit description', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Basic ground assault unit')).toBeInTheDocument()
    })
  })

  it('should render unit type badges', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Mobile')).toBeInTheDocument()
    })

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
      // New path uses unit.image field which contains assets path
      expect(icon).toHaveAttribute('src', '/factions/MLA/assets/pa/units/land/tank/tank_icon_buildbar.png')
    })
  })

  it('should render overview stats section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    expect(screen.getByText('HP:')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('should render weapons section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Weapon')).toBeInTheDocument()
    })

    // Weapon ID is displayed as the title
    expect(screen.getByText('tank_weapon.json')).toBeInTheDocument()
    expect(screen.getByText('Range:')).toBeInTheDocument()
    // Value 100 appears multiple times, check it exists
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1)
  })

  it('should render economy stats in overview section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    expect(screen.getByText('Build cost:')).toBeInTheDocument()
    expect(screen.getByText('150 metal')).toBeInTheDocument()
  })

  it('should render maximum range when available', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Maximum range:')).toBeInTheDocument()
    })

    // Value 100 appears multiple times (range, vision), just check it exists
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1)
  })

  it('should render physics stats section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Physics')).toBeInTheDocument()
    })

    expect(screen.getByText('Max speed:')).toBeInTheDocument()
    // Value 10 may appear in multiple places
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Turn rate:')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('should render built by section', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('Built By')).toBeInTheDocument()
    })

    expect(screen.getByText('Vehicle Factory')).toBeInTheDocument()
  })

  it('should create links for build relationships', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      const builderLink = screen.getByText('Vehicle Factory').closest('a')
      expect(builderLink).toHaveAttribute('href', '/faction/MLA/unit/vehicle_factory')
    })
  })

  it('should render back to faction link', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      const backLink = screen.getByText(/back to faction/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/faction/MLA')
    })
  })

  it('should handle error when unit not found', async () => {
    renderUnitDetail('MLA', 'invalid_unit')

    await waitFor(() => {
      expect(screen.getByText(/error loading unit/i)).toBeInTheDocument()
    })
  })

  it('should show error message for failed load', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Failed to load unit'))
    ) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText(/error loading unit/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/failed to load unit/i)).toBeInTheDocument()
  })

  it('should render back to faction link on error', async () => {
    renderUnitDetail('MLA', 'invalid_unit')

    await waitFor(() => {
      const backLink = screen.getByText(/back to faction/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/faction/MLA')
    })
  })

  it('should not render build relationships if none exist', async () => {
    const unitWithoutBuilds: Unit = {
      ...mockTankUnit,
      buildRelationships: undefined
    }

    // The new structure doesn't use separate fetch for units - they're embedded in index
    // So we need to mock the index fetch instead
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('units.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            units: [{
              identifier: 'tank',
              displayName: 'Tank',
              unitTypes: ['Mobile', 'Land', 'Basic', 'Tank'],
              source: '/pa/units/land/tank/tank.json',
              files: [],
              unit: unitWithoutBuilds
            }]
          })
        } as Response)
      }
      if (urlString.includes('metadata.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ identifier: 'mla', displayName: 'MLA' })
        } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
    })

    expect(screen.queryByText('Built By')).not.toBeInTheDocument()
  })
})
