import { useState, useEffect } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import type { Unit } from '@/types/faction'

/**
 * Hook to access a specific unit's resolved data
 * Lazy-loads the unit on first access
 */
export function useUnit(factionId: string, unitId: string) {
  const { getUnit, loadUnit } = useFactionContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const cacheKey = `${factionId}:${unitId}`
  const unit: Unit | undefined = getUnit(cacheKey)

  useEffect(() => {
    // Only load if we don't have the unit yet
    if (!unit && factionId && unitId) {
      setLoading(true)
      setError(null)

      loadUnit(factionId, unitId)
        .then(() => {
          setLoading(false)
        })
        .catch((err) => {
          setError(err)
          setLoading(false)
        })
    }
  }, [factionId, unitId, unit, loadUnit])

  return {
    unit,
    loading,
    error
  }
}
