import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { openDB } from 'idb'
import {
  ZipWriter,
  BlobWriter,
  TextReader,
  Uint8ArrayReader,
  configure,
} from '@zip.js/zip.js'
import {
  getFactionModelsIndex,
  loadUnitModel,
  clearModelCache,
  type ModelsIndex,
} from '../modelLoader'
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

/** Build an in-memory model bundle zip matching SAMPLE_INDEX. */
async function buildBundleBlob(): Promise<Blob> {
  const zw = new ZipWriter(new BlobWriter('application/zip'))
  await zw.add('models.json', new TextReader(JSON.stringify(SAMPLE_INDEX)))
  await zw.add('models/radar.glb', new Uint8ArrayReader(new Uint8Array([1, 2, 3, 4])))
  await zw.add('textures/radar_diffuse.png', new Uint8ArrayReader(new Uint8Array([5, 6])))
  await zw.add('textures/radar_mask.png', new Uint8ArrayReader(new Uint8Array([7, 8])))
  await zw.add('textures/radar_material.png', new Uint8ArrayReader(new Uint8Array([9, 10])))
  await zw.add('models/beacon.glb', new Uint8ArrayReader(new Uint8Array([11, 12, 13])))
  return zw.close()
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

  beforeEach(async () => {
    mockIsDev.mockReturnValue(false)
    const blob = await buildBundleBlob()
    bundleBytes = await blob.arrayBuffer()
  })

  // Tracks how many times the WHOLE bundle was downloaded (a non-range GET) —
  // used to assert the availability precheck never pulls the full bundle.
  let wholeBundleDownloads = 0

  // A range-capable CDN mock: serves byte ranges (206) and HEAD, and counts any
  // full-body GET as a whole-bundle download.
  function mockRangeFetch() {
    wholeBundleDownloads = 0
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const total = bundleBytes.byteLength
      const method = (init?.method ?? 'GET').toUpperCase()
      const rangeHeader = new Headers(init?.headers).get('Range')
      if (method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
        })
      }
      if (rangeHeader) {
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
      wholeBundleDownloads++
      return new Response(bundleBytes.slice(0), {
        status: 200,
        headers: { 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
      })
    }) as unknown as typeof fetch
  }

  const modelsEntry = () => ({
    id: 'MLA',
    version: '1.0.0',
    filename: 'mla-models.zip',
    downloadUrl: '/faction-models/mla-1.0.0-models.zip',
    size: bundleBytes.byteLength,
    timestamp: 100,
    models: {
      filename: 'mla-1.0.0-models.zip',
      downloadUrl: '/faction-models/mla-1.0.0-models.zip',
      size: bundleBytes.byteLength,
      unitCount: 1,
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

  it('reads models.json via range requests (not a whole-bundle download) and caches it', async () => {
    mockGetEntry.mockResolvedValue(modelsEntry())
    mockRangeFetch()

    const first = await getFactionModelsIndex('MLA')
    expect(first).not.toBeNull()
    expect(first!.units.radar).toBeDefined()
    // The availability precheck must NOT pull the whole bundle.
    expect(wholeBundleDownloads).toBe(0)

    const callsAfterFirst = vi.mocked(global.fetch).mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)

    const second = await getFactionModelsIndex('MLA')
    expect(second!.units.radar).toBeDefined()
    // Served from IndexedDB — no additional network calls.
    expect(vi.mocked(global.fetch).mock.calls.length).toBe(callsAfterFirst)
    expect(wholeBundleDownloads).toBe(0)
  })

  it('invalidates the cache when a model-only regen produces a new bundle (same faction-data timestamp)', async () => {
    // A model regen keeps the faction-data `timestamp` unchanged but ships a new
    // bundle filename with a new build stamp. The cache must key on the bundle
    // stamp, not the faction-data timestamp — otherwise stale (e.g. texture-less)
    // models keep being served after a regen.
    const oldEntry = {
      ...modelsEntry(),
      // faction-data timestamp stays constant across the regen
      timestamp: 100,
      models: {
        filename: 'mla-1.0.0-pedia20260101000000-models.zip',
        downloadUrl: '/faction-models/mla-1.0.0-pedia20260101000000-models.zip',
        size: bundleBytes.byteLength,
        unitCount: 1,
      },
    }
    mockGetEntry.mockResolvedValue(oldEntry)
    mockRangeFetch()

    const first = await getFactionModelsIndex('MLA')
    expect(first).not.toBeNull()
    const callsAfterFirst = vi.mocked(global.fetch).mock.calls.length

    // Same bundle again → cache hit, no new network.
    await getFactionModelsIndex('MLA')
    expect(vi.mocked(global.fetch).mock.calls.length).toBe(callsAfterFirst)

    // Model-only regen: NEW bundle filename/stamp, SAME faction-data timestamp.
    const newEntry = {
      ...oldEntry,
      timestamp: 100,
      models: {
        filename: 'mla-1.0.0-pedia20260202000000-models.zip',
        downloadUrl: '/faction-models/mla-1.0.0-pedia20260202000000-models.zip',
        size: bundleBytes.byteLength,
        unitCount: 1,
      },
    }
    mockGetEntry.mockResolvedValue(newEntry)

    const refreshed = await getFactionModelsIndex('MLA')
    expect(refreshed).not.toBeNull()
    // Cache MUST have been invalidated → a fresh range read happened.
    expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('getFactionModelsIndex never whole-bundle-downloads on page load when Range is unsupported', async () => {
    // A CDN that ignores Range (200, no accept-ranges). The precheck must degrade
    // to "no models" rather than downloading the entire bundle just to check.
    mockGetEntry.mockResolvedValue(modelsEntry())
    // CDN ignores Range: always 200 full body, no Accept-Ranges.
    global.fetch = vi.fn(async () =>
      new Response(bundleBytes.slice(0), { status: 200 })
    ) as unknown as typeof fetch

    const index = await getFactionModelsIndex('MLA')
    expect(index).toBeNull()
    // Critically: nothing was cached as a whole bundle — the precheck did not
    // download the full bundle just to check availability.
    const db = await openDB('pa-pedia-model-cache', 1)
    const bundles = await db.getAll('bundles')
    db.close()
    expect(bundles.length).toBe(0)
  })

  it('loads a unit model as blob URLs and caches per-unit', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    mockRangeFetch()

    const model = await loadUnitModel('MLA', 'radar', '1.0.0')
    expect(model).not.toBeNull()
    expect(model!.glbUrl).toMatch(/^blob:/)
    expect(model!.materialUrl).toMatch(/^blob:/)

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
    mockRangeFetch()

    const model = await loadUnitModel('MLA', 'ghost', '1.0.0')
    expect(model).toBeNull()
  })

  it('loads a texture-less unit without requesting undefined bundle entries', async () => {
    mockGetVersion.mockResolvedValue(modelsEntry())
    mockRangeFetch()

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
})
