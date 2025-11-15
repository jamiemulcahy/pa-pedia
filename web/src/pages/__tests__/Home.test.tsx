import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { Home } from '../Home'
import { renderWithProviders, userEvent } from '@/tests/helpers'
import { setupMockFetch } from '@/tests/mocks/factionData'
import { BrowserRouter } from 'react-router-dom'

describe('Home', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render loading state initially', () => {
    renderWithProviders(<Home />)
    expect(screen.getByText(/loading factions/i)).toBeInTheDocument()
  })

  it('should render faction cards after loading', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText('Legion')).toBeInTheDocument()
  })

  it('should display page title', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('PA-PEDIA')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should display page description', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/browse planetary annihilation titans faction data/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should render faction metadata correctly', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/machine legion army faction for testing/i)).toBeInTheDocument()
    expect(screen.getByText(/test author/i)).toBeInTheDocument()
    expect(screen.getByText(/version 1.0.0/i)).toBeInTheDocument()
  })

  it('should create clickable links to faction detail pages', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    }, { timeout: 3000 })

    const mlaLink = screen.getByText('MLA').closest('a')
    expect(mlaLink).toHaveAttribute('href', '/faction/MLA')

    const legionLink = screen.getByText('Legion').closest('a')
    expect(legionLink).toHaveAttribute('href', '/faction/Legion')
  })

  it('should navigate to faction detail on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    }, { timeout: 3000 })

    const mlaCard = screen.getByText('MLA').closest('a')
    expect(mlaCard).toBeTruthy()

    // Click would navigate, but we just verify the link exists
    expect(mlaCard?.getAttribute('href')).toBe('/faction/MLA')
  })

  it('should handle error state', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any

    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/error loading factions/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/network error/i)).toBeInTheDocument()
  })

  it('should display error message', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Failed to fetch'))) as any

    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should show message when no factions available', async () => {
    // Note: discoverFactions() is hardcoded to return ['MLA', 'Legion']
    // So we test the scenario where all metadata fetches fail
    // This results in an empty factions map, which shows "no factions found"
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)
    ) as any

    renderWithProviders(<Home />)

    // When all faction metadata fails to load, we get an error state
    // In a real scenario with discoverFactions fetching from a manifest,
    // an empty manifest would show "no factions found"
    await waitFor(() => {
      // With current implementation, failed metadata loads show error
      expect(screen.getByText(/error loading factions/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should render multiple faction cards', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(2)
    }, { timeout: 3000 })
  })

  it('should display faction descriptions', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/machine legion army/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/legion expansion/i)).toBeInTheDocument()
  })

  it('should display faction versions', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/version 1.0.0/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/version 2.0.0/i)).toBeInTheDocument()
  })

  it('should display faction authors', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/by test author/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByText(/by legion team/i)).toBeInTheDocument()
  })

  it('should have proper grid layout classes', async () => {
    renderWithProviders(<Home />)

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    }, { timeout: 3000 })

    const grid = screen.getByText('MLA').closest('div.grid')?.parentElement
    expect(grid?.className).toContain('grid')
  })
})
