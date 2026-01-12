import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { UnitDetail } from '../UnitDetail'
import { renderWithProviders } from '@/tests/helpers'
import { setupMockFetch, mockTankUnit, type MockFetch } from '@/tests/mocks/factionData'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Unit } from '@/types/faction'

function renderUnitDetail(factionId: string, unitId: string, searchParams?: string) {
  const url = searchParams
    ? `/faction/${factionId}/unit/${unitId}?${searchParams}`
    : `/faction/${factionId}/unit/${unitId}`
  return renderWithProviders(
    <MemoryRouter initialEntries={[url]}>
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
      // Multiple icons may exist (unit detail + dropdown selector), find the main one
      const icons = screen.getAllByAltText('Tank')
      // The main unit icon has the object-contain class
      const mainIcon = icons.find(icon => icon.className.includes('object-contain'))
      expect(mainIcon).toBeInTheDocument()
      // New path uses unit.image field which contains assets path
      expect(mainIcon).toHaveAttribute('src', '/factions/MLA/assets/pa/units/land/tank/tank_icon_buildbar.png')
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

    // Weapon name is displayed (uses weapon.name when available, falls back to weapon ID)
    expect(screen.getByText('Main Cannon')).toBeInTheDocument()
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
    // Build cost value (150) and unit (metal) may be in separate elements
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText(/metal/)).toBeInTheDocument()
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

  it('should render breadcrumb navigation', async () => {
    renderUnitDetail('MLA', 'tank')

    await waitFor(() => {
      // BreadcrumbNav should be present with faction and unit selectors
      expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
      expect(screen.getByLabelText('Select unit')).toBeInTheDocument()
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

  describe('Comparison Mode', () => {
    it('should render Compare button in non-comparison mode', async () => {
      renderUnitDetail('MLA', 'tank')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument()
      })
    })

    it('should enter comparison mode with compare URL parameter', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot')

      await waitFor(() => {
        // Should show Add button (comparison mode controls)
        expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
      })

      // Should show exit comparison button
      expect(screen.getByRole('button', { name: /exit comparison/i })).toBeInTheDocument()
    })

    it('should render comparison unit when specified in URL', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot')

      await waitFor(() => {
        // Primary unit should be visible
        expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
      })

      // Comparison unit should also be visible
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Bot' })).toBeInTheDocument()
      })
    })

    it('should support multiple comparison units in URL', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot,MLA/air_fighter')

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Bot' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Fighter' })).toBeInTheDocument()
      })
    })

    it('should show filter toggle in comparison mode', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show (all stats|differences only)/i })).toBeInTheDocument()
      })
    })

    it('should show remove buttons for comparison units', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot')

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Bot' })).toBeInTheDocument()
      })

      // Should have remove button
      expect(screen.getByRole('button', { name: /remove from comparison/i })).toBeInTheDocument()
    })

    it('should show swap button for comparison units with selected unit', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot')

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Bot' })).toBeInTheDocument()
      })

      // Should have swap button
      expect(screen.getByRole('button', { name: /swap with primary/i })).toBeInTheDocument()
    })

    it('should show pending selection placeholder for empty unit slot', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/')

      await waitFor(() => {
        expect(screen.getByText(/select a unit above/i)).toBeInTheDocument()
      })
    })

    it('should support many comparison units without limit', async () => {
      // URL with many comparison units - all should be parsed (no limit in group mode)
      const manyUnits = 'compare=MLA/bot,MLA/air_fighter,MLA/vehicle_factory,MLA/bot,MLA/air_fighter,MLA/vehicle_factory,MLA/bot'
      renderUnitDetail('MLA', 'tank', manyUnits)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
      })

      // Wait for comparison units to load
      await waitFor(() => {
        expect(screen.getAllByRole('heading', { name: 'Bot' }).length).toBeGreaterThanOrEqual(1)
      })

      // Add button should still be visible (no limit on comparison units)
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
    })

    it('should support cross-faction comparison', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=Legion/legion_tank')

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Legion Tank' })).toBeInTheDocument()
      })
    })

    it('should render multiple faction selectors in comparison mode', async () => {
      renderUnitDetail('MLA', 'tank', 'compare=MLA/bot')

      await waitFor(() => {
        // Should have multiple faction selectors (one for primary, one for comparison)
        const factionSelectors = screen.getAllByLabelText('Select faction')
        expect(factionSelectors.length).toBeGreaterThanOrEqual(2)
      })
    })
  })
})
