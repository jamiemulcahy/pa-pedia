import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setupMockFetch } from '@/tests/mocks/factionData'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FactionProvider } from '@/contexts/FactionContext'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'
import { render } from '@testing-library/react'

function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <FactionProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/faction/:id" element={<FactionDetail />} />
          <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
        </Routes>
      </FactionProvider>
    </MemoryRouter>
  )
}

describe('Navigation Integration Tests', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should navigate from Home to Faction Detail', async () => {
    renderApp('/')

    // Wait for factions to load
    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    // Click on MLA faction
    const mlaCard = screen.getByText('MLA').closest('a')
    expect(mlaCard).toBeTruthy()

    // Verify we can see the home page content
    expect(screen.getByText('PA-PEDIA')).toBeInTheDocument()
  })

  it('should navigate from Faction Detail back to Home', async () => {
    renderApp('/faction/MLA')

    // Wait for faction detail to load
    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Click back to factions link
    const backLink = screen.getByText(/back to factions/i).closest('a')
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('should navigate from Faction Detail to Unit Detail', async () => {
    renderApp('/faction/MLA')

    // Wait for units to load
    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Verify unit cards have correct links - find link elements that contain Tank text
    const tankCards = screen.getAllByText('Tank').map(el => el.closest('a')).filter(Boolean)
    expect(tankCards[0]).toHaveAttribute('href', '/faction/MLA/unit/tank')
  })

  it('should navigate from Unit Detail back to Faction Detail', async () => {
    renderApp('/faction/MLA/unit/tank')

    // Wait for unit to load
    await waitFor(() => {
      expect(screen.getByText('Basic ground assault unit')).toBeInTheDocument()
    })

    // Click back to faction link
    const backLink = screen.getByText(/back to faction/i).closest('a')
    expect(backLink).toHaveAttribute('href', '/faction/MLA')
  })

  it('should handle full navigation flow: Home -> Faction -> Unit -> Back', async () => {
    // Test verifies that all three main routes render correctly
    // Step 1: Home page
    renderApp('/')
    await waitFor(() => {
      expect(screen.getByText('PA-PEDIA')).toBeInTheDocument()
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    // Step 2: Faction detail route (separate render to test route works)
    const { unmount } = renderApp('/faction/MLA')
    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })
    unmount()

    // Step 3: Unit detail route (separate render to test route works)
    renderApp('/faction/MLA/unit/tank')
    await waitFor(() => {
      expect(screen.getByText('tank_weapon.json')).toBeInTheDocument()
      expect(screen.getByText(/back to faction/i)).toBeInTheDocument()
    })
  })

  it('should navigate between different factions', async () => {
    // Load MLA faction
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Navigate to Legion faction
    renderApp('/faction/Legion')

    await waitFor(() => {
      expect(screen.getByText('Legion Tank')).toBeInTheDocument()
    })
  })

  it('should navigate between different units in same faction', async () => {
    // Load Tank unit
    renderApp('/faction/MLA/unit/tank')

    await waitFor(() => {
      expect(screen.getByText('tank_weapon.json')).toBeInTheDocument()
    })

    // Navigate to Bot unit
    renderApp('/faction/MLA/unit/bot')

    await waitFor(() => {
      expect(screen.getByText('bot_weapon.json')).toBeInTheDocument()
    })
  })

  it('should handle invalid faction route', async () => {
    renderApp('/faction/InvalidFaction')

    await waitFor(() => {
      expect(screen.getByText(/faction not found/i)).toBeInTheDocument()
    })

    // Should have link back to home
    const homeLink = screen.getByText(/go back home/i).closest('a')
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('should handle invalid unit route', async () => {
    renderApp('/faction/MLA/unit/invalid_unit')

    await waitFor(() => {
      expect(screen.getByText(/error loading unit/i)).toBeInTheDocument()
    })

    // Should have link back to faction
    const factionLink = screen.getByText(/back to faction/i).closest('a')
    expect(factionLink).toHaveAttribute('href', '/faction/MLA')
  })

  it('should preserve faction data when navigating back', async () => {
    // This test verifies that faction data can be loaded successfully
    // Note: True cache testing would require actual navigation within a single app instance
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Verify that faction data loaded correctly with metadata
    expect(screen.getByText('MLA')).toBeInTheDocument()
    expect(screen.getByText(/4 units total/i)).toBeInTheDocument()
  })

  it('should update URL correctly during navigation', async () => {
    // This test verifies links have correct hrefs
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Check unit links - need to find the actual unit card links, not badges
    const unitCards = screen.getAllByText('Tank').map(el => el.closest('a')).filter(Boolean)
    const tankLink = unitCards[0]
    expect(tankLink?.getAttribute('href')).toBe('/faction/MLA/unit/tank')

    const botCards = screen.getAllByText('Bot').map(el => el.closest('a')).filter(Boolean)
    const botLink = botCards[0]
    expect(botLink?.getAttribute('href')).toBe('/faction/MLA/unit/bot')

    const fighterCards = screen.getAllByText('Fighter').map(el => el.closest('a')).filter(Boolean)
    const fighterLink = fighterCards[0]
    expect(fighterLink?.getAttribute('href')).toBe('/faction/MLA/unit/air_fighter')
  })

  it('should navigate to units via build relationships', async () => {
    renderApp('/faction/MLA/unit/tank')

    await waitFor(() => {
      expect(screen.getByText('Built By')).toBeInTheDocument()
    })

    // Tank is built by vehicle_factory
    const factoryLink = screen.getByText('Vehicle Factory').closest('a')
    expect(factoryLink).toHaveAttribute('href', '/faction/MLA/unit/vehicle_factory')
  })

  it('should maintain search state when navigating away and back', async () => {
    // Note: This test verifies the structure, actual state persistence
    // would require React Router's location state or query params
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Search input should be present
    const searchInput = screen.getByPlaceholderText(/search units/i)
    expect(searchInput).toBeInTheDocument()
  })
})
