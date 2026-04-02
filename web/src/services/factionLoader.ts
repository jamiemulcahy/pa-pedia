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
  getManifestVersion,
  isDevelopmentMode,
  getSiteBaseUrl,
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
 * Auto-discover factions in development mode using Vite's glob import.
 * This is resolved at build time and returns all faction folders with metadata.json.
 * Factions are located at repo root /factions/ folder (../factions from web/).
 *
 * When VITE_FACTIONS_DIR is set (e.g. for E2E tests), the glob may not find the
 * overridden directory since it's resolved at compile time. In that case we fall
 * back to a runtime fetch of the /factions/ endpoint to discover available factions.
 */
function discoverDevFactions(): string[] {
  // Use Vite's glob import to find all faction metadata files
  // Path is relative to this file (web/src/services/) - factions are at repo root
  const factionModules = import.meta.glob('../../../factions/*/metadata.json')

  // Extract faction IDs from the paths
  const factionIds: string[] = []
  for (const path of Object.keys(factionModules)) {
    // Path format: ../../factions/{factionId}/metadata.json
    const match = path.match(/\/factions\/([^/]+)\/metadata\.json$/)
    if (match) {
      factionIds.push(match[1])
    }
  }

  // Fallback for test environments where glob doesn't find files
  // In production builds, glob is resolved at compile time and this won't be needed
  if (factionIds.length === 0 && import.meta.env.MODE === 'test') {
    return ['MLA', 'Legion', 'Bugs', 'Exiles', 'Second-Wave']
  }

  return factionIds
}

/**
 * Runtime discovery of factions by fetching metadata.json from known faction IDs.
 * Used when VITE_FACTIONS_DIR overrides the default faction directory (e.g. E2E tests),
 * since Vite's compile-time glob won't find factions in the overridden directory.
 */
async function discoverDevFactionsRuntime(): Promise<string[]> {
  // Fetch the factions directory listing by trying to load a manifest
  // If no manifest exists, there's no runtime discovery available
  try {
    const response = await fetch(`${FACTIONS_BASE_PATH}/manifest.json`)
    if (response.ok) {
      const manifest = await response.json()
      if (manifest.factions && Array.isArray(manifest.factions)) {
        return manifest.factions.map((f: { id: string }) => f.id)
      }
    }
  } catch {
    // No manifest available, fall through
  }
  return []
}

/**
 * Discovers available factions
 * - In dev mode: Auto-discovers factions from /factions/ folder using Vite glob
 * - In dev-live mode: Loads manifest from production (for testing versioning)
 * - In prod mode: Loads manifest from GitHub Releases
 * - Always includes local (user-uploaded) factions
 */
