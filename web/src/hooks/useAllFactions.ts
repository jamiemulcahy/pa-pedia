import { useReducer, useEffect, useRef, useMemo } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import type { UnitIndexEntry } from '@/types/faction'

/**
 * Extended unit entry that includes faction information
 */
export interface UnitIndexEntryWithFaction extends UnitIndexEntry {
  factionId: string
  factionDisplayName: string
}

/**
 * State for all-factions loading lifecycle
 */
type AllFactionsLoadState = {
  loading: boolean
  error: Error | null
  loadedCount: number
  totalCount: number
}

/**
 * Actions for all-factions loading state machine
 */
type AllFactionsLoadAction =
  | { type: 'LOAD_START'; totalCount: number }
  | { type: 'LOAD_PROGRESS'; loadedCount: number }
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_ERROR'; error: Error }
  | { type: 'RESET' }

/**
 * Reducer to manage all-factions loading state
 */
function allFactionsLoadReducer(state: AllFactionsLoadState, action: AllFactionsLoadAction): AllFactionsLoadState {
  switch (action.type) {
    case 'LOAD_START':
      return { loading: true, error: null, loadedCount: 0, totalCount: action.totalCount }
    case 'LOAD_PROGRESS':
      return { ...state, loadedCount: action.loadedCount }
    case 'LOAD_SUCCESS':
      return { loading: false, error: null, loadedCount: state.totalCount, totalCount: state.totalCount }
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error }
    case 'RESET':
      return { loading: false, error: null, loadedCount: 0, totalCount: 0 }
    default:
      return state
  }
}

/**
 * Hook to load and access units from all factions combined
 * Lazy-loads all faction indexes on first access
 */
export function useAllFactions() {
  const { factions, getFactionIndex, loadFaction, factionsLoading } = useFactionContext()
  const [{ loading, error, loadedCount, totalCount }, dispatch] = useReducer(allFactionsLoadReducer, {
    loading: false,
    error: null,
    loadedCount: 0,
    totalCount: 0
  })

  // Track loading state with a ref to prevent race conditions
  const loadingRef = useRef(false)

  // Get array of faction IDs
  const factionIds = useMemo(() => Array.from(factions.keys()), [factions])

  // Check if all factions are loaded
  const allLoaded = useMemo(() => {
    if (factionIds.length === 0) return false
    return factionIds.every(id => getFactionIndex(id) !== undefined)
  }, [factionIds, getFactionIndex])

  // Reset loading ref on unmount to prevent stale state on remount
  useEffect(() => {
    return () => {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Only load if we have factions and not all are loaded yet
    if (factionsLoading || factionIds.length === 0 || allLoaded || loadingRef.current) {
      return
    }

    // Mark as loading to prevent duplicate fetches
    loadingRef.current = true
    dispatch({ type: 'LOAD_START', totalCount: factionIds.length })

    // Load all factions concurrently
    const loadAll = async () => {
      let loaded = 0
      const failedFactions: string[] = []

      await Promise.all(
        factionIds.map(async (factionId) => {
          try {
            // Only load if not already loaded
            if (!getFactionIndex(factionId)) {
              await loadFaction(factionId)
            }
            loaded++
            dispatch({ type: 'LOAD_PROGRESS', loadedCount: loaded })
          } catch {
            failedFactions.push(factionId)
          }
        })
      )

      loadingRef.current = false

      if (failedFactions.length > 0) {
        dispatch({ type: 'LOAD_ERROR', error: new Error(`Failed to load faction(s): ${failedFactions.join(', ')}`) })
      } else {
        dispatch({ type: 'LOAD_SUCCESS' })
      }
    }

    loadAll()
  }, [factionIds, allLoaded, factionsLoading, loadFaction, getFactionIndex])

  // Combine all units from all loaded factions with faction info
  const units = useMemo((): UnitIndexEntryWithFaction[] => {
    const allUnits: UnitIndexEntryWithFaction[] = []

    for (const [factionId, metadata] of factions.entries()) {
      const index = getFactionIndex(factionId)
      if (index) {
        for (const entry of index.units) {
          allUnits.push({
            ...entry,
            factionId,
            factionDisplayName: metadata.displayName,
          })
        }
      }
    }

    return allUnits
  }, [factions, getFactionIndex])

  return {
    units,
    loading: loading || factionsLoading,
    error,
    loadedCount,
    totalCount,
    allLoaded,
    factionsLoading,
  }
}
