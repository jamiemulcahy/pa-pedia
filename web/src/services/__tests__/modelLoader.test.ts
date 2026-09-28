import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ZipWriter,
  Uint8ArrayWriter,
  TextReader,
  Uint8ArrayReader,
  configure,
} from '@zip.js/zip.js'
import {
  getFactionModelsIndex,
  getRangeSupport,
  ModelIndexUnavailableError,
  loadUnitModel,
  clearModelCache,
  type ModelsIndex,
} from '../modelLoader'
import { reportError } from '@/lib/monitoring'
import {
  isDevelopmentMode,
  getManifestEntry,
  getManifestVersion,
  getSiteBaseUrl,
} from '../manifestLoader'

// Mock the manifest layer so we can flip dev/prod and control model availability.
vi.mock('../manifestLoader', () => ({
  isDevelopmentMode: vi.fn(),
  getSiteBaseUrl: vi.fn(() => ''),
  getManifestEntry: vi.fn(),
  getManifestVersion: vi.fn(),
}))

vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

configure({ useWebWorkers: false })

const SAMPLE_INDEX: ModelsIndex = {
  generated: '2026-07-11T00:00:00Z',
  unitCount: 2,
  units: {
    radar: {
      glb: 'models/radar.glb',
      diffuse: 'textures/radar_diffuse.png',
      mask: 'textures/radar_mask.png',
      material: 'textures/radar_material.png',
    },
    // A texture-less unit (geometry only) — many Exiles/Bugs units are like this.
    beacon: {
      glb: 'models/beacon.glb',
    },
  },
}

/**
 * Build an in-memory model bundle zip matching SAMPLE_INDEX.
 *
 * Deliberately assembled with Uint8ArrayWriter rather than BlobWriter: under
 * jsdom the global Blob is jsdom's while Response/streams are Node's, and
 * zip.js's BlobWriter finishes by re-wrapping the Response's (Node) Blob in a
 * `new Blob([...])` to apply the content type. jsdom's Blob constructor does
 * not recognise a foreign-realm Blob, so it stringifies it to "[object Blob]"
 * and the "zip" comes back as 13 bytes. Uint8Array in, Uint8Array out keeps
 * the fixture clear of that cross-realm trap.
 */
async function buildBundleBytes(): Promise<ArrayBuffer> {
  const zw = new ZipWriter(new Uint8ArrayWriter())
  await zw.add('models.json', new TextReader(JSON.stringify(SAMPLE_INDEX)))
  await zw.add('models/radar.glb', new Uint8ArrayReader(new Uint8Array([1, 2, 3, 4])))
  await zw.add('textures/radar_diffuse.png', new Uint8ArrayReader(new Uint8Array([5, 6])))
  await zw.add('textures/radar_mask.png', new Uint8ArrayReader(new Uint8Array([7, 8])))
  await zw.add('textures/radar_material.png', new Uint8ArrayReader(new Uint8Array([9, 10])))
  await zw.add('models/beacon.glb', new Uint8ArrayReader(new Uint8Array([11, 12, 13])))
  const bytes = await zw.close()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

const mockIsDev = vi.mocked(isDevelopmentMode)
const mockGetEntry = vi.mocked(getManifestEntry)
const mockGetVersion = vi.mocked(getManifestVersion)
vi.mocked(getSiteBaseUrl).mockReturnValue('')

beforeEach(async () => {
  await clearModelCache()
  vi.clearAllMocks()
  vi.mocked(getSiteBaseUrl).mockReturnValue('')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('modelLoader — development mode', () => {
  beforeEach(() => {
    mockIsDev.mockReturnValue(true)
  })

  it('fetches and parses models.json from the unzipped dev bundle', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(SAMPLE_INDEX), { status: 200 })
    ) as unknown as typeof fetch

    const index = await getFactionModelsIndex('MLA')
    expect(index).not.toBeNull()
    expect(index!.units.radar.glb).toBe('models/radar.glb')
    expect(global.fetch).toHaveBeenCalledWith('/faction-models/MLA/models.json')
  })

  it('returns null when the dev bundle is missing (404)', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch

    const index = await getFactionModelsIndex('MLA')
    expect(index).toBeNull()
  })

  it('returns direct file URLs for a unit that has a model', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(SAMPLE_INDEX), { status: 200 })
    ) as unknown as typeof fetch

    const model = await loadUnitModel('MLA', 'radar')
    expect(model).not.toBeNull()
    expect(model!.glbUrl).toBe('/faction-models/MLA/models/radar.glb')
    expect(model!.diffuseUrl).toBe('/faction-models/MLA/textures/radar_diffuse.png')
    expect(model!.maskUrl).toBe('/faction-models/MLA/textures/radar_mask.png')
    expect(model!.materialUrl).toBe('/faction-models/MLA/textures/radar_material.png')
  })

  it('returns null for a unit with no model (graceful absence)', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(SAMPLE_INDEX), { status: 200 })
    ) as unknown as typeof fetch

    const model = await loadUnitModel('MLA', 'does_not_exist')
    expect(model).toBeNull()
  })

  it('loads a texture-less unit with only a glb URL (no diffuse/mask/material)', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(SAMPLE_INDEX), { status: 200 })
    ) as unknown as typeof fetch

    const model = await loadUnitModel('MLA', 'beacon')
    expect(model).not.toBeNull()
    expect(model!.glbUrl).toBe('/faction-models/MLA/models/beacon.glb')
    expect(model!.diffuseUrl).toBeUndefined()
    expect(model!.maskUrl).toBeUndefined()
    expect(model!.materialUrl).toBeUndefined()
  })
})

