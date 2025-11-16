import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { FactionDetail } from '../FactionDetail'
import { renderWithProviders, userEvent } from '@/tests/helpers'
import { setupMockFetch } from '@/tests/mocks/factionData'
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
    }, { timeout: 3000 })
  })

  it('should render link to go back home when faction not found', async () => {
    renderFactionDetail('InvalidFaction')

    await waitFor(() => {
      const link = screen.getByText(/go back home/i)
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/')
    }, { timeout: 3000 })
  })

  it('should render faction name and description', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/machine legion army faction for testing/i)).toBeInTheDocument()
  })

  it('should render unit count', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByText(/3 units total/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should render unit grid', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    expect(screen.getAllByText('Bot')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Fighter')[0]).toBeInTheDocument()
  })

  it('should render search input', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search units/i)
      expect(searchInput).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should filter units by search query', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    const searchInput = screen.getByPlaceholderText(/search units/i)
    await user.type(searchInput, 'tank')

    // Verify filtered units don't have links to bot or fighter, but tank link should exist
    const tankLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/tank')
    )
    const botLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    )
    const fighterLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/air_fighter')
    )
    expect(tankLinks.length).toBeGreaterThan(0)
    expect(botLinks.length).toBe(0)
    expect(fighterLinks.length).toBe(0)
  })

  it('should filter units case-insensitively', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    const searchInput = screen.getByPlaceholderText(/search units/i)
    await user.type(searchInput, 'TANK')

    const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
  })

  it('should render type filter dropdown', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const typeFilter = screen.getByRole('combobox')
      expect(typeFilter).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should populate type filter with unit types', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Wait for type filter to be populated after units load
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      // Should have "All Types" option plus all unique types
      // MLA has units with types: Mobile, Land, Basic, Tank, Bot, Air, Fighter
      // So "All Types" + unique types should be >= 2
      expect(options.length).toBeGreaterThanOrEqual(2)
    }, { timeout: 3000 })

    expect(screen.getByRole('option', { name: /all types/i })).toBeInTheDocument()
  })

  it('should filter units by type', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

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
    }, { timeout: 3000 })

    const searchInput = screen.getByPlaceholderText(/search units/i)
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByText(/no units match your filters/i)).toBeInTheDocument()
  })

  it('should combine search and type filters', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Apply type filter
    const typeFilter = screen.getByRole('combobox')
    await user.selectOptions(typeFilter, 'Land')

    // Should show Tank and Bot unit cards, not Fighter
    const tankLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/tank')
    )
    const botLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    )
    const fighterLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/air_fighter')
    )
    expect(tankLinks.length).toBeGreaterThan(0)
    expect(botLinks.length).toBeGreaterThan(0)
    expect(fighterLinks.length).toBe(0)

    // Now search for "tank"
    const searchInput = screen.getByPlaceholderText(/search units/i)
    await user.type(searchInput, 'tank')

    // Should only show Tank unit card
    const filteredTankLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/tank')
    )
    const filteredBotLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    )
    expect(filteredTankLinks.length).toBeGreaterThan(0)
    expect(filteredBotLinks.length).toBe(0)
  })

  it('should render unit cards with icons', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    const tankImage = screen.getByAltText('Tank')
    expect(tankImage).toBeInTheDocument()
    expect(tankImage).toHaveAttribute('src', '/factions/MLA/units/tank/tank_icon_buildbar.png')
  })

  it('should render unit type badges', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Each unit shows up to 2 type badges
    const mobileBadges = screen.getAllByText('Mobile')
    expect(mobileBadges.length).toBeGreaterThan(0)
  })

  it('should create links to unit detail pages', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Find unit card links by href
    const tankLinks = screen.getAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/faction/MLA/unit/tank')
    )
    const botLinks = screen.getAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/faction/MLA/unit/bot')
    )

    expect(tankLinks.length).toBeGreaterThan(0)
    expect(tankLinks[0]).toHaveAttribute('href', '/faction/MLA/unit/tank')

    expect(botLinks.length).toBeGreaterThan(0)
    expect(botLinks[0]).toHaveAttribute('href', '/faction/MLA/unit/bot')
  })

  it('should render back to factions link', async () => {
    renderFactionDetail('MLA')

    await waitFor(() => {
      const backLink = screen.getByText(/back to factions/i)
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    }, { timeout: 3000 })
  })

  it('should handle error when loading units', async () => {
    type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('units.json')) {
        return Promise.reject(new Error('Failed to load units'))
      }
      // Still return metadata successfully
      return Promise.resolve({
        ok: true,
        json: async () => ({ identifier: 'mla', displayName: 'MLA' })
      } as Response)
    }) as unknown as MockFetch

    renderFactionDetail('MLA')

    await waitFor(() => {
      expect(screen.getByText(/error loading units/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should clear search on backspace', async () => {
    const user = userEvent.setup()
    renderFactionDetail('MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    const searchInput = screen.getByPlaceholderText(/search units/i) as HTMLInputElement
    await user.type(searchInput, 'tank')

    // After filtering, Bot and Fighter unit cards should not exist
    let botLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    )
    expect(botLinks.length).toBe(0)

    await user.clear(searchInput)

    // After clearing, Bot and Fighter unit cards should be back
    botLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/bot')
    )
    const fighterLinks = screen.queryAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('/unit/air_fighter')
    )
    expect(botLinks.length).toBeGreaterThan(0)
    expect(fighterLinks.length).toBeGreaterThan(0)
  })
})
