import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  discoverFactions,
  loadFactionMetadata,
  loadFactionIndex,
  loadUnitResolved,
  getUnitIconPath,
  loadAllFactionMetadata
} from '../factionLoader'
import {
  mockMLAMetadata,
  mockLegionMetadata,
  mockMLAIndex,
  mockTankUnit,
  createMockFetchResponse,
  setupMockFetch
} from '@/tests/mocks/factionData'

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

    it('should throw error for failed fetch', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(createMockFetchResponse(null, false))
      ) as any

      await expect(loadFactionMetadata('Invalid')).rejects.toThrow(
        'Failed to load faction metadata for Invalid'
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as any

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
      ) as any

      await expect(loadFactionIndex('Invalid')).rejects.toThrow(
        'Failed to load faction index for Invalid'
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as any

      await expect(loadFactionIndex('MLA')).rejects.toThrow('Network error')
    })
  })

  describe('loadUnitResolved', () => {
    it('should fetch and parse unit resolved data', async () => {
      const unit = await loadUnitResolved('MLA', 'tank')
      expect(unit).toEqual(mockTankUnit)
    })

    it('should fetch from correct URL', async () => {
      await loadUnitResolved('MLA', 'tank')
      expect(global.fetch).toHaveBeenCalledWith(
        '/factions/MLA/units/tank/tank_resolved.json'
      )
    })

    it('should return complete unit specification', async () => {
      const unit = await loadUnitResolved('MLA', 'tank')
      expect(unit).toHaveProperty('identifier')
      expect(unit).toHaveProperty('displayName')
      expect(unit).toHaveProperty('specs')
      expect(unit).toHaveProperty('unitTypes')
    })

    it('should throw error for failed fetch', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(createMockFetchResponse(null, false))
      ) as any

      await expect(loadUnitResolved('MLA', 'invalid')).rejects.toThrow(
        'Failed to load unit invalid for faction MLA'
      )
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      ) as any

      await expect(loadUnitResolved('MLA', 'tank')).rejects.toThrow('Network error')
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
      }) as any

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
  })
})
