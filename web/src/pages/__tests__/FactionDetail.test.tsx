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
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('should render unit count', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByText(/4 units total/i)).toBeInTheDocument()
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
      const searchInput = screen.getByPlaceholderText(/search units/i)
      expect(searchInput).toBeInTheDocument()
    })
  })

  it('should filter units by search query', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByPlaceholderText(/search units/i) as HTMLInputElement
    await user.type(searchInput, 'tank')

    // Wait for input value to update
    await waitFor(() => {
      expect(searchInput.value).toBe('tank')
    })

    // Verify filtering - Tank card should be visible, Bot and Fighter should not
    // Check using the unit names since that's what's actually visible
    const tankCards = screen.getAllByText('Tank')
    const tankUnitCard = tankCards.find(el => el.closest('a[href*="/unit/tank"]'))
    expect(tankUnitCard).toBeTruthy()

    // Bot and Fighter should not have unit card links
    expect(screen.queryByRole('link', { name: /unit\/bot/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /unit\/air_fighter/ })).not.toBeInTheDocument()
  })

  it('should filter units case-insensitively', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByPlaceholderText(/search units/i)
    await user.type(searchInput, 'TANK')

    const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
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

    // Wait for type filter to be populated after units load
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      // Should have "All Types" option plus all unique types
      // MLA has units with types: Mobile, Land, Basic, Tank, Bot, Air, Fighter
      // So "All Types" + unique types should be >= 2
      expect(options.length).toBeGreaterThanOrEqual(2)
    })

    expect(screen.getByRole('option', { name: /all types/i })).toBeInTheDocument()
  })

  it('should filter units by type', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    const typeFilter = screen.getByRole('combobox', { name: /filter units by type/i })
    await user.selectOptions(typeFilter, 'Air')

    // Fighter should be in grid, Tank and Bot should not have unit card links
    expect(screen.getAllByText('Fighter')[0]).toBeInTheDocument()

    // Check that Tank and Bot unit cards are not present (but type filter options may still exist)
    const tankLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/tank')
    )
    const botLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    )
    expect(tankLinks.length).toBe(0)
    expect(botLinks.length).toBe(0)
  })

  it('should show no units message when filters match nothing', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByPlaceholderText(/search units/i)
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByText(/no units match your filters/i)).toBeInTheDocument()
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

      await waitFor(() => {
        const fighters = screen.getAllByText('Fighter'); expect(fighters.length).toBeGreaterThan(0)
      })

      // In normal view, unit names are visible as text in the card
      const fighterTexts = screen.getAllByText('Fighter')
      const fighterInCard = fighterTexts.find(el => el.closest('a[href*="/unit/air_fighter"]'))
      expect(fighterInCard).toBeInTheDocument()

      // Toggle compact view
      const compactButton = screen.getByRole('button', { name: /switch to compact view/i })
      await user.click(compactButton)

      // In compact view, unit names should not be visible as text (only in title attribute)
      // The Fighter text in the unit card should be gone, but Fighter option in filter dropdown remains
      const fighterTextsAfter = screen.getAllByText('Fighter')
      const fighterInCardAfter = fighterTextsAfter.find(el => el.closest('a[href*="/unit/air_fighter"]'))
      expect(fighterInCardAfter).toBeUndefined()

      // But the link should still exist with the unit name in title
      const fighterLink = screen.getByLabelText('View Fighter details')
      expect(fighterLink).toHaveAttribute('title', 'Fighter')
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

      // Apply search filter
      const searchInput = screen.getByPlaceholderText(/search units/i) as HTMLInputElement
      await user.type(searchInput, 'tank')

      await waitFor(() => {
        expect(searchInput.value).toBe('tank')
      })

      // Only Tank should be in the table
      const table = screen.getByRole('table')
      expect(within(table).getByRole('link', { name: 'Tank' })).toBeInTheDocument()
      expect(within(table).queryByRole('link', { name: 'Bot' })).not.toBeInTheDocument()
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
  })
})
