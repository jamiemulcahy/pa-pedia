/**
 * Static Faction Cache Service
 *
 * Manages IndexedDB cache for static faction data downloaded from GitHub Releases.
 * This is separate from localFactionStorage.ts which handles user-uploaded factions.
 *
 * Features:
 * - Caches complete faction data (metadata, units, assets)
 * - Version-aware cache invalidation (based on manifest version)
 * - Prunes stale factions not in current manifest
 *
 * The cache is only an optimisation, so no operation here throws: a failed read
 * is a miss and a failed write is skipped. Seen in the wild: a database left at
 * version 1 with none of its stores, which failed the manifest load (and so
 * every unit page) for that visitor.
 */

import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'
import type { FactionMetadata, FactionIndex } from '@/types/faction'
import { reportError } from '@/lib/monitoring'
import { claimTransactionDone } from './idbTransaction'
import { openWithoutWaiting } from './idbOpen'

interface CachedFaction {
  id: string
  version: string // From manifest, for cache invalidation
  timestamp: number // pedia timestamp from manifest
  metadata: FactionMetadata
  index: FactionIndex
  cachedAt: string // ISO timestamp
}

interface StaticFactionDB extends DBSchema {
  factions: {
    key: string // factionId
    value: CachedFaction
  }
  assets: {
    key: string // `${factionId}/${assetPath}`
    value: Blob
  }
  manifest: {
    key: 'current'
    value: {
      generated: string
      cachedAt: string
      factions: string[] // List of faction IDs for quick lookup
    }
  }
}

const DB_NAME = 'pa-pedia-static-factions'
// v2 changes no schema. It exists so `upgrade()` runs once more for databases
// left at v1 with none of their stores (seen in Firefox): it creates whatever
// is missing, which repairs them in place.
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<StaticFactionDB>> | null = null

function getDB(): Promise<IDBPDatabase<StaticFactionDB>> {
  if (!dbPromise) {
    dbPromise = openWithoutWaiting<StaticFactionDB>(
      DB_NAME,
      DB_VERSION,
      (db) => {
        if (!db.objectStoreNames.contains('factions')) {
          db.createObjectStore('factions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets')
        }
        if (!db.objectStoreNames.contains('manifest')) {
          db.createObjectStore('manifest')
        }
      },
      () => {
        dbPromise = null
      }
    )
  }
  return dbPromise
}

/** Cache failures already reported this session, by error name. */
const reportedCacheFailures = new Set<string>()

/**
 * Reported once per error name per session, at warning level: it is one
 * visitor's browser state, not an outage. Keyed by name so an expected
 * QuotaExceededError on a large faction neither hides a later, real failure
 * nor lands in the same Sentry issue.
 */
function reportCacheFailure(error: unknown, op: string): void {
  const name = error instanceof Error || error instanceof DOMException ? error.name : 'unknown'
  if (reportedCacheFailures.has(name)) return
  reportedCacheFailures.add(name)
  console.warn(`Faction cache ${op} failed (${name}); continuing without it`, error)
  reportError(error, {
    level: 'warning',
    context: { stage: 'factionCache', op },
    fingerprint: ['faction-cache-unavailable', name],
  })
}

/**
 * Runs `op` against the database, returning `fallback` if anything fails.
 * The transaction is created here, so its `done` is claimed before any await.
 */
async function withStores<T, Mode extends 'readonly' | 'readwrite'>(
  opName: string,
  stores: StoreNames<StaticFactionDB>[],
  mode: Mode,
  fallback: T,
  op: (tx: IDBPTransaction<StaticFactionDB, StoreNames<StaticFactionDB>[], Mode>) => Promise<T>
): Promise<T> {
  try {
    const db = await getDB()
    const tx = db.transaction(stores, mode)
    claimTransactionDone(tx)
    const result = await op(tx)
    await tx.done
    return result
  } catch (error) {
    reportCacheFailure(error, opName)
    return fallback
  }
}

/**
 * Factions the cache failed to store, kept for this session instead. The
 * faction was just downloaded, and its icons and raw files are served from
 * here; without it they would show nothing, and each further load of the
 * faction would download the zip again.
 */
const uncached = new Map<string, CachedFaction & { assets: Map<string, Blob> }>()

async function readFaction(factionId: string): Promise<CachedFaction | undefined> {
  return (
    uncached.get(factionId) ??
    withStores('read', ['factions'], 'readonly', undefined, (tx) =>
      tx.objectStore('factions').get(factionId)
    )
  )
}

/**
 * Check if a faction is cached and matches the expected version
 */
export async function isStaticFactionCached(
  factionId: string,
  expectedVersion: string,
  expectedTimestamp: number
): Promise<boolean> {
  const cached = await readFaction(factionId)

  if (!cached) return false

  // Check version and timestamp match
  return cached.version === expectedVersion && cached.timestamp === expectedTimestamp
}

/**
 * Get cached faction data
 */
export async function getStaticFactionCache(factionId: string): Promise<{
  metadata: FactionMetadata
  index: FactionIndex
} | null> {
  const cached = await readFaction(factionId)

  if (!cached) return null

  return {
    metadata: cached.metadata,
    index: cached.index,
  }
}

/**
 * Store faction data in cache
 */
