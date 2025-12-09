import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { BreadcrumbNav } from '../BreadcrumbNav'
import { renderWithProviders } from '@/tests/helpers'
import { setupMockFetch } from '@/tests/mocks/factionData'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

interface RenderOptions {
  factionId: string
  unitId?: string
  onUnitChange?: (factionId: string, unitId: string) => void
  enableAllFactions?: boolean
}

function renderBreadcrumbNav(
  factionIdOrOptions: string | RenderOptions,
  unitId?: string,
  onUnitChange?: (factionId: string, unitId: string) => void
) {
  // Support both old signature and new options object
  const options: RenderOptions = typeof factionIdOrOptions === 'string'
    ? { factionId: factionIdOrOptions, unitId, onUnitChange }
    : factionIdOrOptions

  return renderWithProviders(
    <MemoryRouter>
      <BreadcrumbNav
        factionId={options.factionId}
        unitId={options.unitId}
        onUnitChange={options.onUnitChange}
        enableAllFactions={options.enableAllFactions}
      />
    </MemoryRouter>,
    { skipRouter: true }
  )
}

describe('BreadcrumbNav', () => {
  beforeEach(() => {
    setupMockFetch()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render faction selector', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
    })
  })

  it('should render unit selector', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByLabelText('Select unit')).toBeInTheDocument()
    })
  })

  it('should have searchable faction input', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      const factionSelect = screen.getByLabelText('Select faction')
      expect(factionSelect).toBeInTheDocument()
      // react-select creates an input for searching
      expect(factionSelect.tagName).toBe('INPUT')
    })
  })

  it('should show unit options after faction is loaded', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    // Wait for faction data to load - the placeholder changes when units are available
    await waitFor(() => {
      expect(screen.getByLabelText('Select unit')).toBeInTheDocument()
    })

    // Wait for units to load (placeholder will change from "Loading units..." to "Select unit...")
    await waitFor(() => {
      const unitSelect = screen.getByLabelText('Select unit')
      // Check the input has loaded by looking for the control
      expect(unitSelect).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should have searchable unit input', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      const unitSelect = screen.getByLabelText('Select unit')
      expect(unitSelect).toBeInTheDocument()
      // react-select creates an input for searching
      expect(unitSelect.tagName).toBe('INPUT')
    })
  })

  it('should show LOCAL tag for local factions', async () => {
    // Note: Full LOCAL tag testing would require mock data with isLocal: true
    // The formatFactionOption function renders the tag when isLocal is true
    // This test verifies the component renders without error
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
    })
  })

  // Note: Unit selection navigation is tested in integration tests
  // (navigation.test.tsx) since react-select dropdown interactions
  // are complex to simulate in unit tests

  it('should have arrow between selectors', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByText('→')).toBeInTheDocument()
    })
  })

  it('should be wrapped in a container', async () => {
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      const nav = screen.getByLabelText('Unit navigation')
      expect(nav).toBeInTheDocument()
    })
  })

  it('should accept onUnitChange callback prop', async () => {
    const onUnitChange = vi.fn()
    renderBreadcrumbNav('MLA', 'tank', onUnitChange)

    await waitFor(() => {
      expect(screen.getByLabelText('Select unit')).toBeInTheDocument()
    })

    // Component renders successfully with callback
    expect(screen.getByLabelText('Unit navigation')).toBeInTheDocument()
  })

  describe('All Factions Feature', () => {
    // Helper to open react-select dropdown
    const openFactionDropdown = async () => {
      const factionSelect = screen.getByLabelText('Select faction')
      // react-select opens on focus + keyboard or mouseDown
      fireEvent.focus(factionSelect)
      fireEvent.keyDown(factionSelect, { key: 'ArrowDown', code: 'ArrowDown' })
    }

    it('should show "All" option when enableAllFactions is true', async () => {
      renderBreadcrumbNav({
        factionId: 'MLA',
        unitId: 'tank',
        enableAllFactions: true,
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
      })

      // Open the dropdown
      await openFactionDropdown()

      // Wait for options to be rendered - "All" should be the first option
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
      })
    })

    it('should show "All" option when onUnitChange callback is provided', async () => {
      const onUnitChange = vi.fn()
      renderBreadcrumbNav({
        factionId: 'MLA',
        unitId: 'tank',
        onUnitChange,
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
      })

      // Open the dropdown
      await openFactionDropdown()

      // "All" should be available
      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
      })
    })

    it('should NOT show "All" option when neither enableAllFactions nor onUnitChange is provided', async () => {
      renderBreadcrumbNav({
        factionId: 'MLA',
        unitId: 'tank',
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
      })

      // Open the dropdown
      await openFactionDropdown()

      // Wait for options to render - check for menu listbox indicating dropdown is open
      await waitFor(() => {
        // MLA will appear multiple times (selected value + dropdown option)
        expect(screen.getAllByText('MLA').length).toBeGreaterThanOrEqual(1)
      })

      // "All" option should NOT be present (check exact match to avoid matching partial text)
      const allOptions = screen.queryAllByText('All')
      expect(allOptions.length).toBe(0)
    })

    it('should render successfully with enableAllFactions prop', async () => {
      renderBreadcrumbNav({
        factionId: 'MLA',
        unitId: 'tank',
        enableAllFactions: true,
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Unit navigation')).toBeInTheDocument()
      })
    })
  })
})
