import { useReducer, useEffect, useRef, useMemo } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import type { Unit } from '@/types/faction'

export interface ComparisonRef {
  factionId: string
  unitId: string
}

export interface ComparisonRefWithQuantity extends ComparisonRef {
  quantity: number
}

interface ComparisonUnitState {
  loading: boolean
  error: Error | null
}

type ComparisonUnitsState = {
  states: Map<string, ComparisonUnitState>
}

type ComparisonUnitsAction =
  | { type: 'LOAD_START'; key: string }
  | { type: 'LOAD_SUCCESS'; key: string }
  | { type: 'LOAD_ERROR'; key: string; error: Error }
  | { type: 'RESET'; keys: string[] }

function comparisonUnitsReducer(
  state: ComparisonUnitsState,
  action: ComparisonUnitsAction
): ComparisonUnitsState {
  const newStates = new Map(state.states)

  switch (action.type) {
    case 'LOAD_START':
      newStates.set(action.key, { loading: true, error: null })
      return { states: newStates }
    case 'LOAD_SUCCESS':
      newStates.set(action.key, { loading: false, error: null })
      return { states: newStates }
    case 'LOAD_ERROR':
      newStates.set(action.key, { loading: false, error: action.error })
      return { states: newStates }
    case 'RESET':
      // Remove any keys that are no longer in the list
      for (const key of state.states.keys()) {
        if (!action.keys.includes(key)) {
          newStates.delete(key)
        }
      }
      return { states: newStates }
    default:
      return state
  }
}

/**
 * Hook to load multiple comparison units in parallel
 * Returns arrays aligned with input order
 */
export function useComparisonUnits(refs: ComparisonRef[]) {
  const { getUnit, loadUnit } = useFactionContext()
  const [{ states }, dispatch] = useReducer(comparisonUnitsReducer, {
    states: new Map()
  })

  // Track which units are currently being loaded to prevent duplicate fetches
  const loadingRef = useRef<Set<string>>(new Set())

  // Create a stable key string from refs to avoid infinite loops
  // (refs array is created fresh each render, but this string is stable)
  const refsKey = refs.map(r => `${r.factionId}:${r.unitId}`).join(',')

  // Generate cache keys for all refs - memoized on the stable string key
  const cacheKeys = useMemo(
    () => refsKey ? refsKey.split(',') : [],
    [refsKey]
  )

  // Clean up states for removed refs
  useEffect(() => {
    dispatch({ type: 'RESET', keys: cacheKeys })
  }, [cacheKeys])

  // Load all units that aren't cached yet
  useEffect(() => {
    let mounted = true
    const loadingSet = loadingRef.current

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      const key = cacheKeys[i]

      // Skip empty unitIds (pending selection slots)
      if (!ref.unitId) {
        continue
      }

      const cached = getUnit(key)

      // Skip if already cached or already loading
      if (cached || loadingSet.has(key)) {
        continue
      }

      // Mark as loading
      loadingSet.add(key)
      dispatch({ type: 'LOAD_START', key })

      loadUnit(ref.factionId, ref.unitId)
        .then(() => {
          if (!mounted) return
          loadingSet.delete(key)
          dispatch({ type: 'LOAD_SUCCESS', key })
        })
        .catch((err) => {
          if (!mounted) return
          loadingSet.delete(key)
          dispatch({ type: 'LOAD_ERROR', key, error: err })
        })
    }

    return () => {
      mounted = false
      loadingSet.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refsKey, getUnit, loadUnit])

  // Build result arrays aligned with input order
  const units: (Unit | undefined)[] = cacheKeys.map(key => getUnit(key))
  const loading: boolean[] = cacheKeys.map(key => states.get(key)?.loading ?? false)
  const errors: (Error | null)[] = cacheKeys.map(key => states.get(key)?.error ?? null)

  // Aggregate loading state
  const anyLoading = loading.some(l => l) || units.some((u, i) => !u && !errors[i] && refs[i]?.factionId && refs[i]?.unitId)

  return {
    units,
    loading,
    errors,
    anyLoading
  }
}