export async function cacheStaticFaction(
  factionId: string,
  version: string,
  timestamp: number,
  metadata: FactionMetadata,
  index: FactionIndex,
  assets: Map<string, Blob>
): Promise<void> {
  const faction: CachedFaction = {
    id: factionId,
    version,
    timestamp,
    metadata,
    index,
    cachedAt: new Date().toISOString(),
  }

  const stored = await withStores('write', ['factions', 'assets'], 'readwrite', false, async (tx) => {
    await tx.objectStore('factions').put(faction)

    const assetStore = tx.objectStore('assets')
    for (const [path, blob] of assets) {
      const key = `${factionId}/${path}`
      await assetStore.put(blob, key)
    }
    return true
  })

  if (stored) uncached.delete(factionId)
  else uncached.set(factionId, { ...faction, assets })
}

/**
 * Get a cached asset blob
 *
 * @param factionId - The base faction ID (e.g., "mla")
 * @param assetPath - Path within the faction (e.g., "assets/pa/units/...")
 * @param version - Optional version string. When provided, looks up assets
 *   stored under the versioned key (e.g., "mla@0.9.0/assets/...").
 *   When omitted, uses the unversioned key (e.g., "mla/assets/...").
 */
export async function getStaticAsset(
  factionId: string,
  assetPath: string,
  version?: string | null
): Promise<Blob | null> {
  const prefix = version ? `${factionId}@${version}` : factionId
  const inMemory = uncached.get(prefix)
  if (inMemory) return inMemory.assets.get(assetPath) ?? null

  const key = `${prefix}/${assetPath}`
  const blob = await withStores('read', ['assets'], 'readonly', undefined, (tx) =>
    tx.objectStore('assets').get(key)
  )
  return blob ?? null
}

/**
 * Get every cached asset for a faction (or versioned faction) as a map keyed by
 * the asset path (e.g. "assets/pa/units/...").
 *
 * Assets are stored under `${cacheKey}/${assetPath}`; we scan the key range for
 * that prefix and strip it back off. Used by the version diff to compare the raw
 * source file trees of two versions.
 *
 * @param cacheKey - The faction cache key: `${factionId}` (latest) or
 *   `${factionId}@${version}`, matching the key used by cacheStaticFaction.
 */
export async function getAllStaticAssets(cacheKey: string): Promise<Map<string, Blob>> {
  const inMemory = uncached.get(cacheKey)
  if (inMemory) return new Map(inMemory.assets)

  const prefix = `${cacheKey}/`
  // Range over all keys starting with the prefix. The '/' delimiter guarantees a
  // versioned key (`id@ver/…`) or a longer id (`bugsX/…`) sorts outside this range,
  // so we never pick up another faction's assets. '￿' is the largest BMP char.
  const range = IDBKeyRange.bound(prefix, `${prefix}￿`, false, false)
  return withStores('read', ['assets'], 'readonly', new Map<string, Blob>(), async (tx) => {
    const store = tx.objectStore('assets')
    const keys = (await store.getAllKeys(range)) as string[]
    const blobs = await store.getAll(range)

    const map = new Map<string, Blob>()
    keys.forEach((key, i) => {
      map.set(key.slice(prefix.length), blobs[i])
    })
    return map
  })
}

/**
 * Delete a faction and all its assets from cache
 */
export async function deleteStaticFactionCache(factionId: string): Promise<void> {
  uncached.delete(factionId)
  await withStores('delete', ['factions', 'assets'], 'readwrite', undefined, async (tx) => {
    // Delete faction data
    await tx.objectStore('factions').delete(factionId)

    // Delete all assets for this faction
    const assetStore = tx.objectStore('assets')
    const allKeys = await assetStore.getAllKeys()
    const factionPrefix = `${factionId}/`

    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(factionPrefix)) {
        await assetStore.delete(key)
      }
    }
  })
}

/**
 * Prune factions not in the current manifest
 */
export async function pruneStaleStaticFactions(currentFactionIds: string[]): Promise<void> {
  const allCachedIds = await withStores('read', ['factions'], 'readonly', [] as string[], (tx) =>
    tx.objectStore('factions').getAllKeys()
  )

  const currentSet = new Set(currentFactionIds)
  const staleIds = [...allCachedIds, ...uncached.keys()].filter((id) => !currentSet.has(id))

  for (const id of staleIds) {
    console.log(`Pruning stale faction from cache: ${id}`)
    await deleteStaticFactionCache(id)
  }
}

/**
 * Save manifest cache info
 */
export async function cacheManifestInfo(generated: string, factionIds: string[]): Promise<void> {
  await withStores('write', ['manifest'], 'readwrite', undefined, async (tx) => {
    await tx.objectStore('manifest').put(
      {
        generated,
        cachedAt: new Date().toISOString(),
        factions: factionIds,
      },
      'current'
    )
  })
}

/**
 * Get cached manifest info
 */
export async function getCachedManifestInfo(): Promise<{
  generated: string
  factions: string[]
} | null> {
  const cached = await withStores('read', ['manifest'], 'readonly', undefined, (tx) =>
    tx.objectStore('manifest').get('current')
  )
  if (!cached) return null
  return {
    generated: cached.generated,
    factions: cached.factions,
  }
}

/**
 * Clear all static faction cache
 */
export async function clearStaticFactionCache(): Promise<void> {
  uncached.clear()
  await withStores('delete', ['factions', 'assets', 'manifest'], 'readwrite', undefined, async (tx) => {
    await tx.objectStore('factions').clear()
    await tx.objectStore('assets').clear()
    await tx.objectStore('manifest').clear()
  })
}

/**
 * Get all cached faction IDs
 */
export async function getCachedStaticFactionIds(): Promise<string[]> {
  const stored = await withStores('read', ['factions'], 'readonly', [] as string[], (tx) =>
    tx.objectStore('factions').getAllKeys()
  )
  return [...new Set([...stored, ...uncached.keys()])]
}
