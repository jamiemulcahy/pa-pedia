import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { FactionMetadata, FactionIndex, Unit } from '@/types/faction'
import {
  loadAllFactionMetadata,
  loadFactionIndex
} from '@/services/factionLoader'

interface FactionContextState {
  // Faction metadata (loaded on app start)
  factions: Map<string, FactionMetadata>
  factionsLoading: boolean
  factionsError: Error | null

  // Faction indexes (lazy-loaded per faction)
  factionIndexes: Map<string, FactionIndex>

  // Faction-specific loading errors
  factionErrors: Map<string, Error>

  // Unit cache (lazy-loaded per unit)
  unitsCache: Map<string, Unit>

  // Unit-specific loading errors
  unitErrors: Map<string, Error>

  // Actions
  loadFaction: (factionId: string) => Promise<void>
  loadUnit: (factionId: string, unitId: string) => Promise<Unit>
  getFaction: (factionId: string) => FactionMetadata | undefined
  getFactionIndex: (factionId: string) => FactionIndex | undefined
  getUnit: (cacheKey: string) => Unit | undefined
  getFactionError: (factionId: string) => Error | undefined
  getUnitError: (cacheKey: string) => Error | undefined
}

const FactionContext = createContext<FactionContextState | null>(null)

/**
 * Provider component for faction data management.
 *
 * Note: This file exports both the provider component and a custom hook.
 * This is a standard React context pattern and is acceptable for Fast Refresh.
 * The hook is not a component but a utility function for accessing the context.
 */
/* eslint-disable react-refresh/only-export-components */
export function FactionProvider({ children }: { children: React.ReactNode }) {
  const [factions, setFactions] = useState<Map<string, FactionMetadata>>(new Map())
  const [factionsLoading, setFactionsLoading] = useState(true)
  const [factionsError, setFactionsError] = useState<Error | null>(null)
  const [factionIndexes, setFactionIndexes] = useState<Map<string, FactionIndex>>(new Map())
  const [factionErrors, setFactionErrors] = useState<Map<string, Error>>(new Map())
  const [unitsCache, setUnitsCache] = useState<Map<string, Unit>>(new Map())
  const [unitErrors, setUnitErrors] = useState<Map<string, Error>>(new Map())

  // Use refs to avoid dependency issues in useCallback
  const factionIndexesRef = useRef(factionIndexes)
  const unitsCacheRef = useRef(unitsCache)

  // Keep refs in sync with state
  useEffect(() => {
    factionIndexesRef.current = factionIndexes
  }, [factionIndexes])

  useEffect(() => {
    unitsCacheRef.current = unitsCache
  }, [unitsCache])

  // Load all faction metadata on mount
  useEffect(() => {
    const loadFactions = async () => {
      try {
        setFactionsLoading(true)
        const metadataMap = await loadAllFactionMetadata()
        setFactions(metadataMap)
        setFactionsError(null)
      } catch (error) {
        setFactionsError(error as Error)
        console.error('Failed to load factions:', error)
      } finally {
        setFactionsLoading(false)
      }
    }

    loadFactions()
  }, [])

  // Load a faction's unit index and populate units cache
  const loadFaction = useCallback(async (factionId: string) => {
    // Check if already loaded
    if (factionIndexesRef.current.has(factionId)) {
      return
    }

    try {
      const index = await loadFactionIndex(factionId)

      // Update refs immediately to prevent race conditions
      factionIndexesRef.current.set(factionId, index)

      // Populate units cache ref from the index
      index.units.forEach(entry => {
        const cacheKey = `${factionId}:${entry.identifier}`
        unitsCacheRef.current.set(cacheKey, entry.unit)
      })

      // Update state for React components
      setFactionIndexes(prev => new Map(prev).set(factionId, index))
      setUnitsCache(prev => {
        const next = new Map(prev)
        index.units.forEach(entry => {
          const cacheKey = `${factionId}:${entry.identifier}`
          next.set(cacheKey, entry.unit)
        })
        return next
      })

      // Clear any previous error for this faction
      setFactionErrors(prev => {
        const next = new Map(prev)
        next.delete(factionId)
        return next
      })
    } catch (error) {
      const err = error as Error
      console.error(`Failed to load faction index for ${factionId}:`, err)
      // Track faction-specific error
      setFactionErrors(prev => new Map(prev).set(factionId, err))
      throw error
    }
  }, [])

  // Load a specific unit (now just retrieves from cache after faction index is loaded)
  const loadUnit = useCallback(async (factionId: string, unitId: string): Promise<Unit> => {
    const cacheKey = `${factionId}:${unitId}`

    // Check cache first - units are now loaded with the faction index
    const cached = unitsCacheRef.current.get(cacheKey)
    if (cached) {
      return cached
    }

    // If not in cache, we need to load the faction index first
    // This can happen when navigating directly to a unit page
    if (!factionIndexesRef.current.has(factionId)) {
      await loadFaction(factionId)
    }

    // Check cache again after loading faction
    const cachedAfterLoad = unitsCacheRef.current.get(cacheKey)
    if (cachedAfterLoad) {
      return cachedAfterLoad
    }

    // If still not found, the unit doesn't exist
    const err = new Error(`Unit ${unitId} not found for faction ${factionId}.`)
    console.error(err.message)
    setUnitErrors(prev => new Map(prev).set(cacheKey, err))
    throw err
  }, [loadFaction])

  const getFaction = useCallback((factionId: string) => {
    return factions.get(factionId)
  }, [factions])

  const getFactionIndex = useCallback((factionId: string) => {
    return factionIndexes.get(factionId)
  }, [factionIndexes])

  const getUnit = useCallback((cacheKey: string) => {
    return unitsCache.get(cacheKey)
  }, [unitsCache])

  const getFactionError = useCallback((factionId: string) => {
    return factionErrors.get(factionId)
  }, [factionErrors])

  const getUnitError = useCallback((cacheKey: string) => {
    return unitErrors.get(cacheKey)
  }, [unitErrors])

  const value: FactionContextState = {
    factions,
    factionsLoading,
    factionsError,
    factionIndexes,
    factionErrors,
    unitsCache,
    unitErrors,
    loadFaction,
    loadUnit,
    getFaction,
    getFactionIndex,
    getUnit,
    getFactionError,
    getUnitError
  }

  return <FactionContext.Provider value={value}>{children}</FactionContext.Provider>
}

/**
 * Custom hook to access the FactionContext.
 * Must be used within a FactionProvider component.
 *
 * @throws {Error} If used outside of FactionProvider
 */
export function useFactionContext() {
  const context = useContext(FactionContext)
  if (!context) {
    throw new Error('useFactionContext must be used within a FactionProvider')
  }
  return context
}
/* eslint-enable react-refresh/only-export-components */
