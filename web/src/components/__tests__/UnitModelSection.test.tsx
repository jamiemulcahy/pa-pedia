import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { UnitModelSection } from '../UnitModelSection'
import { getFactionModelsIndex, type ModelsIndex } from '@/services/modelLoader'

// Mock the model availability layer so we control what the index returns.
vi.mock('@/services/modelLoader', () => ({
  getFactionModelsIndex: vi.fn(),
}))

// Mock the heavy three.js viewer so tests never touch WebGL — we only care that
// the section decides correctly whether to render it.
vi.mock('../UnitModelViewer', () => ({
  default: ({ unitId }: { unitId: string }) => <div data-testid="viewer">viewer:{unitId}</div>,
}))

const mockGetIndex = vi.mocked(getFactionModelsIndex)

const indexWith = (unitId: string): ModelsIndex => ({
  generated: '2026-07-11T00:00:00Z',
  unitCount: 1,
  units: { [unitId]: { glb: 'models/x.glb', diffuse: 'd', mask: 'm' } },
})

describe('UnitModelSection — graceful availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the viewer when the unit has a model', async () => {
    mockGetIndex.mockResolvedValue(indexWith('radar'))
    render(<UnitModelSection factionId="MLA" unitId="radar" />)
    expect(await screen.findByTestId('viewer')).toHaveTextContent('viewer:radar')
  })

  it('renders nothing when the unit has no model in the index', async () => {
    mockGetIndex.mockResolvedValue(indexWith('other_unit'))
    const { container } = render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await waitFor(() => expect(mockGetIndex).toHaveBeenCalled())
    expect(screen.queryByTestId('viewer')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the faction has no model bundle (null index)', async () => {
    mockGetIndex.mockResolvedValue(null)
    const { container } = render(<UnitModelSection factionId="MLA" unitId="radar" />)
    await waitFor(() => expect(mockGetIndex).toHaveBeenCalled())
    expect(screen.queryByTestId('viewer')).toBeNull()
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
    await screen.findByTestId('viewer')
    expect(mockGetIndex).toHaveBeenCalledWith('MLA', '1.0.0')
  })
})
