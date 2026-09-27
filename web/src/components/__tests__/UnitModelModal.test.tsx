import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitModelModal } from '../UnitModelModal'

const { importAttempts, checkForNewBuild } = vi.hoisted(() => ({
  importAttempts: { count: 0 },
  checkForNewBuild: vi.fn(),
}))

// The first import fails the way a deleted chunk does; later ones succeed.
vi.mock('../UnitModelViewer', () => {
  importAttempts.count++
  if (importAttempts.count === 1) {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/UnitModelViewer-old.js')
  }
  return { default: ({ unitId }: { unitId: string }) => <p>viewer for {unitId}</p> }
})
vi.mock('@/lib/staleBuild', () => ({ checkForNewBuild }))
vi.mock('@/lib/monitoring', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/monitoring')>()),
  reportError: vi.fn(),
}))

describe('UnitModelModal', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('keeps a failed viewer import inside the modal and recovers on Try again', async () => {
    checkForNewBuild.mockResolvedValue('unknown')
    render(<UnitModelModal factionId="exiles" unitId="jelly" title="Jelly" onClose={() => {}} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('viewer for jelly')).toBeInTheDocument()
    // The modal chrome survived the failure.
    expect(screen.getByRole('dialog', { name: '3D model: Jelly' })).toBeInTheDocument()
  })
})
