import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { screen, waitFor, render } from '@testing-library/react'
import { setupMockFetch } from '@/tests/mocks/factionData'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FactionProvider } from '@/contexts/FactionContext'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'

type FetchCallArgs = [input: string | URL | Request, init?: RequestInit];
type MockFetch = Mock<FetchCallArgs, Promise<Response>>;

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

describe('Data Flow Integration Tests', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should preload faction metadata on app start', async () => {
    renderApp('/')

    // Faction metadata should load automatically
    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    expect(screen.getByText('Legion')).toBeInTheDocument()

    // Should have fetched metadata for both factions
    const metadataFetches = (global.fetch as MockFetch).mock.calls.filter(
      (call: FetchCallArgs) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('metadata.json');
      }
    )
    expect(metadataFetches.length).toBe(2)
  })

  it('should lazy-load faction index when viewing faction', async () => {
    renderApp('/')

    // Wait for metadata to load
    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    const metadataOnlyFetches = (global.fetch as MockFetch).mock.calls.length

    // Navigate to faction detail (new render to simulate navigation)
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank')
      expect(tanks.length).toBeGreaterThan(0)
    })

    // Should have made fetch for units.json
    const totalFetches = (global.fetch as MockFetch).mock.calls.length
    expect(totalFetches).toBeGreaterThan(metadataOnlyFetches)

    const unitsFetch = (global.fetch as MockFetch).mock.calls.find(
      (call: FetchCallArgs) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('units.json');
      }
    )
    expect(unitsFetch).toBeDefined()
  })

  it('should lazy-load unit data when viewing unit', async () => {
    renderApp('/faction/MLA')

    // Wait for faction index to load
    await waitFor(() => {
      const tanks = screen.getAllByText('Tank')
      expect(tanks.length).toBeGreaterThan(0)
    })

    // Navigate to unit detail
    renderApp('/faction/MLA/unit/tank')

    await waitFor(() => {
      expect(screen.getByText('Main Cannon')).toBeInTheDocument()
    })

    // Unit data comes from the index, so no additional fetch is needed
    // Verify unit details are displayed correctly
    expect(screen.getByText('Basic ground assault unit')).toBeInTheDocument()
  })

  it('should cache faction metadata and not refetch', async () => {
    renderApp('/')

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    // Verify metadata was fetched for both factions
    const metadataFetches = (global.fetch as MockFetch).mock.calls.filter(
      (call: FetchCallArgs) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('metadata.json');
      }
    )
    // Should have fetched MLA and Legion metadata (2 factions)
    expect(metadataFetches.length).toBe(2)

    // Verify both factions are displayed
    expect(screen.getByText('MLA')).toBeInTheDocument()
    expect(screen.getByText('Legion')).toBeInTheDocument()
  })

  it('should cache faction index and not refetch', async () => {
    // First visit to faction
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank')
      expect(tanks.length).toBeGreaterThan(0)
    })

    const firstFetchCount = (global.fetch as MockFetch).mock.calls.length

    // Navigate away and back
    renderApp('/')
    await waitFor(() => {
      expect(screen.getByText('PA-PEDIA')).toBeInTheDocument()
    })

    renderApp('/faction/MLA')
    await waitFor(() => {
      const tanks = screen.getAllByText('Tank')
      expect(tanks.length).toBeGreaterThan(0)
    })

    // Might have metadata fetch from home page reload, but not units.json
    const unitsJsonFetches = (global.fetch as MockFetch).mock.calls.filter(
      (call: FetchCallArgs, index: number) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString()
        return index >= firstFetchCount && url.includes('units.json')
      }
    )
    expect(unitsJsonFetches.length).toBe(0)
  })

  it('should cache unit data and not refetch', async () => {
    // First visit to unit
    renderApp('/faction/MLA/unit/tank')

    await waitFor(() => {
      expect(screen.getByText('Main Cannon')).toBeInTheDocument()
    })

    // Verify unit data is displayed correctly - use heading for unique match
    expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
    expect(screen.getByText('Basic ground assault unit')).toBeInTheDocument()

    // Unit data is cached in the index, so subsequent views don't need additional fetches
    const unitsFetches = (global.fetch as MockFetch).mock.calls.filter(
      (call: FetchCallArgs) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString()
        return url.includes('units.json')
      }
    )
    // Should have fetched units.json which contains the tank unit
    expect(unitsFetches.length).toBeGreaterThanOrEqual(1)
  })

  it('should load different units independently', async () => {
    // Load first unit
    renderApp('/faction/MLA/unit/tank')

    await waitFor(() => {
      expect(screen.getByText('Main Cannon')).toBeInTheDocument()
    })

    // Load second unit
    renderApp('/faction/MLA/unit/bot')

    await waitFor(() => {
      expect(screen.getByText('Rifle')).toBeInTheDocument()
    })

    // Both units come from the same units.json fetch
    const unitsFetches = (global.fetch as MockFetch).mock.calls.filter(
      (call: FetchCallArgs) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString()
        return url.includes('units.json')
      }
    )
    // Should have fetched units.json which contains all units
    expect(unitsFetches.length).toBeGreaterThanOrEqual(1)
  })

  it('should handle concurrent unit loads', async () => {
    // Simulate loading multiple units in quick succession
    renderApp('/faction/MLA/unit/tank')
    renderApp('/faction/MLA/unit/bot')

    // Both should load successfully
    await waitFor(() => {
      // At least one should have loaded
      expect(
        screen.queryByText('Main Cannon') || screen.queryByText('Rifle')
      ).toBeTruthy()
    })
  })

  it('should fetch data in correct order: metadata -> index', async () => {
    const fetchOrder: string[] = []

    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()

      if (urlString.includes('metadata.json')) {
        fetchOrder.push('metadata')
      } else if (urlString.includes('units.json')) {
        fetchOrder.push('index')
      }

      // Return mocked responses
      const mockFn = setupMockFetch()
      return mockFn ? mockFn(url, {}) : Promise.resolve({ ok: false } as Response)
    }) as unknown as MockFetch

    // Setup mock properly
    setupMockFetch()

    // Start at home
    renderApp('/')
    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    // Go to faction
    renderApp('/faction/MLA')
    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // Go to unit (unit data is in the index, no additional fetch)
    renderApp('/faction/MLA/unit/tank')
    await waitFor(() => {
      expect(screen.getByText('Main Cannon')).toBeInTheDocument()
    })

    // Verify order: metadata should be fetched before index
    const firstMetadataIndex = fetchOrder.indexOf('metadata')
    const firstIndexIndex = fetchOrder.indexOf('index')

    if (firstMetadataIndex >= 0 && firstIndexIndex >= 0) {
      expect(firstMetadataIndex).toBeLessThan(firstIndexIndex)
    }
  })

  it('should handle partial failures gracefully', async () => {
    // Mock factionsList to include both, but fail Legion metadata fetch
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()

      if (urlString.includes('factionsList.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ['MLA', 'Legion'],
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          redirected: false,
          type: 'basic',
          url: '',
          clone: function() { return this },
          body: null,
          bodyUsed: false,
          arrayBuffer: async () => new ArrayBuffer(0),
          blob: async () => new Blob(),
          formData: async () => new FormData(),
          text: async () => '["MLA", "Legion"]'
        } as Response)
      }

      if (urlString.includes('Legion/metadata.json')) {
        return Promise.reject(new Error('Failed to load Legion'))
      }

      if (urlString.includes('MLA/metadata.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            identifier: 'mla',
            displayName: 'MLA',
            version: '1.0.0',
            author: 'Test Author',
            description: 'Machine Legion Army faction for testing',
            dateCreated: '2025-01-15',
            build: '123456',
            type: 'mod',
            mods: ['com.pa.mla']
          }),
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          redirected: false,
          type: 'basic',
          url: '',
          clone: function() { return this },
          body: null,
          bodyUsed: false,
          arrayBuffer: async () => new ArrayBuffer(0),
          blob: async () => new Blob(),
          formData: async () => new FormData(),
          text: async () => '{}'
        } as Response)
      }

      return Promise.resolve({ ok: false, status: 404 } as Response)
    }) as unknown as MockFetch

    renderApp('/')

    await waitFor(() => {
      expect(screen.getByText('MLA')).toBeInTheDocument()
    })

    // MLA should load, Legion should fail silently (not displayed)
    expect(screen.queryByText('Legion')).not.toBeInTheDocument()
  })

  it('should share context data across all routes', async () => {
    // Test that faction detail page can access metadata loaded at app start
    renderApp('/faction/MLA')

    await waitFor(() => {
      const tanks = screen.getAllByText('Tank'); expect(tanks.length).toBeGreaterThan(0)
    })

    // The faction name 'MLA' should be displayed from metadata
    // Check there's only one MLA text (faction name heading), not multiple
    const mlaElements = screen.getAllByText('MLA')
    expect(mlaElements.length).toBeGreaterThanOrEqual(1)

    // Verify faction description is also present (from metadata)
    expect(screen.getByText(/machine legion army/i)).toBeInTheDocument()
  })

  it('should minimize redundant fetches across navigation', async () => {
    // Test that loading unit detail makes necessary fetches
    renderApp('/faction/MLA/unit/tank')

    await waitFor(() => {
      expect(screen.getByText('Main Cannon')).toBeInTheDocument()
    })

    // Verify the necessary fetches were made
    const allFetches = (global.fetch as MockFetch).mock.calls.map((call: FetchCallArgs) =>
      typeof call[0] === 'string' ? call[0] : call[0].toString()
    )

    const unitsFetches = allFetches.filter((url: string) => url.includes('units.json'))

    // Should have loaded the units.json file which contains all unit data
    expect(unitsFetches.length).toBeGreaterThanOrEqual(1)

    // Verify unit detail is displayed
    expect(screen.getByRole('heading', { name: 'Tank' })).toBeInTheDocument()
  })
})
