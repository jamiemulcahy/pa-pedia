import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUnitIcon } from '../useUnitIcon'

// Mock the FactionContext
const mockIsLocalFaction = vi.fn()

vi.mock('@/contexts/FactionContext', () => ({
  useFactionContext: () => ({
    isLocalFaction: mockIsLocalFaction
  })
}))

// Mock the factionLoader
const mockGetLocalAssetUrl = vi.fn()

vi.mock('@/services/factionLoader', () => ({
  getUnitIconPathFromImage: (factionId: string, imagePath: string) =>
    `/factions/${factionId}/${imagePath}`,
  getLocalAssetUrl: (...args: unknown[]) => mockGetLocalAssetUrl(...args)
}))

describe('useUnitIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLocalFaction.mockReturnValue(false)
  })

  it('should return empty string for undefined imagePath', () => {
    const { result } = renderHook(() => useUnitIcon('MLA', undefined))

    expect(result.current.iconUrl).toBe('')
    expect(result.current.loading).toBe(false)
  })

  it('should return empty string for empty imagePath', () => {
    const { result } = renderHook(() => useUnitIcon('MLA', ''))

    expect(result.current.iconUrl).toBe('')
    expect(result.current.loading).toBe(false)
  })

  it('should return static URL for non-local faction', () => {
    mockIsLocalFaction.mockReturnValue(false)

    const { result } = renderHook(() =>
      useUnitIcon('MLA', 'assets/pa/units/tank/tank_icon.png')
    )

    expect(result.current.iconUrl).toBe('/factions/MLA/assets/pa/units/tank/tank_icon.png')
    expect(result.current.loading).toBe(false)
  })

  it('should load blob URL for local faction', async () => {
    mockIsLocalFaction.mockReturnValue(true)
    mockGetLocalAssetUrl.mockResolvedValue('blob:http://localhost/test-blob')

    const { result } = renderHook(() =>
      useUnitIcon('LocalFaction', 'assets/pa/units/tank/tank_icon.png')
    )

    // Initially loading
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBe('blob:http://localhost/test-blob')
    expect(mockGetLocalAssetUrl).toHaveBeenCalledWith(
      'LocalFaction',
      'assets/pa/units/tank/tank_icon.png'
    )
  })

  it('should return empty string when local asset not found', async () => {
    mockIsLocalFaction.mockReturnValue(true)
    mockGetLocalAssetUrl.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useUnitIcon('LocalFaction', 'assets/missing.png')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBe('')
  })

  it('should handle errors when loading local asset', async () => {
    mockIsLocalFaction.mockReturnValue(true)
    mockGetLocalAssetUrl.mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() =>
      useUnitIcon('LocalFaction', 'assets/error.png')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBe('')
    expect(result.current.error).toBeDefined()
  })

  it('should update when factionId changes', () => {
    mockIsLocalFaction.mockReturnValue(false)

    const { result, rerender } = renderHook(
      ({ factionId }) => useUnitIcon(factionId, 'assets/icon.png'),
      { initialProps: { factionId: 'MLA' } }
    )

    expect(result.current.iconUrl).toBe('/factions/MLA/assets/icon.png')

    rerender({ factionId: 'Legion' })

    expect(result.current.iconUrl).toBe('/factions/Legion/assets/icon.png')
  })

  it('should update when imagePath changes', () => {
    mockIsLocalFaction.mockReturnValue(false)

    const { result, rerender } = renderHook(
      ({ imagePath }) => useUnitIcon('MLA', imagePath),
      { initialProps: { imagePath: 'assets/icon1.png' } }
    )

    expect(result.current.iconUrl).toBe('/factions/MLA/assets/icon1.png')

    rerender({ imagePath: 'assets/icon2.png' })

    expect(result.current.iconUrl).toBe('/factions/MLA/assets/icon2.png')
  })
})
