import { useState, useEffect } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import type { FactionMetadata, FactionIndex } from '@/types/faction'

/**
 * Hook to access a specific faction and its units index
 * Lazy-loads the faction index on first access
 */
export function useFaction(factionId: string) {
  const { getFaction, getFactionIndex, loadFaction, factionsLoading } = useFactionContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const metadata: FactionMetadata | undefined = getFaction(factionId)
  const index: FactionIndex | undefined = getFactionIndex(factionId)

  useEffect(() => {
    // Only load if we don't have the index yet
    if (!index && metadata) {
      setLoading(true)
      setError(null)

      loadFaction(factionId)
        .then(() => {
          setLoading(false)
        })
        .catch((err) => {
          setError(err)
          setLoading(false)
        })
    }
  }, [factionId, index, metadata, loadFaction])

  return {
    metadata,
    index,
    units: index?.units || [],
    loading,
    error,
    exists: !!metadata,
    factionsLoading
  }
}
