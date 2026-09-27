import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ZipWriter,
  Uint8ArrayWriter,
  TextReader,
  Uint8ArrayReader,
  configure,
} from '@zip.js/zip.js'
import { getFactionModelsIndex, loadUnitModel, type ModelsIndex } from '../modelLoader'
import { isDevelopmentMode, getManifestEntry, getManifestVersion } from '../manifestLoader'
import { reportError } from '@/lib/monitoring'

// Reproduces a browser whose model-cache database exists at version 1 with none
// of its object stores. The upgrade callback never runs for it, so every
// `db.get` / `db.put` throws NotFoundError. Seen in the wild in Firefox, where it
// disabled the 3D button on every unit page for that visitor.
//
// Its own file because the loader opens its database once per module: the
// store-less database has to be what that first open returns.
vi.mock('idb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('idb')>()
  return {
    ...actual,
    // Same name and version, but no upgrade callback: an empty v1 database.
    openDB: (name: string, version?: number) => actual.openDB(`${name}-storeless`, version),
  }
})

vi.mock('../manifestLoader', () => ({
  isDevelopmentMode: vi.fn(() => false),
  getSiteBaseUrl: vi.fn(() => ''),
  getManifestEntry: vi.fn(),
  getManifestVersion: vi.fn(),
}))

vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

configure({ useWebWorkers: false })

const INDEX: ModelsIndex = {
  generated: '2026-09-27T00:00:00Z',
  unitCount: 1,
  units: { radar: { glb: 'models/radar.glb' } },
}
const INDEX_URL = '/model-index/mla-1.0.0-pedia20260101000000-models.index.json'
const BUNDLE_URL = '/faction-models/mla-1.0.0-pedia20260101000000-models.zip'

async function buildBundle(): Promise<ArrayBuffer> {
  const zw = new ZipWriter(new Uint8ArrayWriter())
  await zw.add('models.json', new TextReader(JSON.stringify(INDEX)))
  await zw.add('models/radar.glb', new Uint8ArrayReader(new Uint8Array([1, 2, 3, 4])))
  const bytes = await zw.close()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('modelLoader with an unusable IndexedDB cache', () => {
  let bundle: ArrayBuffer

  beforeEach(async () => {
    vi.mocked(isDevelopmentMode).mockReturnValue(false)
    bundle = await buildBundle()
    const entry = {
      id: 'MLA',
      version: '1.0.0',
      filename: 'mla.zip',
      downloadUrl: '/factions/mla.zip',
      size: 1,
      timestamp: 100,
      models: {
        filename: 'mla-1.0.0-pedia20260101000000-models.zip',
        downloadUrl: BUNDLE_URL,
        size: bundle.byteLength,
        unitCount: 1,
        indexUrl: INDEX_URL,
      },
    }
    vi.mocked(getManifestEntry).mockResolvedValue(entry)
    vi.mocked(getManifestVersion).mockResolvedValue(entry)

    global.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      if (String(input) === INDEX_URL) {
        return new Response(JSON.stringify(INDEX), { status: 200 })
      }
      const total = bundle.byteLength
      const range = new Headers(init?.headers).get('Range')
      if ((init?.method ?? 'GET').toUpperCase() === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'Content-Length': String(total) } })
      }
      const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null
      if (!m) return new Response(bundle.slice(0), { status: 200 })
      const start = Number(m[1])
      const end = m[2] ? Number(m[2]) : total - 1
      return new Response(bundle.slice(start, end + 1), {
        status: 206,
        headers: { 'Content-Range': `bytes ${start}-${end}/${total}` },
      })
    }) as unknown as typeof fetch
  })

  // One test, in order: the report-once guard lives for the module's session,
  // and the broken database cannot be cleared between tests.
  it('finds and loads the model from the network, reporting the storage failure once', async () => {
    // Page load: the index is fetched instead of the cache failure disabling the button.
    const index = await getFactionModelsIndex('MLA')
    expect(index?.units.radar.glb).toBe('models/radar.glb')
    expect(global.fetch).toHaveBeenCalledWith(INDEX_URL)

    // Viewer: the unit's assets come out of the bundle as usual.
    const model = await loadUnitModel('MLA', 'radar', '1.0.0')
    expect(model?.glbUrl).toMatch(/^blob:/)
    model?.release()

    // Many failed cache reads and writes above, one warning.
    const cacheReports = vi
      .mocked(reportError)
      .mock.calls.filter(([, opts]) => opts?.fingerprint?.[0] === 'model-cache-unavailable')
    expect(cacheReports).toHaveLength(1)
    const [error, opts] = cacheReports[0]
    expect((error as Error).name).toBe('NotFoundError')
    expect(opts).toMatchObject({ level: 'warning', context: { stage: 'modelCache' } })
  })
})
