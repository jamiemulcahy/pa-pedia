/**
 * Faction Loader Service
 *
 * Loads faction data from various sources:
 * - Development mode: Direct file access from /factions/
 * - Production mode: Download zips from GitHub Releases with IndexedDB caching
 * - Local factions: User-uploaded factions stored in IndexedDB
 */

import JSZip from 'jszip'
import type { FactionMetadata, FactionIndex } from '@/types/faction'
import {
  getLocalFactionIds,
  getLocalFactionMetadata,
  getLocalFactionIndex,
} from './localFactionStorage'
import {
  loadManifest,
  getManifestEntry,
  isDevelopmentMode,
  type ManifestEntry,
} from './manifestLoader'
import {
  isStaticFactionCached,
  getStaticFactionCache,
  cacheStaticFaction,
  pruneStaleStaticFactions,
} from './staticFactionCache'
import { getAssetUrl } from './assetUrlManager'

const FACTIONS_BASE_PATH = `${import.meta.env.BASE_URL}factions`

export interface FactionDiscoveryEntry {
  id: string
  isLocal: boolean
}

/**
 * Discovers available factions
 * - In dev mode: Uses hardcoded list from local /factions/ folder
 * - In prod mode: Loads manifest from GitHub Releases
 * - Always includes local (user-uploaded) factions
 */
export async function discoverFactions(): Promise<FactionDiscoveryEntry[]> {
  const entries: FactionDiscoveryEntry[] = []

  if (isDevelopmentMode()) {
    // In dev mode, use hardcoded list of static factions
    // These match the folders in /factions/
    const staticFactionIds = ['MLA', 'Legion', 'Bugs', 'Exiles', 'Second-Wave']
    for (const id of staticFactionIds) {
      entries.push({ id, isLocal: false })
    }
  } else {
    // In prod mode, load from manifest
    try {
      const manifest = await loadManifest()
      for (const faction of manifest.factions) {
        entries.push({ id: faction.id, isLocal: false })
      }

      // Prune stale cached factions not in manifest
      const manifestIds = manifest.factions.map((f) => f.id)
      await pruneStaleStaticFactions(manifestIds)
    } catch (error) {
      console.error('Failed to load manifest:', error)
      // Fall back to empty list - user can still use local factions
    }
  }

  // Add local factions
  try {
    const localIds = await getLocalFactionIds()
    for (const id of localIds) {
      entries.push({ id, isLocal: true })
    }
  } catch (error) {
    console.warn('Failed to load local factions:', error)
  }

  return entries
}

/**
 * Downloads and extracts a faction zip from GitHub Releases
 */
async function downloadAndExtractFaction(
  entry: ManifestEntry
): Promise<{ metadata: FactionMetadata; index: FactionIndex; assets: Map<string, Blob> }> {
  console.log(`Downloading faction ${entry.id} from ${entry.downloadUrl}`)

  const response = await fetch(entry.downloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download faction: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  // Find metadata.json (at root of zip)
  const metadataFile = zip.file('metadata.json')
  if (!metadataFile) {
    throw new Error('metadata.json not found in faction zip')
  }

  const metadataText = await metadataFile.async('string')
  const metadata: FactionMetadata = JSON.parse(metadataText)

  // Find units.json
  const unitsFile = zip.file('units.json')
  if (!unitsFile) {
    throw new Error('units.json not found in faction zip')
  }

  const unitsText = await unitsFile.async('string')
  const index: FactionIndex = JSON.parse(unitsText)

  // Extract assets
  const assets = new Map<string, Blob>()
  const assetsPath = 'assets/'

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (path.startsWith(assetsPath) && !zipEntry.dir) {
      const blob = await zipEntry.async('blob')
      assets.set(path, blob)
    }
  }

  console.log(`Extracted faction ${entry.id}: ${index.units.length} units, ${assets.size} assets`)

  return { metadata, index, assets }
}

/**
 * Loads faction metadata
 * - Dev mode: Fetches from local file
 * - Prod mode: Gets from cache or downloads zip
 * - Local factions: Gets from IndexedDB
 */
