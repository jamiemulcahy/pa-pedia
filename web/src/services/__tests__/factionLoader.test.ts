import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import {
  discoverFactions,
  loadFactionMetadata,
  loadFactionIndex,
  getUnitIconPath,
  getUnitIconPathFromImage,
  loadAllFactionMetadata
} from '../factionLoader'
import {
  mockMLAMetadata,
  mockLegionMetadata,
  mockMLAIndex,
  createMockFetchResponse,
  setupMockFetch
} from '@/tests/mocks/factionData'

type MockFetch = Mock<[input: string | URL | Request, init?: RequestInit], Promise<Response>>

describe('factionLoader', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('discoverFactions', () => {
    it('should return list of available factions', async () => {
      const factions = await discoverFactions()
      expect(factions).toEqual(['MLA', 'Legion'])
    })

    it('should return an array', async () => {
      const factions = await discoverFactions()
      expect(Array.isArray(factions)).toBe(true)
    })
  })

  describe('loadFactionMetadata', () => {
    it('should fetch and parse MLA metadata', async () => {
      const metadata = await loadFactionMetadata('MLA')
      expect(metadata).toEqual(mockMLAMetadata)
    })

    it('should fetch and parse Legion metadata', async () => {
      const metadata = await loadFactionMetadata('Legion')
      expect(metadata).toEqual(mockLegionMetadata)
    })

    it('should fetch from correct URL', async () => {
      await loadFactionMetadata('MLA')
      expect(global.fetch).toHaveBeenCalledWith('/factions/MLA/metadata.json')
    })

    it('should throw error for 404 with helpful message', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(createMockFetchResponse(null, false, 404))
      ) as unknown as MockFetch

      await expect(loadFactionMetadata('Invalid')).rejects.toThrow(
        "Faction 'Invalid' not found. Please generate faction data using the CLI."
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as unknown as MockFetch

      await expect(loadFactionMetadata('MLA')).rejects.toThrow('Network error')
    })
  })

  describe('loadFactionIndex', () => {
    it('should fetch and parse faction index', async () => {
      const index = await loadFactionIndex('MLA')
      expect(index).toEqual(mockMLAIndex)
    })

    it('should return units array', async () => {
      const index = await loadFactionIndex('MLA')
      expect(Array.isArray(index.units)).toBe(true)
      expect(index.units.length).toBeGreaterThan(0)
    })

    it('should fetch from correct URL', async () => {
      await loadFactionIndex('MLA')
      expect(global.fetch).toHaveBeenCalledWith('/factions/MLA/units.json')
    })

    it('should throw error for failed fetch', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(createMockFetchResponse(null, false))
      ) as unknown as MockFetch

      await expect(loadFactionIndex('Invalid')).rejects.toThrow(
        'Failed to load faction index for Invalid'
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as unknown as MockFetch

      await expect(loadFactionIndex('MLA')).rejects.toThrow('Network error')
    })
  })

  describe('getUnitIconPath', () => {
    it('should return correct icon path for unit', () => {
      const iconPath = getUnitIconPath('MLA', 'tank')
      expect(iconPath).toBe('/factions/MLA/units/tank/tank_icon_buildbar.png')
    })

    it('should work with different faction IDs', () => {
      const iconPath = getUnitIconPath('Legion', 'bot')
      expect(iconPath).toBe('/factions/Legion/units/bot/bot_icon_buildbar.png')
    })

    it('should handle unit IDs with underscores', () => {
      const iconPath = getUnitIconPath('MLA', 'air_fighter')
      expect(iconPath).toBe('/factions/MLA/units/air_fighter/air_fighter_icon_buildbar.png')
    })

    it('should be a pure function (no side effects)', () => {
      const path1 = getUnitIconPath('MLA', 'tank')
      const path2 = getUnitIconPath('MLA', 'tank')
      expect(path1).toBe(path2)
    })
  })

  describe('getUnitIconPathFromImage', () => {
    it('should return correct path from image field', () => {
      const iconPath = getUnitIconPathFromImage('MLA', 'assets/pa/units/land/tank/tank_icon_buildbar.png')
      expect(iconPath).toBe('/factions/MLA/assets/pa/units/land/tank/tank_icon_buildbar.png')
    })

    it('should work with different faction IDs', () => {
      const iconPath = getUnitIconPathFromImage('Legion', 'assets/pa/units/air/fighter/fighter_icon_buildbar.png')
      expect(iconPath).toBe('/factions/Legion/assets/pa/units/air/fighter/fighter_icon_buildbar.png')
    })

    it('should handle empty image path', () => {
      const iconPath = getUnitIconPathFromImage('MLA', '')
      expect(iconPath).toBe('/factions/MLA/')
    })

    it('should be a pure function (no side effects)', () => {
      const path1 = getUnitIconPathFromImage('MLA', 'assets/pa/units/land/tank/tank_icon_buildbar.png')
      const path2 = getUnitIconPathFromImage('MLA', 'assets/pa/units/land/tank/tank_icon_buildbar.png')
      expect(path1).toBe(path2)
    })
  })

  describe('loadAllFactionMetadata', () => {
    it('should load metadata for all factions', async () => {
      const metadataMap = await loadAllFactionMetadata()
      expect(metadataMap.size).toBe(2)
      expect(metadataMap.has('MLA')).toBe(true)
      expect(metadataMap.has('Legion')).toBe(true)
    })

    it('should map by folder name, not identifier', async () => {
      const metadataMap = await loadAllFactionMetadata()
      const mlaMetadata = metadataMap.get('MLA')
      expect(mlaMetadata).toBeDefined()
      expect(mlaMetadata?.identifier).toBe('mla')
    })

    it('should handle partial failures gracefully', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString()
        if (urlString.includes('MLA')) {
          return Promise.resolve(createMockFetchResponse(mockMLAMetadata))
        }
        return Promise.resolve(createMockFetchResponse(null, false))
      }) as unknown as MockFetch

      const metadataMap = await loadAllFactionMetadata()
      expect(metadataMap.size).toBe(1)
      expect(metadataMap.has('MLA')).toBe(true)
      expect(metadataMap.has('Legion')).toBe(false)
    })

    it('should return Map instance', async () => {
      const metadataMap = await loadAllFactionMetadata()
      expect(metadataMap instanceof Map).toBe(true)
    })

    it('should call fetch for each faction', async () => {
      await loadAllFactionMetadata()
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should return empty map when all factions are not found (404)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(createMockFetchResponse(null, false, 404))
      ) as unknown as MockFetch

      const metadataMap = await loadAllFactionMetadata()
      expect(metadataMap.size).toBe(0)
      expect(metadataMap instanceof Map).toBe(true)
    })

    it('should throw error for unexpected errors (not 404)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(createMockFetchResponse(null, false, 500))
      ) as unknown as MockFetch

      await expect(loadAllFactionMetadata()).rejects.toThrow()
    })
  })
})
