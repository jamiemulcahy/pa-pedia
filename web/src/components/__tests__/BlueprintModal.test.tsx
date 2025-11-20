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
})
