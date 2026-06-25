import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { VersionDiffModal } from '../VersionDiffModal'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithFactionProvider } from '@/tests/helpers'
import { setupMockFetch, mockMLAIndex } from '@/tests/mocks/factionData'
import type { FactionIndex } from '@/types/faction'

/**
 * In standard test/dev mode a versioned index load ignores the version and serves
 * the base `units.json` (see loadFactionIndex). So the mock serves `mockMLAIndex`
 * as the "previous" version, and we pass a tweaked `currentIndex` to produce a diff.
 */
function cloneMLAIndex(): FactionIndex {
  return structuredClone(mockMLAIndex)
}

function renderModal(props: {
  isOpen: boolean
  onClose: () => void
  currentIndex: FactionIndex
  previousVersion?: string
  currentVersion?: string
}) {
  const { previousVersion = '0.9.0', currentVersion = '1.0.0', ...rest } = props
  return renderWithFactionProvider(
    <BrowserRouter>
      <CurrentFactionProvider factionId="MLA">
        <VersionDiffModal
          factionId="MLA"
          previousVersion={previousVersion}
          currentVersion={currentVersion}
          {...rest}
        />
      </CurrentFactionProvider>
    </BrowserRouter>
  )
}

describe('VersionDiffModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    setupMockFetch()
    mockOnClose.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render when closed', () => {
    renderModal({ isOpen: false, onClose: mockOnClose, currentIndex: cloneMLAIndex() })
    expect(screen.queryByText(/what changed/i)).not.toBeInTheDocument()
  })

  it('renders the version labels in the header when open', () => {
    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })
    expect(screen.getByText(/what changed/i)).toBeInTheDocument()
    expect(screen.getByText('v0.9.0')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })
    fireEvent.click(screen.getByLabelText('Close'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', () => {
    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('shows a humanised changed-field diff', async () => {
    const current = cloneMLAIndex()
    const tank = current.units.find((u) => u.identifier === 'tank')!
    tank.unit.specs.combat.health = 250 // was 200

    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: current })

    await waitFor(() => {
      expect(screen.getByText(/Changed \(1\)/)).toBeInTheDocument()
    })
    expect(screen.getByText('Health: 200 → 250 (+25%)')).toBeInTheDocument()
  })

  it('detects added and removed units', async () => {
    const current = cloneMLAIndex()
    // Remove the bot (removed unit) and add a brand-new unit (added unit)
    current.units = current.units.filter((u) => u.identifier !== 'bot')
    const tank = current.units.find((u) => u.identifier === 'tank')!
    current.units.push({
      ...tank,
      identifier: 'new_unit',
      displayName: 'New Unit',
      unit: { ...tank.unit, id: 'new_unit', displayName: 'New Unit' },
    })

    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: current })

    await waitFor(() => {
      expect(screen.getByText(/Added \(1\)/)).toBeInTheDocument()
    })
    expect(screen.getByText('New Unit')).toBeInTheDocument()
    expect(screen.getByText(/Removed \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('Bot')).toBeInTheDocument()
  })

  it('shows an empty state when nothing changed', async () => {
    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })

    await waitFor(() => {
      expect(screen.getByText(/No tracked changes/i)).toBeInTheDocument()
    })
  })
})
