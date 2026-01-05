import { useFactionContext } from '@/contexts/FactionContext'
import { sortFactions } from '@/utils/factionOrdering'
import type { FactionWithFolder } from '@/types/faction'

/**
 * Hook to access all factions metadata
 * Automatically loaded on app start
 */
export function useFactions() {
  const {
    factions,
    factionsLoading,
    factionsError,
    uploadFaction,
    deleteFaction,
    isLocalFaction,
  } = useFactionContext()

  // Convert Map entries to array with folder names attached, sorted by explicit order
  const factionsList: FactionWithFolder[] = sortFactions(
    Array.from(factions.entries()).map(([folderName, metadata]) => ({
      ...metadata,
      folderName,
    }))
  )

  return {
    factions: factionsList,
    factionsMap: factions,
    loading: factionsLoading,
    error: factionsError,
    uploadFaction,
    deleteFaction,
    isLocalFaction,
  }
}
