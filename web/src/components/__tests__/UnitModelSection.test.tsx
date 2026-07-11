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

  it('renders nothing when the unit has no model in the index', async () => {
    mockGetIndex.mockResolvedValue(indexWith('other_unit'))
    const { container } = render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await waitFor(() => expect(mockGetIndex).toHaveBeenCalled())
    expect(screen.queryByTestId('view-3d-model')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the faction has no model bundle (null index)', async () => {
    mockGetIndex.mockResolvedValue(null)
    const { container } = render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await waitFor(() => expect(mockGetIndex).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing (no crash) when availability lookup rejects', async () => {
    mockGetIndex.mockRejectedValue(new Error('network'))
    const { container } = render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await waitFor(() => expect(mockGetIndex).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('passes the version through to the availability lookup', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" version="1.0.0" />)
    await screen.findByTestId('view-3d-model')
    expect(mockGetIndex).toHaveBeenCalledWith('MLA', '1.0.0')
  })
})
