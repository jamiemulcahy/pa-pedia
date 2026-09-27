import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { LazyLoadBoundary } from '../LazyLoadBoundary'
import type { BuildStatus } from '@/lib/staleBuild'

const { checkForNewBuild, reportError } = vi.hoisted(() => ({
  checkForNewBuild: vi.fn<() => Promise<BuildStatus>>(),
  reportError: vi.fn(),
}))

vi.mock('@/lib/staleBuild', () => ({ checkForNewBuild }))
vi.mock('@/lib/monitoring', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/monitoring')>()),
  reportError,
}))

const CHUNK_ERROR = new TypeError(
  'Failed to fetch dynamically imported module: https://pa-pedia.com/assets/UnitModelViewer-JcajY5qs.js',
)

function Child({ failing, error }: { failing: boolean; error: Error }) {
  if (failing) throw error
  return <p>viewer loaded</p>
}

/** Throws `error` while `failing`; Try again flips it off, like a fresh import that succeeds. */
function Harness({ error }: { error: Error }) {
  const [failing, setFailing] = useState(true)
  return (
    <LazyLoadBoundary feature="the 3D viewer" onRetry={() => setFailing(false)}>
      <Child failing={failing} error={error} />
    </LazyLoadBoundary>
  )
}

describe('LazyLoadBoundary', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    vi.restoreAllMocks()
  })

  it('offers a reload when a newer build is deployed, without reloading on its own', async () => {
    checkForNewBuild.mockResolvedValue('stale')
    render(<Harness error={CHUNK_ERROR} />)

    const button = await screen.findByRole('button', { name: 'Reload page' })
    expect(screen.getByRole('alert')).toHaveTextContent(/updated since this page was opened/)
    expect(reload).not.toHaveBeenCalled()

    await userEvent.click(button)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // The reload-loop guard: after a reload the tab IS the deployed build, so a
  // chunk that still fails can only ever get Try again. Reload is never offered
  // twice, and never happens without a click.
  it.each<BuildStatus>(['current', 'unknown'])(
    'never offers or performs a reload when the build is %s',
    async status => {
      checkForNewBuild.mockResolvedValue(status)
      render(<Harness error={CHUNK_ERROR} />)

      await screen.findByRole('button', { name: 'Try again' })
      expect(screen.getByRole('alert')).toHaveTextContent(/check your connection/i)
      expect(screen.queryByRole('button', { name: 'Reload page' })).not.toBeInTheDocument()
      expect(reload).not.toHaveBeenCalled()
    },
  )

  it('shows a checking state while the build check is in flight', () => {
    checkForNewBuild.mockReturnValue(new Promise(() => {}))
    render(<Harness error={CHUNK_ERROR} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/checking for a site update/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('Try again re-renders the children', async () => {
    checkForNewBuild.mockResolvedValue('unknown')
    render(<Harness error={CHUNK_ERROR} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(screen.getByText('viewer loaded')).toBeInTheDocument()
  })

  it('reports chunk-load failures tagged with the build status', async () => {
    checkForNewBuild.mockResolvedValue('stale')
    render(<Harness error={CHUNK_ERROR} />)

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))
    expect(reportError).toHaveBeenCalledWith(CHUNK_ERROR, {
      level: 'warning',
      tags: { build_status: 'stale' },
    })
  })

  it('contains other errors too, reporting them without a build check', async () => {
    const bug = new Error('three.js exploded')
    render(<Harness error={bug} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong displaying the 3D viewer/i)
    expect(checkForNewBuild).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(bug, expect.objectContaining({ context: expect.any(Object) }))

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('viewer loaded')).toBeInTheDocument()
  })
})
