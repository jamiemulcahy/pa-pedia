/**
 * Model Loader Service
 *
 * Loads per-unit 3D model assets (Draco glb geometry + grayscale diffuse +
 * team-colour mask, plus an optional material map) for the Unit Model Viewer.
 *
 * Mirrors the dev/prod split used by `factionLoader`:
 *
 * - Development (`just dev`): model bundles are served UNZIPPED from the repo
 *   root `faction-models/{factionId}/` folder via a Vite middleware. Files are
 *   fetched directly with plain URLs; no zip, no IndexedDB.
 *
 * - Production: each faction+version has a model bundle zip on the
 *   `faction-models` GitHub release, referenced by `VersionEntry.models`.
 *   `models.json` inside the bundle is the availability source of truth. We
 *   read only the entries we need using HTTP range requests (`@zip.js/zip.js`
 *   `HttpRangeReader`) so a single unit costs ~30-120 KB rather than the whole
 *   8-20 MB bundle. If the release CDN doesn't honour range requests we fall
 *   back to downloading the whole bundle once, caching it, and extracting from
 *   the cached copy. Extracted `models.json` and per-unit blobs are cached in
 *   IndexedDB, version-aware (invalidated on timestamp change).
 *
 * Absent bundle / absent unit → returns `null` (graceful no-viewer). The common
 * "faction/version has no models yet" case is detected from the manifest with
 * no failed network request.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  ZipReader,
  HttpRangeReader,
  BlobReader,
  Uint8ArrayWriter,
  configure,
  type Entry,
} from '@zip.js/zip.js'
import {
  getManifestEntry,
  getManifestVersion,
  isDevelopmentMode,
  getSiteBaseUrl,
} from './manifestLoader'

// Run zip decompression inline (no web workers). Bundle entries are already
// compressed (Draco glb / PNG) so there is nothing to gain from workers, and
// avoiding them keeps us CSP/offline-safe (no external worker script) and lets
// the loader run under jsdom in tests.
configure({ useWebWorkers: false })

/** One unit's model asset paths, relative to the bundle root. */
export interface ModelEntry {
  glb: string
  diffuse: string
  mask: string
  material?: string
}

/** The bundle index (`models.json`) — availability source of truth. */
export interface ModelsIndex {
  generated: string
  unitCount: number
  units: Record<string, ModelEntry>
}

/** A loaded unit model, as URLs ready to hand to three.js loaders. */
export interface LoadedUnitModel {
  glbUrl: string
  diffuseUrl: string
  maskUrl: string
  materialUrl?: string
  /**
   * Release any object URLs created for this model. No-op in dev (plain file
   * URLs). Call on viewer unmount to avoid leaking blob URLs in production.
   */
  release: () => void
}

const MODELS_BASE_PATH = `${import.meta.env.BASE_URL}faction-models`

/**
 * Dev-local mode: dev server without live production data. In this mode model
 * bundles are served unzipped from /faction-models and we skip zip + caching.
 * (VITE_FACTIONS_DIR does NOT force prod here — E2E fixtures still use the
 * unzipped dev layout for models.)
 */
function isDevLocalModels(): boolean {
  return isDevelopmentMode() && import.meta.env.VITE_USE_LIVE_DATA !== 'true'
}

// ---------------------------------------------------------------------------
// IndexedDB cache (production only)
// ---------------------------------------------------------------------------

interface ModelCacheDB extends DBSchema {
  indexes: {
    key: string // `${factionId}@${version}`
    value: {
      key: string
      timestamp: number
      index: ModelsIndex
      cachedAt: string
    }
  }
  units: {
    key: string // `${factionId}@${version}/${unitId}`
    value: {
      key: string
      timestamp: number
      // Stored as raw bytes (not Blob): ArrayBuffers structured-clone cleanly
      // across environments, and Blobs are rebuilt in-context on read so they
      // are always valid for URL.createObjectURL.
      glb: ArrayBuffer
      diffuse: ArrayBuffer
      mask: ArrayBuffer
      material?: ArrayBuffer
    }
  }
  bundles: {
    key: string // `${factionId}@${version}`
    value: {
      key: string
      timestamp: number
      blob: Blob
    }
  }
}

const DB_NAME = 'pa-pedia-model-cache'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<ModelCacheDB>> | null = null

