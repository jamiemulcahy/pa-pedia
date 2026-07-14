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
  type ModelBundleInfo,
} from './manifestLoader'

// Run zip decompression inline (no web workers). Bundle entries are already
// compressed (Draco glb / PNG) so there is nothing to gain from workers, and
// avoiding them keeps us CSP/offline-safe (no external worker script) and lets
// the loader run under jsdom in tests.
configure({ useWebWorkers: false })

/** One unit's model asset paths, relative to the bundle root. Only `glb` is
 * guaranteed — texture-less units (many Exiles/Bugs units) omit the textures. */
export interface ModelEntry {
  glb: string
  diffuse?: string
  mask?: string
  material?: string
}

/** The bundle index (`models.json`) — availability source of truth. */
export interface ModelsIndex {
  generated: string
  unitCount: number
  units: Record<string, ModelEntry>
}

/** A loaded unit model, as URLs ready to hand to three.js loaders.
 *
 * `diffuseUrl`/`maskUrl` are optional: some units (many Exiles/Bugs units) have
 * geometry but no textures in the bundle, so the viewer falls back to a plain
 * material for those. */
export interface LoadedUnitModel {
  glbUrl: string
  diffuseUrl?: string
  maskUrl?: string
  materialUrl?: string
  /**
   * Release any object URLs created for this model. No-op in dev (plain file
   * URLs). Call on viewer unmount to avoid leaking blob URLs in production.
   */
  release: () => void
}

const MODELS_BASE_PATH = `${import.meta.env.BASE_URL}faction-models`

/**
 * URL of a faction's model bundle zip.
 *
 * Deliberately RELATIVE, unlike faction data (which dev-live fetches straight
 * from the production origin via `getSiteBaseUrl`). We read these bundles with
 * Range requests to pull one unit out of a large zip, and `Range` is not a
 * CORS-safelisted header — so fetching cross-origin makes the browser preflight,
 * and the /faction-models Pages Function answers only GET/HEAD with no CORS
 * headers (it is same-origin in prod, so it never needs them). The preflight
 * fails and the viewer concludes there are no models.
 *
 * Staying relative keeps the browser same-origin in every mode: prod hits the
 * Pages Function directly, dev-live goes through the vite proxy (vite.config.ts).
 */
function modelBundleUrl(models: ModelBundleInfo): string {
  return models.downloadUrl
}

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
      // Optional: some units have geometry but no textures in the bundle.
      diffuse?: ArrayBuffer
      mask?: ArrayBuffer
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

/**
 * Signals that reading the zip's central directory via HTTP range requests
 * failed — i.e. the CDN doesn't honour Range. Distinguished from entry-level
 * errors so that only genuine range failures downgrade session range support.
 */
