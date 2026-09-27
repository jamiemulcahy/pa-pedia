import { describe, it, expect, vi, beforeEach } from 'vitest'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/react', () => ({ captureException }))

import { reportError } from '../monitoring'

describe('reportError', () => {
  beforeEach(() => captureException.mockClear())

  it('sends no tags by default', () => {
    const err = new Error('x')
    reportError(err)
    expect(captureException).toHaveBeenCalledWith(err, { level: 'error' })
  })

  it('passes tags through', () => {
    reportError(new Error('x'), { tags: { build_status: 'stale' } })
    expect(captureException.mock.calls[0][1].tags).toEqual({ build_status: 'stale' })
  })

  it('merges the per-visitor tag with caller tags, per-visitor winning', () => {
    reportError(new Error('x'), { perVisitor: true, tags: { volume: 'nope', a: 'b' } })
    expect(captureException.mock.calls[0][1].tags).toEqual({ volume: 'per-visitor', a: 'b' })
  })
})
