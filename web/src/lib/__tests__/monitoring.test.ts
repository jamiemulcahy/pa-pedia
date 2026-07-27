import { describe, it, expect } from 'vitest'
import type { ErrorEvent, EventHint } from '@sentry/react'
import {
  isChunkLoadError,
  isIdbTeardownError,
  eventMessage,
  filterEvent,
  parseSampleRate,
} from '../monitoring'

/**
 * Minimal Sentry error event carrying a single exception value.
 *
 * No mechanism, which is how `captureException` events arrive unless the SDK
 * marks them otherwise — i.e. a handled report.
 */
function errorEvent(type: string, value: string): ErrorEvent {
  return {
    type: undefined,
    exception: { values: [{ type, value }] },
  } as ErrorEvent
}

/** As above, but flagged the way global handlers (onunhandledrejection) mark events. */
function unhandledEvent(type: string, value: string): ErrorEvent {
  return {
    type: undefined,
    exception: {
      values: [{ type, value, mechanism: { type: 'onunhandledrejection', handled: false } }],
    },
  } as ErrorEvent
}

describe('isChunkLoadError', () => {
  // These are the real messages browsers emit when a stale index.html points at
  // a bundle the latest deploy deleted.
  it.each([
    'Failed to fetch dynamically imported module: https://pa-pedia.com/assets/UnitDetail-a1b2c3.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'ChunkLoadError: Loading chunk 42 failed.',
    'Unable to preload CSS for /assets/index-9f8e7d.css',
  ])('detects %s', message => {
    expect(isChunkLoadError(message)).toBe(true)
  })

  it('does not match ordinary application errors', () => {
    expect(isChunkLoadError('Cannot read properties of undefined')).toBe(false)
    expect(isChunkLoadError('QuotaExceededError: IndexedDB is full')).toBe(false)
    expect(isChunkLoadError('Failed to fetch')).toBe(false)
  })
})

describe('isIdbTeardownError', () => {
  // Both messages came off one page load in Sentry (PA-PEDIA-2 / PA-PEDIA-3):
  // Chromium force-closed the origin's storage under two open transactions.
  it('matches the messages Chromium emits when it force-closes storage', () => {
    expect(
      isIdbTeardownError(
        'UnknownError: Connection is closing because of: Force close delete origin',
      ),
    ).toBe(true)
  })

  // idb's fallback when the transaction aborted without setting tx.error.
  it("matches idb's stackless tx.done rejection", () => {
    expect(isIdbTeardownError('AbortError: AbortError')).toBe(true)
  })

  it('leaves other IndexedDB failures alone', () => {
    expect(isIdbTeardownError('QuotaExceededError: quota exceeded')).toBe(false)
    // A real fetch/user abort carries a descriptive message, unlike idb's.
    expect(
      isIdbTeardownError('AbortError: The user aborted a request'),
    ).toBe(false)
  })
})

describe('eventMessage', () => {
  it('reads the exception type and value', () => {
    const message = eventMessage(errorEvent('TypeError', 'x is not a function'))
    expect(message).toContain('TypeError')
    expect(message).toContain('x is not a function')
  })

  it('falls back to the original exception from the hint', () => {
    const event = { type: undefined } as ErrorEvent
    const hint = { originalException: new Error('ChunkLoadError') } as EventHint
    expect(eventMessage(event, hint)).toContain('ChunkLoadError')
  })

  it('handles events with no exception data', () => {
    expect(eventMessage({ type: undefined } as ErrorEvent)).toBe('')
  })

  it('reads non-Error throwables such as DOMException', () => {
    // DOMException does not inherit from Error in browsers, and IndexedDB and
    // fetch both throw it. An instanceof check would miss the message.
    const event = { type: undefined } as ErrorEvent
    const hint = {
      originalException: { name: 'QuotaExceededError', message: 'ChunkLoadError' },
    } as unknown as EventHint
    expect(eventMessage(event, hint)).toContain('ChunkLoadError')
  })

  it('ignores a hint whose message is not a string', () => {
    const event = { type: undefined } as ErrorEvent
    const hint = { originalException: { message: 42 } } as unknown as EventHint
    expect(eventMessage(event, hint)).toBe('')
  })
})

