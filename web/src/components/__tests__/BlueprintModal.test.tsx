import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlueprintModal } from '../BlueprintModal'

describe('BlueprintModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not render when closed', () => {
    render(
      <BlueprintModal
        isOpen={false}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test Blueprint"
      />
    )

    expect(screen.queryByText('Test Blueprint')).not.toBeInTheDocument()
  })

  it('should render title when open', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ test: 'data' })
    } as Response)

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test Blueprint"
      />
    )

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

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

    expect(screen.getByText('Loading blueprint...')).toBeInTheDocument()
  })

  it('should display fetched JSON content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ unit: 'tank', health: 200 })
    } as Response)

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

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

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/nonexistent.json"
        title="Test"
      />
    )

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

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

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
    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

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

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

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

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should show copy button when content is loaded', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ test: 'data' })
    } as Response)

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

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

    render(
      <BlueprintModal
        isOpen={true}
        onClose={mockOnClose}
        blueprintPath="/path/to/blueprint.json"
        title="Test"
      />
    )

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

      render(
        <BlueprintModal
          isOpen={true}
          onClose={mockOnClose}
          blueprintPath="/factions/MLA/assets/pa/units/land/tank/tank.json"
          title="Test Blueprint"
        />
      )

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

      render(
        <BlueprintModal
          isOpen={true}
          onClose={mockOnClose}
          blueprintPath="/factions/MLA/assets/pa/units/land/tank/tank.json"
          title="Test Blueprint"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/"unit"/)).toBeInTheDocument()
      })

      expect(screen.queryByText('Inherits from:')).not.toBeInTheDocument()
    })

    it('should navigate to base_spec when clicking the link', async () => {
      const user = userEvent.setup()

      // First fetch returns unit with base_spec
      // Second fetch returns the base spec content
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
          json: async () => ({
            base: 'vehicle',
            navigation: { type: 'land' }
          })
        } as Response)

      render(
        <BlueprintModal
          isOpen={true}
          onClose={mockOnClose}
          blueprintPath="/factions/MLA/assets/pa/units/land/tank/tank.json"
          title="Test Blueprint"
        />
      )

      // Wait for initial content
      await waitFor(() => {
        expect(screen.getByText('Inherits from:')).toBeInTheDocument()
      })

      // Click the base_spec link
      const baseSpecButton = screen.getByText('/pa/units/land/base_vehicle/base_vehicle.json')
      await user.click(baseSpecButton)

      // Should fetch the base spec file
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(global.fetch).toHaveBeenLastCalledWith(
          '/factions/MLA/assets/pa/units/land/base_vehicle/base_vehicle.json',
          expect.any(Object)
        )
      })

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

      render(
        <BlueprintModal
          isOpen={true}
          onClose={mockOnClose}
          blueprintPath="/factions/MLA/assets/pa/units/land/tank/tank.json"
          title="Test Blueprint"
        />
      )

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

      render(
        <BlueprintModal
          isOpen={true}
          onClose={mockOnClose}
          blueprintPath="/factions/MLA/assets/pa/units/land/tank/tank.json"
          title="Test Blueprint"
        />
      )

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
          json: async () => ({
            base: 'vehicle',
            base_spec: '/pa/units/land/base_moveable/base_moveable.json'
          })
        } as Response)

      render(
        <BlueprintModal
          isOpen={true}
          onClose={mockOnClose}
          blueprintPath="/factions/MLA/assets/pa/units/land/tank/tank.json"
          title="Test Blueprint"
        />
      )

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
  })
})