class RangeUnsupportedError extends Error {
  constructor(cause: unknown) {
    super('model bundle range requests unsupported')
    this.name = 'RangeUnsupportedError'
    this.cause = cause
  }
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
  // forceRangeRequests: skip zip.js's Accept-Ranges probe and just issue range
  // requests. Our Cloudflare Pages Function proxies model bundles from the
  // GitHub release and serves correct 206 Partial Content, but Cloudflare strips
  // Accept-Ranges from the 206 responses, which would otherwise make zip.js
  // throw "HTTP Range not supported" and hide the 3D viewer.
  // Cast: forceRangeRequests is supported at runtime but missing from the
  // installed zip.js type defs.
  const reader = new ZipReader(
    new HttpRangeReader(url, {
      forceRangeRequests: true,
    } as ConstructorParameters<typeof HttpRangeReader>[1])
  )
  let entries: Entry[]
  // Reading the central directory is the range-dependent step; a failure here
  // means Range is unsupported. Entry reads below are NOT treated as range
  // failures (a missing/corrupt entry must not disable range for the session).
  try {
    entries = await reader.getEntries()
  } catch (error) {
    await reader.close()
    throw new RangeUnsupportedError(error)
  }
  try {
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
  names: string[],
  allowWholeBundleFallback = true
): Promise<Map<string, Uint8Array>> {
  if (rangeSupport !== 'no') {
    try {
      const result = await extractViaRange(url, names)
      rangeSupport = 'yes'
      return result
    } catch (error) {
      if (error instanceof RangeUnsupportedError) {
        // CDN doesn't honour Range — remember for the rest of the session and
        // fall back to a whole-bundle download (when the caller allows it).
        rangeSupport = 'no'
        console.warn('Model bundle range requests unsupported; using whole-bundle fallback', error)
      } else {
        // Entry-level/other error — do NOT poison range support for the session.
        throw error
      }
    }
  }
  if (!allowWholeBundleFallback) {
    // The availability precheck must never pull the whole bundle on page load.
    throw new RangeUnsupportedError('whole-bundle fallback disabled for this read')
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
  const bundleStamp = modelBundleStamp(manifestEntry)

  // Cache freshness keys on the MODEL bundle stamp (not the faction-data
  // timestamp) so a model-only regen invalidates stale entries.
  const db = await getDB()
  const cached = await db.get('indexes', cacheKey)
  if (cached && cached.timestamp === bundleStamp) {
    return cached.index
  }

  // Cache miss / stale — read models.json via a RANGE request only. This runs
  // on unit-page load (to decide whether to show the "View 3D Model" button), so
  // it must never download the whole multi-MB bundle. The whole-bundle fallback
  // is therefore disabled here; if Range is unavailable we treat the faction as
  // having no viewable models this session (graceful — no button, no big fetch).
  // The actual model download (loadUnitModel) keeps the fallback, since that only
  // runs after the user clicks.
  const url = modelBundleUrl(manifestEntry.models)
  let bytes: Uint8Array | undefined
  try {
    const extracted = await extractEntries(
      url,
      cacheKey,
      bundleStamp,
      ['models.json'],
      false // no whole-bundle fallback on page load
    )
    bytes = extracted.get('models.json')
  } catch (error) {
    console.warn('Model index unavailable without a whole-bundle download; hiding 3D viewer', error)
    return null
  }
  if (!bytes) return null

  const index = JSON.parse(new TextDecoder().decode(bytes)) as ModelsIndex
  await db.put('indexes', {
    key: cacheKey,
    timestamp: bundleStamp,
    index,
    cachedAt: new Date().toISOString(),
  })
  return index
}

/**
 * Freshness token for a faction's model bundle.
 *
 * A model-only regen (the `faction-models` workflow) keeps the faction-data
 * `timestamp` unchanged but ships a NEW bundle filename carrying a new build
 * stamp. So the model cache must key on the bundle's own stamp — the 14-digit
 * `pedia<YYYYMMDDHHmmss>` in `{id}-{version}-pedia{stamp}-models.zip` — NOT
 * `manifestEntry.timestamp` (the spec-zip timestamp), which would leave stale
 * (e.g. texture-less) models cached indefinitely after a regen.
 *
 * Falls back to the faction-data timestamp only if the filename is unparseable,
 * which should not happen for a real bundle.
 */
function modelBundleStamp(entry: { timestamp: number; models?: { filename: string } }): number {
  const match = entry.models?.filename.match(/pedia(\d{14})-models\.zip$/i)
  return match ? Number(match[1]) : entry.timestamp
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
      diffuseUrl: entry.diffuse ? `${base}/${entry.diffuse}` : undefined,
      maskUrl: entry.mask ? `${base}/${entry.mask}` : undefined,
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
  const bundleStamp = modelBundleStamp(manifestEntry)
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
  if (cachedUnit && cachedUnit.timestamp === bundleStamp) {
    glb = bytesToBlob(cachedUnit.glb, entry.glb)
    diffuse =
      cachedUnit.diffuse && entry.diffuse ? bytesToBlob(cachedUnit.diffuse, entry.diffuse) : undefined
    mask = cachedUnit.mask && entry.mask ? bytesToBlob(cachedUnit.mask, entry.mask) : undefined
    material =
      cachedUnit.material && entry.material
        ? bytesToBlob(cachedUnit.material, entry.material)
        : undefined
  } else {
    // Only request the assets this unit actually has — diffuse/mask/material are
    // absent for texture-less units, and asking for an undefined entry would
    // throw "Entry not found in bundle: undefined".
    const names = [entry.glb]
    if (entry.diffuse) names.push(entry.diffuse)
    if (entry.mask) names.push(entry.mask)
    if (entry.material) names.push(entry.material)

    const url = modelBundleUrl(manifestEntry.models)
    const extracted = await extractEntries(url, bundleKey, bundleStamp, names)

    // Copy each entry into a fresh ArrayBuffer that owns exactly its bytes.
    const getBytes = (name: string): ArrayBuffer => {
      const bytes = extracted.get(name)
      if (!bytes) throw new Error(`Missing bundle entry: ${name}`)
      return bytes.slice().buffer
    }

    const glbBytes = getBytes(entry.glb)
    const diffuseBytes = entry.diffuse ? getBytes(entry.diffuse) : undefined
    const maskBytes = entry.mask ? getBytes(entry.mask) : undefined
    const materialBytes = entry.material ? getBytes(entry.material) : undefined

    await db.put('units', {
      key: unitKey,
      timestamp: bundleStamp,
      glb: glbBytes,
      diffuse: diffuseBytes,
      mask: maskBytes,
      material: materialBytes,
    })

    glb = bytesToBlob(glbBytes, entry.glb)
    diffuse = diffuseBytes && entry.diffuse ? bytesToBlob(diffuseBytes, entry.diffuse) : undefined
    mask = maskBytes && entry.mask ? bytesToBlob(maskBytes, entry.mask) : undefined
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
    diffuseUrl: diffuse ? makeUrl(diffuse) : undefined,
    maskUrl: mask ? makeUrl(mask) : undefined,
    materialUrl: material ? makeUrl(material) : undefined,
    release: () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.length = 0
    },
  }
}

/** Clear all cached model data (indexes, per-unit blobs, whole bundles) and
 * reset the session's range-support detection. */
export async function clearModelCache(): Promise<void> {
  rangeSupport = 'unknown'
  const db = await getDB()
  const tx = db.transaction(['indexes', 'units', 'bundles'], 'readwrite')
  await tx.objectStore('indexes').clear()
  await tx.objectStore('units').clear()
  await tx.objectStore('bundles').clear()
  await tx.done
}