describe('modelLoader — production mode', () => {
  let bundleBytes: ArrayBuffer

  const BUNDLE_URL = '/faction-models/mla-1.0.0-pedia20260101000000-models.zip'
  const INDEX_URL = '/model-index/mla-1.0.0-pedia20260101000000-models.index.json'

  beforeEach(async () => {
    mockIsDev.mockReturnValue(false)
    bundleBytes = await buildBundleBytes()
  })

  /** Requests the loader made, by kind. */
  let requests: { index: number; ranged: number; wholeBundle: number }

  /**
   * Fake site: serves the baked index (the bundle's sidecar) and a
   * range-capable bundle. `bundle` can override how ranged bundle requests are
   * answered, to simulate failures on the viewer path.
   */
  function mockSite(opts: { index?: () => Response; ranged?: () => Response | never } = {}) {
    requests = { index: 0, ranged: 0, wholeBundle: 0 }
    global.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      const total = bundleBytes.byteLength
      const method = (init?.method ?? 'GET').toUpperCase()
      const rangeHeader = new Headers(init?.headers).get('Range')

      if (url === INDEX_URL) {
        requests.index++
        // The index must be an ordinary GET: no Range, ever.
        expect(rangeHeader).toBeNull()
        return opts.index
          ? opts.index()
          : new Response(
              JSON.stringify({ factionId: 'mla', version: '1.0.0', timestamp: 1, ...SAMPLE_INDEX }),
              { status: 200 }
            )
      }
      if (method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
        })
      }
      if (rangeHeader) {
        requests.ranged++
        if (opts.ranged) return opts.ranged()
        const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
        const start = m ? Number(m[1]) : 0
        const end = m && m[2] ? Number(m[2]) : total - 1
        return new Response(bundleBytes.slice(start, end + 1), {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
          },
        })
      }
      requests.wholeBundle++
      return new Response(bundleBytes.slice(0), {
        status: 200,
        headers: { 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
      })
    }) as unknown as typeof fetch
  }

  const modelsEntry = (stamp = '20260101000000', indexUrl: string | null = INDEX_URL) => ({
    id: 'MLA',
    version: '1.0.0',
    filename: 'mla.zip',
    downloadUrl: '/factions/mla.zip',
    size: 1,
    timestamp: 100,
    models: {
      filename: `mla-1.0.0-pedia${stamp}-models.zip`,
      downloadUrl: BUNDLE_URL,
      size: bundleBytes.byteLength,
      unitCount: 2,
      ...(indexUrl ? { indexUrl } : {}),
    },
  })

  it('returns null with NO network request when the manifest has no model bundle', async () => {
    mockGetEntry.mockResolvedValue({
      id: 'MLA',
      version: '1.0.0',
      filename: 'mla.zip',
      downloadUrl: '/factions/mla.zip',
      size: 1,
      timestamp: 100,
      // no `models`
    })
    global.fetch = vi.fn() as unknown as typeof fetch

    const index = await getFactionModelsIndex('MLA')
    expect(index).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns null when the faction is absent from the manifest', async () => {
    mockGetEntry.mockResolvedValue(null)
    global.fetch = vi.fn() as unknown as typeof fetch

    const index = await getFactionModelsIndex('Unknown')
    expect(index).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('reads the baked index with one plain GET, never touching the bundle, and caches it', async () => {
    mockGetEntry.mockResolvedValue(modelsEntry())
    mockSite()

    const first = await getFactionModelsIndex('MLA')
    expect(first!.units.radar.glb).toBe('models/radar.glb')
    // Page load: exactly one small request. No Range, no bundle.
    expect(requests).toEqual({ index: 1, ranged: 0, wholeBundle: 0 })

    const second = await getFactionModelsIndex('MLA')
    expect(second!.units.radar).toBeDefined()
    // Served from IndexedDB — no additional network calls.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1)
  })

  it('invalidates the cache when a model-only regen produces a new bundle (same faction-data timestamp)', async () => {
    // A model regen keeps the faction-data `timestamp` unchanged but ships a new
    // bundle filename with a new build stamp. The cache must key on the bundle
    // stamp, not the faction-data timestamp — otherwise stale (e.g. texture-less)
    // models keep being served after a regen.
    mockGetEntry.mockResolvedValue(modelsEntry('20260101000000'))
    mockSite()

    await getFactionModelsIndex('MLA')
    await getFactionModelsIndex('MLA')
    expect(requests.index).toBe(1)

    mockGetEntry.mockResolvedValue(modelsEntry('20260202000000'))
    const refreshed = await getFactionModelsIndex('MLA')
    expect(refreshed).not.toBeNull()
    expect(requests.index).toBe(2)
  })

  it('reports "unavailable", not "no model", for a manifest that predates baked indexes', async () => {
    // The bundle exists, so null would be false. Reading it would mean a Range
    // read on page load, which is what the baked index exists to avoid.
    mockGetEntry.mockResolvedValue(modelsEntry(undefined, null))
    global.fetch = vi.fn() as unknown as typeof fetch

    await expect(getFactionModelsIndex('MLA')).rejects.toBeInstanceOf(ModelIndexUnavailableError)
    expect(global.fetch).not.toHaveBeenCalled()
    // A rollout state, not a fault: nothing to report.
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports the real error once per bundle, under one fingerprint, when the index is not baked', async () => {
    // Pages answers a missing file with the SPA's index.html and a 200.
    mockGetEntry.mockResolvedValue(modelsEntry('20260303000000'))
    mockSite({ index: () => new Response('<!doctype html><html></html>', { status: 200 }) })

    const error = await getFactionModelsIndex('MLA').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModelIndexUnavailableError)
    // The original error travels as `cause`, not a generic stand-in.
    expect((error as Error).cause).toBeInstanceOf(SyntaxError)

    expect(reportError).toHaveBeenCalledTimes(1)
    const [reported, options] = vi.mocked(reportError).mock.calls[0]
    expect(reported).toBeInstanceOf(SyntaxError)
    expect(options).toMatchObject({
      perVisitor: true,
      fingerprint: ['model-index-unavailable'],
      context: { stage: 'loadModelIndex', indexUrl: INDEX_URL },
    })

    // Not cached, but not re-reported on the next unit page either.
    await expect(getFactionModelsIndex('MLA')).rejects.toBeInstanceOf(ModelIndexUnavailableError)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('carries the HTTP status of a failed index request', async () => {
    mockGetEntry.mockResolvedValue(modelsEntry('20260404000000'))
    mockSite({ index: () => new Response('', { status: 503 }) })

    const error = await getFactionModelsIndex('MLA').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModelIndexUnavailableError)
    expect(String(((error as Error).cause as Error).message)).toMatch(/HTTP 503/)
  })

  it('does not leak the underlying cause in the error message', async () => {
    mockGetEntry.mockResolvedValue(modelsEntry('20260505000000'))
    global.fetch = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.1:443 while fetching /internal/path.json')
    }) as unknown as typeof fetch

    const error = await getFactionModelsIndex('MLA').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModelIndexUnavailableError)
    // The message is a fixed string; internals are reachable only via `cause`
    // (for console diagnostics), never via the message the UI might render.
    expect((error as Error).message).toBe('model index unavailable')
    expect((error as Error).message).not.toMatch(/ECONNREFUSED|10\.0\.0\.1|internal/i)
  })

  it('loads a unit model as blob URLs via range reads and caches per-unit', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    mockSite()

    const model = await loadUnitModel('MLA', 'radar', '1.0.0')
    expect(model).not.toBeNull()
    expect(model!.glbUrl).toMatch(/^blob:/)
    expect(model!.materialUrl).toMatch(/^blob:/)
    expect(requests.ranged).toBeGreaterThan(0)
    expect(requests.wholeBundle).toBe(0)

    const callsAfterFirst = vi.mocked(global.fetch).mock.calls.length

    const again = await loadUnitModel('MLA', 'radar', '1.0.0')
    expect(again).not.toBeNull()
    // Per-unit cache hit — no extra network.
    expect(vi.mocked(global.fetch).mock.calls.length).toBe(callsAfterFirst)

    model!.release()
    again!.release()
  })

  it('returns null for a unit absent from the bundle index', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    mockSite()

    const model = await loadUnitModel('MLA', 'ghost', '1.0.0')
    expect(model).toBeNull()
  })

  it('loads a texture-less unit without requesting undefined bundle entries', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    mockSite()

    // Regression: a unit with only a glb (no diffuse/mask/material) must not
    // throw "Entry not found in bundle: undefined" — it renders geometry-only.
    const model = await loadUnitModel('MLA', 'beacon', '1.0.0')
    expect(model).not.toBeNull()
    expect(model!.glbUrl).toMatch(/^blob:/)
    expect(model!.diffuseUrl).toBeUndefined()
    expect(model!.maskUrl).toBeUndefined()
    expect(model!.materialUrl).toBeUndefined()
    model!.release()
  })

  it('falls back on a transient range failure without disabling Range for the session', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    const networkError = new TypeError('Load failed')
    mockSite({
      ranged: () => {
        throw networkError
      },
    })

    const model = await loadUnitModel('MLA', 'radar', '1.0.0')
    // The visitor asked for the model, so the fallback download is justified.
    expect(model).not.toBeNull()
    expect(requests.wholeBundle).toBe(1)
    // A network error says nothing about Range support: try it again next time.
    expect(getRangeSupport()).toBe('unknown')

    // Reported with the ORIGINAL error, so Sentry shows the real cause.
    expect(reportError).toHaveBeenCalledWith(
      networkError,
      expect.objectContaining({
        fingerprint: ['model-bundle-range-read'],
        context: { stage: 'loadUnitModel', rangeUnsupported: false },
      })
    )
    model!.release()

    // That download now serves every other unit in the bundle, with no network.
    const callsBefore = vi.mocked(global.fetch).mock.calls.length
    const other = await loadUnitModel('MLA', 'beacon', '1.0.0')
    expect(other).not.toBeNull()
    expect(vi.mocked(global.fetch).mock.calls.length).toBe(callsBefore)
    other!.release()
  })

  it('disables Range for the session only when the server ignores it', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    // 200 with the whole body in answer to a ranged request: proof, not a blip.
    mockSite({ ranged: () => new Response(bundleBytes.slice(0), { status: 200 }) })

    const model = await loadUnitModel('MLA', 'radar', '1.0.0')
    expect(model).not.toBeNull()
    expect(getRangeSupport()).toBe('no')
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: { stage: 'loadUnitModel', rangeUnsupported: true } })
    )
    model!.release()
  })
})
