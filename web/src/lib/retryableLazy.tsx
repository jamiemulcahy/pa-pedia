import { lazy, type ComponentType } from 'react'

/**
 * `lazy()` whose import can be re-attempted.
 *
 * React caches a lazy component's rejected import for good, so after a chunk
 * fails to load, re-rendering the same lazy component just rethrows. `retry()`
 * swaps in a fresh `lazy()`; the stable `Component` renders whichever is current,
 * so call sites never hold a stale reference. The swap is module-wide, so a
 * successful retry also fixes every later mount.
 *
 * Pair with LazyLoadBoundary: pass `retry` as its `retryImport`. The swap only
 * takes effect on the next mount, which the boundary's reset provides.
 */
export function retryableLazy<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
) {
  let Current = lazy(load)

  function Component(props: P) {
    return <Current {...props} />
  }

  return {
    Component,
    retry: () => {
      Current = lazy(load)
    },
  }
}
