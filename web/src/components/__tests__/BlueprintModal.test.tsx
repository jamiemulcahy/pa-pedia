import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlueprintModal } from '../BlueprintModal'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithFactionProvider } from '@/tests/helpers'
import { setupMockFetch, mockMLAMetadata, mockLegionMetadata, mockBugsMetadata, mockExilesMetadata, mockMLAIndex, mockLegionIndex, mockBugsIndex, mockExilesIndex, createMockFetchResponse } from '@/tests/mocks/factionData'
import type { Unit } from '@/types/faction'

function renderModal(props: {
  isOpen: boolean
  onClose: () => void
  blueprintPath: string
  title: string
}) {
  return renderWithFactionProvider(
    <CurrentFactionProvider factionId="MLA">
      <BlueprintModal {...props} />
    </CurrentFactionProvider>
  )
}

// Helper to create a fetch mock that handles faction data plus custom blueprint responses
function createBlueprintFetchMock(blueprintResponses: Array<() => Promise<Response>>) {
  let callIndex = 0
  return vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url.toString()

    // Handle faction metadata
    if (urlString.includes('/factions/MLA/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockMLAMetadata))
    }
    if (urlString.includes('/factions/Legion/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockLegionMetadata))
    }
    if (urlString.includes('/factions/Bugs/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockBugsMetadata))
    }
    if (urlString.includes('/factions/Exiles/metadata.json')) {
      return Promise.resolve(createMockFetchResponse(mockExilesMetadata))
    }
    if (urlString.includes('/factions/MLA/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockMLAIndex))
    }
    if (urlString.includes('/factions/Legion/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockLegionIndex))
    }
    if (urlString.includes('/factions/Bugs/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockBugsIndex))
    }
    if (urlString.includes('/factions/Exiles/units.json')) {
      return Promise.resolve(createMockFetchResponse(mockExilesIndex))
    }

    // Handle blueprint requests in sequence
    if (callIndex < blueprintResponses.length) {
      return blueprintResponses[callIndex++]()
    }

    // Default 404
    return Promise.resolve(createMockFetchResponse(null, false))
  })
}

describe('BlueprintModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    setupMockFetch()
    mockOnClose.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not render when closed', () => {
    renderModal({
      isOpen: false,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test Blueprint'
    })

    expect(screen.queryByText('Test Blueprint')).not.toBeInTheDocument()
  })

  it('should render title when open', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ test: 'data' })
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test Blueprint'
    })

    expect(screen.getByText('Test Blueprint')).toBeInTheDocument()
  })

  it('should show loading state while fetching', async () => {
    // Delay the fetch response
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => {
        resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ test: 'data' })
        } as Response)
      }, 100))
    )

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    expect(screen.getByText('Loading blueprint...')).toBeInTheDocument()
  })

  it('should display fetched JSON content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ unit: 'tank', health: 200 })
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    await waitFor(() => {
      expect(screen.getByText(/"unit"/)).toBeInTheDocument()
      expect(screen.getByText(/"tank"/)).toBeInTheDocument()
    })
  })

  it('should show error on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers()
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/nonexistent.json',
      title: 'Test'
    })

    await waitFor(() => {
      expect(screen.getByText(/Blueprint file not found/)).toBeInTheDocument()
    })
  })

  it('should show error on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers()
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to load blueprint/)).toBeInTheDocument()
    })
  })

  it('should call onClose when clicking close button', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({})
    } as Response)

    const user = userEvent.setup()
    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    const closeButton = screen.getByLabelText('Close')
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when clicking backdrop', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({})
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    // Click on the backdrop (the fixed overlay)
    const backdrop = screen.getByText('Test').closest('.fixed')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should call onClose when pressing Escape', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({})
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should show copy button when content is loaded', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ test: 'data' })
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument()
    })
  })

  it('should handle invalid JSON content type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      json: async () => ({})
    } as Response)

    renderModal({
      isOpen: true,
      onClose: mockOnClose,
      blueprintPath: '/path/to/blueprint.json',
      title: 'Test'
    })

    await waitFor(() => {
      expect(screen.getByText(/Blueprint file not found or invalid format/)).toBeInTheDocument()
    })
  })

  describe('base_spec navigation', () => {
    it('should show base_spec link when blueprint has base_spec field', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          unit: 'tank',
          base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
        })
      } as Response)

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
        expect(screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')).toBeInTheDocument()
      })
    })

    it('should not show base_spec link when blueprint has no base_spec', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ unit: 'tank', health: 200 })
      } as Response)

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      await waitFor(() => {
        expect(screen.getByText(/"unit"/)).toBeInTheDocument()
      })

      expect(screen.queryByText('Inherits from:')).not.toBeInTheDocument()
    })

    it('should navigate to base_spec when clicking the link', async () => {
      const user = userEvent.setup()

      // First fetch returns unit with base_spec
      // Second fetch returns the base spec content
      global.fetch = createBlueprintFetchMock([
        () => Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            unit: 'tank',
            base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
          })
        } as Response),
        () => Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            base: 'vehicle',
            navigation: { type: 'land' }
          })
        } as Response)
      ])

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      // Wait for initial content
      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
      })

      // Click the base_spec link
      const baseSpecButton = screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')
      await user.click(baseSpecButton)

      // Title should update to show base spec
      await waitFor(() => {
        expect(screen.getByText('Base Spec: base_vehicle.json')).toBeInTheDocument()
      })
    })

    it('should show back button after navigating to base_spec', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            unit: 'tank',
            base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ base: 'vehicle' })
        } as Response)

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      // Initially no back button
      expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument()

      // Wait and click base_spec
      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
      })

      const baseSpecButton = screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')
      await user.click(baseSpecButton)

      // Back button should appear
      await waitFor(() => {
        expect(screen.getByLabelText('Go back')).toBeInTheDocument()
      })
    })

    it('should navigate back when clicking back button', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            unit: 'tank',
            base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ base: 'vehicle' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            unit: 'tank',
            base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
          })
        } as Response)

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      // Navigate to base_spec
      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
      })

      const baseSpecButton = screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')
      await user.click(baseSpecButton)

      // Wait for navigation
      await waitFor(() => {
        expect(screen.getByLabelText('Go back')).toBeInTheDocument()
      })

      // Click back button
      const backButton = screen.getByLabelText('Go back')
      await user.click(backButton)

      // Should return to original title
      await waitFor(() => {
        expect(screen.getByText('Test Blueprint')).toBeInTheDocument()
      })

      // Back button should be gone
      expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument()
    })

    it('should support nested base_spec navigation', async () => {
      const user = userEvent.setup()

      global.fetch = createBlueprintFetchMock([
        () => Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            unit: 'tank',
            base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
          })
        } as Response),
        () => Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            base: 'vehicle',
            base_spec: '/pa/units/land/base_moveable/base_moveable.json'
          })
        } as Response)
      ])

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      // Navigate to first base_spec
      await waitFor(() => {
        expect(screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')).toBeInTheDocument()
      })

      const firstBaseSpec = screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')
      await user.click(firstBaseSpec)

      // Should show nested base_spec
      await waitFor(() => {
        expect(screen.getByText('/pa/units/land/base_moveable/base_moveable.json')).toBeInTheDocument()
      })
    })

    it('should show error when base_spec fetch fails', async () => {
      const user = userEvent.setup()

      global.fetch = createBlueprintFetchMock([
        () => Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            unit: 'tank',
            base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
          })
        } as Response),
        () => Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: new Headers()
        } as Response)
      ])

      renderModal({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/factions/MLA/assets/pa/units/land/tank/tank.json',
        title: 'Test Blueprint'
      })

      // Wait for initial content and click base_spec
      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
      })

      const baseSpecButton = screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')
      await user.click(baseSpecButton)

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Blueprint file not found/)).toBeInTheDocument()
      })
    })
  })

  describe('resolved view', () => {
    const mockResolvedData = {
      id: 'tank',
      resourceName: '/pa/units/land/tank/tank.json',
      displayName: 'Ant',
      tier: 1,
      unitTypes: ['Mobile', 'Tank', 'Land', 'Basic'],
      accessible: true,
      specs: {
        combat: {
          health: 200,
          dps: 45.5
        },
        economy: {
          buildCost: 100
        }
      }
    } as Unit

    function renderModalWithResolved(props: Parameters<typeof BlueprintModal>[0]) {
      return renderWithFactionProvider(
        <CurrentFactionProvider factionId="MLA">
          <BlueprintModal {...props} />
        </CurrentFactionProvider>
      )
    }

    it('should not show toggle when resolvedData is not provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ test: 'data' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint'
      })

      await waitFor(() => {
        expect(screen.getByText(/"test"/)).toBeInTheDocument()
      })

      // Toggle buttons should not be present
      expect(screen.queryByRole('tab', { name: 'Raw' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Resolved' })).not.toBeInTheDocument()
    })

    it('should show toggle when resolvedData is provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ test: 'data' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Raw' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })
    })

    it('should default to raw view', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ rawField: 'rawValue' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      await waitFor(() => {
        // Should show raw content
        expect(screen.getByText(/"rawField"/)).toBeInTheDocument()
        expect(screen.getByText(/"rawValue"/)).toBeInTheDocument()
      })

      // Should not show resolved content
      expect(screen.queryByText(/"displayName"/)).not.toBeInTheDocument()
    })

    it('should switch to resolved view when clicking Resolved button', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ rawField: 'rawValue' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })

      // Click Resolved button
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      // Should show resolved content
      await waitFor(() => {
        expect(screen.getByText(/"displayName"/)).toBeInTheDocument()
        expect(screen.getByText(/"Ant"/)).toBeInTheDocument()
        expect(screen.getByText(/"dps"/)).toBeInTheDocument()
      })
    })

    it('should switch back to raw view when clicking Raw button', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ rawField: 'rawValue' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })

      // Switch to resolved
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      await waitFor(() => {
        expect(screen.getByText(/"displayName"/)).toBeInTheDocument()
      })

      // Switch back to raw
      await user.click(screen.getByRole('tab', { name: 'Raw' }))

      await waitFor(() => {
        expect(screen.getByText(/"rawField"/)).toBeInTheDocument()
      })
    })

    it('should not show loading state in resolved view', async () => {
      const user = userEvent.setup()

      // Slow fetch that would show loading in raw mode
      global.fetch = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => {
          resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ rawField: 'rawValue' })
          } as Response)
        }, 100))
      )

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      // Wait for toggle to appear
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })

      // Switch to resolved immediately
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      // Should show resolved content immediately without loading
      expect(screen.queryByText('Loading blueprint...')).not.toBeInTheDocument()
      expect(screen.getByText(/"displayName"/)).toBeInTheDocument()
    })

    it('should hide base_spec link in resolved view', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          unit: 'tank',
          base_spec: '/pa/units/land/base_vehicle/base_vehicle.json'
        })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      // Wait for base_spec link to appear in raw view
      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
      })

      // Switch to resolved view
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      // Base spec link should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Inherits from:')).not.toBeInTheDocument()
      })
    })

    it('should reset to raw view when modal reopens', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ rawField: 'rawValue' })
      } as Response)

      const { rerender } = renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      // Switch to resolved
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      await waitFor(() => {
        expect(screen.getByText(/"displayName"/)).toBeInTheDocument()
      })

      // Close modal
      rerender(
        <CurrentFactionProvider factionId="MLA">
          <BlueprintModal
            isOpen={false}
            onClose={mockOnClose}
            blueprintPath="/path/to/blueprint.json"
            title="Test Blueprint"
            resolvedData={mockResolvedData}
          />
        </CurrentFactionProvider>
      )

      // Reopen modal
      rerender(
        <CurrentFactionProvider factionId="MLA">
          <BlueprintModal
            isOpen={true}
            onClose={mockOnClose}
            blueprintPath="/path/to/blueprint.json"
            title="Test Blueprint"
            resolvedData={mockResolvedData}
          />
        </CurrentFactionProvider>
      )

      // Should be back to raw view
      await waitFor(() => {
        expect(screen.getByText(/"rawField"/)).toBeInTheDocument()
      })
    })

    it('should show copy button in resolved view', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ rawField: 'rawValue' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })

      // Switch to resolved
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      // Copy button should be present
      await waitFor(() => {
        expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument()
      })
    })

    it('should handle empty object as resolvedData gracefully', async () => {
      const user = userEvent.setup()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ rawField: 'rawValue' })
      } as Response)

      // Pass an empty object (edge case)
      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: {} as any
      })

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Resolved' })).toBeInTheDocument()
      })

      // Switch to resolved view with empty object
      await user.click(screen.getByRole('tab', { name: 'Resolved' }))

      // Should not crash - the syntax highlighter will render the empty object
      // We verify by checking the content area exists and no error is shown
      await waitFor(() => {
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
        expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument()
      })
    })

    it('should have proper accessibility attributes on toggle buttons', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ test: 'data' })
      } as Response)

      renderModalWithResolved({
        isOpen: true,
        onClose: mockOnClose,
        blueprintPath: '/path/to/blueprint.json',
        title: 'Test Blueprint',
        resolvedData: mockResolvedData
      })

      await waitFor(() => {
        const rawTab = screen.getByRole('tab', { name: 'Raw' })
        const resolvedTab = screen.getByRole('tab', { name: 'Resolved' })

        // Check ARIA attributes
        expect(rawTab).toHaveAttribute('aria-selected', 'true')
        expect(resolvedTab).toHaveAttribute('aria-selected', 'false')
        expect(rawTab).toHaveAttribute('aria-controls', 'blueprint-content')
        expect(resolvedTab).toHaveAttribute('aria-controls', 'blueprint-content')
      })
    })
  })
})
