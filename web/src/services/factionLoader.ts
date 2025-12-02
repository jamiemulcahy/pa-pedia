import type { FactionMetadata, FactionIndex } from '@/types/faction'
import {
  getLocalFactionIds,
  getLocalFactionMetadata,
  getLocalFactionIndex,
  getLocalAssetUrl,
} from './localFactionStorage'

const FACTIONS_BASE_PATH = `${import.meta.env.BASE_URL}factions`

export interface FactionDiscoveryEntry {
  id: string
  isLocal: boolean
}

/**
 * Discovers available factions by checking for known faction directories
 * Includes both static factions and local (user-uploaded) factions
 */
export async function discoverFactions(): Promise<FactionDiscoveryEntry[]> {
  const staticFactions: FactionDiscoveryEntry[] = ['MLA', 'Legion', 'Bugs', 'Exiles'].map(id => ({
    id,
    isLocal: false,
  }))

  try {
    const localIds = await getLocalFactionIds()
    const localFactions: FactionDiscoveryEntry[] = localIds.map(id => ({
      id,
      isLocal: true,
    }))
    return [...staticFactions, ...localFactions]
  } catch (error) {
    console.warn('Failed to load local factions:', error)
    return staticFactions
  }
}

/**
 * Loads faction metadata from metadata.json
 * Supports both static factions (fetched) and local factions (IndexedDB)
 */
export async function loadFactionMetadata(factionId: string, isLocal: boolean = false): Promise<FactionMetadata> {
  // Try local storage first if marked as local
  if (isLocal) {
    const localMetadata = await getLocalFactionMetadata(factionId)
    if (localMetadata) {
      return localMetadata
    }
    throw new Error(`Local faction '${factionId}' not found`)
  }

  try {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/metadata.json`)
    if (!response.ok) {
      // 404 means faction doesn't exist
      if (response.status === 404) {
        throw new Error(`Faction '${factionId}' not found. Please generate faction data using the CLI.`)
      }
      throw new Error(`Failed to load faction metadata for ${factionId}: ${response.statusText}`)
    }

    // Check if we got HTML instead of JSON (common when server returns error pages)
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.includes('application/json')) {
      throw new Error(`Faction '${factionId}' not found. Please generate faction data using the CLI.`)
    }

    return await response.json()
  } catch (error) {
    // Re-throw our custom errors as-is
    if (error instanceof Error && error.message.includes('not found')) {
      throw error
    }
    // For JSON parse errors, provide a better message
    if (error instanceof SyntaxError) {
      throw new Error(`Faction '${factionId}' not found. Please generate faction data using the CLI.`)
    }
    console.error(`Error loading faction metadata for ${factionId}:`, error)
    throw error
  }
}

/**
 * Loads faction unit index from units.json
 * Supports both static factions (fetched) and local factions (IndexedDB)
 */
export async function loadFactionIndex(factionId: string, isLocal: boolean = false): Promise<FactionIndex> {
  // Try local storage first if marked as local
  if (isLocal) {
    const localIndex = await getLocalFactionIndex(factionId)
    if (localIndex) {
      return localIndex
    }
    throw new Error(`Local faction '${factionId}' index not found`)
  }

  try {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/units.json`)
    if (!response.ok) {
      throw new Error(`Failed to load faction index for ${factionId}: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Error loading faction index for ${factionId}:`, error)
    throw error
  }
}

/**
 * Gets the icon path for a unit using the unit's image field
 * The image field contains the path relative to the faction folder
 * (e.g., "assets/pa/units/land/tank/tank_icon_buildbar.png")
 */
export function getUnitIconPathFromImage(factionId: string, imagePath: string): string {
  if (!imagePath) {
    return '' // Return empty string for missing images - caller should handle fallback
  }
  return `${FACTIONS_BASE_PATH}/${factionId}/${imagePath}`
}

/**
 * Gets the icon URL for a local faction unit
 * Returns a blob URL that must be revoked when no longer needed
 */
export async function getLocalUnitIconUrl(factionId: string, imagePath: string): Promise<string | undefined> {
  if (!imagePath) {
    return undefined
  }
  return getLocalAssetUrl(factionId, imagePath)
}

/**
 * Gets the background image path for a faction (static factions)
 */
export function getFactionBackgroundPath(factionId: string, backgroundPath: string): string {
  if (!backgroundPath) {
    return ''
  }
  return `${FACTIONS_BASE_PATH}/${factionId}/${backgroundPath}`
}

/**
 * Gets the background image URL for a local faction
 * Returns a blob URL that must be revoked when no longer needed
 */
export async function getLocalFactionBackgroundUrl(factionId: string, backgroundPath: string): Promise<string | undefined> {
  if (!backgroundPath) {
    return undefined
  }
  return getLocalAssetUrl(factionId, backgroundPath)
}

// Re-export for convenience
export { getLocalAssetUrl }

export interface FactionMetadataWithLocal extends FactionMetadata {
  isLocal: boolean
}

/**
 * Loads all faction metadata at once for initial app load
 * Maps by folder name (not metadata.identifier) since routes use folder names
 * Now includes isLocal flag for each faction
 */
export async function loadAllFactionMetadata(): Promise<Map<string, FactionMetadataWithLocal>> {
  const factionEntries = await discoverFactions()
  const metadataMap = new Map<string, FactionMetadataWithLocal>()

  const results = await Promise.allSettled(
    factionEntries.map(entry => loadFactionMetadata(entry.id, entry.isLocal))
  )

  const errors: Error[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      // Use folder name as key, not metadata.identifier
      // This ensures routes like /faction/MLA match the map key
      const entry = factionEntries[index]
      metadataMap.set(entry.id, {
        ...result.value,
        isLocal: entry.isLocal,
      })
    } else {
      console.warn(`Skipping faction ${factionEntries[index].id}: ${result.reason.message}`)
      errors.push(result.reason)
    }
  })

  // If no factions were loaded, that's okay - return empty map
  // The UI will show a "no factions found" message
  // Only throw an error if we got unexpected errors (not 404s)
  if (metadataMap.size === 0 && errors.length > 0) {
    // Check if all errors are "not found" errors
    const allNotFound = errors.every(e => e.message.includes('not found'))
    if (!allNotFound) {
      // We have some unexpected errors, throw the first one
      throw errors[0]
    }
    // All errors are "not found" - this is expected when no factions exist
    // Return empty map and let the UI handle it
  }

  return metadataMap
}
