import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlueprintLink } from '../BlueprintLink'

describe('BlueprintLink', () => {
  beforeEach(() => {
    // Mock fetch for modal content loading
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ unit: 'tank', health: 200 })
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render button with display name', () => {
    render(
      <BlueprintLink
        factionId="MLA"
        unitId="tank"
        resourceName="/pa/units/land/tank/tank.json"
        displayName="Tank Blueprint"
      />
    )

    expect(screen.getByText('Tank Blueprint')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should render button with resource name when no display name', () => {
    render(
      <BlueprintLink
        factionId="MLA"
        unitId="tank"
        resourceName="/pa/units/land/tank/tank.json"
      />
    )

    expect(screen.getByText('/pa/units/land/tank/tank.json')).toBeInTheDocument()
  })

  it('should open modal when clicked', async () => {
    const user = userEvent.setup()
    render(
      <BlueprintLink
        factionId="MLA"
        unitId="tank"
        resourceName="/pa/units/land/tank/tank.json"
        displayName="View Blueprint"
      />
    )

    const button = screen.getByText('View Blueprint')
    await user.click(button)

    // Modal should appear with title
    await waitFor(() => {
      expect(screen.getByText('Blueprint: View Blueprint')).toBeInTheDocument()
    })
  })

  it('should generate correct blueprint path', async () => {
    const user = userEvent.setup()
    render(
      <BlueprintLink
        factionId="MLA"
        unitId="tank"
        resourceName="/pa/units/land/tank/tank.json"
        displayName="View"
      />
    )

    await user.click(screen.getByText('View'))

    // Check that fetch was called with correct path
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/factions/MLA/units/tank/tank.json')
    })
  })

  it('should close modal when clicking close button', async () => {
    const user = userEvent.setup()
    render(
      <BlueprintLink
        factionId="MLA"
        unitId="tank"
        resourceName="/pa/units/land/tank/tank.json"
        displayName="View Blueprint"
      />
    )

    // Open modal
    await user.click(screen.getByText('View Blueprint'))

    await waitFor(() => {
      expect(screen.getByText('Blueprint: View Blueprint')).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByLabelText('Close')
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Blueprint: View Blueprint')).not.toBeInTheDocument()
    })
  })
})
