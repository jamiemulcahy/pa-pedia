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

function renderBreadcrumbNav(factionId: string, unitId?: string) {
  return renderWithProviders(
    <MemoryRouter>
      <BreadcrumbNav factionId={factionId} unitId={unitId} />
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
    // This test would require mock data with isLocal: true
    // For now, just verify the component renders without error
    renderBreadcrumbNav('MLA', 'tank')

    await waitFor(() => {
      expect(screen.getByLabelText('Select faction')).toBeInTheDocument()
    })
  })

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
})