export async function loadFactionMetadata(
  factionId: string,
  isLocal: boolean = false
): Promise<FactionMetadata> {
  // Local factions always come from IndexedDB
  if (isLocal) {
    const localMetadata = await getLocalFactionMetadata(factionId)
    if (localMetadata) {
      return localMetadata
    }
    throw new Error(`Local faction '${factionId}' not found`)
  }

  // Development mode: fetch from local file
  if (isDevelopmentMode()) {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/metadata.json`)
    if (!response.ok) {
      throw new Error(`Failed to load faction metadata for ${factionId}: ${response.statusText}`)
    }
    return await response.json()
  }

  // Production mode: check cache or download
  const manifestEntry = await getManifestEntry(factionId)
  if (!manifestEntry) {
    throw new Error(`Faction '${factionId}' not found in manifest`)
  }

  // Check if cached and up-to-date
  const isCached = await isStaticFactionCached(
    factionId,
    manifestEntry.version,
    manifestEntry.timestamp
  )

  if (isCached) {
    const cached = await getStaticFactionCache(factionId)
    if (cached) {
      return cached.metadata
    }
  }

  // Download and cache
  const { metadata, index, assets } = await downloadAndExtractFaction(manifestEntry)
  await cacheStaticFaction(
    factionId,
    manifestEntry.version,
    manifestEntry.timestamp,
    metadata,
    index,
    assets
  )

  return metadata
}

/**
 * Loads faction unit index
 * - Dev mode: Fetches from local file
 * - Prod mode: Gets from cache or downloads zip
 * - Local factions: Gets from IndexedDB
 */
export async function loadFactionIndex(
  factionId: string,
  isLocal: boolean = false
): Promise<FactionIndex> {
  // Local factions always come from IndexedDB
  if (isLocal) {
    const localIndex = await getLocalFactionIndex(factionId)
    if (localIndex) {
      return localIndex
    }
    throw new Error(`Local faction '${factionId}' index not found`)
  }

  // Development mode: fetch from local file
  if (isDevelopmentMode()) {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/units.json`)
    if (!response.ok) {
      throw new Error(`Failed to load faction index for ${factionId}: ${response.statusText}`)
    }
    return await response.json()
  }

  // Production mode: check cache or download
  const manifestEntry = await getManifestEntry(factionId)
  if (!manifestEntry) {
    throw new Error(`Faction '${factionId}' not found in manifest`)
  }

  // Check if cached and up-to-date
  const isCached = await isStaticFactionCached(
    factionId,
    manifestEntry.version,
    manifestEntry.timestamp
  )

  if (isCached) {
    const cached = await getStaticFactionCache(factionId)
    if (cached) {
      return cached.index
    }
  }

  // Download and cache
  const { metadata, index, assets } = await downloadAndExtractFaction(manifestEntry)
  await cacheStaticFaction(
    factionId,
    manifestEntry.version,
    manifestEntry.timestamp,
    metadata,
    index,
    assets
  )

  return index
}

/**
 * Gets the icon URL for a unit
 * - Dev mode static factions: Direct file URL
 * - Prod mode static factions: Blob URL from cache
 * - Local factions: Blob URL from IndexedDB
 */
export async function getUnitIconUrl(
  factionId: string,
  imagePath: string | undefined,
  isLocal: boolean
): Promise<string | undefined> {
  if (!imagePath) return undefined
  return getAssetUrl(factionId, imagePath, isLocal)
}

/**
 * Gets the icon path for static factions in dev mode (direct URL)
 * @deprecated Use getUnitIconUrl instead for unified handling
 */
export function getUnitIconPathFromImage(factionId: string, imagePath: string): string {
  if (!imagePath) {
    return ''
  }
  return `${FACTIONS_BASE_PATH}/${factionId}/${imagePath}`
}

/**
 * Gets the background image URL for a faction
 */
export async function getFactionBackgroundUrl(
  factionId: string,
  backgroundPath: string | undefined,
  isLocal: boolean
): Promise<string | undefined> {
  if (!backgroundPath) return undefined
  return getAssetUrl(factionId, backgroundPath, isLocal)
}

/**
 * Gets the background image path for static factions in dev mode
 * @deprecated Use getFactionBackgroundUrl instead
 */
export function getFactionBackgroundPath(factionId: string, backgroundPath: string): string {
  if (!backgroundPath) {
    return ''
  }
  return `${FACTIONS_BASE_PATH}/${factionId}/${backgroundPath}`
}

// Re-export for convenience
export { getAssetUrl }

export interface FactionMetadataWithLocal extends FactionMetadata {
  isLocal: boolean
  /** The folder name / faction ID used for routing */
  folderName: string
}

/**
 * Loads all faction metadata at once for initial app load
 */
export async function loadAllFactionMetadata(): Promise<Map<string, FactionMetadataWithLocal>> {
  const factionEntries = await discoverFactions()
  const metadataMap = new Map<string, FactionMetadataWithLocal>()

  const results = await Promise.allSettled(
    factionEntries.map((entry) => loadFactionMetadata(entry.id, entry.isLocal))
  )

  const errors: Error[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const entry = factionEntries[index]
      metadataMap.set(entry.id, {
        ...result.value,
        isLocal: entry.isLocal,
        folderName: entry.id,
      })
    } else {
      console.warn(`Skipping faction ${factionEntries[index].id}: ${result.reason.message}`)
      errors.push(result.reason)
    }
  })

  // Only throw if we have unexpected errors (not 404s)
  if (metadataMap.size === 0 && errors.length > 0) {
    const allNotFound = errors.every((e) => e.message.includes('not found'))
    if (!allNotFound) {
      throw errors[0]
    }
  }

  return metadataMap
}
