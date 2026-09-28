import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Only the reporting decision is under test; the SDK is mocked out.
vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

// Controls whether loadManifest has a cached manifest to fall back to.
vi.mock('../staticFactionCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../staticFactionCache')>()),
  getCachedManifestInfo: vi.fn(async () => null),
  cacheManifestInfo: vi.fn(async () => {}),
}))

import { reportError } from '@/lib/monitoring'
import { discoverFactions } from '../factionLoader'
import { invalidateManifestCache } from '../manifestLoader'
import { getCachedManifestInfo } from '../staticFactionCache'

function respond(status: number, statusText: string, headers: Record<string, string> = {}) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(new Response(null, { status, statusText, headers })),
  ))
}

function reportFor(stage: string) {
  const call = vi.mocked(reportError).mock.calls.find(
    ([, options]) => options?.context?.stage === stage,
  )
  if (!call) throw new Error(`no report for ${stage}`)
  return call[1]
}

describe('manifest failure reporting', () => {
  beforeEach(() => {
    // The manifest path only runs outside dev mode.
    vi.stubEnv('DEV', false)
    invalidateManifestCache()
    vi.mocked(reportError).mockClear()
    vi.mocked(getCachedManifestInfo).mockResolvedValue(null)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('with no cached manifest', () => {
    it('reports an edge block as a warning in its own issue', async () => {
      respond(403, 'Forbidden', { 'cf-mitigated': 'challenge', 'cf-ray': 'abc-SIN' })

      await discoverFactions()

      expect(reportFor('discoverFactions:manifest')).toEqual({
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

      const options = reportFor('discoverFactions:manifest')
      expect(options?.level).toBeUndefined()
      expect(options?.fingerprint).toBeUndefined()
      expect(options?.perVisitor).toBe(true)
      expect(options?.context).toMatchObject({ status: 500, edgeBlocked: false })
    })

    it('reports a network failure with only the stage', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

      await discoverFactions()

      expect(reportFor('discoverFactions:manifest')).toEqual({
        context: { stage: 'discoverFactions:manifest' },
        perVisitor: true,
      })
    })
  })

  // Returning visitors fall back to the cached manifest, so discoverFactions
  // never sees the failure. A block that hits real visitors mostly hits these.
  describe('with a cached manifest', () => {
    beforeEach(() => {
      vi.mocked(getCachedManifestInfo).mockResolvedValue({
        generated: '2026-09-01T00:00:00Z',
        factions: ['mla'],
      } as Awaited<ReturnType<typeof getCachedManifestInfo>>)
    })

    it('still reports an edge block', async () => {
      respond(403, 'Forbidden', { 'cf-mitigated': 'challenge' })

      const entries = await discoverFactions()

      expect(entries.map(e => e.id)).toContain('mla')
      expect(reportFor('loadManifest:cachedFallback')).toMatchObject({
        level: 'warning',
        fingerprint: ['manifest-edge-blocked'],
        perVisitor: true,
      })
    })

    // Being offline is the fallback's purpose, not a failure.
    it('does not report a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

      await discoverFactions()

      expect(reportError).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ context: expect.objectContaining({ stage: expect.stringMatching(/manifest/i) }) }),
      )
    })
  })
})
