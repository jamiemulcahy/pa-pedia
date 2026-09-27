import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { LazyLoadBoundary } from '../LazyLoadBoundary'
import type { BuildStatus } from '@/lib/staleBuild'

const { checkForNewBuild, reportError, retryImport } = vi.hoisted(() => ({
  checkForNewBuild: vi.fn<() => Promise<BuildStatus>>(),
  reportError: vi.fn(),
  retryImport: vi.fn(),
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

/**
 * Throws `error` until the first remount after a Try again, like a fresh import
 * that succeeds. `resetKey` is forwarded so tests can change it.
 */
function Harness({ error, resetKey }: { error: Error; resetKey?: string }) {
  const [failing, setFailing] = useState(true)
  return (
    <LazyLoadBoundary
      feature="the 3D viewer"
      retryImport={() => {
        retryImport()
        setFailing(false)
      }}
      resetKey={resetKey}
    >
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

  // The reload-loop guard: nothing here reloads without a click, so however
  // many times a chunk fails (after a reload the tab IS the deployed build, so
  // the check says `current`), the page never reloads itself.
  it.each<[BuildStatus, RegExp]>([
    ['current', /reload the page if it keeps failing/i],
    ['unknown', /check your connection/i],
  ])('leads with Try again and never reloads by itself when the build is %s', async (status, message) => {
    checkForNewBuild.mockResolvedValue(status)
    render(<Harness error={CHUNK_ERROR} />)

    await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    // Offered as the fallback for browsers that remember a failed import.
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows a checking state while the build check is in flight', () => {
    checkForNewBuild.mockReturnValue(new Promise(() => {}))
    render(<Harness error={CHUNK_ERROR} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/checking for a site update/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('Try again re-attempts the import and remounts the children', async () => {
    checkForNewBuild.mockResolvedValue('unknown')
    render(<Harness error={CHUNK_ERROR} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(retryImport).toHaveBeenCalledTimes(1)
    expect(screen.getByText('viewer loaded')).toBeInTheDocument()
  })

  it('clears a shown failure when the reset key changes', async () => {
    checkForNewBuild.mockResolvedValue('unknown')
    const { rerender } = render(<Harness error={CHUNK_ERROR} resetKey="exiles/jelly" />)
    await screen.findByRole('button', { name: 'Try again' })

    rerender(<Harness error={CHUNK_ERROR} resetKey="exiles/other" />)
    expect(await screen.findByText('viewer loaded')).toBeInTheDocument()
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
  })

  it('remounts without re-importing on Try again after a render error', async () => {
    let throws = true
    function Flaky() {
      if (throws) throw new Error('three.js exploded')
      return <p>recovered</p>
    }
    render(
      <LazyLoadBoundary feature="the 3D viewer" retryImport={retryImport}>
        <Flaky />
      </LazyLoadBoundary>,
    )

    throws = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('recovered')).toBeInTheDocument()
    // Only a failed import needs a fresh lazy(); swapping it here would force
    // a pointless Suspense round-trip.
    expect(retryImport).not.toHaveBeenCalled()
  })
})
