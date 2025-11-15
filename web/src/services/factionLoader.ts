import type { FactionMetadata, FactionIndex, Unit } from '@/types/faction'

const FACTIONS_BASE_PATH = '/factions'

/**
 * Discovers available factions by checking for known faction directories
 * In a real app, this would be dynamic, but for now we hardcode MLA and Legion
 */
export async function discoverFactions(): Promise<string[]> {
  // Hardcoded for now - in production, this could fetch a manifest
  return ['MLA', 'Legion']
}

/**
 * Loads faction metadata from metadata.json
 */
export async function loadFactionMetadata(factionId: string): Promise<FactionMetadata> {
  try {
    const response = await fetch(`${FACTIONS_BASE_PATH}/${factionId}/metadata.json`)
    if (!response.ok) {
      throw new Error(`Failed to load faction metadata for ${factionId}: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Error loading faction metadata for ${factionId}:`, error)
    throw error
  }
}

/**
 * Loads faction unit index from units.json
 */
export async function loadFactionIndex(factionId: string): Promise<FactionIndex> {
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
 * Loads a specific unit's resolved data
 */
export async function loadUnitResolved(factionId: string, unitId: string): Promise<Unit> {
  try {
    const response = await fetch(
      `${FACTIONS_BASE_PATH}/${factionId}/units/${unitId}/${unitId}_resolved.json`
    )
    if (!response.ok) {
      throw new Error(`Failed to load unit ${unitId} for faction ${factionId}: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Error loading unit ${unitId} for faction ${factionId}:`, error)
    throw error
  }
}

/**
 * Gets the icon path for a unit
 */
export function getUnitIconPath(factionId: string, unitId: string): string {
  return `${FACTIONS_BASE_PATH}/${factionId}/units/${unitId}/${unitId}_icon_buildbar.png`
}

/**
 * Loads all faction metadata at once for initial app load
 * Maps by folder name (not metadata.identifier) since routes use folder names
 */
export async function loadAllFactionMetadata(): Promise<Map<string, FactionMetadata>> {
  const factionFolderNames = await discoverFactions()
  const metadataMap = new Map<string, FactionMetadata>()

  const results = await Promise.allSettled(
    factionFolderNames.map(folderName => loadFactionMetadata(folderName))
  )

  const errors: Error[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      // Use folder name as key, not metadata.identifier
      // This ensures routes like /faction/MLA match the map key
      metadataMap.set(factionFolderNames[index], result.value)
    } else {
      console.error(`Failed to load metadata for ${factionFolderNames[index]}:`, result.reason)
      errors.push(result.reason)
    }
  })

  // If all factions failed to load, throw the first error
  if (metadataMap.size === 0 && errors.length > 0) {
    throw errors[0]
  }

  return metadataMap
}
