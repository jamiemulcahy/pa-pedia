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

// Mock the assetUrlManager
const mockGetAssetUrl = vi.fn()
const mockReleaseAssetUrl = vi.fn()

vi.mock('@/services/assetUrlManager', () => ({
  getAssetUrl: (...args: unknown[]) => mockGetAssetUrl(...args),
  releaseAssetUrl: (...args: unknown[]) => mockReleaseAssetUrl(...args)
}))

describe('useUnitIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLocalFaction.mockReturnValue(false)
    // Default: resolve with a URL
    mockGetAssetUrl.mockResolvedValue('/factions/MLA/assets/icon.png')
  })

  it('should return undefined for undefined imagePath', () => {
    const { result } = renderHook(() => useUnitIcon('MLA', undefined))

    expect(result.current.iconUrl).toBeUndefined()
    expect(result.current.loading).toBe(false)
    expect(mockGetAssetUrl).not.toHaveBeenCalled()
  })

  it('should return undefined for empty imagePath', () => {
    const { result } = renderHook(() => useUnitIcon('MLA', ''))

    expect(result.current.iconUrl).toBeUndefined()
    expect(result.current.loading).toBe(false)
    expect(mockGetAssetUrl).not.toHaveBeenCalled()
  })

  it('should load URL for non-local faction', async () => {
    mockIsLocalFaction.mockReturnValue(false)
    mockGetAssetUrl.mockResolvedValue('/factions/MLA/assets/pa/units/tank/tank_icon.png')

    const { result } = renderHook(() =>
      useUnitIcon('MLA', 'assets/pa/units/tank/tank_icon.png')
    )

    // Initially loading
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBe('/factions/MLA/assets/pa/units/tank/tank_icon.png')
    expect(mockGetAssetUrl).toHaveBeenCalledWith(
      'MLA',
      'assets/pa/units/tank/tank_icon.png',
      false
    )
  })

  it('should load blob URL for local faction', async () => {
    mockIsLocalFaction.mockReturnValue(true)
    mockGetAssetUrl.mockResolvedValue('blob:http://localhost/test-blob')

    const { result } = renderHook(() =>
      useUnitIcon('LocalFaction', 'assets/pa/units/tank/tank_icon.png')
    )

    // Initially loading
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBe('blob:http://localhost/test-blob')
    expect(mockGetAssetUrl).toHaveBeenCalledWith(
      'LocalFaction',
      'assets/pa/units/tank/tank_icon.png',
      true
    )
  })

  it('should return undefined when asset not found', async () => {
    mockIsLocalFaction.mockReturnValue(true)
    mockGetAssetUrl.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useUnitIcon('LocalFaction', 'assets/missing.png')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBeUndefined()
  })

  it('should handle errors when loading asset', async () => {
    mockIsLocalFaction.mockReturnValue(true)
    mockGetAssetUrl.mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() =>
      useUnitIcon('LocalFaction', 'assets/error.png')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.iconUrl).toBeUndefined()
    expect(result.current.error).toBeDefined()
  })

  it('should update when factionId changes', async () => {
    mockIsLocalFaction.mockReturnValue(false)
    mockGetAssetUrl
      .mockResolvedValueOnce('/factions/MLA/assets/icon.png')
      .mockResolvedValueOnce('/factions/Legion/assets/icon.png')

    const { result, rerender } = renderHook(
      ({ factionId }) => useUnitIcon(factionId, 'assets/icon.png'),
      { initialProps: { factionId: 'MLA' } }
    )

    await waitFor(() => {
      expect(result.current.iconUrl).toBe('/factions/MLA/assets/icon.png')
    })

    rerender({ factionId: 'Legion' })

    await waitFor(() => {
      expect(result.current.iconUrl).toBe('/factions/Legion/assets/icon.png')
    })
  })

  it('should update when imagePath changes', async () => {
    mockIsLocalFaction.mockReturnValue(false)
    mockGetAssetUrl
      .mockResolvedValueOnce('/factions/MLA/assets/icon1.png')
      .mockResolvedValueOnce('/factions/MLA/assets/icon2.png')

    const { result, rerender } = renderHook(
      ({ imagePath }) => useUnitIcon('MLA', imagePath),
      { initialProps: { imagePath: 'assets/icon1.png' } }
    )

    await waitFor(() => {
      expect(result.current.iconUrl).toBe('/factions/MLA/assets/icon1.png')
    })

    rerender({ imagePath: 'assets/icon2.png' })

    await waitFor(() => {
      expect(result.current.iconUrl).toBe('/factions/MLA/assets/icon2.png')
    })
  })

  it('should release URL on unmount', async () => {
    mockIsLocalFaction.mockReturnValue(false)
    mockGetAssetUrl.mockResolvedValue('/factions/MLA/assets/icon.png')

    const { result, unmount } = renderHook(() =>
      useUnitIcon('MLA', 'assets/icon.png')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    unmount()

    expect(mockReleaseAssetUrl).toHaveBeenCalledWith('MLA', 'assets/icon.png')
  })
})
