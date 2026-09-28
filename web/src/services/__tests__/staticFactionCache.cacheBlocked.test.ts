import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import JSZip from 'jszip'
import { loadFactionIndex } from '../factionLoader'
import { getStaticAsset } from '../staticFactionCache'
import { reportError } from '@/lib/monitoring'
import { mockMLAMetadata, mockMLAIndex } from '@/tests/mocks/factionData'

// Its own file: the cache opens its database once per module.

vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

const ENTRY = {
  version: '1.0.0',
  filename: 'mla.zip',
  downloadUrl: '/factions/mla.zip',
  size: 1,
  timestamp: 100,
}
const MANIFEST = {
  generated: '2026-09-28T00:00:00Z',
  releaseTag: 'faction-data',
  factions: [{ id: 'MLA', latest: ENTRY, versions: [ENTRY] }],
}
const ICON = 'assets/pa/units/land/tank/tank_icon_buildbar.png'

describe('staticFactionCache when an old tab blocks the cache upgrade', () => {
  beforeAll(async () => {
    // A tab running the previous release: it holds v1 open and has no
    // versionchange handler, so it never lets the v2 upgrade through.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('pa-pedia-static-factions', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('factions', { keyPath: 'id' })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    const zip = new JSZip()
    zip.file('metadata.json', JSON.stringify(mockMLAMetadata))
    zip.file('units.json', JSON.stringify(mockMLAIndex))
    zip.file(ICON, 'png')
    const zipBytes = await zip.generateAsync({ type: 'arraybuffer' })

    vi.stubEnv('DEV', false)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
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

  // One test: setup clears mock calls between tests.
  it('loads from the network instead of waiting, and keeps the faction for the session', async () => {
    expect(await loadFactionIndex('MLA')).toEqual(mockMLAIndex)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/blocked/) }),
      expect.objectContaining({ level: 'warning' })
    )

    // Kept in memory: not downloaded again, and its icons still resolve.
    expect(await loadFactionIndex('MLA')).toEqual(mockMLAIndex)
    const zipFetches = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/factions/mla.zip')
    expect(zipFetches).toHaveLength(1)
    expect(await getStaticAsset('mla', ICON)).not.toBeNull()

    // Once per session, not once per operation.
    expect(reportError).toHaveBeenCalledTimes(1)
  }, 5000)
})
