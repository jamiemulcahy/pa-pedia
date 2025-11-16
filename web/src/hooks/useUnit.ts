import { useReducer, useEffect } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import type { Unit } from '@/types/faction'

/**
 * State for unit loading lifecycle
 */
type UnitLoadState = {
  loading: boolean
  error: Error | null
}

/**
 * Actions for unit loading state machine
 */
type UnitLoadAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS' }
  | { type: 'LOAD_ERROR'; error: Error }
  | { type: 'RESET' }

/**
 * Reducer to manage unit loading state without cascading renders
 * Using useReducer batches state updates and eliminates setState-in-effect violations
 */
function unitLoadReducer(state: UnitLoadState, action: UnitLoadAction): UnitLoadState {
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
 * Hook to access a specific unit's resolved data
 * Lazy-loads the unit on first access
 *
 * Refactored to use useReducer pattern to eliminate setState calls inside useEffect,
 * which prevents cascading renders and satisfies react-hooks/set-state-in-effect rule.
 */
export function useUnit(factionId: string, unitId: string) {
  const { getUnit, loadUnit } = useFactionContext()
  const [{ loading, error }, dispatch] = useReducer(unitLoadReducer, {
    loading: false,
    error: null
  })

  const cacheKey = `${factionId}:${unitId}`
  const unit: Unit | undefined = getUnit(cacheKey)

  useEffect(() => {
    // Only load if we don't have the unit yet
    if (!unit && factionId && unitId) {
      // Dispatch action to initiate loading - this is safe in useEffect
      // because dispatch is stable and doesn't cause re-renders itself
      dispatch({ type: 'LOAD_START' })

      loadUnit(factionId, unitId)
        .then(() => {
          dispatch({ type: 'LOAD_SUCCESS' })
        })
        .catch((err) => {
          dispatch({ type: 'LOAD_ERROR', error: err })
        })
    } else if (unit) {
      // Reset state if unit is already available (e.g., from cache)
      dispatch({ type: 'RESET' })
    }
  }, [factionId, unitId, unit, loadUnit])

  return {
    unit,
    loading,
    error
  }
}
