/**
 * Asset URL Manager
 *
 * Manages Blob URLs for faction assets (icons, backgrounds).
 * Uses reference counting to prevent memory leaks.
 *
 * Usage pattern:
 * 1. Call getAssetUrl() to get a Blob URL for an asset
 * 2. Call releaseAssetUrl() when done with the URL
 * 3. URL is automatically revoked when reference count hits 0
 */

import { getStaticAsset } from './staticFactionCache'
import { getLocalAsset } from './localFactionStorage'
import { isDevelopmentMode } from './manifestLoader'

interface CachedUrl {
  url: string
  refCount: number
}

// In-memory cache of Blob URLs with reference counting
const urlCache = new Map<string, CachedUrl>()

/**
 * Get or create a Blob URL for an asset
 *
 * @param factionId - The faction ID
 * @param assetPath - Path to the asset within the faction (e.g., "assets/pa/units/land/tank/tank_icon_buildbar.png")
 * @param isLocal - Whether this is a local (user-uploaded) faction
 * @returns The Blob URL or undefined if asset not found
 */
export async function getAssetUrl(
  factionId: string,
  assetPath: string,
  isLocal: boolean
): Promise<string | undefined> {
  // In development mode for static factions, use direct file URLs
  if (!isLocal && isDevelopmentMode()) {
    const basePath = `${import.meta.env.BASE_URL}factions`
    return `${basePath}/${factionId}/${assetPath}`
  }

  const cacheKey = `${factionId}/${assetPath}`

  // Check if we already have a URL for this asset
  const cached = urlCache.get(cacheKey)
  if (cached) {
    cached.refCount++
    return cached.url
  }

  // Load from appropriate cache
  let blob: Blob | null = null
  if (isLocal) {
    blob = (await getLocalAsset(factionId, assetPath)) ?? null
  } else {
    blob = await getStaticAsset(factionId, assetPath)
  }

  if (!blob) {
    return undefined
  }

  // Create new Blob URL
  const url = URL.createObjectURL(blob)
  urlCache.set(cacheKey, { url, refCount: 1 })

  return url
}

/**
 * Release a Blob URL when no longer needed
 *
 * @param factionId - The faction ID
 * @param assetPath - Path to the asset
 */
export function releaseAssetUrl(factionId: string, assetPath: string): void {
  const cacheKey = `${factionId}/${assetPath}`
  const cached = urlCache.get(cacheKey)

  if (!cached) return

  cached.refCount--

  if (cached.refCount <= 0) {
    URL.revokeObjectURL(cached.url)
    urlCache.delete(cacheKey)
  }
}

/**
 * Clear all cached URLs for a faction
 * Call this when a faction is unloaded
 */
export function clearFactionAssetUrls(factionId: string): void {
  const prefix = `${factionId}/`
  const keysToDelete: string[] = []

  for (const [key, cached] of urlCache) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(cached.url)
      keysToDelete.push(key)
    }
  }

  for (const key of keysToDelete) {
    urlCache.delete(key)
  }
}

/**
 * Clear all cached URLs
 * Call this on app unmount or cache clear
 */
export function clearAllAssetUrls(): void {
  for (const cached of urlCache.values()) {
    URL.revokeObjectURL(cached.url)
  }
  urlCache.clear()
}

/**
 * Get the number of cached URLs (for debugging)
 */
export function getCachedUrlCount(): number {
  return urlCache.size
}
