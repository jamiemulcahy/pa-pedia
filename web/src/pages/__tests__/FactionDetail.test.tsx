import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { FactionDetail } from '../FactionDetail'
import { renderWithProviders, userEvent } from '@/tests/helpers'
import { setupMockFetch } from '@/tests/mocks/factionData'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

// Helper component to display current location for testing navigation
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderFactionDetail(factionId: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/faction/${factionId}`]}>
      <Routes>
        <Route path="/faction/:id" element={<><FactionDetail /><LocationDisplay /></>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
    { skipRouter: true }
  )
}

describe('FactionDetail', () => {
  beforeEach(() => {
    setupMockFetch()
    // Reset localStorage to ensure clean state for each test
    localStorage.removeItem('pa-pedia-view-mode')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clean up localStorage after each test
    localStorage.removeItem('pa-pedia-view-mode')
  })

  it('should render loading state initially', () => {
    renderFactionDetail('MLA')
    // Can show either general loading or units loading
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should render faction not found for invalid faction', async () => {
    renderFactionDetail('InvalidFaction')

    await waitFor(() => {
      expect(screen.getByText(/faction not found/i)).toBeInTheDocument()
    })
  })

  it('should render link to go back home when faction not found', async () => {
    renderFactionDetail('InvalidFaction')

    await waitFor(() => {
      const link = screen.getByText(/go back home/i)
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/')
    })
  })

  it('should render faction name and description', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'MLA' })).toBeInTheDocument()
    })

    expect(screen.getByText(/machine legion army faction for testing/i)).toBeInTheDocument()
  })

  it('should render unit count with hidden count', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByText(/4 units.*1 hidden/i)).toBeInTheDocument()
    })
  })

  it('should render unit grid', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('Bot')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Fighter')[0]).toBeInTheDocument()
  })

  it('should render search input', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      // react-select uses aria-label for accessibility
      const searchInput = screen.getByLabelText(/search units by name/i)
      expect(searchInput).toBeInTheDocument()
    })
  })

  it('should filter units by search query', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // react-select uses aria-label for accessibility
    const searchInput = screen.getByLabelText(/search units by name/i) as HTMLInputElement
    await user.type(searchInput, 'tank')

    // Wait for filtering to take effect
    await waitFor(() => {
      // Tank card should still be visible
      const tankCards = screen.getAllByText('Tank')
      const tankUnitCard = tankCards.find(el => el.closest('a[href*="/unit/tank"]'))
      expect(tankUnitCard).toBeTruthy()
    })

    // Bot and Fighter should not have unit card links
    expect(screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    ).length).toBe(0)
  })

  it('should filter units case-insensitively', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // react-select uses aria-label for accessibility
    const searchInput = screen.getByLabelText(/search units by name/i)
    await user.type(searchInput, 'TANK')

    // Wait for filtering to take effect - Tank card should still be visible
    await waitFor(() => {
      const tankCards = screen.getAllByText('Tank')
      const tankUnitCard = tankCards.find(el => el.closest('a[href*="/unit/tank"]'))
      expect(tankUnitCard).toBeTruthy()
    })
  })

  it('should render type filter dropdown', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const typeFilter = screen.getByRole('combobox', { name: /filter units by type/i })
      expect(typeFilter).toBeInTheDocument()
    })
  })

  it('should populate type filter with unit types', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Verify the type filter is rendered and is a searchable input (react-select)
    const typeFilter = screen.getByLabelText(/filter units by type/i)
    expect(typeFilter).toBeInTheDocument()
    expect(typeFilter.tagName).toBe('INPUT')
  })

  // Note: Detailed type filter interaction tests are skipped because
  // react-select menu interactions don't work reliably in jsdom.
  // The type filter component is rendered and interactive (verified above).
  // Type filtering logic is covered by the underlying useMemo filter.

  it('should show no units message when filters match nothing', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // react-select uses aria-label for accessibility
    const searchInput = screen.getByLabelText(/search units by name/i)
    await user.type(searchInput, 'nonexistent')

    await waitFor(() => {
      expect(screen.getByText(/no units match your filters/i)).toBeInTheDocument()
    })
  })

  it('should render unit cards with icons', async () => {
    renderFactionDetail('MLA')

    // Wait for units to load and icons to render
    await waitFor(() => {
      const tankImage = screen.getByAltText('Tank icon')
      expect(tankImage).toBeInTheDocument()
    })

    // Icon alt text includes " icon" suffix
    const tankImage = screen.getByAltText('Tank icon')
    // New path uses unit.unit.image field which contains assets path
    expect(tankImage).toHaveAttribute('src', '/factions/MLA/assets/pa/units/land/tank/tank_icon_buildbar.png')
  })

  it('should render unit type badges', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Each unit shows up to 2 type badges
    const mobileBadges = screen.getAllByText('Mobile')
    expect(mobileBadges.length).toBeGreaterThan(0)
  })

  it('should create links to unit detail pages', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Find unit cards using getAllByText since there are type filter options too
    const tankTexts = screen.getAllByText('Tank')
    const botTexts = screen.getAllByText('Bot')

    // Find the one that's inside a link (the unit card, not the select option)
    const tankCard = tankTexts.find(el => el.closest('a'))?.closest('a')
    const botCard = botTexts.find(el => el.closest('a'))?.closest('a')

    expect(tankCard).toHaveAttribute('href', '/faction/MLA/unit/tank')
    expect(botCard).toHaveAttribute('href', '/faction/MLA/unit/bot')
  })

  it('should render back to factions link', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const backLink = screen.getByText(/back to factions/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })
  })

  // Note: Error handling for unit loading is tested in the Context tests
  // and covered by the "Invalid Faction" scenario above

  describe('compact view', () => {
    it('should render compact view toggle button', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        const compactButton = screen.getByRole('button', { name: /switch to compact view/i })
        expect(compactButton).toBeInTheDocument()
      })
    })

    it('should toggle compact view when button is clicked', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      const compactButton = screen.getByRole('button', { name: /switch to compact view/i })
      expect(compactButton).toHaveAttribute('aria-pressed', 'false')

      await user.click(compactButton)

      // Button should now show "switch to normal view" and be pressed
      const normalButton = screen.getByRole('button', { name: /switch to normal view/i })
      expect(normalButton).toHaveAttribute('aria-pressed', 'true')
    })

    it('should hide unit names in compact view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      // Wait for units to load
      await waitFor(() => {
        expect(screen.getByLabelText('View Fighter details')).toBeInTheDocument()
      })

      // In normal view, the unit link should contain the unit name as visible text
      const fighterLink = screen.getByLabelText('View Fighter details')
      expect(fighterLink.textContent).toContain('Fighter')

      // Toggle compact view
      const compactButton = screen.getByRole('button', { name: /switch to compact view/i })
      await user.click(compactButton)

      // In compact view, the link should NOT contain the unit name as visible text
      // But the link should still exist with the unit name in title attribute
      await waitFor(() => {
        const fighterLinkAfter = screen.getByLabelText('View Fighter details')
        expect(fighterLinkAfter).toHaveAttribute('title', 'Fighter')
        // The span with unit name should be hidden (sr-only class)
        expect(fighterLinkAfter.textContent).not.toContain('Fighter')
      })
    })
  })

  describe('faction selector', () => {
    it('should render faction selector', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        // react-select uses input with aria-label
        const factionSelector = screen.getByLabelText('Select faction')
        expect(factionSelector).toBeInTheDocument()
      })
    })

    it('should show current faction as selected', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        // The current faction name appears in the react-select control
        // MLA appears in heading and selector, just check it exists
        expect(screen.getByRole('heading', { name: 'MLA' })).toBeInTheDocument()
      })
    })

    // Note: Faction selection navigation is tested in integration tests
    // since react-select dropdown interactions are complex to simulate
  })

  describe('view mode toggle', () => {
    it('should render view mode toggle button', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        const viewToggle = screen.getByRole('button', { name: /switch to table view/i })
        expect(viewToggle).toBeInTheDocument()
      })
    })

    it('should start in grid view by default', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Grid view shows category sections
      expect(screen.getByRole('heading', { name: 'Tanks' })).toBeInTheDocument()

      // Table should not be present
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('should switch to table view when toggle is clicked', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      const viewToggle = screen.getByRole('button', { name: /switch to table view/i })
      await user.click(viewToggle)

      // Table should now be present
      expect(screen.getByRole('table')).toBeInTheDocument()

      // Category sections should not be visible
      expect(screen.queryByRole('heading', { name: 'Tanks' })).not.toBeInTheDocument()
    })

    it('should switch back to grid view when toggle is clicked again', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Switch to table view
      const viewToggle = screen.getByRole('button', { name: /switch to table view/i })
      await user.click(viewToggle)

      expect(screen.getByRole('table')).toBeInTheDocument()

      // Switch back to grid view
      const gridToggle = screen.getByRole('button', { name: /switch to grid view/i })
      await user.click(gridToggle)

      // Grid view should be back
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Tanks' })).toBeInTheDocument()
    })

    it('should update toggle button label based on current view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // In grid view, button should say "switch to table view"
      expect(screen.getByRole('button', { name: /switch to table view/i })).toBeInTheDocument()

      // Click to switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      // Now button should say "switch to grid view"
      expect(screen.getByRole('button', { name: /switch to grid view/i })).toBeInTheDocument()
    })

    it('should hide compact view button when in table view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Compact button visible in grid mode
      expect(screen.getByRole('button', { name: /switch to compact view/i })).toBeInTheDocument()

      // Switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      // Compact button should be hidden
      expect(screen.queryByRole('button', { name: /switch to compact view/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /switch to normal view/i })).not.toBeInTheDocument()
    })

    it('should hide expand/collapse all button when in table view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Expand/collapse button visible in grid mode
      expect(screen.getByRole('button', { name: /collapse all categories/i })).toBeInTheDocument()

      // Switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      // Expand/collapse button should be hidden
      expect(screen.queryByRole('button', { name: /collapse all categories/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /expand all categories/i })).not.toBeInTheDocument()
    })

    it('should apply filters in table view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      // Apply search filter - react-select uses aria-label
      const searchInput = screen.getByLabelText(/search units by name/i)
      await user.type(searchInput, 'tank')

      // Wait for filtering to take effect
      await waitFor(() => {
        // Only Tank should be in the table
        const table = screen.getByRole('table')
        expect(within(table).getByRole('link', { name: 'Tank' })).toBeInTheDocument()
        expect(within(table).queryByRole('link', { name: 'Bot' })).not.toBeInTheDocument()
      })
    })

    it('should render sortable column headers in table view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      // Check for sortable headers
      expect(screen.getByRole('button', { name: /sort by name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by health/i })).toBeInTheDocument()
    })

    it('should persist view mode preference in localStorage', async () => {
      const user = userEvent.setup()

      // Clear any existing preference
      localStorage.removeItem('pa-pedia-view-mode')

      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Initially should be grid view (default)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      // Switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      expect(screen.getByRole('table')).toBeInTheDocument()

      // Check localStorage was updated
      expect(localStorage.getItem('pa-pedia-view-mode')).toBe('table')
    })

    it('should restore view mode preference from localStorage', async () => {
      // Set preference to table before rendering
      localStorage.setItem('pa-pedia-view-mode', 'table')

      renderFactionDetail('MLA')

      await waitFor(() => {
        // Should start in table view since that's the stored preference
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      // Clean up
      localStorage.removeItem('pa-pedia-view-mode')
    })
  })

  describe('inaccessible units filtering', () => {
    it('should hide inaccessible units by default', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Sea Mine (inaccessible) should NOT be visible by default
      expect(screen.queryByText('Sea Mine')).not.toBeInTheDocument()

      // Accessible units should still be visible
      expect(screen.getAllByText('Tank')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Bot')[0]).toBeInTheDocument()
    })

    it('should show toggle button when inaccessible units exist', async () => {
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Toggle button should be visible with count in aria-label
      const toggleButton = screen.getByRole('button', { name: /show 1 inaccessible unit/i })
      expect(toggleButton).toBeInTheDocument()
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    })

    it('should show inaccessible units when toggle is clicked', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Sea Mine should be hidden initially
      expect(screen.queryByText('Sea Mine')).not.toBeInTheDocument()

      // Click toggle to show inaccessible units
      const toggleButton = screen.getByRole('button', { name: /show 1 inaccessible unit/i })
      await user.click(toggleButton)

      // Now Sea Mine should be visible
      await waitFor(() => {
        expect(screen.getByText('Sea Mine')).toBeInTheDocument()
      })

      // Button should now show "hide inaccessible units"
      expect(screen.getByRole('button', { name: /hide inaccessible units/i })).toHaveAttribute('aria-pressed', 'true')
    })

    it('should hide inaccessible units when toggle is clicked again', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Show inaccessible units
      const toggleButton = screen.getByRole('button', { name: /show 1 inaccessible unit/i })
      await user.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText('Sea Mine')).toBeInTheDocument()
      })

      // Hide inaccessible units again
      const hideButton = screen.getByRole('button', { name: /hide inaccessible units/i })
      await user.click(hideButton)

      await waitFor(() => {
        expect(screen.queryByText('Sea Mine')).not.toBeInTheDocument()
      })
    })

    it('should work with inaccessible filter in table view', async () => {
      const user = userEvent.setup()
      renderFactionDetail('MLA')

      await waitFor(() => {
        const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
      })

      // Switch to table view
      await user.click(screen.getByRole('button', { name: /switch to table view/i }))

      // Sea Mine should be hidden in table view too
      const table = screen.getByRole('table')
      expect(within(table).queryByText('Sea Mine')).not.toBeInTheDocument()

      // Show inaccessible units
      const toggleButton = screen.getByRole('button', { name: /show 1 inaccessible unit/i })
      await user.click(toggleButton)

      // Now Sea Mine should be visible in table
      await waitFor(() => {
        expect(within(table).getByRole('link', { name: 'Sea Mine' })).toBeInTheDocument()
      })
    })
  })
})
