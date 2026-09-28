import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

/** Throws while `state.throws` is set; flipping it simulates a fixed render. */
const state = { throws: true, error: CHUNK_ERROR as Error }
function Child() {
  if (state.throws) throw state.error
  return <p>viewer loaded</p>
}

function renderBoundary(error: Error, resetKey?: string) {
  state.throws = true
  state.error = error
  return render(
    <LazyLoadBoundary feature="the 3D viewer" resetKey={resetKey}>
      <Child />
    </LazyLoadBoundary>,
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

  it('shows a checking state while the build check is in flight', () => {
    checkForNewBuild.mockReturnValue(new Promise(() => {}))
    renderBoundary(CHUNK_ERROR)
    expect(screen.getByRole('alert')).toHaveTextContent(/checking for a site update/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // Reload is the only way out of a failed import: Chromium caches the failure
  // for the document's lifetime, so there is deliberately no Try again. The
  // reload-loop guarantee is that it only ever happens on a click.
  it.each<[BuildStatus, RegExp]>([
    ['stale', /updated since this page was opened/],
    ['current', /reloading the page usually fixes this/i],
    ['unknown', /check your connection, then reload/i],
  ])('offers only Reload page when the build is %s, and reloads only on click', async (status, message) => {
    checkForNewBuild.mockResolvedValue(status)
    renderBoundary(CHUNK_ERROR)

    const button = await screen.findByRole('button', { name: 'Reload page' })
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(reload).not.toHaveBeenCalled()

    await userEvent.click(button)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reports chunk-load failures tagged with the build status', async () => {
    checkForNewBuild.mockResolvedValue('stale')
    renderBoundary(CHUNK_ERROR)

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))
    expect(reportError).toHaveBeenCalledWith(CHUNK_ERROR, {
      level: 'warning',
      tags: { build_status: 'stale' },
    })
  })

  it('contains other errors too, reporting them without a build check', () => {
    const bug = new Error('three.js exploded')
    renderBoundary(bug)

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong displaying the 3D viewer/i)
    expect(checkForNewBuild).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(bug, expect.objectContaining({ context: expect.any(Object) }))
  })

  it('remounts on Try again after a render error', async () => {
    renderBoundary(new Error('three.js exploded'))

    state.throws = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('viewer loaded')).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it('clears a shown failure when the reset key changes', () => {
    const { rerender } = renderBoundary(new Error('three.js exploded'), 'exiles/jelly')
    expect(screen.getByRole('alert')).toBeInTheDocument()

    state.throws = false
    rerender(
      <LazyLoadBoundary feature="the 3D viewer" resetKey="exiles/other">
        <Child />
      </LazyLoadBoundary>,
    )
    expect(screen.getByText('viewer loaded')).toBeInTheDocument()
  })
})
