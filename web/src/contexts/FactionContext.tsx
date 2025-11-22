import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { FactionIndex, Unit } from '@/types/faction'
import {
  loadAllFactionMetadata,
  loadFactionIndex,
  type FactionMetadataWithLocal
} from '@/services/factionLoader'
import {
  saveLocalFaction,
  deleteLocalFaction as deleteLocalFactionFromStorage,
  hasLocalFaction,
} from '@/services/localFactionStorage'
import { parseFactionZip } from '@/services/zipHandler'

interface FactionContextState {
  // Faction metadata (loaded on app start)
  factions: Map<string, FactionMetadataWithLocal>
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
  getFaction: (factionId: string) => FactionMetadataWithLocal | undefined
  getFactionIndex: (factionId: string) => FactionIndex | undefined
  getUnit: (cacheKey: string) => Unit | undefined
  getFactionError: (factionId: string) => Error | undefined
  getUnitError: (cacheKey: string) => Error | undefined

  // Local faction actions
  uploadFaction: (file: File) => Promise<{ factionId: string; wasOverwrite: boolean }>
  deleteFaction: (factionId: string) => Promise<void>
  isLocalFaction: (factionId: string) => boolean
  refreshFactions: () => Promise<void>
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
  const [factions, setFactions] = useState<Map<string, FactionMetadataWithLocal>>(new Map())
  const [factionsLoading, setFactionsLoading] = useState(true)
  const [factionsError, setFactionsError] = useState<Error | null>(null)
  const [factionIndexes, setFactionIndexes] = useState<Map<string, FactionIndex>>(new Map())
  const [factionErrors, setFactionErrors] = useState<Map<string, Error>>(new Map())
  const [unitsCache, setUnitsCache] = useState<Map<string, Unit>>(new Map())
  const [unitErrors, setUnitErrors] = useState<Map<string, Error>>(new Map())

  // Track which factions are currently being loaded to prevent race conditions
  const loadingFactionsRef = useRef<Set<string>>(new Set())

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

  // Ref for factions to use in callbacks
  const factionsRef = useRef(factions)
  useEffect(() => {
    factionsRef.current = factions
  }, [factions])

  // Load all faction metadata
  const loadFactionsData = useCallback(async () => {
    try {
      setFactionsLoading(true)
      const metadataMap = await loadAllFactionMetadata()
      setFactions(metadataMap)
      factionsRef.current = metadataMap
      setFactionsError(null)
    } catch (error) {
      setFactionsError(error as Error)
      console.error('Failed to load factions:', error)
    } finally {
      setFactionsLoading(false)
    }
  }, [])

  // Load all faction metadata on mount
  useEffect(() => {
    loadFactionsData()
  }, [loadFactionsData])

  // Load a faction's unit index and populate units cache
  const loadFaction = useCallback(async (factionId: string) => {
    // Check if already loaded or currently loading
    if (factionIndexesRef.current.has(factionId) || loadingFactionsRef.current.has(factionId)) {
      return
    }

    // Mark as loading to prevent duplicate requests
    loadingFactionsRef.current.add(factionId)

    try {
      // Check if this is a local faction
      // Use metadata if available, fall back to ID suffix check for direct navigation
      const factionMeta = factionsRef.current.get(factionId)
      const isLocal = factionMeta?.isLocal ?? factionId.endsWith('--local')
      const index = await loadFactionIndex(factionId, isLocal)

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
    } finally {
      // Remove from loading set
      loadingFactionsRef.current.delete(factionId)
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

  // Upload a local faction from a zip file
  const uploadFaction = useCallback(async (file: File): Promise<{ factionId: string; wasOverwrite: boolean }> => {
    // Parse and validate the zip file
    const result = await parseFactionZip(file)

    if (!result.success) {
      throw new Error(result.error.message)
    }

    const { factionId, metadata, index, assets } = result.data

    // Check if this will be an overwrite
    const wasOverwrite = await hasLocalFaction(factionId)

    // Save to IndexedDB
    await saveLocalFaction(factionId, metadata, index, assets)

    // Clear cached data for this faction if it was previously loaded
    if (factionIndexesRef.current.has(factionId)) {
      factionIndexesRef.current.delete(factionId)
      setFactionIndexes(prev => {
        const next = new Map(prev)
        next.delete(factionId)
        return next
      })

      // Clear units cache for this faction
      setUnitsCache(prev => {
        const next = new Map(prev)
        for (const key of prev.keys()) {
          if (key.startsWith(`${factionId}:`)) {
            next.delete(key)
            unitsCacheRef.current.delete(key)
          }
        }
        return next
      })
    }

    // Refresh factions list
    await loadFactionsData()

    return { factionId, wasOverwrite }
  }, [loadFactionsData])

  // Delete a local faction
  const deleteFaction = useCallback(async (factionId: string) => {
    // Check if it's actually a local faction
    const faction = factionsRef.current.get(factionId)
    if (!faction?.isLocal) {
      throw new Error(`Cannot delete non-local faction '${factionId}'`)
    }

    // Delete from IndexedDB
    await deleteLocalFactionFromStorage(factionId)

    // Clear cached data
    if (factionIndexesRef.current.has(factionId)) {
      factionIndexesRef.current.delete(factionId)
      setFactionIndexes(prev => {
        const next = new Map(prev)
        next.delete(factionId)
        return next
      })
    }

    // Clear units cache for this faction
    setUnitsCache(prev => {
      const next = new Map(prev)
      for (const key of prev.keys()) {
        if (key.startsWith(`${factionId}:`)) {
          next.delete(key)
          unitsCacheRef.current.delete(key)
        }
      }
      return next
    })

    // Refresh factions list
    await loadFactionsData()
  }, [loadFactionsData])

  // Check if a faction is local
  const isLocalFaction = useCallback((factionId: string): boolean => {
    return factionsRef.current.get(factionId)?.isLocal ?? false
  }, [])

  // Refresh factions list
  const refreshFactions = useCallback(async () => {
    await loadFactionsData()
  }, [loadFactionsData])

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
    getUnitError,
    uploadFaction,
    deleteFaction,
    isLocalFaction,
    refreshFactions,
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
