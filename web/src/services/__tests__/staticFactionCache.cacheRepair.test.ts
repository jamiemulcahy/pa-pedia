import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import JSZip from 'jszip'
import { discoverFactions, loadFactionIndex } from '../factionLoader'
import { reportError } from '@/lib/monitoring'
import { mockMLAMetadata, mockMLAIndex } from '@/tests/mocks/factionData'

// Its own file: the cache opens its database once per module, so the state the
// database is in before that first open is what each file here tests.

vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

const MANIFEST = {
  generated: '2026-09-28T00:00:00Z',
  releaseTag: 'faction-data',
  factions: [
    {
      id: 'MLA',
      latest: {
        version: '1.0.0',
        filename: 'mla.zip',
        downloadUrl: '/factions/mla.zip',
        size: 1,
        timestamp: 100,
      },
      versions: [
        {
          version: '1.0.0',
          filename: 'mla.zip',
          downloadUrl: '/factions/mla.zip',
          size: 1,
          timestamp: 100,
        },
      ],
    },
  ],
}

/** Open `pa-pedia-static-factions` at v1 with no upgrade handler: no object stores. */
function openStorelessV1(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pa-pedia-static-factions', 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function openCurrent(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pa-pedia-static-factions')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('staticFactionCache repairs a database left without its stores', () => {
  let zipBytes: ArrayBuffer

  beforeAll(async () => {
    // The state found in the wild: the database exists at v1 with none of its
    // stores. Closed again, as a finished visit would leave it.
    ;(await openStorelessV1()).close()

    const zip = new JSZip()
    zip.file('metadata.json', JSON.stringify(mockMLAMetadata))
    zip.file('units.json', JSON.stringify(mockMLAIndex))
    zipBytes = await zip.generateAsync({ type: 'arraybuffer' })

    // The manifest path only runs outside dev mode.
    vi.stubEnv('DEV', false)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/factions/manifest.json')
          ? new Response(JSON.stringify(MANIFEST))
          : new Response(zipBytes)
      )
    )
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the manifest and the faction, and caches them again', async () => {
    const factions = await discoverFactions()
    expect(factions.map((f) => f.id)).toContain('MLA')

    expect((await loadFactionIndex('MLA')).units).toHaveLength(mockMLAIndex.units.length)
    expect(await loadFactionIndex('MLA')).toEqual(mockMLAIndex)

    // The second load came from the repaired cache, not another download.
    const zipFetches = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/factions/mla.zip')
    expect(zipFetches).toHaveLength(1)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('leaves the database at v2 with every store', async () => {
    const db = await openCurrent()
    try {
      expect(db.version).toBe(2)
      expect([...db.objectStoreNames].sort()).toEqual(['assets', 'factions', 'manifest'])
    } finally {
      db.close()
    }
  })
})
