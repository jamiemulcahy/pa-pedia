import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { FactionMetadata, FactionIndex, Unit } from '@/types/faction'
import {
  loadAllFactionMetadata,
  loadFactionIndex,
  loadUnitResolved
} from '@/services/factionLoader'

interface FactionContextState {
  // Faction metadata (loaded on app start)
  factions: Map<string, FactionMetadata>
  factionsLoading: boolean
  factionsError: Error | null

  // Faction indexes (lazy-loaded per faction)
  factionIndexes: Map<string, FactionIndex>

  // Unit cache (lazy-loaded per unit)
  unitsCache: Map<string, Unit>

  // Actions
  loadFaction: (factionId: string) => Promise<void>
  loadUnit: (factionId: string, unitId: string) => Promise<Unit>
  getFaction: (factionId: string) => FactionMetadata | undefined
  getFactionIndex: (factionId: string) => FactionIndex | undefined
  getUnit: (cacheKey: string) => Unit | undefined
}

const FactionContext = createContext<FactionContextState | null>(null)

export function FactionProvider({ children }: { children: React.ReactNode }) {
  const [factions, setFactions] = useState<Map<string, FactionMetadata>>(new Map())
  const [factionsLoading, setFactionsLoading] = useState(true)
  const [factionsError, setFactionsError] = useState<Error | null>(null)
  const [factionIndexes, setFactionIndexes] = useState<Map<string, FactionIndex>>(new Map())
  const [unitsCache, setUnitsCache] = useState<Map<string, Unit>>(new Map())

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

  // Load a faction's unit index
  const loadFaction = useCallback(async (factionId: string) => {
    // Check if already loaded
    if (factionIndexes.has(factionId)) {
      return
    }

    try {
      const index = await loadFactionIndex(factionId)
      setFactionIndexes(prev => new Map(prev).set(factionId, index))
    } catch (error) {
      console.error(`Failed to load faction index for ${factionId}:`, error)
      throw error
    }
  }, [factionIndexes])

  // Load a specific unit
  const loadUnit = useCallback(async (factionId: string, unitId: string): Promise<Unit> => {
    const cacheKey = `${factionId}:${unitId}`

    // Check cache first
    const cached = unitsCache.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const unit = await loadUnitResolved(factionId, unitId)
      setUnitsCache(prev => new Map(prev).set(cacheKey, unit))
      return unit
    } catch (error) {
      console.error(`Failed to load unit ${unitId} for faction ${factionId}:`, error)
      throw error
    }
  }, [unitsCache])

  const getFaction = useCallback((factionId: string) => {
    return factions.get(factionId)
  }, [factions])

  const getFactionIndex = useCallback((factionId: string) => {
    return factionIndexes.get(factionId)
  }, [factionIndexes])

  const getUnit = useCallback((cacheKey: string) => {
    return unitsCache.get(cacheKey)
  }, [unitsCache])

  const value: FactionContextState = {
    factions,
    factionsLoading,
    factionsError,
    factionIndexes,
    unitsCache,
    loadFaction,
    loadUnit,
    getFaction,
    getFactionIndex,
    getUnit
  }

  return <FactionContext.Provider value={value}>{children}</FactionContext.Provider>
}

export function useFactionContext() {
  const context = useContext(FactionContext)
  if (!context) {
    throw new Error('useFactionContext must be used within a FactionProvider')
  }
  return context
}
