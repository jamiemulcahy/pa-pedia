import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitModelSection } from '../UnitModelSection'
import {
  getFactionModelsIndex,
  getModelBundleSourceVersion,
  type ModelsIndex,
} from '@/services/modelLoader'

// Mock the model availability layer so we control what the index returns.
vi.mock('@/services/modelLoader', () => ({
  getFactionModelsIndex: vi.fn(),
  getModelBundleSourceVersion: vi.fn(),
}))

// Mock the modal (and therefore the heavy three.js viewer) so tests never touch
// WebGL — we only care that the section shows the trigger and opens the modal.
vi.mock('../UnitModelModal', () => ({
  UnitModelModal: ({
    unitId,
    builtFromVersion,
    onClose,
  }: {
    unitId: string
    builtFromVersion?: string | null
    onClose: () => void
  }) => (
    <div data-testid="model-modal" data-built-from={builtFromVersion ?? ''}>
      modal:{unitId}
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const mockGetIndex = vi.mocked(getFactionModelsIndex)
const mockGetSourceVersion = vi.mocked(getModelBundleSourceVersion)

const indexWith = (unitId: string): ModelsIndex => ({
  generated: '2026-07-11T00:00:00Z',
  unitCount: 1,
  units: { [unitId]: { glb: 'models/x.glb', diffuse: 'd', mask: 'm' } },
})

// Default: the model belongs to the viewed version, so there is nothing to
// disclose. Re-armed after clearing because the component always calls it.
const resetModelMocks = () => {
  vi.clearAllMocks()
  mockGetSourceVersion.mockResolvedValue(null)
}

describe('UnitModelSection — trigger + modal', () => {
  beforeEach(resetModelMocks)

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

// A faction's models are regenerated far less often than its unit data, so the
// manifest attaches the newest available bundle to versions that have none of
// their own. The model is then real but was built from a different release —
// which the viewer must say, rather than implying it is this version's own.
describe('UnitModelSection — model borrowed from another version', () => {
  beforeEach(resetModelMocks)

  it('tells the modal which version the model was built from', async () => {
    mockGetIndex.mockResolvedValue(indexWith('can'))
    mockGetSourceVersion.mockResolvedValue('0.7.4.6')

    render(<UnitModelSection factionId="Exiles" unitId="can" version="0.8.1" />)
    await userEvent.click(await screen.findByTestId('view-3d-model'))

    expect(screen.getByTestId('model-modal')).toHaveAttribute('data-built-from', '0.7.4.6')
  })

  it('says nothing when the model belongs to the viewed version', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    mockGetSourceVersion.mockResolvedValue(null)

    render(<UnitModelSection factionId="MLA" unitId="radar" version="124664" />)
    await userEvent.click(await screen.findByTestId('view-3d-model'))

    expect(screen.getByTestId('model-modal')).toHaveAttribute('data-built-from', '')
  })

  // The disclosure is a nicety; the model is the point. Failing to learn which
  // version built it must not take the working viewer down with it.
  it('still offers the model when the disclosure lookup fails', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    mockGetSourceVersion.mockRejectedValue(new Error('manifest gone'))

    render(<UnitModelSection factionId="MLA" unitId="radar" />)

    const button = await screen.findByTestId('view-3d-model')
    expect(button).not.toHaveAttribute('aria-disabled')
    await userEvent.click(button)
    expect(screen.getByTestId('model-modal')).toBeInTheDocument()
  })

  it('does not look up a source version for a unit with no model', async () => {
    mockGetIndex.mockResolvedValue(indexWith('other'))

    render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await screen.findByTestId('view-3d-model')

    expect(mockGetSourceVersion).not.toHaveBeenCalled()
  })
})

describe('UnitModelSection — unavailable state', () => {
  beforeEach(resetModelMocks)

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
  beforeEach(resetModelMocks)

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
  beforeEach(resetModelMocks)

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
