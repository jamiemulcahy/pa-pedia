import { Component, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitModelSection } from '../UnitModelSection'
import { getFactionModelsIndex, type ModelsIndex } from '@/services/modelLoader'

// Mock the model availability layer so we control what the index returns.
vi.mock('@/services/modelLoader', () => ({
  getFactionModelsIndex: vi.fn(),
}))

// Mock the modal (and therefore the heavy three.js viewer) so tests never touch
// WebGL — we only care that the section shows the trigger and opens the modal.
vi.mock('../UnitModelModal', () => ({
  UnitModelModal: ({ unitId, onClose }: { unitId: string; onClose: () => void }) => (
    <div data-testid="model-modal">
      modal:{unitId}
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const mockGetIndex = vi.mocked(getFactionModelsIndex)

const indexWith = (unitId: string): ModelsIndex => ({
  generated: '2026-07-11T00:00:00Z',
  unitCount: 1,
  units: { [unitId]: { glb: 'models/x.glb', diffuse: 'd', mask: 'm' } },
})

describe('UnitModelSection — trigger + modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the "View 3D Model" button when the unit has a model', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)
    expect(await screen.findByTestId('view-3d-model')).toBeInTheDocument()
    // The modal (and its model download) is NOT rendered until clicked.
    expect(screen.queryByTestId('model-modal')).toBeNull()
  })

  it('opens the modal only when the button is clicked', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)
    const button = await screen.findByTestId('view-3d-model')

    expect(screen.queryByTestId('model-modal')).toBeNull()
    await userEvent.click(button)
    expect(screen.getByTestId('model-modal')).toHaveTextContent('modal:radar')
  })

  it('closes the modal via its onClose', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await userEvent.click(await screen.findByTestId('view-3d-model'))
    expect(screen.getByTestId('model-modal')).toBeInTheDocument()
    await userEvent.click(screen.getByText('close'))
    expect(screen.queryByTestId('model-modal')).toBeNull()
  })

  it('passes the version through to the availability lookup', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" version="1.0.0" />)
    await screen.findByTestId('view-3d-model')
    expect(mockGetIndex).toHaveBeenCalledWith('MLA', '1.0.0')
  })
})

describe('UnitModelSection — unavailable state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Each of these means the unit genuinely HAS no model, by a different route.
  // A failed lookup is deliberately not in this list — see the error suite.
  const unavailableCases: Array<[string, () => void]> = [
    ['the unit is absent from the index', () => mockGetIndex.mockResolvedValue(indexWith('other'))],
    ['the faction has no model bundle', () => mockGetIndex.mockResolvedValue(null)],
  ]

  it.each(unavailableCases)('shows a disabled button with a tooltip when %s', async (_label, arrange) => {
    arrange()
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = await screen.findByTestId('view-3d-model')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('title', expect.stringContaining('No 3D model is available'))
  })

  it('does not open the modal when the disabled button is clicked', async () => {
    mockGetIndex.mockResolvedValue(null)
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    await userEvent.click(await screen.findByTestId('view-3d-model'))
    expect(screen.queryByTestId('model-modal')).toBeNull()
  })

  // aria-disabled (rather than the disabled attribute) is load-bearing: a truly
  // disabled button suppresses pointer events, so the title tooltip explaining
  // the absence would never appear — which is the whole point of showing it.
  it('stays hoverable and focusable so the tooltip is reachable', async () => {
    mockGetIndex.mockResolvedValue(null)
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = await screen.findByTestId('view-3d-model')
    expect(button).not.toBeDisabled()
    await userEvent.tab()
    expect(button).toHaveFocus()
  })
})

describe('UnitModelSection — failed lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // The distinction that matters: a failed check must not claim the model is
  // absent. The models may well exist — we simply could not find out.
  it('says it could not check, NOT that no model exists', async () => {
    mockGetIndex.mockRejectedValue(new Error('network'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = await screen.findByTestId('view-3d-model')
    expect(button).toHaveAttribute('data-state', 'error')
    expect(button).toHaveAttribute('title', "Couldn't check for a 3D model. Try reloading the page.")
    expect(button.getAttribute('title')).not.toMatch(/No 3D model is available/)
  })

  it('never surfaces the underlying error detail', async () => {
    mockGetIndex.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.1:443 /internal/bundle.zip')
    )
    const { container } = render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = await screen.findByTestId('view-3d-model')
    expect(button.getAttribute('title')).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|internal|\.zip/i)
    expect(container.textContent).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|internal/i)
  })

  it('is still disabled and inert', async () => {
    mockGetIndex.mockRejectedValue(new Error('network'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = await screen.findByTestId('view-3d-model')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(screen.queryByTestId('model-modal')).toBeNull()
  })

  it('marks a genuine absence as such, not as an error', async () => {
    mockGetIndex.mockResolvedValue(null)
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    expect(await screen.findByTestId('view-3d-model')).toHaveAttribute('data-state', 'none')
  })
})

