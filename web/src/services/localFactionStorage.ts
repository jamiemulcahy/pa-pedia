import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { FactionMetadata, FactionIndex } from '@/types/faction'

interface LocalFactionDB extends DBSchema {
  factions: {
    key: string
    value: {
      id: string
      metadata: FactionMetadata
      index: FactionIndex
      uploadedAt: string
    }
  }
  assets: {
    key: string // `${factionId}/${assetPath}`
    value: Blob
  }
}

const DB_NAME = 'pa-pedia-local-factions'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<LocalFactionDB>> | null = null

function getDB(): Promise<IDBPDatabase<LocalFactionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LocalFactionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('factions')) {
          db.createObjectStore('factions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets')
        }
      },
    })
  }
  return dbPromise
}

/**
 * Get all local faction IDs
 */
export async function getLocalFactionIds(): Promise<string[]> {
  const db = await getDB()
  return db.getAllKeys('factions')
}

/**
 * Check if a local faction exists
 */
export async function hasLocalFaction(factionId: string): Promise<boolean> {
  const db = await getDB()
  const faction = await db.get('factions', factionId)
  return !!faction
}

/**
 * Get local faction metadata
 */
export async function getLocalFactionMetadata(factionId: string): Promise<FactionMetadata | undefined> {
  const db = await getDB()
  const faction = await db.get('factions', factionId)
  return faction?.metadata
}

/**
 * Get local faction index (units.json data)
 */
export async function getLocalFactionIndex(factionId: string): Promise<FactionIndex | undefined> {
  const db = await getDB()
  const faction = await db.get('factions', factionId)
  return faction?.index
}

/**
 * Save a local faction (metadata, index, and assets)
 */
export async function saveLocalFaction(
  factionId: string,
  metadata: FactionMetadata,
  index: FactionIndex,
  assets: Map<string, Blob>
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['factions', 'assets'], 'readwrite')

  // Save faction data
  await tx.objectStore('factions').put({
    id: factionId,
    metadata,
    index,
    uploadedAt: new Date().toISOString(),
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
 * Delete a local faction and all its assets
 */
export async function deleteLocalFaction(factionId: string): Promise<void> {
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
 * Get an asset blob for a local faction
 */
export async function getLocalAsset(factionId: string, assetPath: string): Promise<Blob | undefined> {
  const db = await getDB()
  const key = `${factionId}/${assetPath}`
  return db.get('assets', key)
}

/**
 * Create a blob URL for a local asset
 * IMPORTANT: Caller must revoke the URL when done to prevent memory leaks
 */
export async function getLocalAssetUrl(factionId: string, assetPath: string): Promise<string | undefined> {
  const blob = await getLocalAsset(factionId, assetPath)
  if (!blob) return undefined
  return URL.createObjectURL(blob)
}
