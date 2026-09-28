import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitModelModal } from '../UnitModelModal'

const { viewer, checkForNewBuild } = vi.hoisted(() => ({
  viewer: { failing: true },
  checkForNewBuild: vi.fn(),
}))

// Vitest wraps errors thrown by a mock factory, hiding the browser's message,
// so the chunk-load failure is raised on first render instead. The boundary
// classifies by message either way; retryableLazy's re-import has its own test.
vi.mock('../UnitModelViewer', () => ({
  default: ({ unitId }: { unitId: string }) => {
    if (viewer.failing) {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/UnitModelViewer-old.js')
    }
    return <p>viewer for {unitId}</p>
  },
}))
vi.mock('@/lib/staleBuild', () => ({ checkForNewBuild }))
vi.mock('@/lib/monitoring', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/monitoring')>()),
  reportError: vi.fn(),
}))

describe('UnitModelModal', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Single test by design: the viewer's retryableLazy is module state, so a
  // second test would start from whatever lazy() this one's retry left behind.

  it('keeps a failed viewer import inside the modal and recovers on Try again', async () => {
    checkForNewBuild.mockResolvedValue('unknown')
    render(<UnitModelModal factionId="exiles" unitId="jelly" title="Jelly" onClose={() => {}} />)

    const tryAgain = await screen.findByRole('button', { name: 'Try again' })
    viewer.failing = false
    await userEvent.click(tryAgain)
    expect(await screen.findByText('viewer for jelly')).toBeInTheDocument()
    // The modal chrome survived the failure.
    expect(screen.getByRole('dialog', { name: '3D model: Jelly' })).toBeInTheDocument()
  })
})
