import { describe, it, expect, beforeAll, vi } from 'vitest'
import { getFactionModelsIndex, type ModelsIndex } from '../modelLoader'
import { isDevelopmentMode, getManifestEntry } from '../manifestLoader'
import { reportError } from '@/lib/monitoring'

// Its own file: the loader opens its database once per module.

vi.mock('../manifestLoader', () => ({
  isDevelopmentMode: vi.fn(() => false),
  getSiteBaseUrl: vi.fn(() => ''),
  getManifestEntry: vi.fn(),
  getManifestVersion: vi.fn(),
}))
vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

const INDEX: ModelsIndex = {
  generated: '2026-09-27T00:00:00Z',
  unitCount: 1,
  units: { radar: { glb: 'models/radar.glb' } },
}

describe('modelLoader when an old tab blocks the cache upgrade', () => {
  beforeAll(async () => {
    // A tab running the previous release: it holds v1 open and has no
    // versionchange handler, so it never lets the v2 upgrade through.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('pa-pedia-model-cache', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('indexes', { keyPath: 'key' })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    vi.mocked(isDevelopmentMode).mockReturnValue(false)
    vi.mocked(getManifestEntry).mockResolvedValue({
      id: 'MLA',
      version: '1.0.0',
      filename: 'mla.zip',
      downloadUrl: '/factions/mla.zip',
      size: 1,
      timestamp: 100,
      models: {
        filename: 'mla-1.0.0-pedia20260101000000-models.zip',
        downloadUrl: '/faction-models/mla-1.0.0-pedia20260101000000-models.zip',
        size: 1,
        unitCount: 1,
        indexUrl: '/model-index/mla-1.0.0-pedia20260101000000-models.index.json',
      },
    })
    global.fetch = vi.fn(async () => new Response(JSON.stringify(INDEX))) as unknown as typeof fetch
  })

  it('answers from the network instead of waiting for that tab to close', async () => {
    const index = await getFactionModelsIndex('MLA')
    expect(index?.units.radar).toBeDefined()
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/blocked/) }),
      expect.objectContaining({ level: 'warning' })
    )
  }, 5000)
})
