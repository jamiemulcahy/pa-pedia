import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Only the reporting decision is under test; the SDK is mocked out.
vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

import { reportError } from '@/lib/monitoring'
import { discoverFactions } from '../factionLoader'
import { invalidateManifestCache } from '../manifestLoader'

function respond(status: number, statusText: string, headers: Record<string, string> = {}) {
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status, statusText, headers })),
  ) as unknown as typeof fetch
}

function manifestReport() {
  const call = vi.mocked(reportError).mock.calls.find(
    ([, options]) => options?.context?.stage === 'discoverFactions:manifest',
  )
  if (!call) throw new Error('manifest failure was not reported')
  return call[1]
}

describe('discoverFactions manifest failure reporting', () => {
  beforeEach(() => {
    // The manifest path only runs outside dev mode.
    vi.stubEnv('DEV', false)
    invalidateManifestCache()
    vi.mocked(reportError).mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('reports an edge block as a warning in its own issue', async () => {
    respond(403, 'Forbidden', { 'cf-mitigated': 'challenge', 'cf-ray': 'abc-SIN' })

    await discoverFactions()

    expect(manifestReport()).toEqual({
      context: {
        stage: 'discoverFactions:manifest',
        status: 403,
        cfMitigated: 'challenge',
        cfRay: 'abc-SIN',
        contentType: null,
        edgeBlocked: true,
      },
      perVisitor: true,
      level: 'warning',
      fingerprint: ['manifest-edge-blocked'],
    })
  })

  it('reports an origin failure as an error, with the response details', async () => {
    respond(500, 'Internal Server Error')

    await discoverFactions()

    const options = manifestReport()
    expect(options?.level).toBeUndefined()
    expect(options?.fingerprint).toBeUndefined()
    expect(options?.perVisitor).toBe(true)
    expect(options?.context).toMatchObject({ status: 500, edgeBlocked: false })
  })

  it('reports a network failure with only the stage', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch

    await discoverFactions()

    expect(manifestReport()).toEqual({
      context: { stage: 'discoverFactions:manifest' },
      perVisitor: true,
    })
  })
})
