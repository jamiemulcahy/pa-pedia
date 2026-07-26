import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocked wholesale: these tests assert what monitoring.ts asks the SDK to do,
// not what the SDK then does. Kept in its own file so the filterEvent tests
// still exercise the real types.
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  reactRouterBrowserTracingIntegration: vi.fn(() => ({ name: 'router' })),
}))

import * as Sentry from '@sentry/react'
import { initMonitoring, isMonitoringEnabled, reportError } from '../monitoring'

describe('initMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // The load-bearing safety property: without a DSN nothing is ever sent, which
  // is what keeps dev, CI and forks off the 5k/month quota.
  it('does not initialise Sentry when no DSN is configured', () => {
    expect(import.meta.env.VITE_SENTRY_DSN).toBeFalsy()

    initMonitoring()

    expect(Sentry.init).not.toHaveBeenCalled()
    expect(isMonitoringEnabled()).toBe(false)
  })
})

describe('reportError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults to error level with no extra or tags', () => {
    const error = new Error('boom')
    reportError(error)

    expect(Sentry.captureException).toHaveBeenCalledWith(error, { level: 'error' })
  })

  it('passes context through as extra', () => {
    const error = new Error('boom')
    reportError(error, { context: { stage: 'discoverFactions:manifest' } })

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      extra: { stage: 'discoverFactions:manifest' },
    })
  })

  it('honours an explicit severity level', () => {
    const error = new Error('idb unavailable')
    reportError(error, { level: 'warning' })

    expect(Sentry.captureException).toHaveBeenCalledWith(error, { level: 'warning' })
  })

  // The tag is what filterEvent samples on; without it an outage would be
  // reported once per visitor at full rate.
  it('tags per-visitor failures so filterEvent can sample them', () => {
    const error = new Error('No manifest available')
    reportError(error, { context: { stage: 'x' }, perVisitor: true })

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      extra: { stage: 'x' },
      tags: { volume: 'per-visitor' },
    })
  })
})
