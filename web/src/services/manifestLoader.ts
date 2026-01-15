/**
 * Manifest Loader Service
 *
 * Loads the faction manifest from GitHub Releases.
 * The manifest lists all available static factions with their download URLs.
 *
 * Features:
 * - Cache-busting for fresh manifest on each app load
 * - Falls back to cached manifest when offline
 * - In-memory caching to avoid repeated fetches during session
 */

import { getCachedManifestInfo, cacheManifestInfo } from './staticFactionCache'

// Production site URL for dev-live mode
const PRODUCTION_SITE_URL = 'https://pa-pedia.com'

// In production, faction data is served from the same origin (/factions/)
// This avoids CORS issues that would occur with GitHub Releases URLs
const FACTIONS_BASE_PATH = `${import.meta.env.BASE_URL}factions`

/**
 * Check if we're in dev-live mode (local dev server using production data)
 */
function isDevLiveMode(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_USE_LIVE_DATA === 'true'
}

/**
 * Get the manifest URL, accounting for dev-live mode
 */
function getManifestUrl(): string {
  if (isDevLiveMode()) {
    return `${PRODUCTION_SITE_URL}/factions/manifest.json`
  }
  return `${FACTIONS_BASE_PATH}/manifest.json`
}

/**
 * Get the base URL for downloading faction assets
 */
export function getSiteBaseUrl(): string {
  if (isDevLiveMode()) {
    return PRODUCTION_SITE_URL
  }
  return ''
}

// Release tag for reference (used in cached manifest fallback)
const RELEASE_TAG = 'faction-data'

export interface VersionEntry {
  version: string
  filename: string
  downloadUrl: string
  size: number
  timestamp: number
  build?: string
}

export interface FactionEntry {
  id: string
  displayName?: string
  isAddon?: boolean
  baseFactions?: string[]
  latest: VersionEntry
  versions: VersionEntry[]
}

export interface FactionManifest {
  generated: string
  releaseTag: string
  factions: FactionEntry[]
}

/**
 * Flattened manifest entry for backwards compatibility
 * Combines faction info with a specific version's download info
 */
export interface ManifestEntry {
  id: string
  version: string
  filename: string
  downloadUrl: string
  size: number
  timestamp: number
  build?: string
  displayName?: string
  isAddon?: boolean
  baseFactions?: string[]
}

// In-memory cache for the current session
let cachedManifest: FactionManifest | null = null
let manifestLoadPromise: Promise<FactionManifest> | null = null

/**
 * Load the faction manifest
 *
 * - First load in session: Fetches from GitHub Releases
 * - Subsequent calls: Returns cached manifest
 * - Offline: Falls back to IndexedDB cached manifest info
 */
export async function loadManifest(): Promise<FactionManifest> {
  // Return cached if available
  if (cachedManifest) {
    return cachedManifest
  }

  // Dedupe concurrent calls
  if (manifestLoadPromise) {
    return manifestLoadPromise
  }

  manifestLoadPromise = doLoadManifest()
  try {
    cachedManifest = await manifestLoadPromise
    return cachedManifest
  } finally {
    manifestLoadPromise = null
  }
}

async function doLoadManifest(): Promise<FactionManifest> {
  try {
    // Add cache-busting parameter
    const url = `${getManifestUrl()}?_=${Date.now()}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`)
    }

    const manifest: FactionManifest = await response.json()

    // Cache manifest info for offline fallback
    await cacheManifestInfo(
      manifest.generated,
      manifest.factions.map((f) => f.id)
    )

    return manifest
  } catch (error) {
    console.warn('Failed to fetch manifest from network, trying cache...', error)

    // Try to load cached manifest info for offline mode
    const cached = await getCachedManifestInfo()
    if (cached) {
      console.log('Using cached manifest info for offline mode')
      // Return a minimal manifest from cache
      // Note: This won't have download URLs, so new factions can't be loaded
      const placeholderVersion: VersionEntry = {
        version: 'cached',
        filename: '',
        downloadUrl: '',
        size: 0,
        timestamp: 0,
      }
      return {
        generated: cached.generated,
        releaseTag: RELEASE_TAG,
        factions: cached.factions.map((id) => ({
          id,
          latest: placeholderVersion,
          versions: [placeholderVersion],
        })),
      }
    }

    throw new Error('No manifest available (network error and no cache)')
  }
}

/**
 * Get a specific faction entry from the manifest (flattened with latest version)
 */
export async function getManifestEntry(factionId: string): Promise<ManifestEntry | null> {
  const manifest = await loadManifest()
  // Case-insensitive lookup (manifest has lowercase IDs but URLs may have uppercase)
  const normalizedId = factionId.toLowerCase()
  const faction = manifest.factions.find((f) => f.id === factionId || f.id === normalizedId)
  if (!faction) return null

  // Flatten faction info with latest version for backwards compatibility
  return {
    id: faction.id,
    displayName: faction.displayName,
    isAddon: faction.isAddon,
    baseFactions: faction.baseFactions,
    ...faction.latest,
  }
}

/**
 * Get a specific version of a faction from the manifest
 */
export async function getManifestVersion(
  factionId: string,
  version: string
): Promise<ManifestEntry | null> {
  const manifest = await loadManifest()
  // Case-insensitive lookup (manifest has lowercase IDs but URLs may have uppercase)
  const normalizedId = factionId.toLowerCase()
  const faction = manifest.factions.find((f) => f.id === factionId || f.id === normalizedId)
  if (!faction) return null

  const versionEntry = faction.versions.find((v) => v.version === version)
  if (!versionEntry) return null

  return {
    id: faction.id,
    displayName: faction.displayName,
    isAddon: faction.isAddon,
    baseFactions: faction.baseFactions,
    ...versionEntry,
  }
}

/**
 * Get all available versions for a faction
 */
export async function getFactionVersions(factionId: string): Promise<VersionEntry[]> {
  const manifest = await loadManifest()
  // Case-insensitive lookup (manifest has lowercase IDs but URLs may have uppercase)
  const normalizedId = factionId.toLowerCase()
  const faction = manifest.factions.find((f) => f.id === factionId || f.id === normalizedId)
  return faction?.versions ?? []
}

/**
 * Get all faction IDs from the manifest
 */
export async function getManifestFactionIds(): Promise<string[]> {
  const manifest = await loadManifest()
  return manifest.factions.map((f) => f.id)
}

/**
 * Force reload the manifest (clears in-memory cache)
 */
export function invalidateManifestCache(): void {
  cachedManifest = null
  manifestLoadPromise = null
}

/**
 * Check if we're running in development mode
 * In dev mode, we load from local files instead of GitHub Releases
 */
export function isDevelopmentMode(): boolean {
  return import.meta.env.DEV
}

/**
 * Get the base path for faction data
 * Both dev and prod serve from the same origin at /factions/
 */
export function getFactionBasePath(): string {
  return FACTIONS_BASE_PATH
}
