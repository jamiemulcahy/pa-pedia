import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
  unitCount: 1,
  units: {
    radar: {
      glb: 'models/radar.glb',
      diffuse: 'textures/radar_diffuse.png',
      mask: 'textures/radar_mask.png',
      material: 'textures/radar_material.png',
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
})

describe('modelLoader — production mode', () => {
  let bundleBytes: ArrayBuffer

  beforeEach(async () => {
    mockIsDev.mockReturnValue(false)
    const blob = await buildBundleBlob()
    bundleBytes = await blob.arrayBuffer()
  })

  function mockBundleFetch() {
    // Fresh Response each call (bodies are single-use). No accept-ranges header,
    // so the range reader falls back to a whole-bundle download.
    global.fetch = vi.fn(async () => new Response(bundleBytes.slice(0), { status: 200 })) as unknown as typeof fetch
  }

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

  it('reads models.json from the bundle and caches it (no refetch on 2nd call)', async () => {
    mockGetEntry.mockResolvedValue({
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
    mockBundleFetch()

    const first = await getFactionModelsIndex('MLA')
    expect(first).not.toBeNull()
    expect(first!.units.radar).toBeDefined()

    const callsAfterFirst = vi.mocked(global.fetch).mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)

    const second = await getFactionModelsIndex('MLA')
    expect(second!.units.radar).toBeDefined()
    // Served from IndexedDB — no additional network calls.
    expect(vi.mocked(global.fetch).mock.calls.length).toBe(callsAfterFirst)
  })

  it('loads a unit model as blob URLs and caches per-unit', async () => {
    mockGetVersion.mockResolvedValue({
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
    mockBundleFetch()

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
    mockGetVersion.mockResolvedValue({
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
    mockBundleFetch()

    const model = await loadUnitModel('MLA', 'ghost', '1.0.0')
    expect(model).toBeNull()
  })
})
