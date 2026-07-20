import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { VersionDiffModal } from '../VersionDiffModal'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithFactionProvider } from '@/tests/helpers'
import { setupMockFetch, mockMLAIndex } from '@/tests/mocks/factionData'
import * as factionLoader from '@/services/factionLoader'
import type { FactionIndex, FactionMetadata } from '@/types/faction'

/** Build an asset map from path → string content, as loadFactionAssets returns. */
function assetMap(entries: Record<string, string>): Map<string, Blob> {
  const map = new Map<string, Blob>()
  for (const [path, content] of Object.entries(entries)) map.set(path, new Blob([content]))
  return map
}

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
  currentVersionKey?: string | null
  currentMetadata?: FactionMetadata
}) {
  const {
    previousVersion = '0.9.0',
    currentVersion = '1.0.0',
    currentVersionKey = null,
    ...rest
  } = props
  return renderWithFactionProvider(
    <BrowserRouter>
      <CurrentFactionProvider factionId="MLA">
        <VersionDiffModal
          factionId="MLA"
          previousVersion={previousVersion}
          currentVersion={currentVersion}
          currentVersionKey={currentVersionKey}
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

  it('shows an empty state when source files are unavailable and nothing changed', async () => {
    // Default test/dev mode: loadFactionAssets returns null (no cached file trees).
    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })

    await waitFor(() => {
      expect(screen.getByText(/No tracked changes/i)).toBeInTheDocument()
    })
  })

  it('surfaces raw source-file changes invisible to units.json', async () => {
    const path = 'assets/pa/units/land/tank/tank_ammo.json'
    vi.spyOn(factionLoader, 'loadFactionAssets')
      .mockResolvedValueOnce(assetMap({ [path]: '{"collision_check":"Enemies"}' })) // previous
      .mockResolvedValueOnce(assetMap({ [path]: '{"collision_check":"target"}' })) // current

    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })

    await waitFor(() => {
      expect(screen.getByText(/Other changes/i)).toBeInTheDocument()
    })
    expect(screen.getByText('collision_check: "Enemies" → "target"')).toBeInTheDocument()
    expect(screen.queryByText(/No tracked changes/i)).not.toBeInTheDocument()
  })

  it('reports a version-number bump when nothing changed on either side', async () => {
    const same = () => assetMap({ 'assets/pa/units/land/tank/tank.json': '{"x":1}' })
    vi.spyOn(factionLoader, 'loadFactionAssets')
      .mockResolvedValueOnce(same())
      .mockResolvedValueOnce(same())

    renderModal({ isOpen: true, onClose: mockOnClose, currentIndex: cloneMLAIndex() })

    await waitFor(() => {
      expect(screen.getByText(/Version-number bump only/i)).toBeInTheDocument()
    })
  })
})
