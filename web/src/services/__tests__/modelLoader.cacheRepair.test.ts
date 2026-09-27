import { describe, it, expect, beforeAll, vi } from 'vitest'
import { getFactionModelsIndex, type ModelsIndex } from '../modelLoader'
import { isDevelopmentMode, getManifestEntry } from '../manifestLoader'

// Its own file: the loader opens its database once per module, so the state the
// database is in before that first open is what each file here tests.

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
const INDEX_URL = '/model-index/mla-1.0.0-pedia20260101000000-models.index.json'

/** Open `pa-pedia-model-cache` at v1 with no upgrade handler: no object stores. */
function openStorelessV1(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pa-pedia-model-cache', 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('modelLoader repairs a model-cache database left without its stores', () => {
  beforeAll(async () => {
    // The state found in the wild: the database exists at v1 with none of its
    // stores. Closed again, as a finished visit would leave it.
    ;(await openStorelessV1()).close()

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
        indexUrl: INDEX_URL,
      },
    })
    global.fetch = vi.fn(async () => new Response(JSON.stringify(INDEX))) as unknown as typeof fetch
  })

  it('recreates the stores on upgrade, so the cache works again', async () => {
    expect((await getFactionModelsIndex('MLA'))?.units.radar).toBeDefined()
    expect(await getFactionModelsIndex('MLA')).toBeDefined()
    // The second read came from the repaired cache, not the network.
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
