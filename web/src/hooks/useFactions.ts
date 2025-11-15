import { useFactionContext } from '@/contexts/FactionContext'
import type { FactionMetadata } from '@/types/faction'

/**
 * Hook to access all factions metadata
 * Automatically loaded on app start
 */
export function useFactions() {
  const { factions, factionsLoading, factionsError } = useFactionContext()

  const factionsList: FactionMetadata[] = Array.from(factions.values())

  return {
    factions: factionsList,
    factionsMap: factions,
    loading: factionsLoading,
    error: factionsError
  }
}
