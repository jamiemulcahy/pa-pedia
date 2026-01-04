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
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { FactionMetadata, FactionIndex } from '@/types/faction'

interface StaticFactionDB extends DBSchema {
  factions: {
    key: string // factionId
    value: {
      id: string
      version: string // From manifest, for cache invalidation
      timestamp: number // pedia timestamp from manifest
      metadata: FactionMetadata
      index: FactionIndex
      cachedAt: string // ISO timestamp
    }
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
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<StaticFactionDB>> | null = null

function getDB(): Promise<IDBPDatabase<StaticFactionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StaticFactionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
    })
  }
  return dbPromise
}

/**
 * Check if a faction is cached and matches the expected version
 */
export async function isStaticFactionCached(
  factionId: string,
  expectedVersion: string,
  expectedTimestamp: number
): Promise<boolean> {
  const db = await getDB()
  const cached = await db.get('factions', factionId)

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
  const db = await getDB()
  const cached = await db.get('factions', factionId)

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
  const db = await getDB()
  const tx = db.transaction(['factions', 'assets'], 'readwrite')

  // Save faction data
  await tx.objectStore('factions').put({
    id: factionId,
    version,
    timestamp,
    metadata,
    index,
    cachedAt: new Date().toISOString(),
  })

  // Save assets
  const assetStore = tx.objectStore('assets')
  for (const [path, blob] of assets) {
    const key = `${factionId}/${path}`
    await assetStore.put(blob, key)
  }

  await tx.done
}

/**
 * Get a cached asset blob
 */
export async function getStaticAsset(factionId: string, assetPath: string): Promise<Blob | null> {
  const db = await getDB()
  const key = `${factionId}/${assetPath}`
  const blob = await db.get('assets', key)
  return blob ?? null
}

/**
 * Delete a faction and all its assets from cache
 */
export async function deleteStaticFactionCache(factionId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['factions', 'assets'], 'readwrite')

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

  await tx.done
}

/**
 * Prune factions not in the current manifest
 */
export async function pruneStaleStaticFactions(currentFactionIds: string[]): Promise<void> {
  const db = await getDB()
  const allCachedIds = await db.getAllKeys('factions')

  const currentSet = new Set(currentFactionIds)
  const staleIds = allCachedIds.filter((id) => !currentSet.has(id))

  for (const id of staleIds) {
    console.log(`Pruning stale faction from cache: ${id}`)
    await deleteStaticFactionCache(id)
  }
}

/**
 * Save manifest cache info
 */
export async function cacheManifestInfo(generated: string, factionIds: string[]): Promise<void> {
  const db = await getDB()
  await db.put('manifest', {
    generated,
    cachedAt: new Date().toISOString(),
    factions: factionIds,
  }, 'current')
}

/**
 * Get cached manifest info
 */
export async function getCachedManifestInfo(): Promise<{
  generated: string
  factions: string[]
} | null> {
  const db = await getDB()
  const cached = await db.get('manifest', 'current')
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
  const db = await getDB()
  const tx = db.transaction(['factions', 'assets', 'manifest'], 'readwrite')
  await tx.objectStore('factions').clear()
  await tx.objectStore('assets').clear()
  await tx.objectStore('manifest').clear()
  await tx.done
}

/**
 * Get all cached faction IDs
 */
export async function getCachedStaticFactionIds(): Promise<string[]> {
  const db = await getDB()
  return db.getAllKeys('factions')
}
