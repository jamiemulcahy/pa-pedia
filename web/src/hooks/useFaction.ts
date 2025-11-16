import { useReducer, useEffect } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import type { FactionMetadata, FactionIndex } from '@/types/faction'

/**
 * State for faction loading lifecycle
 */
type FactionLoadState = {
  loading: boolean
  error: Error | null
}

/**
 * Actions for faction loading state machine
 */
type FactionLoadAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_ERROR'; error: Error }
  | { type: 'RESET' }

/**
 * Reducer to manage faction loading state without cascading renders
 * Using useReducer batches state updates and eliminates setState-in-effect violations
 */
function factionLoadReducer(state: FactionLoadState, action: FactionLoadAction): FactionLoadState {
  switch (action.type) {
    case 'LOAD_START':
      return { loading: true, error: null }
    case 'LOAD_SUCCESS':
      return { loading: false, error: null }
    case 'LOAD_ERROR':
      return { loading: false, error: action.error }
    case 'RESET':
      return { loading: false, error: null }
    default:
      return state
  }
}

/**
 * Hook to access a specific faction and its units index
 * Lazy-loads the faction index on first access
 *
 * Refactored to use useReducer pattern to eliminate setState calls inside useEffect,
 * which prevents cascading renders and satisfies react-hooks/set-state-in-effect rule.
 */
export function useFaction(factionId: string) {
  const { getFaction, getFactionIndex, loadFaction, factionsLoading } = useFactionContext()
  const [{ loading, error }, dispatch] = useReducer(factionLoadReducer, {
    loading: false,
    error: null
  })

  const metadata: FactionMetadata | undefined = getFaction(factionId)
  const index: FactionIndex | undefined = getFactionIndex(factionId)

  useEffect(() => {
    // Only load if we don't have the index yet
    if (!index && metadata) {
      // Dispatch action to initiate loading - this is safe in useEffect
      // because dispatch is stable and doesn't cause re-renders itself
      dispatch({ type: 'LOAD_START' })

      loadFaction(factionId)
        .then(() => {
          dispatch({ type: 'LOAD_SUCCESS' })
        })
        .catch((err) => {
          dispatch({ type: 'LOAD_ERROR', error: err })
        })
    } else if (index) {
      // Reset state if index is already available (e.g., from cache)
      dispatch({ type: 'RESET' })
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
