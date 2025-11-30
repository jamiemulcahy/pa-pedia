import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { FactionProvider, useFactionContext } from '../FactionContext'
import {
  mockMLAMetadata,
  mockLegionMetadata,
  mockMLAIndex,
  mockTankUnit,
  mockBotUnit,
  setupMockFetch,
  type MockFetch
} from '@/tests/mocks/factionData'

describe('FactionContext', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useFactionContext', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useFactionContext())
      }).toThrow('useFactionContext must be used within a FactionProvider')

      consoleError.mockRestore()
    })
  })

  describe('FactionProvider - initial state', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      expect(result.current.factionsLoading).toBe(true)
      expect(result.current.factions.size).toBe(0)
    })

    it('should initialize empty maps', () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      expect(result.current.factionIndexes instanceof Map).toBe(true)
      expect(result.current.unitsCache instanceof Map).toBe(true)
      expect(result.current.factionIndexes.size).toBe(0)
      expect(result.current.unitsCache.size).toBe(0)
    })
  })

  describe('FactionProvider - loading factions', () => {
    it('should load all faction metadata on mount', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      expect(result.current.factions.size).toBe(2)
      expect(result.current.factions.get('MLA')).toEqual(mockMLAMetadata)
      expect(result.current.factions.get('Legion')).toEqual(mockLegionMetadata)
    })

    it('should set error state on failure', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as unknown as MockFetch

      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      expect(result.current.factionsError).toBeTruthy()
      expect(result.current.factionsError?.message).toContain('Network error')
    })

    it('should clear error on successful load', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      expect(result.current.factionsError).toBeNull()
    })
  })

  describe('loadFaction', () => {
    it('should load faction index', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      // Wait for initial metadata load
      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      // Load faction index
      await result.current.loadFaction('MLA')

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.factionIndexes.get('MLA')).toEqual(mockMLAIndex)
      })
    })

    it('should not reload if already loaded', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      // Load once
      await result.current.loadFaction('MLA')

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.factionIndexes.has('MLA')).toBe(true)
      })

      const firstCallCount = (global.fetch as MockFetch).mock.calls.length

      // Load again
      await result.current.loadFaction('MLA')
      const secondCallCount = (global.fetch as MockFetch).mock.calls.length

      // Should not have made additional fetch calls
      expect(secondCallCount).toBe(firstCallCount)
    })

    it('should throw error on load failure', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      await expect(result.current.loadFaction('InvalidFaction')).rejects.toThrow()
    })
  })

  describe('loadUnit', () => {
    it('should load unit and cache it', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      // Load faction index first (required before loadUnit)
      await result.current.loadFaction('MLA')

      // Wait for units cache to be populated
      await waitFor(() => {
        expect(result.current.unitsCache.size).toBeGreaterThan(0)
      })

      const unit = await result.current.loadUnit('MLA', 'tank')

      expect(unit).toEqual(mockTankUnit)

      // Wait for cache to update
      await waitFor(() => {
        expect(result.current.unitsCache.get('MLA:tank')).toEqual(mockTankUnit)
      })
    })

    it('should return cached unit on second call', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      // Load faction index first (required before loadUnit)
      await result.current.loadFaction('MLA')

      // Wait for units cache to be populated
      await waitFor(() => {
        expect(result.current.unitsCache.size).toBeGreaterThan(0)
      })

      // First load
      const unit1 = await result.current.loadUnit('MLA', 'tank')

      // Wait for cache to update
      await waitFor(() => {
        expect(result.current.unitsCache.has('MLA:tank')).toBe(true)
      })

      const firstCallCount = (global.fetch as MockFetch).mock.calls.length

      // Second load (should use cache)
      const unit2 = await result.current.loadUnit('MLA', 'tank')
      const secondCallCount = (global.fetch as MockFetch).mock.calls.length

      expect(unit1).toEqual(unit2)
      expect(secondCallCount).toBe(firstCallCount) // No additional fetch
    })

    it('should cache multiple units independently', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      // Load faction index first (required before loadUnit)
      await result.current.loadFaction('MLA')

      // Wait for units cache to be populated
      await waitFor(() => {
        expect(result.current.unitsCache.size).toBeGreaterThan(0)
      })

      await result.current.loadUnit('MLA', 'tank')
      await result.current.loadUnit('MLA', 'bot')

      // All units from the index are cached (tank, bot, air_fighter, vehicle_factory, sea_mine = 5 units)
      // The units are embedded in the index, so all are cached when index loads
      await waitFor(() => {
        expect(result.current.unitsCache.size).toBe(5)
      })

      // Verify specific units are accessible
      expect(result.current.unitsCache.get('MLA:tank')).toEqual(mockTankUnit)
      expect(result.current.unitsCache.get('MLA:bot')).toEqual(mockBotUnit)
    })

    it('should throw error on load failure', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      await expect(result.current.loadUnit('MLA', 'invalid_unit')).rejects.toThrow()
    })
  })

  describe('getFaction', () => {
    it('should return faction metadata', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      const faction = result.current.getFaction('MLA')
      expect(faction).toEqual(mockMLAMetadata)
    })

    it('should return undefined for unknown faction', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      const faction = result.current.getFaction('Unknown')
      expect(faction).toBeUndefined()
    })
  })

  describe('getFactionIndex', () => {
    it('should return faction index if loaded', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      await result.current.loadFaction('MLA')

      // Wait for index to be loaded
      await waitFor(() => {
        const index = result.current.getFactionIndex('MLA')
        expect(index).toEqual(mockMLAIndex)
      })
    })

    it('should return undefined if not loaded', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      const index = result.current.getFactionIndex('MLA')
      expect(index).toBeUndefined()
    })
  })

  describe('getUnit', () => {
    it('should return cached unit', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      // Load faction index first (required before loadUnit)
      await result.current.loadFaction('MLA')

      // Wait for units cache to be populated
      await waitFor(() => {
        expect(result.current.unitsCache.size).toBeGreaterThan(0)
      })

      await result.current.loadUnit('MLA', 'tank')

      // Wait for unit to be cached
      await waitFor(() => {
        const unit = result.current.getUnit('MLA:tank')
        expect(unit).toEqual(mockTankUnit)
      })
    })

    it('should return undefined if not cached', async () => {
      const { result } = renderHook(() => useFactionContext(), {
        wrapper: FactionProvider
      })

      await waitFor(() => {
        expect(result.current.factionsLoading).toBe(false)
      })

      const unit = result.current.getUnit('MLA:tank')
      expect(unit).toBeUndefined()
    })
  })
})