function getDB(): Promise<IDBPDatabase<ModelCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ModelCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('indexes')) {
          db.createObjectStore('indexes', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('units')) {
          db.createObjectStore('units', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('bundles')) {
          db.createObjectStore('bundles', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------------------
// Range-request support detection + zip entry extraction (production)
// ---------------------------------------------------------------------------

// Whether the release CDN honours HTTP range requests. Detected lazily on the
// first prod fetch; once a range read fails we stop attempting it this session
// and use the whole-bundle fallback.
let rangeSupport: 'unknown' | 'yes' | 'no' = 'unknown'

/** Exposed for diagnostics / tests. */
export function getRangeSupport(): 'unknown' | 'yes' | 'no' {
  return rangeSupport
}

/** Read a named entry's bytes, narrowing away directory entries. */
async function readEntry(byName: Map<string, Entry>, name: string): Promise<Uint8Array> {
  const entry = byName.get(name)
  if (!entry || !('getData' in entry) || !entry.getData) {
    throw new Error(`Entry not found in bundle: ${name}`)
  }
  return entry.getData(new Uint8ArrayWriter())
}

async function extractViaRange(
  url: string,
  names: string[]
): Promise<Map<string, Uint8Array>> {
  const reader = new ZipReader(new HttpRangeReader(url))
  try {
    const entries = await reader.getEntries()
    const byName = new Map(entries.map((e) => [e.filename, e]))
    const out = new Map<string, Uint8Array>()
    for (const name of names) {
      out.set(name, await readEntry(byName, name))
    }
    return out
  } finally {
    await reader.close()
  }
}

async function getWholeBundle(
  url: string,
  cacheKey: string,
  timestamp: number
): Promise<Blob> {
  const db = await getDB()
  const cached = await db.get('bundles', cacheKey)
  if (cached && cached.timestamp === timestamp) {
    return cached.blob
  }
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download model bundle: ${response.status} ${response.statusText}`)
  }
  const blob = await response.blob()
  await db.put('bundles', { key: cacheKey, timestamp, blob })
  return blob
}

async function extractViaWholeBundle(
  url: string,
  cacheKey: string,
  timestamp: number,
  names: string[]
): Promise<Map<string, Uint8Array>> {
  const blob = await getWholeBundle(url, cacheKey, timestamp)
  const reader = new ZipReader(new BlobReader(blob))
  try {
    const entries = await reader.getEntries()
    const byName = new Map(entries.map((e) => [e.filename, e]))
    const out = new Map<string, Uint8Array>()
    for (const name of names) {
      out.set(name, await readEntry(byName, name))
    }
    return out
  } finally {
    await reader.close()
  }
}

/**
 * Extract the requested entries from a bundle, preferring range requests and
 * falling back to a whole-bundle download.
 */
async function extractEntries(
  url: string,
  cacheKey: string,
  timestamp: number,
  names: string[]
): Promise<Map<string, Uint8Array>> {
  if (rangeSupport !== 'no') {
    try {
      const result = await extractViaRange(url, names)
      rangeSupport = 'yes'
      return result
    } catch (error) {
      // Range read failed (CDN doesn't honour Range, CORS, or partial support).
      // Remember and use the whole-bundle fallback for the rest of the session.
      rangeSupport = 'no'
      console.warn('Model bundle range request failed, falling back to whole-bundle download', error)
    }
  }
  return extractViaWholeBundle(url, cacheKey, timestamp, names)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve whether a model bundle exists for a faction+version and return its
 * availability index (`models.json`). Returns `null` when there is no bundle
 * (the common backfill case) — with no failed network request in production,
 * since the manifest tells us up front.
 */
export async function getFactionModelsIndex(
  factionId: string,
  version?: string | null
): Promise<ModelsIndex | null> {
  // Dev: fetch the unzipped models.json directly. Missing file → no models.
  if (isDevLocalModels()) {
    try {
      const response = await fetch(`${MODELS_BASE_PATH}/${factionId}/models.json`)
      if (!response.ok) return null
      return (await response.json()) as ModelsIndex
    } catch {
      return null
    }
  }

  // Production: consult the manifest first — no bundle info means no models.
  const manifestEntry = version
    ? await getManifestVersion(factionId, version)
    : await getManifestEntry(factionId)

  if (!manifestEntry || !manifestEntry.models) {
    return null
  }

  const resolvedVersion = version ?? manifestEntry.version
  const cacheKey = `${factionId.toLowerCase()}@${resolvedVersion}`

  // Version-aware cache check.
  const db = await getDB()
  const cached = await db.get('indexes', cacheKey)
  if (cached && cached.timestamp === manifestEntry.timestamp) {
    return cached.index
  }

  // Cache miss / stale — read models.json from the bundle.
  const url = getSiteBaseUrl() + manifestEntry.models.downloadUrl
  const extracted = await extractEntries(url, cacheKey, manifestEntry.timestamp, ['models.json'])
  const bytes = extracted.get('models.json')
  if (!bytes) return null

  const index = JSON.parse(new TextDecoder().decode(bytes)) as ModelsIndex
  await db.put('indexes', {
    key: cacheKey,
    timestamp: manifestEntry.timestamp,
    index,
    cachedAt: new Date().toISOString(),
  })
  return index
}

function mimeForPath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.glb')) return 'model/gltf-binary'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.ktx2')) return 'image/ktx2'
  return 'application/octet-stream'
}

/**
 * Load a single unit's model assets. Returns `null` if the faction/version has
 * no bundle or the unit has no model.
 */
export async function loadUnitModel(
  factionId: string,
  unitId: string,
  version?: string | null
): Promise<LoadedUnitModel | null> {
  const index = await getFactionModelsIndex(factionId, version)
  const entry = index?.units[unitId]
  if (!entry) return null

  // Dev: plain file URLs relative to the faction's bundle root.
  if (isDevLocalModels()) {
    const base = `${MODELS_BASE_PATH}/${factionId}`
    return {
      glbUrl: `${base}/${entry.glb}`,
      diffuseUrl: `${base}/${entry.diffuse}`,
      maskUrl: `${base}/${entry.mask}`,
      materialUrl: entry.material ? `${base}/${entry.material}` : undefined,
      release: () => {},
    }
  }

  // Production: resolve blobs from the per-unit IndexedDB cache or the bundle.
  const manifestEntry = version
    ? await getManifestVersion(factionId, version)
    : await getManifestEntry(factionId)
  if (!manifestEntry || !manifestEntry.models) return null

  const resolvedVersion = version ?? manifestEntry.version
  const bundleKey = `${factionId.toLowerCase()}@${resolvedVersion}`
  const unitKey = `${bundleKey}/${unitId}`
  const db = await getDB()

  // Rebuild a Blob from stored bytes in the current context so it is always a
  // valid Blob for URL.createObjectURL (Blobs do not reliably survive an
  // IndexedDB structured-clone round-trip in all environments).
  const bytesToBlob = (bytes: ArrayBuffer, name: string): Blob =>
    new Blob([bytes], { type: mimeForPath(name) })

  let glb: Blob | undefined
  let diffuse: Blob | undefined
  let mask: Blob | undefined
  let material: Blob | undefined

  const cachedUnit = await db.get('units', unitKey)
  if (cachedUnit && cachedUnit.timestamp === manifestEntry.timestamp) {
    glb = bytesToBlob(cachedUnit.glb, entry.glb)
    diffuse = bytesToBlob(cachedUnit.diffuse, entry.diffuse)
    mask = bytesToBlob(cachedUnit.mask, entry.mask)
    material =
      cachedUnit.material && entry.material
        ? bytesToBlob(cachedUnit.material, entry.material)
        : undefined
  } else {
    const names = [entry.glb, entry.diffuse, entry.mask]
    if (entry.material) names.push(entry.material)

    const url = getSiteBaseUrl() + manifestEntry.models.downloadUrl
    const extracted = await extractEntries(url, bundleKey, manifestEntry.timestamp, names)

    // Copy each entry into a fresh ArrayBuffer that owns exactly its bytes.
    const getBytes = (name: string): ArrayBuffer => {
      const bytes = extracted.get(name)
      if (!bytes) throw new Error(`Missing bundle entry: ${name}`)
      return bytes.slice().buffer
    }

    const glbBytes = getBytes(entry.glb)
    const diffuseBytes = getBytes(entry.diffuse)
    const maskBytes = getBytes(entry.mask)
    const materialBytes = entry.material ? getBytes(entry.material) : undefined

    await db.put('units', {
      key: unitKey,
      timestamp: manifestEntry.timestamp,
      glb: glbBytes,
      diffuse: diffuseBytes,
      mask: maskBytes,
      material: materialBytes,
    })

    glb = bytesToBlob(glbBytes, entry.glb)
    diffuse = bytesToBlob(diffuseBytes, entry.diffuse)
    mask = bytesToBlob(maskBytes, entry.mask)
    material = materialBytes && entry.material ? bytesToBlob(materialBytes, entry.material) : undefined
  }

  const urls: string[] = []
  const makeUrl = (blob: Blob): string => {
    const url = URL.createObjectURL(blob)
    urls.push(url)
    return url
  }

  return {
    glbUrl: makeUrl(glb),
    diffuseUrl: makeUrl(diffuse),
    maskUrl: makeUrl(mask),
    materialUrl: material ? makeUrl(material) : undefined,
    release: () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.length = 0
    },
  }
}

/** Clear all cached model data (indexes, per-unit blobs, whole bundles). */
export async function clearModelCache(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['indexes', 'units', 'bundles'], 'readwrite')
  await tx.objectStore('indexes').clear()
  await tx.objectStore('units').clear()
  await tx.objectStore('bundles').clear()
  await tx.done
}