export async function discoverFactions(): Promise<FactionDiscoveryEntry[]> {
  const entries: FactionDiscoveryEntry[] = []

  // Check if we're in dev-live mode (dev server using production data)
  const useDevLocalFiles = isDevelopmentMode() && import.meta.env.VITE_USE_LIVE_DATA !== 'true'

  if (useDevLocalFiles) {
    // In dev mode (without live data), auto-discover factions from /factions/ folder.
    // When VITE_FACTIONS_DIR is set (e.g. E2E tests), the compile-time glob won't
    // find factions in the overridden directory, so use runtime manifest-based discovery.
    const staticFactionIds = import.meta.env.VITE_FACTIONS_DIR
      ? await discoverDevFactionsRuntime()
      : discoverDevFactions()

    for (const id of staticFactionIds) {
      entries.push({ id, isLocal: false })
    }
  } else {
    // In prod mode or dev-live mode, load from manifest
    try {
      const manifest = await loadManifest()
      for (const faction of manifest.factions) {
        entries.push({ id: faction.id, isLocal: false })
      }

      // Prune stale cached factions not in manifest
      // Include both plain IDs (latest) and versioned keys (factionId@version)
      // so that versioned cache entries are not incorrectly pruned
      const validCacheKeys: string[] = []
      for (const faction of manifest.factions) {
        validCacheKeys.push(faction.id)
        for (const v of faction.versions) {
          validCacheKeys.push(`${faction.id}@${v.version}`)
        }
      }
      await pruneStaleStaticFactions(validCacheKeys)
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
  isLocal: boolean = false,
  version?: string | null
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
  // When VITE_FACTIONS_DIR is set, fall through to manifest-based path for version support
  if (isDevelopmentMode()) {
    const useLiveData = import.meta.env.VITE_USE_LIVE_DATA === 'true'
    const hasCustomDir = !!import.meta.env.VITE_FACTIONS_DIR
    if (!useLiveData && !hasCustomDir) {
      const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/metadata.json`)
      if (!response.ok) {
        throw new Error(`Failed to load faction metadata for ${factionId}: ${response.statusText}`)
      }
      return await response.json()
    }
    // Fall through to manifest-based code path for version support
  }

  // Production mode, dev-live mode, or dev with VITE_FACTIONS_DIR:
  // Use manifest for version resolution
  const manifestEntry = version
    ? await getManifestVersion(factionId, version)
    : await getManifestEntry(factionId)

  if (!manifestEntry) {
    const versionStr = version ? ` version '${version}'` : ''
    throw new Error(`Faction '${factionId}'${versionStr} not found in manifest`)
  }

  // In dev mode with VITE_FACTIONS_DIR, fetch directly from versioned path
  // (no zip download or IndexedDB caching needed)
  if (isDevelopmentMode() && import.meta.env.VITE_FACTIONS_DIR) {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/${manifestEntry.version}/metadata.json`)
    if (!response.ok) {
      throw new Error(`Failed to load faction metadata for ${factionId} v${manifestEntry.version}: ${response.statusText}`)
    }
    return await response.json()
  }

  // Build cache key that includes version
  // Normalize factionId to lowercase for consistent cache keys
  const normalizedFactionId = factionId.toLowerCase()
  const cacheKey = version ? `${normalizedFactionId}@${version}` : normalizedFactionId

  // Check if cached and up-to-date
  const isCached = await isStaticFactionCached(
    cacheKey,
    manifestEntry.version,
    manifestEntry.timestamp
  )

  if (isCached) {
    const cached = await getStaticFactionCache(cacheKey)
    if (cached) {
      return cached.metadata
    }
    // Cache check passed but retrieval failed (race condition or corrupt cache)
    // Fall through to re-download the faction
  }

  // Cache miss or stale - download fresh copy
  // In dev-live mode, prepend production URL to root-relative download paths
  const downloadUrl = getSiteBaseUrl() + manifestEntry.downloadUrl
  const entryWithUrl = { ...manifestEntry, downloadUrl }

  const { metadata, index, assets } = await downloadAndExtractFaction(entryWithUrl)
  await cacheStaticFaction(
    cacheKey,
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
 * - Dev mode: Fetches from local file (version ignored - dev only has one version)
 * - Prod mode: Gets from cache or downloads zip
 * - Local factions: Gets from IndexedDB
 */
export async function loadFactionIndex(
  factionId: string,
  isLocal: boolean = false,
  version?: string | null
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
  // When VITE_FACTIONS_DIR is set, fall through to manifest-based path for version support
  if (isDevelopmentMode()) {
    const useLiveData = import.meta.env.VITE_USE_LIVE_DATA === 'true'
    const hasCustomDir = !!import.meta.env.VITE_FACTIONS_DIR
    if (!useLiveData && !hasCustomDir) {
      const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/units.json`)
      if (!response.ok) {
        throw new Error(`Failed to load faction index for ${factionId}: ${response.statusText}`)
      }
      return await response.json()
    }
    // Fall through to manifest-based code path for version support
  }

  // Production mode, dev-live mode, or dev with VITE_FACTIONS_DIR:
  // Use manifest for version resolution
  const manifestEntry = version
    ? await getManifestVersion(factionId, version)
    : await getManifestEntry(factionId)

  if (!manifestEntry) {
    const versionStr = version ? ` version '${version}'` : ''
    throw new Error(`Faction '${factionId}'${versionStr} not found in manifest`)
  }

  // In dev mode with VITE_FACTIONS_DIR, fetch directly from versioned path
  if (isDevelopmentMode() && import.meta.env.VITE_FACTIONS_DIR) {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/${manifestEntry.version}/units.json`)
    if (!response.ok) {
      throw new Error(`Failed to load faction index for ${factionId} v${manifestEntry.version}: ${response.statusText}`)
    }
    return await response.json()
  }

  // Build cache key that includes version
  // Normalize factionId to lowercase for consistent cache keys
  const normalizedFactionId = factionId.toLowerCase()
  const cacheKey = version ? `${normalizedFactionId}@${version}` : normalizedFactionId

  // Check if cached and up-to-date
  const isCached = await isStaticFactionCached(
    cacheKey,
    manifestEntry.version,
    manifestEntry.timestamp
  )

  if (isCached) {
    const cached = await getStaticFactionCache(cacheKey)
    if (cached) {
      return cached.index
    }
    // Cache check passed but retrieval failed (race condition or corrupt cache)
    // Fall through to re-download the faction
  }

  // Cache miss or stale - download fresh copy
  // In dev-live mode, prepend production URL to root-relative download paths
  const downloadUrl = getSiteBaseUrl() + manifestEntry.downloadUrl
  const entryWithUrl = { ...manifestEntry, downloadUrl }

  const { metadata, index, assets } = await downloadAndExtractFaction(entryWithUrl)
  await cacheStaticFaction(
    cacheKey,
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
  isLocal: boolean,
  version?: string | null
): Promise<string | undefined> {
  if (!imagePath) return undefined
  return getAssetUrl(factionId, imagePath, isLocal, version)
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
  isLocal: boolean,
  version?: string | null
): Promise<string | undefined> {
  if (!backgroundPath) return undefined
  return getAssetUrl(factionId, backgroundPath, isLocal, version)
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
    const allNotFound = errors.every((e) => e.message.toLowerCase().includes('not found'))
    if (!allNotFound) {
      throw errors[0]
    }
  }

  return metadataMap
}
