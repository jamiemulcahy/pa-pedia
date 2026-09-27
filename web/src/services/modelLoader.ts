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
 *   The bundle's `models.json` is the availability source of truth, and a copy
 *   of it (the bundle's sidecar) is baked into the site at
 *   `models.indexUrl`. Unit-page load reads only that small JSON file, with a
 *   plain same-origin GET: it never touches the bundle, the GitHub proxy or
 *   HTTP Range. Only when the visitor opens the viewer do we read the unit's
 *   entries out of the bundle with HTTP range requests (`@zip.js/zip.js`
 *   `HttpRangeReader`), so a single unit costs ~30-120 KB rather than the
 *   whole 20-80 MB bundle. If that range read fails we fall back to
 *   downloading the whole bundle once, caching it, and extracting from the
 *   cached copy. The index and per-unit blobs are cached in IndexedDB,
 *   version-aware (invalidated on bundle stamp change).
 *
 * Absent bundle / absent unit → returns `null` (graceful no-viewer). The common
 * "faction/version has no models yet" case is detected from the manifest with
 * no failed network request.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { reportError } from '@/lib/monitoring'
import { claimTransactionDone } from './idbTransaction'

/**
 * Model indexes whose failure has already been reported this session, keyed by
 * index URL (one per bundle). Prevents one broken bundle from emitting an event
 * on every unit page the visitor opens.
 */
const reportedModelIndexFailures = new Set<string>()

/** Whether a failed range read of a bundle has been reported this session. */
let reportedRangeReadFailure = false
import {
  ZipReader,
  ERR_HTTP_RANGE,
  HttpRangeReader,
  Uint8ArrayReader,
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
      // Raw bytes, for the same reason as `units`. Entries written before this
      // hold a `blob` instead and read as a cache miss.
      bytes?: ArrayBuffer
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

// Whether the bundle proxy honours HTTP range requests. Detected lazily on the
// first bundle read. It latches to 'no' for the session only on proof that
// Range is being ignored (see isRangeUnsupported); any other failure falls back
// for that one read and tries Range again next time.
let rangeSupport: 'unknown' | 'yes' | 'no' = 'unknown'

/** Exposed for diagnostics / tests. */
export function getRangeSupport(): 'unknown' | 'yes' | 'no' {
  return rangeSupport
}

/**
 * Signals that reading the zip's central directory via HTTP range requests
 * failed, for any reason. `cause` is the original error. Distinguished from
 * entry-level errors (a missing or corrupt entry), which a whole-bundle
 * download would not fix.
 */
class RangeReadError extends Error {
  constructor(cause: unknown) {
    super('model bundle range read failed')
    this.name = 'RangeReadError'
    this.cause = cause
  }
}

/**
 * Whether a failed range read proves the server ignores Range: zip.js raises
 * ERR_HTTP_RANGE for a non-206 answer to a ranged request, a missing or
 * mismatched Content-Range, or a 416. A network error, a 403/429/5xx or an
 * aborted request says nothing about Range support, so it must not latch the
 * session onto whole-bundle downloads.
 */
function isRangeUnsupported(error: unknown): boolean {
  return error instanceof Error && error.message === ERR_HTTP_RANGE
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
  // Reading the central directory is the range-dependent step. Entry reads
  // below are NOT range failures (a missing/corrupt entry must not trigger a
  // whole-bundle download).
  try {
    entries = await reader.getEntries()
  } catch (error) {
    await reader.close()
    throw new RangeReadError(error)
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

async function downloadWholeBundle(
  url: string,
  cacheKey: string,
  timestamp: number
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download model bundle: ${response.status} ${response.statusText}`)
  }
  const bytes = await response.arrayBuffer()
  const db = await getDB()
  await db.put('bundles', { key: cacheKey, timestamp, bytes })
  return bytes
}

async function extractFromBytes(
  bytes: ArrayBuffer,
  names: string[]
): Promise<Map<string, Uint8Array>> {
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(bytes)))
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
 *
 * Only called once the visitor has asked for a model, which is what justifies
 * the fallback's multi-MB download.
 */
async function extractEntries(
  url: string,
  cacheKey: string,
  timestamp: number,
  names: string[]
): Promise<Map<string, Uint8Array>> {
  // A bundle an earlier fallback already downloaded serves every unit in it
  // with no network at all. Checked before Range because a transient Range
  // failure no longer switches the session over to the fallback.
  const db = await getDB()
  const cached = await db.get('bundles', cacheKey)
  if (cached?.bytes && cached.timestamp === timestamp) {
    return extractFromBytes(cached.bytes, names)
  }

  if (rangeSupport !== 'no') {
    try {
      const result = await extractViaRange(url, names)
      rangeSupport = 'yes'
      return result
    } catch (error) {
      // Entry-level/other error — a whole-bundle download would not fix it.
      if (!(error instanceof RangeReadError)) throw error

      const unsupported = isRangeUnsupported(error.cause)
      if (unsupported) rangeSupport = 'no'
      console.warn('Model bundle range read failed; using whole-bundle fallback', error.cause)
      // The fallback usually hides this from the visitor, so Sentry is the only
      // place it shows. Report the ORIGINAL error: the wrapper's message is the
      // same for every cause, which is what made earlier failures undiagnosable.
      if (!reportedRangeReadFailure) {
        reportedRangeReadFailure = true
        reportError(error.cause, {
          level: 'warning',
          context: { stage: 'loadUnitModel', rangeUnsupported: unsupported },
          perVisitor: true,
          fingerprint: ['model-bundle-range-read'],
        })
      }
    }
  }
  return extractFromBytes(await downloadWholeBundle(url, cacheKey, timestamp), names)
}

/**
 * Fetch a bundle's baked unit index. Any failure throws with the real reason
 * (HTTP status, network error, parse error) so it reaches Sentry intact.
 */
async function fetchModelsIndex(url: string): Promise<ModelsIndex> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`model index request failed: HTTP ${response.status}`)
  }
  // A file missing from the deploy comes back as the SPA's index.html with a
  // 200, so a JSON parse failure here usually means "not baked", not "corrupt".
  const index = (await response.json()) as Partial<ModelsIndex> | null
  const units: unknown = index?.units
  if (typeof units !== 'object' || units === null || Array.isArray(units)) {
    throw new Error('model index has no units')
  }
  return index as ModelsIndex
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Raised when the model index could not be READ — a failed request, an index
 * missing from the deploy, or a manifest that does not say where the index is.
 *
 * Kept strictly apart from a `null` return, which means the faction genuinely
 * HAS no bundle. Callers must not conflate them: absence is normal and permanent
 * ("no 3D model for this unit"), a failure is transient and reporting it as
 * absence tells the user something false about data that does exist.
 *
 * `cause` is for console diagnostics only — never render it, it can carry
 * internal URLs and stack text.
 */
export class ModelIndexUnavailableError extends Error {
  constructor(cause: unknown) {
    super('model index unavailable')
    this.name = 'ModelIndexUnavailableError'
    this.cause = cause
  }
}

/**
 * Resolve whether a model bundle exists for a faction+version and return its
 * availability index (`models.json`).
 *
 * Returns `null` when there is no bundle (the common backfill case) — with no
 * failed network request in production, since the manifest tells us up front.
 * Throws {@link ModelIndexUnavailableError} when a bundle exists but its index
 * could not be read.
 */
export async function getFactionModelsIndex(
  factionId: string,
  version?: string | null
): Promise<ModelsIndex | null> {
  // Dev: fetch the unzipped models.json directly. Missing file → no models.
  //
  // Any failure here is absence, not an error: a faction with no local models
  // has no file for the middleware to serve, so the request falls through to
  // vite's SPA fallback and returns index.html — which fails to parse as JSON.
  // That is the normal "I only have MLA models checked out" case, so it must
  // read as "no model", not as a scary error on every other faction.
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

  // Cache miss / stale. This runs on unit-page load (to decide whether to show
  // the "View 3D Model" button), so it reads only the baked index: never the
  // bundle, never Range. See the module header.
  //
  // No indexUrl means a manifest from before indexes were baked. deploy.yml
  // refuses to publish one, so this is only an older manifest the visitor has
  // cached. The bundle is there, so answering "no model" would be false, and
  // opening the bundle is what this path exists to avoid: "couldn't check" is
  // the honest answer. Not reported: stale local state, not a fault.
  const { indexUrl } = manifestEntry.models
  if (!indexUrl) throw new ModelIndexUnavailableError('manifest has no model index URL')

  let index: ModelsIndex
  try {
    index = await fetchModelsIndex(indexUrl)
  } catch (error) {
    // The manifest told us a bundle exists, so this is a failure to read it —
    // never absence. Detail stays in the console for developers; callers show a
    // generic message so internals never reach the UI.
    console.warn('Model index unavailable', error)
    // The UI deliberately discards this error (see UnitModelSection), so Sentry
    // is the only place it can surface. The manifest promised a bundle, so this
    // is a broken 3D viewer for the visitor, not simply "no model".
    //
    // Reported once per bundle per session: failures are not cached (only the
    // success path writes to IndexedDB), so without this guard one missing
    // index would re-report on every unit page the visitor opens. The fixed
    // fingerprint keeps it one Sentry issue whichever frame or browser threw.
    if (!reportedModelIndexFailures.has(indexUrl)) {
      reportedModelIndexFailures.add(indexUrl)
      reportError(error, {
        context: { stage: 'loadModelIndex', factionId, version, indexUrl },
        perVisitor: true,
        fingerprint: ['model-index-unavailable'],
      })
    }
    throw new ModelIndexUnavailableError(error)
  }

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
 * reset the session's range-support detection and report-once guards. */
export async function clearModelCache(): Promise<void> {
  rangeSupport = 'unknown'
  reportedRangeReadFailure = false
  reportedModelIndexFailures.clear()
  const db = await getDB()
  const tx = db.transaction(['indexes', 'units', 'bundles'], 'readwrite')
  claimTransactionDone(tx)
  await tx.objectStore('indexes').clear()
  await tx.objectStore('units').clear()
  await tx.objectStore('bundles').clear()
  await tx.done
}