describe('UnitModelSection — checking state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a disabled loading button while availability is in flight', async () => {
    // A promise we never resolve, pinning the component in the checking state.
    mockGetIndex.mockReturnValue(new Promise(() => {}))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = screen.getByTestId('view-3d-model-checking')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(/checking/i)
    // Not yet the real trigger, and no tooltip claiming the model is missing.
    expect(screen.queryByTestId('view-3d-model')).toBeNull()
  })

  it('replaces the loading button with the real trigger once available', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    expect(await screen.findByTestId('view-3d-model')).toBeEnabled()
    await waitFor(() => expect(screen.queryByTestId('view-3d-model-checking')).toBeNull())
  })
})

describe('UnitModelSection — survives browser page translation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Wrap each text node in a <font>, as Chrome/Edge translation does. */
  function simulateBrowserTranslation(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const texts: Text[] = []
    while (walker.nextNode()) texts.push(walker.currentNode as Text)

    for (const text of texts) {
      if (!text.data.trim()) continue
      const font = document.createElement('font')
      text.replaceWith(font)
      font.appendChild(text)
    }
    // Without a detached text node these tests would pass for the wrong reason.
    expect(root.querySelectorAll('font').length).toBeGreaterThan(0)
  }

  class CaptureBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state: { error: Error | null } = { error: null }
    static getDerivedStateFromError(error: Error) {
      return { error }
    }
    render() {
      if (this.state.error) {
        return <div data-testid="boundary-tripped">{this.state.error.message}</div>
      }
      return this.props.children
    }
  }

  it('swaps the spinner for the trigger after the page has been translated', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    const { container } = render(
      <CaptureBoundary>
        <UnitModelSection factionId="MLA" unitId="radar" />
      </CaptureBoundary>
    )

    // Translation runs while the availability lookup is still in flight; the
    // lookup resolving is what swaps the spinner for the icon.
    expect(screen.getByTestId('view-3d-model-checking')).toBeInTheDocument()
    simulateBrowserTranslation(container)

    const button = await screen.findByTestId('view-3d-model')
    expect(screen.queryByTestId('boundary-tripped')).toBeNull()
    expect(button).toHaveTextContent('View 3D Model')
  })

  it('reaches the unavailable state after the page has been translated', async () => {
    mockGetIndex.mockResolvedValue(null)
    const { container } = render(
      <CaptureBoundary>
        <UnitModelSection factionId="MLA" unitId="radar" />
      </CaptureBoundary>
    )

    simulateBrowserTranslation(container)

    const button = await screen.findByTestId('view-3d-model')
    expect(screen.queryByTestId('boundary-tripped')).toBeNull()
    expect(button).toHaveAttribute('data-state', 'none')
  })

  it('reaches the error state after the page has been translated', async () => {
    mockGetIndex.mockRejectedValue(new Error('network'))
    const { container } = render(
      <CaptureBoundary>
        <UnitModelSection factionId="MLA" unitId="radar" />
      </CaptureBoundary>
    )

    simulateBrowserTranslation(container)

    const button = await screen.findByTestId('view-3d-model')
    expect(screen.queryByTestId('boundary-tripped')).toBeNull()
    expect(button).toHaveAttribute('data-state', 'error')
  })

  it('still opens the modal once translated', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    const { container } = render(
      <CaptureBoundary>
        <UnitModelSection factionId="MLA" unitId="radar" />
      </CaptureBoundary>
    )

    simulateBrowserTranslation(container)

    await userEvent.click(await screen.findByTestId('view-3d-model'))
    expect(screen.queryByTestId('boundary-tripped')).toBeNull()
    expect(screen.getByTestId('model-modal')).toHaveTextContent('modal:radar')
  })
})
