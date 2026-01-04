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

// Repository info - these should match your GitHub repo
const REPO_OWNER = 'jamiemulcahy'
const REPO_NAME = 'pa-pedia'
const RELEASE_TAG = 'faction-data'

// Manifest URL with cache-busting
const MANIFEST_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}/manifest.json`

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

export interface FactionManifest {
  generated: string
  releaseTag: string
  factions: ManifestEntry[]
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
    const url = `${MANIFEST_URL}?_=${Date.now()}`
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
      return {
        generated: cached.generated,
        releaseTag: RELEASE_TAG,
        factions: cached.factions.map((id) => ({
          id,
          version: 'cached',
          filename: '',
          downloadUrl: '',
          size: 0,
          timestamp: 0,
        })),
      }
    }

    throw new Error('No manifest available (network error and no cache)')
  }
}

/**
 * Get a specific faction entry from the manifest
 */
export async function getManifestEntry(factionId: string): Promise<ManifestEntry | null> {
  const manifest = await loadManifest()
  return manifest.factions.find((f) => f.id === factionId) ?? null
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
 * In dev mode: local files; In prod: GitHub Releases
 */
export function getFactionBasePath(): string {
  if (isDevelopmentMode()) {
    return `${import.meta.env.BASE_URL}factions`
  }
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}`
}
