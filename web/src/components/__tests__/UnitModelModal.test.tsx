import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitModelModal } from '../UnitModelModal'

const { checkForNewBuild } = vi.hoisted(() => ({ checkForNewBuild: vi.fn() }))

// Vitest wraps errors thrown by a mock factory, hiding the browser's message,
// so the chunk-load failure is raised on render instead. The boundary
// classifies by message either way.
vi.mock('../UnitModelViewer', () => ({
  default: () => {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/UnitModelViewer-old.js')
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

  it('keeps a failed viewer import inside the modal and offers a reload', async () => {
    checkForNewBuild.mockResolvedValue('stale')
    render(<UnitModelModal factionId="exiles" unitId="jelly" title="Jelly" onClose={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    // The modal chrome survived the failure.
    expect(screen.getByRole('dialog', { name: '3D model: Jelly' })).toBeInTheDocument()
  })
})