describe('parseSampleRate', () => {
  it('parses a valid rate', () => {
    expect(parseSampleRate('0.25', 0.1)).toBe(0.25)
    expect(parseSampleRate('0', 0.1)).toBe(0)
    expect(parseSampleRate('1', 0.1)).toBe(1)
  })

  it('falls back when the variable is unset or blank', () => {
    // Vite yields '' for keys present but empty in .env; Number('') is 0, which
    // would silently disable tracing instead of using the default.
    expect(parseSampleRate('', 0.1)).toBe(0.1)
    expect(parseSampleRate('   ', 0.1)).toBe(0.1)
    expect(parseSampleRate(undefined, 0.1)).toBe(0.1)
  })

  it('falls back on non-numeric or out-of-range values', () => {
    expect(parseSampleRate('abc', 0.1)).toBe(0.1)
    expect(parseSampleRate('-1', 0.1)).toBe(0.1)
    expect(parseSampleRate('1.5', 0.1)).toBe(0.1)
    expect(parseSampleRate('Infinity', 0.1)).toBe(0.1)
  })
})

describe('filterEvent', () => {
  it('passes ordinary errors through untouched', () => {
    const event = errorEvent('TypeError', 'units is not iterable')
    const result = filterEvent(event, undefined, () => 0.99)

    expect(result).toBe(event)
    expect(result?.fingerprint).toBeUndefined()
  })

  it('drops unhandled IndexedDB teardown noise', () => {
    const aborted = unhandledEvent('AbortError', 'AbortError')
    const forceClosed = unhandledEvent(
      'UnknownError',
      'Connection is closing because of: Force close delete origin',
    )

    // Not sampled: these escaped from a global handler and duplicate what the
    // catch sites in factionLoader already report.
    expect(filterEvent(aborted, undefined, () => 0)).toBeNull()
    expect(filterEvent(forceClosed, undefined, () => 0)).toBeNull()
  })

  // The whole point of the teardown filter is that the deliberate report
  // survives. A force-close rejects getLocalFactionIds() with exactly this
  // message, and factionLoader reports it via reportError — dropping that too
  // would leave real storage failures invisible.
  it('keeps the deliberate reportError for the same failure', () => {
    const reported = errorEvent(
      'UnknownError',
      'Connection is closing because of: Force close delete origin',
    )

    expect(filterEvent(reported, undefined, () => 0)).toBe(reported)
  })

  it('drops chunk-load errors outside the sample rate', () => {
    const event = errorEvent('TypeError', 'Failed to fetch dynamically imported module')
    // 0.5 is well above the 0.05 sample rate.
    expect(filterEvent(event, undefined, () => 0.5)).toBeNull()
  })

  it('keeps sampled chunk-load errors, grouped into one issue', () => {
    const event = errorEvent('TypeError', 'Failed to fetch dynamically imported module')
    const result = filterEvent(event, undefined, () => 0.01)

    expect(result).not.toBeNull()
    // Every hashed-filename variant must collapse to a single Sentry issue.
    expect(result?.fingerprint).toEqual(['chunk-load-error'])
    expect(result?.tags?.error_class).toBe('chunk-load')
    expect(result?.level).toBe('warning')
  })

  it('samples chunk-load errors at roughly the configured rate', () => {
    let kept = 0
    for (let i = 0; i < 1000; i++) {
      const event = errorEvent('TypeError', 'Failed to fetch dynamically imported module')
      // Deterministic sweep across [0, 1) instead of real randomness.
      if (filterEvent(event, undefined, () => i / 1000)) kept++
    }
    expect(kept).toBe(50) // 5% of 1000
  })

  it('drops per-visitor events outside their sample rate', () => {
    const event = errorEvent('Error', 'No manifest available')
    event.tags = { volume: 'per-visitor' }
    // 0.5 is above the 0.1 per-visitor rate.
    expect(filterEvent(event, undefined, () => 0.5)).toBeNull()
  })

  it('keeps sampled per-visitor events', () => {
    const event = errorEvent('Error', 'No manifest available')
    event.tags = { volume: 'per-visitor' }
    expect(filterEvent(event, undefined, () => 0.05)).toBe(event)
  })

  it('samples per-visitor events at roughly the configured rate', () => {
    let kept = 0
    for (let i = 0; i < 1000; i++) {
      const event = errorEvent('Error', 'No manifest available')
      event.tags = { volume: 'per-visitor' }
      if (filterEvent(event, undefined, () => i / 1000)) kept++
    }
    expect(kept).toBe(100) // 10% of 1000
  })

  it('does not sample untagged events', () => {
    const event = errorEvent('Error', 'No manifest available')
    // Same message, no per-visitor tag: must always be kept.
    expect(filterEvent(event, undefined, () => 0.99)).toBe(event)
  })

  it('preserves existing tags when tagging a chunk-load error', () => {
    const event = errorEvent('TypeError', 'ChunkLoadError')
    event.tags = { faction: 'MLA' }
    const result = filterEvent(event, undefined, () => 0)

    expect(result?.tags).toEqual({ faction: 'MLA', error_class: 'chunk-load' })
  })
})
