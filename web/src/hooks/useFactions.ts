import { useFactionContext } from '@/contexts/FactionContext'
import type { FactionMetadata } from '@/types/faction'

export interface FactionWithFolder extends FactionMetadata {
  folderName: string
}

/**
 * Hook to access all factions metadata
 * Automatically loaded on app start
 */
export function useFactions() {
  const { factions, factionsLoading, factionsError } = useFactionContext()

  // Convert Map entries to array with folder names attached
  const factionsList: FactionWithFolder[] = Array.from(factions.entries()).map(([folderName, metadata]) => ({
    ...metadata,
    folderName
  }))

  return {
    factions: factionsList,
    factionsMap: factions,
    loading: factionsLoading,
    error: factionsError
  }
}
