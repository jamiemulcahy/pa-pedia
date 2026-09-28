import { describe, it, expect, vi } from 'vitest'
import { Component as ReactComponent, Suspense, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { retryableLazy } from '../retryableLazy'

function Hello({ name }: { name: string }) {
  return <p>hello {name}</p>
}

class Catch extends ReactComponent<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <p>failed</p> : this.props.children
  }
}

function mount(Viewer: (p: { name: string }) => ReactNode, key: number) {
  return (
    <Catch key={key}>
      <Suspense fallback={null}>
        <Viewer name="jelly" />
      </Suspense>
    </Catch>
  )
}

describe('retryableLazy', () => {
  it('recovers from a rejected import only after retry()', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const load = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue({ default: Hello })
    const { Component, retry } = retryableLazy(load)

    const { rerender } = render(mount(Component, 1))
    expect(await screen.findByText('failed')).toBeInTheDocument()

    // React caches the rejection: a remount alone re-throws without re-importing.
    rerender(mount(Component, 2))
    expect(await screen.findByText('failed')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(1)

    retry()
    rerender(mount(Component, 3))
    expect(await screen.findByText('hello jelly')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })
})
