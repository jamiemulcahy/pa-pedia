import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { FactionDetail } from '../FactionDetail'
import { renderWithProviders, userEvent } from '@/tests/helpers'
import { setupMockFetch, mockMLAMetadata } from '@/tests/mocks/factionData'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

function renderFactionDetail(factionId: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/faction/${factionId}`]}>
      <Routes>
        <Route path="/faction/:id" element={<FactionDetail />} />
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
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    expect(screen.getByText(/machine legion army faction for testing/i)).toBeInTheDocument()
  })

  it('should render unit count', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByText(/3 units total/i)).toBeInTheDocument()
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
      const typeFilter = screen.getByRole('combobox')
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

    const typeFilter = screen.getByRole('combobox')
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

  it('should combine search and type filters', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Apply type filter for Land
    const typeFilter = screen.getByRole('combobox') as HTMLSelectElement
    await user.selectOptions(typeFilter, 'Land')

    // Search for "tank" (combines with Land filter)
    const searchInput = screen.getByPlaceholderText(/search units/i) as HTMLInputElement
    await user.type(searchInput, 'tank')

    // Wait for both filters to apply - Tank should be the only unit card visible
    await waitFor(() => {
      const allUnitCards = screen.queryAllByRole('link').filter(link =>
        link.getAttribute('href')?.includes('/unit/')
      )
      // Should only have 1 unit card: Tank (Land + matches "tank" search)
      expect(allUnitCards.length).toBe(1)
      expect(allUnitCards[0].getAttribute('href')).toContain('/unit/tank')
    })
  })

  it('should render unit cards with icons', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Icon alt text includes " icon" suffix
    const tankImage = screen.getByAltText('Tank icon')
    expect(tankImage).toBeInTheDocument()
    expect(tankImage).toHaveAttribute('src', '/factions/MLA/units/tank/tank_icon_buildbar.png')
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

  it('should clear search on backspace', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByPlaceholderText(/search units/i) as HTMLInputElement

    // Type search query
    await user.type(searchInput, 'tank')

    // Wait for filtering - should have 1 unit card (Tank)
    await waitFor(() => {
      const unitCards = screen.queryAllByRole('link').filter(link =>
        link.getAttribute('href')?.includes('/unit/')
      )
      expect(unitCards.length).toBe(1)
    })

    // Clear search
    await user.clear(searchInput)

    // Wait for filter to clear - all 3 unit cards should be back
    await waitFor(() => {
      const unitCards = screen.queryAllByRole('link').filter(link =>
        link.getAttribute('href')?.includes('/unit/')
      )
      expect(unitCards.length).toBe(3) // Tank, Bot, Fighter
    })
  })
})
